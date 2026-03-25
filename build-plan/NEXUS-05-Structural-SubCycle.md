# NEXUS — Archivo 05: Phase 3 — Structural Sub-Cycle
## Schema Profiler + Drift Detector + M2 Structural Agent
### Semanas 6–9 · Equipo AI & Knowledge · PARALELO con Phase 4 (M2 Executive)
### Depende de: NEXUS-04-M1-Spark-CDM-Router.md

---

## Tabla de Contenidos

1. [Qué es el Structural Sub-Cycle](#1-qué-es-el-structural-sub-cycle)
2. [P3-STRUCT-01 — Schema Profiler](#2-p3-struct-01--schema-profiler)
3. [P3-STRUCT-02 — DAG Structural Cycle (Airflow)](#3-p3-struct-02--dag-structural-cycle-airflow)
4. [P3-STRUCT-03 — Schema Drift Detector](#4-p3-struct-03--schema-drift-detector)
5. [P3-STRUCT-04 — M2 Structural Agent (LLM)](#5-p3-struct-04--m2-structural-agent-llm)
6. [Prompt Template del Structural Agent](#6-prompt-template-del-structural-agent)
7. [Flujo de Propuesta → Governance](#7-flujo-de-propuesta--governance)
8. [Acceptance Criteria Structural Cycle](#8-acceptance-criteria-structural-cycle)

---

## 1. Qué es el Structural Sub-Cycle

El Structural Sub-Cycle es el mecanismo mediante el cual NEXUS aprende y evoluciona su CDM.
Cuando llegan datos nuevos de sistemas fuente, el sistema:
1. Crea un perfil del schema (tipos, distribuciones, nulos)
2. Compara contra el snapshot anterior
3. Si hay deriva → lanza el M2 Structural Agent (LLM)
4. El M2 Structural Agent propone actualización al CDM
5. La propuesta va a governance para aprobación humana
6. Si se aprueba → nueva versión CDM publicada a todos los módulos

```
m1.int.source_schema_extracted  (publicado por Spark Job en Archivo 04)
         │
         ▼
[Schema Profiler]
  → Calcula FieldProfile por campo (tipo, distribución, nulos)
  → Guarda en nexus_system.schema_snapshots
  → Publica m1.int.structural_cycle_triggered si:
      a) Primera vez que se ve este schema, o
      b) Drift detectado (nuevo campo, tipo cambiado, nulos > umbral)
         │
         ▼
m1.int.structural_cycle_triggered
         │
         ▼
[M2 Structural Agent] (LLM — Anthropic Claude)
  → Recibe SourceKnowledgeArtifact con todos los field profiles
  → Genera ProposedInterpretation:
      - entity_type sugerido
      - mapeos campo→CDM con confidence
      - justificación en texto
  → Publica nexus.cdm.extension_proposed
         │
         ▼
nexus.cdm.extension_proposed
         │
         ▼
[M4 Governance Queue] (Archivo 07) — revisión humana
         │
   aprobado      rechazado
      │               │
      ▼               ▼
nexus.cdm.     nexus.cdm.
version_       extension_
published      rejected
```

---

## 2. P3-STRUCT-01 — Schema Profiler

**Owner:** ML-Engineer  
**Depende de:** `m1.int.source_schema_extracted` activo (Archivo 04)  
**Duración:** Semana 6–7  
**Archivo:** `m2/structural/schema_profiler.py`

### schemas.py — SourceKnowledgeArtifact y ProposedInterpretation

```python
# nexus_core/schemas.py
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any


@dataclass
class FieldProfile:
    """Perfil estadístico de un campo del schema fuente."""
    field_name: str
    inferred_type: str          # "string", "integer", "decimal", "datetime", "boolean"
    nullable: bool
    null_percentage: float      # 0.0 a 100.0
    unique_percentage: float    # Cardinalidad relativa
    sample_values: List[str]    # Máximo 5 valores representativos
    min_value: Optional[str] = None
    max_value: Optional[str] = None
    avg_length: Optional[float] = None  # Para strings


@dataclass
class SourceKnowledgeArtifact:
    """
    Representa el conocimiento extraído de un sistema fuente.
    Es el input principal para el M2 Structural Agent.
    """
    artifact_id: str
    tenant_id: str
    source_system: str          # "postgresql", "salesforce", etc.
    source_table: str           # Nombre original de la tabla
    row_count: int
    field_profiles: List[FieldProfile]
    extracted_at: str           # ISO8601
    cdm_version: str            # Versión CDM activa del tenant
    prior_entity_type: Optional[str] = None   # Si ya se infirió antes
    prior_mappings: Optional[Dict[str, str]] = None  # {source_field: cdm_field}


@dataclass
class FieldMapping:
    """Un mapeo propuesto de campo fuente a campo CDM."""
    source_field: str
    cdm_entity: str
    cdm_field: str
    confidence: float           # 0.0 a 1.0
    reasoning: str              # Justificación del LLM
    tier: int                   # 1, 2, o 3


@dataclass
class ProposedInterpretation:
    """
    Propuesta del M2 Structural Agent para actualizar el CDM.
    Se envía a governance para aprobación humana.
    """
    proposal_id: str
    artifact_id: str
    tenant_id: str
    proposed_entity_type: str
    field_mappings: List[FieldMapping]
    new_fields_proposed: List[str]   # Campos CDM que no existen aún → CDM extension
    justification: str               # Texto del razonamiento del agente
    confidence_overall: float
    requires_cdm_extension: bool
    cdm_version_base: str
```

### schema_profiler.py — Worker completo

```python
# m2/structural/schema_profiler.py
"""
Schema Profiler — consume source_schema_extracted y construye SourceKnowledgeArtifact.

Para cada mensaje:
1. Parsea el schema extraído por Spark
2. Calcula estadísticas adicionales (unique%, avg_length, etc.)
3. Compara con snapshot anterior (Schema Drift Detector)
4. Si hay drift o es nuevo → publica structural_cycle_triggered
5. Guarda snapshot en nexus_system.schema_snapshots
"""
import asyncio
import json
import logging
import os
import uuid
from typing import Optional
import asyncpg
from prometheus_client import Counter, Gauge, start_http_server

from nexus_core.messaging import NexusMessage, NexusProducer, NexusConsumer
from nexus_core.tenant import set_tenant, TenantContext
from nexus_core.topics import CrossModuleTopicNamer as T
from nexus_core.db import get_tenant_scoped_connection
from nexus_core.schemas import FieldProfile, SourceKnowledgeArtifact

logger = logging.getLogger(__name__)

schemas_profiled = Counter(
    "m2_structural_schemas_profiled_total",
    "Schemas procesados por el profiler",
    ["tenant_id"],
)
drift_detected = Counter(
    "m2_structural_drift_detected_total",
    "Drifts de schema detectados",
    ["tenant_id", "drift_type"],
)
cycles_triggered = Counter(
    "m2_structural_cycles_triggered_total",
    "Ciclos estructurales disparados",
    ["tenant_id"],
)


class SchemaProfiler:
    """
    Construye perfiles de schema y detecta drift.
    Consumer del topic m1.int.source_schema_extracted.
    """

    # Umbrales de drift
    NULL_PCT_DRIFT_THRESHOLD = 10.0   # Si nulos cambian más de 10%
    UNIQUE_PCT_DRIFT_THRESHOLD = 20.0

    def __init__(self):
        bootstrap = os.environ["KAFKA_BOOTSTRAP_SERVERS"]
        self._consumer = NexusConsumer(
            bootstrap_servers=bootstrap,
            group_id="m2-schema-profilers",
            topics=[T.STATIC.SOURCE_SCHEMA_EXTRACTED],
        )
        self._producer = NexusProducer(bootstrap, source_module="m2-schema-profiler")
        self._db_pool: asyncpg.Pool = None
        self._drift_detector = None

    async def start(self) -> None:
        self._db_pool = await asyncpg.create_pool(dsn=os.environ["NEXUS_DB_DSN"])
        from m2.structural.schema_drift_detector import SchemaDriftDetector
        self._drift_detector = SchemaDriftDetector(self._db_pool)
        start_http_server(9094)
        logger.info("SchemaProfiler iniciado.")

        while True:
            await self._process_one()

    async def _process_one(self) -> None:
        msg = self._consumer.poll(timeout=2.0)
        if msg is None:
            return

        tenant_id = msg.tenant_id
        payload = msg.payload
        set_tenant(TenantContext(tenant_id=tenant_id, plan="professional", cdm_version="1.0.0"))

        try:
            # Construir SourceKnowledgeArtifact
            artifact = await self._build_artifact(payload, tenant_id)

            # Verificar snapshot anterior
            prior_snapshot = await self._get_prior_snapshot(
                tenant_id,
                payload["connector_id"],
                payload["source_table"],
            )

            drifts = []
            is_new = prior_snapshot is None

            if not is_new:
                drifts = self._drift_detector.detect(artifact, prior_snapshot)

            # Guardar nuevo snapshot
            await self._save_snapshot(tenant_id, payload["connector_id"], artifact)

            # Trigger si es nuevo o hay drift
            if is_new or drifts:
                trigger_reason = "new_schema" if is_new else f"drift:{','.join(d.drift_type for d in drifts)}"
                await self._trigger_structural_cycle(artifact, msg, trigger_reason)
                cycles_triggered.labels(tenant_id=tenant_id).inc()

                for d in drifts:
                    drift_detected.labels(tenant_id=tenant_id, drift_type=d.drift_type).inc()

                logger.info(
                    f"Structural cycle triggered: tenant={tenant_id} "
                    f"table={payload['source_table']} reason={trigger_reason}"
                )

            schemas_profiled.labels(tenant_id=tenant_id).inc()
            self._consumer.commit(msg)

        except Exception as e:
            logger.error(f"Schema profiling fallido: {e}", exc_info=True)
            self._consumer.commit(msg)

    async def _build_artifact(self, payload: dict, tenant_id: str) -> SourceKnowledgeArtifact:
        """Construye el SourceKnowledgeArtifact desde el payload del mensaje."""
        field_profiles = []
        for fp in payload.get("field_profiles", []):
            # Calcular unique_percentage desde datos adicionales si disponible
            unique_pct = fp.get("unique_percentage", 0.0)
            field_profiles.append(FieldProfile(
                field_name=fp["field_name"],
                inferred_type=fp["inferred_type"],
                nullable=fp["nullable"],
                null_percentage=fp.get("null_percentage", 0.0),
                unique_percentage=unique_pct,
                sample_values=fp.get("sample_values", []),
                min_value=fp.get("min_value"),
                max_value=fp.get("max_value"),
                avg_length=fp.get("avg_length"),
            ))

        return SourceKnowledgeArtifact(
            artifact_id=str(uuid.uuid4()),
            tenant_id=tenant_id,
            source_system=payload["source_system"],
            source_table=payload["source_table"],
            row_count=payload.get("row_count", 0),
            field_profiles=field_profiles,
            extracted_at=payload.get("extracted_at", ""),
            cdm_version=payload.get("cdm_version", "1.0.0"),
        )

    async def _get_prior_snapshot(
        self, tenant_id: str, connector_id: str, source_table: str
    ) -> Optional[SourceKnowledgeArtifact]:
        """Recupera el snapshot más reciente de este schema."""
        async with await get_tenant_scoped_connection(self._db_pool, tenant_id) as conn:
            row = await conn.fetchrow("""
                SELECT artifact FROM nexus_system.schema_snapshots
                WHERE tenant_id = $1
                ORDER BY created_at DESC
                LIMIT 1
            """, tenant_id)

        if not row:
            return None

        artifact_data = row["artifact"] if isinstance(row["artifact"], dict) else json.loads(row["artifact"])
        fps = [FieldProfile(**fp) for fp in artifact_data.get("field_profiles", [])]
        return SourceKnowledgeArtifact(
            artifact_id=artifact_data.get("artifact_id", ""),
            tenant_id=tenant_id,
            source_system=artifact_data.get("source_system", ""),
            source_table=artifact_data.get("source_table", ""),
            row_count=artifact_data.get("row_count", 0),
            field_profiles=fps,
            extracted_at=artifact_data.get("extracted_at", ""),
            cdm_version=artifact_data.get("cdm_version", "1.0.0"),
        )

    async def _save_snapshot(
        self, tenant_id: str, connector_id: str, artifact: SourceKnowledgeArtifact
    ) -> None:
        """Guarda el snapshot del schema en PostgreSQL."""
        import dataclasses
        artifact_dict = dataclasses.asdict(artifact)
        async with await get_tenant_scoped_connection(self._db_pool, tenant_id) as conn:
            await conn.fetchrow("""
                SELECT connector_id FROM nexus_system.connectors
                WHERE tenant_id = $1 AND connector_id = $2
            """, tenant_id, connector_id)

            await conn.execute("""
                INSERT INTO nexus_system.schema_snapshots
                    (tenant_id, connector_id, artifact)
                SELECT $1, connector_id, $3
                FROM nexus_system.connectors
                WHERE tenant_id = $1 AND connector_id = $2
            """, tenant_id, connector_id, json.dumps(artifact_dict))

    async def _trigger_structural_cycle(
        self, artifact: SourceKnowledgeArtifact, original: NexusMessage, reason: str
    ) -> None:
        """Publica structural_cycle_triggered para que el Structural Agent lo procese."""
        import dataclasses
        trigger_msg = NexusMessage(
            topic=T.STATIC.STRUCTURAL_CYCLE_TRIGGERED,
            tenant_id=artifact.tenant_id,
            event_type="structural_cycle_triggered",
            payload={
                **dataclasses.asdict(artifact),
                "trigger_reason": reason,
            },
            correlation_id=original.correlation_id,
            trace_id=original.trace_id,
        )
        self._producer.publish(trigger_msg, partition_key=artifact.tenant_id)
```

---

## 3. P3-STRUCT-02 — DAG Structural Cycle (Airflow)

```python
# dags/m1_structural_cycle.py
"""
DAG Airflow para el ciclo estructural de NEXUS.

Trigger: KafkaSensor en m1.int.structural_cycle_triggered
(el SchemaProfiler publica este topic cuando detecta drift o schema nuevo)

El DAG solo coordina — el M2 Structural Agent se ejecuta como worker separado.
"""
from datetime import datetime, timedelta
from airflow import DAG
from airflow.providers.apache.kafka.sensors.kafka import KafkaSensor
from airflow.operators.python import PythonOperator

default_args = {
    "owner": "nexus-ai-team",
    "retries": 2,
    "retry_delay": timedelta(minutes=5),
    "email_on_failure": True,
    "email": ["ai-alerts@mentis-consulting.be"],
}

with DAG(
    dag_id="m1_structural_cycle",
    default_args=default_args,
    description="Ciclo estructural — triggered por drift de schema o schema nuevo",
    schedule_interval=None,  # Event-driven
    start_date=datetime(2026, 3, 2),
    catchup=False,
    tags=["m2", "structural", "cdm"],
) as dag:

    # Sensor: espera mensaje en structural_cycle_triggered
    wait_for_structural_trigger = KafkaSensor(
        task_id="wait_for_structural_trigger",
        kafka_config_id="nexus_kafka",
        topics=["m1.int.structural_cycle_triggered"],
        apply_function="m2.airflow.handlers.process_structural_trigger",
        poll_timeout=5,
        poke_interval=30,
        timeout=3600 * 4,  # 4 horas máximo de espera
        mode="poke",
    )

    def notify_structural_agent(**context):
        """
        El M2 Structural Agent ya está corriendo como worker y consume
        structural_cycle_triggered directamente.
        Este task solo registra la ejecución en Airflow para visibilidad.
        """
        ti = context["task_instance"]
        artifact_data = ti.xcom_pull(task_ids="wait_for_structural_trigger")
        print(f"Structural cycle iniciado: tenant={artifact_data.get('tenant_id')}")
        return artifact_data

    log_execution = PythonOperator(
        task_id="log_structural_cycle",
        python_callable=notify_structural_agent,
        provide_context=True,
    )

    wait_for_structural_trigger >> log_execution
```

---

## 4. P3-STRUCT-03 — Schema Drift Detector

**Archivo:** `m2/structural/schema_drift_detector.py`

```python
# m2/structural/schema_drift_detector.py
"""
Schema Drift Detector — compara dos SourceKnowledgeArtifact y detecta cambios.

Tipos de drift:
  - new_field:       Campo que existe en nuevo pero no en anterior
  - removed_field:   Campo que existía antes pero ya no existe
  - type_changed:    Tipo de dato del campo cambió
  - null_spike:      Null% aumentó más del umbral
  - cardinality_drop: Unique% bajó significativamente (posible estandarización)
"""
import logging
from dataclasses import dataclass
from typing import List, Dict
import asyncpg
from nexus_core.schemas import SourceKnowledgeArtifact, FieldProfile

logger = logging.getLogger(__name__)

NULL_PCT_DRIFT_THRESHOLD = 10.0
UNIQUE_PCT_DRIFT_THRESHOLD = 25.0


@dataclass
class DriftEvent:
    drift_type: str         # "new_field", "removed_field", "type_changed", "null_spike"
    field_name: str
    old_value: str = None
    new_value: str = None
    severity: str = "medium"  # "low", "medium", "high"


class SchemaDriftDetector:

    def __init__(self, pool: asyncpg.Pool = None):
        self._pool = pool

    def detect(
        self,
        new_artifact: SourceKnowledgeArtifact,
        prior_artifact: SourceKnowledgeArtifact,
    ) -> List[DriftEvent]:
        """
        Compara dos artifacts y retorna lista de DriftEvents.
        Lista vacía = no hay drift.
        """
        drifts = []

        # Indexar campos por nombre
        prior_fields: Dict[str, FieldProfile] = {
            fp.field_name: fp for fp in prior_artifact.field_profiles
        }
        new_fields: Dict[str, FieldProfile] = {
            fp.field_name: fp for fp in new_artifact.field_profiles
        }

        # Campos nuevos
        added = set(new_fields.keys()) - set(prior_fields.keys())
        for field in added:
            drifts.append(DriftEvent(
                drift_type="new_field",
                field_name=field,
                old_value=None,
                new_value=new_fields[field].inferred_type,
                severity="medium",
            ))
            logger.info(f"Drift: campo nuevo '{field}' en {new_artifact.source_table}")

        # Campos eliminados
        removed = set(prior_fields.keys()) - set(new_fields.keys())
        for field in removed:
            drifts.append(DriftEvent(
                drift_type="removed_field",
                field_name=field,
                old_value=prior_fields[field].inferred_type,
                new_value=None,
                severity="high",  # Eliminar campo es más grave
            ))
            logger.warning(f"Drift: campo eliminado '{field}' en {new_artifact.source_table}")

        # Campos que existen en ambos
        common = set(prior_fields.keys()) & set(new_fields.keys())
        for field in common:
            prior = prior_fields[field]
            current = new_fields[field]

            # Cambio de tipo
            if prior.inferred_type != current.inferred_type:
                drifts.append(DriftEvent(
                    drift_type="type_changed",
                    field_name=field,
                    old_value=prior.inferred_type,
                    new_value=current.inferred_type,
                    severity="high",
                ))
                logger.warning(
                    f"Drift: tipo cambiado '{field}': "
                    f"{prior.inferred_type} → {current.inferred_type}"
                )

            # Spike de nulos
            null_delta = current.null_percentage - prior.null_percentage
            if null_delta > NULL_PCT_DRIFT_THRESHOLD:
                drifts.append(DriftEvent(
                    drift_type="null_spike",
                    field_name=field,
                    old_value=f"{prior.null_percentage:.1f}%",
                    new_value=f"{current.null_percentage:.1f}%",
                    severity="medium",
                ))

            # Drop de cardinalidad
            unique_delta = prior.unique_percentage - current.unique_percentage
            if unique_delta > UNIQUE_PCT_DRIFT_THRESHOLD:
                drifts.append(DriftEvent(
                    drift_type="cardinality_drop",
                    field_name=field,
                    old_value=f"{prior.unique_percentage:.1f}%",
                    new_value=f"{current.unique_percentage:.1f}%",
                    severity="low",
                ))

        logger.info(
            f"Drift detection: table={new_artifact.source_table} "
            f"drifts={len(drifts)} ({[d.drift_type for d in drifts]})"
        )
        return drifts
```

---

## 5. P3-STRUCT-04 — M2 Structural Agent (LLM)

**Owner:** ML-Engineer  
**Depende de:** LEAD-02 (Anthropic API key en Secrets Manager)  
**Duración:** Semana 7–9  
**Archivo:** `m2/structural/structural_agent.py`

```python
# m2/structural/structural_agent.py
"""
M2 Structural Agent — usa Anthropic Claude para proponer mapeos CDM.

Consume: m1.int.structural_cycle_triggered
Publica: nexus.cdm.extension_proposed

El agente:
1. Lee el SourceKnowledgeArtifact del mensaje
2. Carga el CDM schema actual del tenant
3. Llama al LLM con el prompt template
4. Parsea la respuesta en ProposedInterpretation
5. Publica a nexus.cdm.extension_proposed
6. Inserta en nexus_system.governance_queue
"""
import asyncio
import json
import logging
import os
import uuid
from typing import Optional
import anthropic
import asyncpg
from prometheus_client import Counter, Histogram, start_http_server

from nexus_core.messaging import NexusMessage, NexusProducer, NexusConsumer
from nexus_core.tenant import set_tenant, TenantContext
from nexus_core.topics import CrossModuleTopicNamer as T
from nexus_core.db import get_tenant_scoped_connection
from nexus_core.schemas import SourceKnowledgeArtifact, ProposedInterpretation, FieldProfile, FieldMapping

logger = logging.getLogger(__name__)

llm_calls = Counter("m2_structural_llm_calls_total", "Llamadas LLM del structural agent", ["tenant_id", "outcome"])
llm_latency = Histogram("m2_structural_llm_latency_seconds", "Latencia llamadas LLM", buckets=[1, 5, 10, 30, 60])
proposals_generated = Counter("m2_structural_proposals_generated_total", "Propuestas generadas", ["tenant_id"])


class M2StructuralAgent:
    """
    Agente LLM para inferencia de mapeos CDM desde schemas fuente.
    
    CRÍTICO: Este es el ÚNICO componente de M1 pipeline que usa LLM.
    El Spark Job, CDM Mapper y AI Store Router NO usan LLM.
    """

    def __init__(self):
        bootstrap = os.environ["KAFKA_BOOTSTRAP_SERVERS"]
        self._consumer = NexusConsumer(
            bootstrap_servers=bootstrap,
            group_id="m2-structural-agents",
            topics=[T.STATIC.STRUCTURAL_CYCLE_TRIGGERED],
        )
        self._producer = NexusProducer(bootstrap, source_module="m2-structural-agent")
        self._anthropic = anthropic.Anthropic(api_key=self._load_anthropic_key())
        self._db_pool: asyncpg.Pool = None

    def _load_anthropic_key(self) -> str:
        """Lee la API key de Anthropic del secret montado. Nunca de env vars directamente."""
        secret_path = "/var/run/secrets/platform/anthropic/api_key"
        if os.path.exists(secret_path):
            with open(secret_path, "r") as f:
                return f.read().strip()
        # Fallback para desarrollo local
        return os.environ.get("ANTHROPIC_API_KEY", "")

    async def start(self) -> None:
        self._db_pool = await asyncpg.create_pool(dsn=os.environ["NEXUS_DB_DSN"])
        start_http_server(9095)
        logger.info("M2StructuralAgent iniciado.")

        while True:
            await self._process_one()

    async def _process_one(self) -> None:
        msg = self._consumer.poll(timeout=2.0)
        if msg is None:
            return

        tenant_id = msg.tenant_id
        set_tenant(TenantContext(tenant_id=tenant_id, plan="professional", cdm_version="1.0.0"))

        try:
            artifact = self._parse_artifact(msg.payload)
            cdm_schema = await self._load_cdm_schema(tenant_id)
            proposal = await self._generate_proposal(artifact, cdm_schema, msg)

            await self._save_to_governance(tenant_id, proposal)
            await self._publish_proposal(proposal, msg)

            proposals_generated.labels(tenant_id=tenant_id).inc()
            self._consumer.commit(msg)
            logger.info(
                f"Propuesta CDM generada: tenant={tenant_id} "
                f"table={artifact.source_table} confidence={proposal.confidence_overall:.2f}"
            )

        except Exception as e:
            logger.error(f"Structural agent fallido: {e}", exc_info=True)
            llm_calls.labels(tenant_id=tenant_id, outcome="error").inc()
            self._consumer.commit(msg)

    def _parse_artifact(self, payload: dict) -> SourceKnowledgeArtifact:
        """Deserializa el SourceKnowledgeArtifact del payload del mensaje."""
        fps = [FieldProfile(**fp) for fp in payload.get("field_profiles", [])]
        return SourceKnowledgeArtifact(
            artifact_id=payload.get("artifact_id", str(uuid.uuid4())),
            tenant_id=payload["tenant_id"],
            source_system=payload["source_system"],
            source_table=payload["source_table"],
            row_count=payload.get("row_count", 0),
            field_profiles=fps,
            extracted_at=payload.get("extracted_at", ""),
            cdm_version=payload.get("cdm_version", "1.0.0"),
        )

    async def _load_cdm_schema(self, tenant_id: str) -> dict:
        """Carga la versión CDM activa del tenant desde PostgreSQL."""
        async with await get_tenant_scoped_connection(self._db_pool, tenant_id) as conn:
            rows = await conn.fetch("""
                SELECT cdm_entity, cdm_field, source_system, source_field
                FROM nexus_system.cdm_mappings
                WHERE tenant_id = $1
                ORDER BY cdm_entity, cdm_field
            """, tenant_id)
        schema = {}
        for r in rows:
            entity = r["cdm_entity"]
            if entity not in schema:
                schema[entity] = {"fields": []}
            schema[entity]["fields"].append({
                "field": r["cdm_field"],
                "examples": [f"{r['source_system']}.{r['source_field']}"],
            })
        return schema

    async def _generate_proposal(
        self,
        artifact: SourceKnowledgeArtifact,
        cdm_schema: dict,
        original_msg: NexusMessage,
    ) -> ProposedInterpretation:
        """Llama al LLM con el prompt del Structural Agent."""
        prompt = self._build_prompt(artifact, cdm_schema)

        import time
        start_ts = time.perf_counter()

        response = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: self._anthropic.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=4096,
                messages=[{"role": "user", "content": prompt}],
                system=STRUCTURAL_AGENT_SYSTEM_PROMPT,
            )
        )

        latency = time.perf_counter() - start_ts
        llm_latency.observe(latency)
        llm_calls.labels(tenant_id=artifact.tenant_id, outcome="success").inc()
        logger.info(f"LLM respondió en {latency:.2f}s para table={artifact.source_table}")

        return self._parse_llm_response(response.content[0].text, artifact)

    def _build_prompt(self, artifact: SourceKnowledgeArtifact, cdm_schema: dict) -> str:
        """Construye el prompt para el LLM (ver sección 6 para el template completo)."""
        fields_desc = "\n".join([
            f"- {fp.field_name}: type={fp.inferred_type}, "
            f"null%={fp.null_percentage:.1f}, "
            f"sample={fp.sample_values[:3]}"
            for fp in artifact.field_profiles
        ])
        cdm_desc = json.dumps(cdm_schema, indent=2)

        return STRUCTURAL_AGENT_PROMPT_TEMPLATE.format(
            source_system=artifact.source_system,
            source_table=artifact.source_table,
            row_count=artifact.row_count,
            fields_description=fields_desc,
            cdm_schema=cdm_desc,
            cdm_version=artifact.cdm_version,
        )

    def _parse_llm_response(
        self, response_text: str, artifact: SourceKnowledgeArtifact
    ) -> ProposedInterpretation:
        """Parsea la respuesta JSON del LLM en ProposedInterpretation."""
        try:
            # LLM debe responder con JSON puro entre ```json y ```
            json_start = response_text.find("```json")
            json_end = response_text.rfind("```")
            if json_start >= 0 and json_end > json_start:
                json_str = response_text[json_start + 7 : json_end].strip()
            else:
                json_str = response_text.strip()

            data = json.loads(json_str)
            field_mappings = [FieldMapping(**m) for m in data.get("field_mappings", [])]

            return ProposedInterpretation(
                proposal_id=str(uuid.uuid4()),
                artifact_id=artifact.artifact_id,
                tenant_id=artifact.tenant_id,
                proposed_entity_type=data.get("entity_type", "unknown"),
                field_mappings=field_mappings,
                new_fields_proposed=data.get("new_fields_proposed", []),
                justification=data.get("justification", ""),
                confidence_overall=float(data.get("confidence_overall", 0.5)),
                requires_cdm_extension=bool(data.get("requires_cdm_extension", False)),
                cdm_version_base=artifact.cdm_version,
            )
        except Exception as e:
            logger.error(f"Error parseando respuesta LLM: {e}. Response: {response_text[:200]}")
            # Propuesta vacía como fallback
            return ProposedInterpretation(
                proposal_id=str(uuid.uuid4()),
                artifact_id=artifact.artifact_id,
                tenant_id=artifact.tenant_id,
                proposed_entity_type="unknown",
                field_mappings=[],
                new_fields_proposed=[],
                justification=f"LLM response parse error: {e}",
                confidence_overall=0.0,
                requires_cdm_extension=False,
                cdm_version_base=artifact.cdm_version,
            )

    async def _save_to_governance(
        self, tenant_id: str, proposal: ProposedInterpretation
    ) -> None:
        """Inserta la propuesta en nexus_system.governance_queue."""
        import dataclasses
        async with await get_tenant_scoped_connection(self._db_pool, tenant_id) as conn:
            await conn.execute("""
                INSERT INTO nexus_system.governance_queue
                    (proposal_id, tenant_id, proposal_type, status, payload)
                VALUES ($1, $2, 'cdm_interpretation', 'pending', $3)
            """,
                proposal.proposal_id,
                tenant_id,
                json.dumps(dataclasses.asdict(proposal)),
            )

    async def _publish_proposal(
        self, proposal: ProposedInterpretation, original: NexusMessage
    ) -> None:
        """Publica nexus.cdm.extension_proposed."""
        import dataclasses
        prop_msg = NexusMessage(
            topic=T.CDM.EXTENSION_PROPOSED,
            tenant_id=proposal.tenant_id,
            event_type="cdm_extension_proposed",
            payload=dataclasses.asdict(proposal),
            correlation_id=original.correlation_id,
            trace_id=original.trace_id,
        )
        self._producer.publish(prop_msg, partition_key=proposal.tenant_id)
```

---

## 6. Prompt Template del Structural Agent

```python
STRUCTURAL_AGENT_SYSTEM_PROMPT = """
You are NEXUS Structural Agent — an expert system for enterprise data ontology mapping.
Your role is to analyze database schemas from enterprise systems and propose how they 
map to the NEXUS Common Data Model (CDM).

CRITICAL RULES:
1. Respond ONLY with valid JSON wrapped in ```json ``` markers
2. Never hallucinate field names — only use fields that exist in the input
3. Confidence scores must be empirically justified by the field names and sample values
4. If you cannot determine a mapping with >0.5 confidence, say so explicitly
5. Propose CDM extensions only when the data clearly represents something not in the current CDM
"""

STRUCTURAL_AGENT_PROMPT_TEMPLATE = """
## Source Schema Analysis Request

**Source System:** {source_system}
**Source Table:** {source_table}
**Row Count:** {row_count:,}
**CDM Version:** {cdm_version}

## Fields Observed

{fields_description}

## Current CDM Schema

```json
{cdm_schema}
```

## Task

1. Determine the primary entity type this table represents 
   (party, transaction, product, employee, incident, or NEW if none fit)
2. For each source field, propose the best CDM entity.field mapping with confidence
3. Identify any fields that require a CDM extension (new CDM field not yet in schema)
4. Provide clear reasoning for your decisions

## Required Response Format

```json
{{
  "entity_type": "party|transaction|product|employee|incident|NEW_TYPE",
  "confidence_overall": 0.85,
  "field_mappings": [
    {{
      "source_field": "customer_name",
      "cdm_entity": "party",
      "cdm_field": "full_name",
      "confidence": 0.95,
      "reasoning": "Field name and string samples indicate person/company name",
      "tier": 1
    }},
    {{
      "source_field": "amount_eur",
      "cdm_entity": "transaction",
      "cdm_field": "amount_base_currency",
      "confidence": 0.80,
      "reasoning": "Currency suffix and decimal values indicate monetary amount",
      "tier": 2
    }}
  ],
  "new_fields_proposed": [
    "{{proposed_cdm_entity}}.{{proposed_new_field}}"
  ],
  "requires_cdm_extension": false,
  "justification": "This table represents customer master data from {source_system}. 
                    The presence of name, address, and contact fields strongly indicates 
                    a party entity type. Field confidence reflects naming clarity."
}}
```
"""
```

---

## 7. Flujo de Propuesta → Governance

Una vez que M2 Structural Agent publica `nexus.cdm.extension_proposed`:

```
nexus.cdm.extension_proposed
         │
         ▼
M4 Governance Queue API (Archivo 07)
  GET /api/governance/proposals
  → Human reviewer ve la propuesta en M6 UI (Archivo 08)
  
  Human puede:
  a) APPROVE: POST /api/governance/proposals/{id}/approve
              → Publica nexus.cdm.version_published
              → Todos los módulos consumen y actualizan su CDM version
              → CDMRegistryService.invalidate_cache(tenant_id) llamado

  b) REJECT:  POST /api/governance/proposals/{id}/reject
              → Publica nexus.cdm.extension_rejected
              → M2 Structural Agent puede reintentar con feedback

  c) MODIFY:  Human edita los mapeos antes de aprobar
              → Los mapeos editados se insertan directamente
```

### Invalidación de cache al publicar nueva versión

```python
# m4/event_handlers.py (se implementa en Archivo 07)
async def handle_version_published(msg: NexusMessage) -> None:
    """
    Cuando se publica nueva versión CDM:
    1. Insertar nuevos mapeos en nexus_system.cdm_mappings
    2. Invalidar cache del CDMRegistryService
    3. Actualizar nexus_system.cdm_versions con nueva versión
    """
    tenant_id = msg.tenant_id
    new_version = msg.payload["new_version"]
    mappings = msg.payload["approved_mappings"]
    
    async with await get_tenant_scoped_connection(pool, tenant_id) as conn:
        for m in mappings:
            await conn.execute("""
                INSERT INTO nexus_system.cdm_mappings 
                    (tenant_id, cdm_version, source_system, source_table, source_field,
                     cdm_entity, cdm_field, confidence, tier, approved_by, approved_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
                ON CONFLICT (tenant_id, source_system, source_table, source_field, cdm_version)
                DO UPDATE SET confidence = EXCLUDED.confidence, tier = EXCLUDED.tier
            """,
                tenant_id, new_version,
                m["source_system"], m["source_table"], m["source_field"],
                m["cdm_entity"], m["cdm_field"],
                m["confidence"], m["tier"], msg.payload.get("approved_by"),
            )
        
        await conn.execute("""
            UPDATE nexus_system.cdm_versions 
            SET status = 'active', published_at = NOW()
            WHERE version = $1 AND tenant_id = $2
        """, new_version, tenant_id)
    
    # Invalidar cache
    await cdm_registry.invalidate_cache(tenant_id)
    logger.info(f"CDM version {new_version} publicada para tenant={tenant_id}")
```

---

## 8. Acceptance Criteria Structural Cycle

### Schema Profiler

```bash
# Test 1: Primera vez que llega un schema → trigger
# (sin snapshot previo → siempre triggerear)
kubectl exec -n nexus-data nexus-kafka-kafka-0 -- \
  bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 \
  --topic m1.int.structural_cycle_triggered --from-beginning --max-messages 1 | \
  python -m json.tool | grep trigger_reason
# Expected: "trigger_reason": "new_schema"

# Test 2: Schema idéntico segunda vez → NO trigger
# (el profiler detecta que no hay drift y no publica)
kubectl exec -n nexus-data nexus-kafka-kafka-0 -- \
  bin/kafka-run-class.sh kafka.tools.GetOffsetShell \
  --broker-list localhost:9092 \
  --topic m1.int.structural_cycle_triggered --time -1
# Expected: offset no incrementó

# Test 3: Nuevo campo en schema → trigger con reason="drift:new_field"
# (añadir campo 'loyalty_points' a la tabla test_orders)
# Expected: trigger con "trigger_reason": "drift:new_field"

# Test 4: Schema snapshot guardado en BD
psql -c "SELECT source_table FROM nexus_system.schema_snapshots 
         WHERE tenant_id='test-alpha' ORDER BY created_at DESC LIMIT 1"
# Expected: tabla procesada recientemente
```

### SchemaDriftDetector

```python
# Test unitario
from m2.structural.schema_drift_detector import SchemaDriftDetector, DriftEvent
from nexus_core.schemas import SourceKnowledgeArtifact, FieldProfile

detector = SchemaDriftDetector()

prior = SourceKnowledgeArtifact(
    artifact_id="a1", tenant_id="t1", source_system="pg", source_table="orders",
    row_count=1000, field_profiles=[
        FieldProfile("id", "integer", False, 0.0, 100.0, ["1","2","3"]),
        FieldProfile("name", "string", True, 5.0, 90.0, ["Alice","Bob"]),
    ],
    extracted_at="2026-03-01T00:00:00Z", cdm_version="1.0.0"
)

# Test: nuevo campo
new_with_added = SourceKnowledgeArtifact(
    artifact_id="a2", tenant_id="t1", source_system="pg", source_table="orders",
    row_count=1010, field_profiles=[
        FieldProfile("id", "integer", False, 0.0, 100.0, ["1","2","3"]),
        FieldProfile("name", "string", True, 5.0, 90.0, ["Alice","Bob"]),
        FieldProfile("loyalty_points", "integer", True, 20.0, 50.0, ["100","200"]),  # NUEVO
    ],
    extracted_at="2026-03-02T00:00:00Z", cdm_version="1.0.0"
)
drifts = detector.detect(new_with_added, prior)
assert len(drifts) == 1
assert drifts[0].drift_type == "new_field"
assert drifts[0].field_name == "loyalty_points"
print("✅ new_field detectado correctamente")
```

### M2 Structural Agent

```bash
# Test 1: LLM responde con JSON válido
# Setup: tenant con schema_snapshots de res.partner de Odoo
# Expected: ProposedInterpretation con entity_type="party"

# Test 2: Propuesta insertada en governance_queue
psql -c "SELECT proposal_type, status FROM nexus_system.governance_queue 
         WHERE tenant_id='test-alpha' ORDER BY submitted_at DESC LIMIT 1"
# Expected: proposal_type='cdm_interpretation', status='pending'

# Test 3: nexus.cdm.extension_proposed publicado
kubectl exec -n nexus-data nexus-kafka-kafka-0 -- \
  bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 \
  --topic nexus.cdm.extension_proposed --from-beginning --max-messages 1 | \
  python -m json.tool | grep entity_type
# Expected: "proposed_entity_type": "party"

# Test 4: La API key de Anthropic NUNCA aparece en logs
kubectl logs -n nexus-app -l app=m2-structural-agent | grep -i "sk-ant\|api_key"
# Expected: cero líneas
```

---

*NEXUS Build Plan — Archivo 05 · Phase 3 Structural Sub-Cycle · Mentis Consulting · Marzo 2026*
