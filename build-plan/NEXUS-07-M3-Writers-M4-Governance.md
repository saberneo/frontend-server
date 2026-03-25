# NEXUS — Archivo 07: M3 Writers + M4 Governance + Temporal
## VectorWriter (Pinecone) + GraphWriter (Neo4j) + TimeSeriesWriter (TimescaleDB)
## + FastAPI Governance API + Temporal OnboardingWorkflow
### Semanas 8–12 · Equipo Platform & Backend
### Depende de: NEXUS-04 (ai_routing_decided activo) + NEXUS-05 (governance_queue tabla activa)

---

## Tabla de Contenidos

1. [M3 — AI Store Writers Overview](#1-m3--ai-store-writers-overview)
2. [M3-W1 — VectorWriter (Pinecone)](#2-m3-w1--vectorwriter-pinecone)
3. [M3-W2 — GraphWriter (Neo4j)](#3-m3-w2--graphwriter-neo4j)
4. [M3-W3 — TimeSeriesWriter (TimescaleDB)](#4-m3-w3--timeserieswriter-timescaledb)
5. [M3 — AIStoreWriteOrchestrator](#5-m3--aistorewriteorchestrator)
6. [M4 — Governance FastAPI](#6-m4--governance-fastapi)
7. [Temporal — OnboardingWorkflow](#7-temporal--onboardingworkflow)
8. [K8s Deployments M3 + M4](#8-k8s-deployments-m3--m4)
9. [Acceptance Criteria M3 + M4](#9-acceptance-criteria-m3--m4)

---

## 1. M3 — AI Store Writers Overview

```
m1.int.ai_routing_decided
        │
        ▼  (partitioned by tenant_id)
[AIStoreWriteOrchestrator]  — consumer group: m1-ai-store-writers
        │
        ├──→ entity_type = party       → VectorWriter + GraphWriter
        ├──→ entity_type = transaction → GraphWriter  + TimeSeriesWriter
        ├──→ entity_type = product     → VectorWriter
        ├──→ entity_type = employee    → VectorWriter + GraphWriter
        └──→ entity_type = incident    → VectorWriter + TimeSeriesWriter
        │
        ▼ (todos)
m1.int.ai_write_completed
```

**Reglas de routing (reproducidas desde NEXUS-04):**

| entity_type | Pinecone | Neo4j | TimescaleDB |
|---|---|---|---|
| party | ✅ | ✅ | ❌ |
| transaction | ❌ | ✅ | ✅ |
| product | ✅ | ❌ | ❌ |
| employee | ✅ | ✅ | ❌ |
| incident | ✅ | ❌ | ✅ |

**Convenciones de naming:**
- Pinecone index: `nexus-{tenant_id}-{entity_type}` (1 index por entity type por tenant)
- Pinecone vector ID: `{tenant_id}#{source_record_id}` (namespace de tenant via ID prefix)
- Neo4j labels: `[{entity_type_capitalized}, Tenant_{tenant_id}]`
- Neo4j MERGE por: `(n:{entity_type} {source_record_id: $id, tenant_id: $tid})`
- TimescaleDB tabla: `nexus_m3.timeseries` (hypertable particionada por extracted_at)
- TimescaleDB clave: `(tenant_id, source_record_id, extracted_at)` — ON CONFLICT DO UPDATE

---

## 2. M3-W1 — VectorWriter (Pinecone)

```python
# m3/writers/vector_writer.py
"""
VectorWriter — escribe embeddings vectoriales en Pinecone.

Usa sentence-transformers all-MiniLM-L6-v2 LOCAL (384 dims) — NO OpenAI.
Un index por (tenant_id, entity_type).
Idempotente: upsert basado en vector_id = {tenant_id}#{source_record_id}.
"""
import logging
import os
from dataclasses import dataclass
from typing import List, Optional
from sentence_transformers import SentenceTransformer
from pinecone import Pinecone, ServerlessSpec
from prometheus_client import Counter, Histogram

logger = logging.getLogger(__name__)

vectors_written = Counter("m3_vector_writes_total", "Vectores escritos en Pinecone", ["tenant_id", "entity_type"])
vector_write_latency = Histogram("m3_vector_write_latency_seconds", "Latencia escritura vectorial", buckets=[0.1, 0.5, 1, 5])
vector_write_errors = Counter("m3_vector_write_errors_total", "Errores escritura vectorial", ["tenant_id"])

EMBEDDING_MODEL = "all-MiniLM-L6-v2"
EMBEDDING_DIMS = 384
BATCH_SIZE = 100

# Dimensiones Pinecone Serverless
_PINECONE_CLOUD = "aws"
_PINECONE_REGION = "us-east-1"


@dataclass
class VectorRecord:
    """Registro listo para insertar en Pinecone."""
    vector_id: str       # {tenant_id}#{source_record_id}
    tenant_id: str
    entity_type: str
    text_to_embed: str   # Texto que se vectorizará
    metadata: dict       # Campos relevantes para filtrado


class VectorWriter:
    """
    Escribe vectores a Pinecone, creando el index si no existe.
    Thread-safe: puede ejecutarse desde múltiples workers.
    """

    def __init__(self):
        api_key = self._load_secret("/var/run/secrets/platform/pinecone/api_key")
        self._pc = Pinecone(api_key=api_key)
        self._embedder = SentenceTransformer(EMBEDDING_MODEL)
        self._index_cache: dict = {}

    def _load_secret(self, path: str) -> str:
        if os.path.exists(path):
            with open(path) as f:
                return f.read().strip()
        return os.environ.get("PINECONE_API_KEY", "")

    def _get_or_create_index(self, tenant_id: str, entity_type: str):
        """Retorna index Pinecone, creándolo si no existe. Cachea en memoria."""
        index_name = f"nexus-{tenant_id}-{entity_type}"

        if index_name in self._index_cache:
            return self._index_cache[index_name]

        existing = [idx.name for idx in self._pc.list_indexes()]
        if index_name not in existing:
            logger.info(f"Creando index Pinecone: {index_name}")
            self._pc.create_index(
                name=index_name,
                dimension=EMBEDDING_DIMS,
                metric="cosine",
                spec=ServerlessSpec(cloud=_PINECONE_CLOUD, region=_PINECONE_REGION),
            )

        index = self._pc.Index(index_name)
        self._index_cache[index_name] = index
        return index

    def write_batch(self, records: List[VectorRecord]) -> None:
        """
        Escribe un lote de registros en Pinecone.
        Idempotente: upsert reemplaza vectores existentes con mismo ID.
        """
        if not records:
            return

        import time
        start_ts = time.perf_counter()

        # Agrupar por (tenant_id, entity_type) para eficiencia
        grouped: dict = {}
        for r in records:
            key = (r.tenant_id, r.entity_type)
            grouped.setdefault(key, []).append(r)

        for (tenant_id, entity_type), group in grouped.items():
            index = self._get_or_create_index(tenant_id, entity_type)

            # Generar embeddings en batch
            texts = [r.text_to_embed for r in group]
            embeddings = self._embedder.encode(texts, batch_size=32).tolist()

            # Construir vectores para upsert
            vectors = []
            for record, embedding in zip(group, embeddings):
                # Metadata: máximo 40KB por Pinecone
                metadata = {k: str(v)[:255] for k, v in record.metadata.items()}
                metadata["tenant_id"] = tenant_id
                metadata["entity_type"] = entity_type
                vectors.append({
                    "id": record.vector_id,
                    "values": embedding,
                    "metadata": metadata,
                })

            # Upsert en sub-batches de 100
            for i in range(0, len(vectors), BATCH_SIZE):
                batch = vectors[i:i + BATCH_SIZE]
                index.upsert(vectors=batch)
                vectors_written.labels(tenant_id=tenant_id, entity_type=entity_type).inc(len(batch))

        latency = time.perf_counter() - start_ts
        vector_write_latency.observe(latency)
        logger.info(f"VectorWriter: {len(records)} vectores escritos en {latency:.2f}s")


def build_text_to_embed(payload: dict, entity_type: str) -> str:
    """
    Construye el texto representativo que se vectorizará.
    Campo 'text_blob' si existe, sino concatenación de campos clave.
    """
    if "text_blob" in payload:
        return str(payload["text_blob"])[:2000]

    key_fields = {
        "party": ["name", "company_name", "email", "city", "country"],
        "product": ["name", "description", "category", "sku"],
        "employee": ["name", "job_title", "department", "skills"],
        "incident": ["title", "description", "category", "resolution"],
    }

    fields = key_fields.get(entity_type, [])
    parts = [str(payload.get(f, "")) for f in fields if payload.get(f)]
    return " | ".join(parts)[:2000] if parts else json.dumps(payload)[:2000]
```

---

## 3. M3-W2 — GraphWriter (Neo4j)

```python
# m3/writers/graph_writer.py
"""
GraphWriter — escribe nodos y relaciones en Neo4j AuraDB.

Idempotente: MERGE por (source_record_id, tenant_id).
Labels del nodo: [entity_type_capitalized, Tenant_{tenant_id}].
"""
import logging
import json
from typing import List, Dict, Any
import neo4j
from prometheus_client import Counter, Histogram

logger = logging.getLogger(__name__)

graph_nodes_written = Counter("m3_graph_nodes_written_total", "Nodos Neo4j escritos", ["tenant_id", "entity_type"])
graph_write_latency = Histogram("m3_graph_write_latency_seconds", "Latencia escritura grafo")
graph_write_errors = Counter("m3_graph_write_errors_total", "Errores escritura grafo", ["tenant_id"])

# Relaciones inferred por cdm_entity pairs
RELATIONSHIP_RULES = {
    ("party", "transaction"): "PARTICIPATED_IN",
    ("employee", "party"): "MANAGES",
    ("incident", "party"): "AFFECTS",
    ("product", "transaction"): "INVOLVED_IN",
}


class GraphWriter:
    """
    Escribe entidades como nodos en Neo4j.
    Crea relaciones RELATIONSHIP_RULES si ambos nodos existen.
    """

    def __init__(self, uri: str, user: str, password: str):
        self._driver = neo4j.GraphDatabase.driver(uri, auth=(user, password))

    async def write_batch(self, records: List[dict], tenant_id: str, entity_type: str) -> None:
        import time
        start_ts = time.perf_counter()

        entity_label = entity_type.capitalize()
        tenant_label = f"Tenant_{tenant_id}"

        async with self._driver.async_session() as session:
            for record in records:
                source_record_id = record.get("source_record_id", record.get("id", ""))
                if not source_record_id:
                    logger.warning("GraphWriter: registro sin source_record_id, ignorado")
                    continue

                # Propiedades del nodo: solo tipos primitivos
                props = {
                    k: v for k, v in record.items()
                    if isinstance(v, (str, int, float, bool)) and len(str(v)) < 1000
                }
                props["source_record_id"] = source_record_id
                props["tenant_id"] = tenant_id

                # MERGE — idempotente
                cypher = f"""
                MERGE (n:{entity_label}:{tenant_label} 
                    {{source_record_id: $source_record_id, tenant_id: $tenant_id}})
                SET n += $props
                SET n.updated_at = datetime()
                """
                await session.run(cypher, source_record_id=source_record_id, tenant_id=tenant_id, props=props)
                graph_nodes_written.labels(tenant_id=tenant_id, entity_type=entity_type).inc()

        # Crear relaciones si los records contienen referencias
        await self._create_relationships(records, tenant_id, entity_type)

        latency = time.perf_counter() - start_ts
        graph_write_latency.observe(latency)
        logger.info(f"GraphWriter: {len(records)} nodos escritos en {latency:.2f}s entity={entity_type}")

    async def _create_relationships(
        self, records: List[dict], tenant_id: str, entity_type: str
    ) -> None:
        """
        Infiere y crea relaciones entre nodos basándose en foreign keys.
        Ejemplo: si un 'transaction' tiene 'party_id', crea relación PARTICIPATED_IN.
        """
        async with self._driver.async_session() as session:
            for record in records:
                source_id = record.get("source_record_id", "")

                for field_name, field_value in record.items():
                    # Detectar foreign keys: campos que terminan en _id o _ref
                    if not (field_name.endswith("_id") or field_name.endswith("_ref")):
                        continue
                    if field_name in ("source_record_id", "tenant_id"):
                        continue

                    # Inferir tipo relacionado desde el nombre del campo
                    related_entity = field_name.replace("_id", "").replace("_ref", "")
                    rel_key = (entity_type, related_entity)
                    rel_type = RELATIONSHIP_RULES.get(rel_key)
                    if not rel_type:
                        rel_key_reversed = (related_entity, entity_type)
                        rel_type = RELATIONSHIP_RULES.get(rel_key_reversed)

                    if rel_type and str(field_value):
                        cypher = f"""
                        MATCH (a {{source_record_id: $source_id, tenant_id: $tid}})
                        MATCH (b {{source_record_id: $related_id, tenant_id: $tid}})
                        MERGE (a)-[:{rel_type}]->(b)
                        """
                        try:
                            await session.run(
                                cypher,
                                source_id=source_id,
                                related_id=str(field_value),
                                tid=tenant_id,
                            )
                        except Exception:
                            pass  # Si no existe el nodo relacionado, skip silencioso

    def close(self) -> None:
        self._driver.close()
```

---

## 4. M3-W3 — TimeSeriesWriter (TimescaleDB)

```python
# m3/writers/timeseries_writer.py
"""
TimeSeriesWriter — escribe entidades time-series en TimescaleDB.

La tabla nexus_m3.timeseries es una hypertable de TimescaleDB.
Particionada por extracted_at con chunks de 1 día.
Idempotente: ON CONFLICT (tenant_id, source_record_id, extracted_at) DO UPDATE.
"""
import json
import logging
import time
from typing import List
import asyncpg
from prometheus_client import Counter, Histogram

logger = logging.getLogger(__name__)

ts_records_written = Counter("m3_ts_records_written_total", "Registros TimescaleDB escritos", ["tenant_id", "entity_type"])
ts_write_latency = Histogram("m3_ts_write_latency_seconds", "Latencia escritura TimescaleDB")
ts_write_errors = Counter("m3_ts_write_errors_total", "Errores escritura TimescaleDB", ["tenant_id"])

CREATE_HYPERTABLE_SQL = """
CREATE TABLE IF NOT EXISTS nexus_m3.timeseries (
    id                  BIGSERIAL,
    tenant_id           TEXT        NOT NULL,
    source_record_id    TEXT        NOT NULL,
    entity_type         TEXT        NOT NULL,
    source_system       TEXT,
    extracted_at        TIMESTAMPTZ NOT NULL,
    numeric_value       NUMERIC,
    label               TEXT,
    attributes          JSONB,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

SELECT create_hypertable(
    'nexus_m3.timeseries',
    'extracted_at',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ts_uq
    ON nexus_m3.timeseries (tenant_id, source_record_id, extracted_at);

CREATE INDEX IF NOT EXISTS idx_ts_tenant_entity
    ON nexus_m3.timeseries (tenant_id, entity_type, extracted_at DESC);
"""


class TimeSeriesWriter:
    """
    Escribe registros time-series en TimescaleDB.
    Extrae el timestamp del campo extracted_at o timestamp del payload.
    Extrae numeric_value del campo amount, value, count si existe.
    """

    def __init__(self, pool: asyncpg.Pool):
        self._pool = pool

    async def initialize(self) -> None:
        """Crea hypertable si no existe. Llamar al arrancar el pod."""
        async with self._pool.acquire() as conn:
            await conn.execute(CREATE_HYPERTABLE_SQL)
        logger.info("TimeSeriesWriter: hypertable nexus_m3.timeseries lista.")

    async def write_batch(
        self, records: List[dict], tenant_id: str, entity_type: str
    ) -> None:
        start_ts = time.perf_counter()
        rows_to_insert = []

        for record in records:
            source_record_id = record.get("source_record_id", record.get("id", ""))
            if not source_record_id:
                continue

            extracted_at = record.get("extracted_at") or record.get("timestamp") or record.get("created_at")
            if not extracted_at:
                logger.warning(f"TimeSeriesWriter: registro sin timestamp, tenant={tenant_id}")
                continue

            # Extraer valor numérico principal
            numeric_value = None
            for field in ("amount", "amount_base_currency", "value", "count", "total"):
                if field in record and record[field] is not None:
                    try:
                        numeric_value = float(record[field])
                    except (TypeError, ValueError):
                        pass
                    break

            # Construir label descriptivo
            label = (
                record.get("description")
                or record.get("title")
                or record.get("name")
                or entity_type
            )

            # Atributos adicionales (serializar como JSON)
            attributes = {
                k: v for k, v in record.items()
                if k not in ("source_record_id", "id", "extracted_at", "timestamp",
                             "created_at", "tenant_id")
                and isinstance(v, (str, int, float, bool))
            }

            rows_to_insert.append((
                tenant_id,
                source_record_id,
                entity_type,
                record.get("source_system", ""),
                extracted_at,
                numeric_value,
                str(label)[:500],
                json.dumps(attributes),
            ))

        if not rows_to_insert:
            return

        async with self._pool.acquire() as conn:
            await conn.execute(f"SET app.tenant_id = '{tenant_id}'")
            await conn.executemany("""
                INSERT INTO nexus_m3.timeseries
                    (tenant_id, source_record_id, entity_type, source_system,
                     extracted_at, numeric_value, label, attributes)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (tenant_id, source_record_id, extracted_at)
                DO UPDATE SET
                    numeric_value = EXCLUDED.numeric_value,
                    label = EXCLUDED.label,
                    attributes = EXCLUDED.attributes
            """, rows_to_insert)

        latency = time.perf_counter() - start_ts
        ts_write_latency.observe(latency)
        ts_records_written.labels(tenant_id=tenant_id, entity_type=entity_type).inc(len(rows_to_insert))
        logger.info(f"TimeSeriesWriter: {len(rows_to_insert)} registros en {latency:.2f}s")
```

---

## 5. M3 — AIStoreWriteOrchestrator

```python
# m3/orchestrator.py
"""
AIStoreWriteOrchestrator — consume ai_routing_decided y dispatcha a los writers.

Consumer group: m1-ai-store-writers
Topic: m1.int.ai_routing_decided
"""
import asyncio
import json
import logging
import os
from typing import List
from prometheus_client import Counter, start_http_server
import asyncpg

from nexus_core.messaging import NexusMessage, NexusProducer, NexusConsumer
from nexus_core.tenant import set_tenant, TenantContext
from nexus_core.topics import CrossModuleTopicNamer as T
from m3.writers.vector_writer import VectorWriter, VectorRecord, build_text_to_embed
from m3.writers.graph_writer import GraphWriter
from m3.writers.timeseries_writer import TimeSeriesWriter

logger = logging.getLogger(__name__)

ROUTING_TABLE = {
    "party":       ["vector", "graph"],
    "transaction": ["graph",  "timeseries"],
    "product":     ["vector"],
    "employee":    ["vector", "graph"],
    "incident":    ["vector", "timeseries"],
}

ai_writes_completed = Counter("m3_ai_writes_completed_total", "Escrituras AI stores completadas", ["tenant_id", "entity_type", "store"])
ai_write_errors = Counter("m3_ai_write_errors_total", "Errores escritura AI stores", ["tenant_id"])


class AIStoreWriteOrchestrator:

    def __init__(self):
        bootstrap = os.environ["KAFKA_BOOTSTRAP_SERVERS"]
        self._consumer = NexusConsumer(
            bootstrap_servers=bootstrap,
            group_id="m1-ai-store-writers",
            topics=[T.STATIC.AI_ROUTING_DECIDED],
        )
        self._producer = NexusProducer(bootstrap, source_module="m3-orchestrator")
        self._vector_writer: VectorWriter = None
        self._graph_writer: GraphWriter = None
        self._ts_writer: TimeSeriesWriter = None

    async def start(self) -> None:
        db_pool = await asyncpg.create_pool(dsn=os.environ["NEXUS_DB_DSN"])
        self._vector_writer = VectorWriter()
        self._graph_writer = GraphWriter(
            uri=os.environ["NEO4J_URI"],
            user=os.environ["NEO4J_USER"],
            password=self._load_secret("/var/run/secrets/platform/neo4j/password"),
        )
        self._ts_writer = TimeSeriesWriter(db_pool)
        await self._ts_writer.initialize()
        start_http_server(9097)
        logger.info("AIStoreWriteOrchestrator iniciado.")

        while True:
            await self._process_one()

    def _load_secret(self, path: str) -> str:
        if os.path.exists(path):
            with open(path) as f:
                return f.read().strip()
        return ""

    async def _process_one(self) -> None:
        msg = self._consumer.poll(timeout=2.0)
        if msg is None:
            return

        tenant_id = msg.tenant_id
        payload = msg.payload
        set_tenant(TenantContext(tenant_id=tenant_id, plan="professional", cdm_version="1.0.0"))

        entity_type = payload.get("entity_type", "unknown")
        records = payload.get("records", [])
        stores = ROUTING_TABLE.get(entity_type, [])

        if not records or not stores:
            self._consumer.commit(msg)
            return

        errors = []
        for store in stores:
            try:
                if store == "vector":
                    vector_records = [
                        VectorRecord(
                            vector_id=f"{tenant_id}#{r.get('source_record_id', r.get('id', ''))}",
                            tenant_id=tenant_id,
                            entity_type=entity_type,
                            text_to_embed=build_text_to_embed(r, entity_type),
                            metadata={k: v for k, v in r.items() if isinstance(v, (str, int, float, bool))},
                        )
                        for r in records
                    ]
                    self._vector_writer.write_batch(vector_records)
                    ai_writes_completed.labels(tenant_id=tenant_id, entity_type=entity_type, store="vector").inc(len(records))

                elif store == "graph":
                    await self._graph_writer.write_batch(records, tenant_id, entity_type)
                    ai_writes_completed.labels(tenant_id=tenant_id, entity_type=entity_type, store="graph").inc(len(records))

                elif store == "timeseries":
                    await self._ts_writer.write_batch(records, tenant_id, entity_type)
                    ai_writes_completed.labels(tenant_id=tenant_id, entity_type=entity_type, store="timeseries").inc(len(records))

            except Exception as e:
                logger.error(f"Error escribiendo a {store}: {e}", exc_info=True)
                errors.append(f"{store}:{e}")
                ai_write_errors.labels(tenant_id=tenant_id).inc()

        # Publicar ai_write_completed
        completion_msg = NexusMessage(
            topic=T.STATIC.AI_WRITE_COMPLETED,
            tenant_id=tenant_id,
            event_type="ai_write_completed",
            payload={
                "entity_type": entity_type,
                "record_count": len(records),
                "stores_written": stores,
                "errors": errors,
            },
            correlation_id=msg.correlation_id,
            trace_id=msg.trace_id,
        )
        self._producer.publish(completion_msg, partition_key=tenant_id)
        logger.info(f"AI write completed: tenant={tenant_id} entity={entity_type} records={len(records)} stores={stores}")
        self._consumer.commit(msg)
```

---

## 6. M4 — Governance FastAPI

```python
# m4/api/governance.py
"""
M4 Governance API — endpoints para revisar y aprobar propuestas CDM.

Endpoints:
  GET  /api/governance/proposals           — Lista propuestas pendientes
  GET  /api/governance/proposals/{id}      — Detalle de propuesta
  POST /api/governance/proposals/{id}/approve — Aprueba propuesta
  POST /api/governance/proposals/{id}/reject  — Rechaza propuesta
  GET  /api/governance/mapping-review      — Cola de mapeos para revisión manual (Tier 3)
  POST /api/governance/mapping-review/{id}/resolve — Resuelve un mapeo Tier 3
"""
import asyncio
import json
import logging
import os
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Depends, Header
from pydantic import BaseModel
import asyncpg
from prometheus_client import Counter, make_asgi_app

from nexus_core.messaging import NexusMessage, NexusProducer
from nexus_core.topics import CrossModuleTopicNamer as T

logger = logging.getLogger(__name__)

api_requests = Counter("m4_governance_requests_total", "Requests M4 Governance", ["endpoint", "method"])

app = FastAPI(title="NEXUS M4 Governance API", version="1.0.0")
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)

# DB Pool (inicializado en startup)
_db_pool: asyncpg.Pool = None
_producer: NexusProducer = None


@app.on_event("startup")
async def startup():
    global _db_pool, _producer
    _db_pool = await asyncpg.create_pool(dsn=os.environ["NEXUS_DB_DSN"])
    bootstrap = os.environ["KAFKA_BOOTSTRAP_SERVERS"]
    _producer = NexusProducer(bootstrap, source_module="m4-governance")
    logger.info("M4 Governance API iniciada.")


async def get_tenant_from_header(x_tenant_id: str = Header(...)) -> str:
    """Extrae tenant_id del header X-Tenant-ID (validado por Kong upstream)."""
    if not x_tenant_id:
        raise HTTPException(status_code=400, detail="X-Tenant-ID header requerido")
    return x_tenant_id


class ApprovalRequest(BaseModel):
    approved_by: str
    notes: Optional[str] = None


class RejectionRequest(BaseModel):
    rejected_by: str
    reason: str


class MappingResolution(BaseModel):
    resolved_by: str
    final_cdm_entity: str
    final_cdm_field: str
    confidence: float
    notes: Optional[str] = None


@app.get("/api/governance/proposals")
async def list_proposals(
    tenant_id: str = Depends(get_tenant_from_header),
    status: str = "pending",
    limit: int = 50,
):
    """Lista propuestas CDM pendientes o en revisión para el tenant."""
    api_requests.labels(endpoint="list_proposals", method="GET").inc()
    async with _db_pool.acquire() as conn:
        await conn.execute(f"SET app.tenant_id = '{tenant_id}'")
        rows = await conn.fetch("""
            SELECT proposal_id, proposal_type, status, submitted_at,
                   payload->>'proposed_entity_type' AS entity_type,
                   (payload->>'confidence_overall')::float AS confidence
            FROM nexus_system.governance_queue
            WHERE tenant_id = $1 AND status = $2
            ORDER BY submitted_at DESC
            LIMIT $3
        """, tenant_id, status, limit)
    return {"proposals": [dict(r) for r in rows], "count": len(rows)}


@app.get("/api/governance/proposals/{proposal_id}")
async def get_proposal(
    proposal_id: str,
    tenant_id: str = Depends(get_tenant_from_header),
):
    """Detalle completo de una propuesta."""
    api_requests.labels(endpoint="get_proposal", method="GET").inc()
    async with _db_pool.acquire() as conn:
        await conn.execute(f"SET app.tenant_id = '{tenant_id}'")
        row = await conn.fetchrow("""
            SELECT * FROM nexus_system.governance_queue
            WHERE proposal_id = $1 AND tenant_id = $2
        """, proposal_id, tenant_id)
    if not row:
        raise HTTPException(status_code=404, detail="Propuesta no encontrada")
    return dict(row)


@app.post("/api/governance/proposals/{proposal_id}/approve")
async def approve_proposal(
    proposal_id: str,
    body: ApprovalRequest,
    tenant_id: str = Depends(get_tenant_from_header),
):
    """Aprueba propuesta CDM: actualiza BD y publica nexus.cdm.version_published."""
    api_requests.labels(endpoint="approve_proposal", method="POST").inc()

    async with _db_pool.acquire() as conn:
        await conn.execute(f"SET app.tenant_id = '{tenant_id}'")

        row = await conn.fetchrow("""
            SELECT payload FROM nexus_system.governance_queue
            WHERE proposal_id = $1 AND tenant_id = $2 AND status = 'pending'
        """, proposal_id, tenant_id)
        if not row:
            raise HTTPException(status_code=404, detail="Propuesta no encontrada o ya procesada")

        proposal = row["payload"] if isinstance(row["payload"], dict) else json.loads(row["payload"])

        # Calcular nueva versión CDM (bump minor)
        current = await conn.fetchval("""
            SELECT version FROM nexus_system.cdm_versions
            WHERE tenant_id = $1 AND status = 'active'
            ORDER BY published_at DESC LIMIT 1
        """, tenant_id)
        parts = [int(x) for x in (current or "1.0.0").split(".")]
        new_version = f"{parts[0]}.{parts[1] + 1}.0"

        # Marcar propuesta como aprobada
        await conn.execute("""
            UPDATE nexus_system.governance_queue
            SET status = 'approved', resolved_at = NOW(),
                resolved_by = $3, notes = $4
            WHERE proposal_id = $1 AND tenant_id = $2
        """, proposal_id, tenant_id, body.approved_by, body.notes)

        # Crear nueva versión CDM
        await conn.execute("""
            INSERT INTO nexus_system.cdm_versions
                (tenant_id, version, description, status)
            VALUES ($1, $2, $3, 'draft')
        """, tenant_id, new_version, f"Approved proposal {proposal_id}")

    # Publicar evento de versión aprobada
    event_msg = NexusMessage(
        topic=T.CDM.VERSION_PUBLISHED,
        tenant_id=tenant_id,
        event_type="cdm_version_published",
        payload={
            "proposal_id": proposal_id,
            "new_version": new_version,
            "approved_by": body.approved_by,
            "approved_mappings": proposal.get("field_mappings", []),
        },
    )
    _producer.publish(event_msg, partition_key=tenant_id)
    logger.info(f"Propuesta {proposal_id} aprobada: nueva versión CDM {new_version}")

    return {"status": "approved", "new_cdm_version": new_version}


@app.post("/api/governance/proposals/{proposal_id}/reject")
async def reject_proposal(
    proposal_id: str,
    body: RejectionRequest,
    tenant_id: str = Depends(get_tenant_from_header),
):
    """Rechaza propuesta CDM y publica nexus.cdm.extension_rejected."""
    api_requests.labels(endpoint="reject_proposal", method="POST").inc()

    async with _db_pool.acquire() as conn:
        await conn.execute(f"SET app.tenant_id = '{tenant_id}'")
        await conn.execute("""
            UPDATE nexus_system.governance_queue
            SET status = 'rejected', resolved_at = NOW(),
                resolved_by = $3, notes = $4
            WHERE proposal_id = $1 AND tenant_id = $2
        """, proposal_id, tenant_id, body.rejected_by, body.reason)

    reject_msg = NexusMessage(
        topic=T.CDM.EXTENSION_REJECTED,
        tenant_id=tenant_id,
        event_type="cdm_extension_rejected",
        payload={"proposal_id": proposal_id, "reason": body.reason},
    )
    _producer.publish(reject_msg, partition_key=tenant_id)

    return {"status": "rejected"}


@app.get("/api/governance/mapping-review")
async def list_mapping_review(
    tenant_id: str = Depends(get_tenant_from_header),
    limit: int = 50,
):
    """Lista mapeos Tier 3 pendientes de revisión manual."""
    api_requests.labels(endpoint="list_mapping_review", method="GET").inc()
    async with _db_pool.acquire() as conn:
        await conn.execute(f"SET app.tenant_id = '{tenant_id}'")
        rows = await conn.fetch("""
            SELECT *
            FROM nexus_system.mapping_review_queue
            WHERE tenant_id = $1 AND status = 'pending'
            ORDER BY created_at DESC LIMIT $2
        """, tenant_id, limit)
    return {"items": [dict(r) for r in rows], "count": len(rows)}


@app.post("/api/governance/mapping-review/{review_id}/resolve")
async def resolve_mapping(
    review_id: str,
    body: MappingResolution,
    tenant_id: str = Depends(get_tenant_from_header),
):
    """Resuelve un mapeo Tier 3 con decisión humana."""
    api_requests.labels(endpoint="resolve_mapping", method="POST").inc()
    async with _db_pool.acquire() as conn:
        await conn.execute(f"SET app.tenant_id = '{tenant_id}'")

        row = await conn.fetchrow("""
            SELECT * FROM nexus_system.mapping_review_queue
            WHERE review_id = $1 AND tenant_id = $2
        """, review_id, tenant_id)
        if not row:
            raise HTTPException(status_code=404, detail="Item de review no encontrado")

        # Insertar mapeo definitivo en cdm_mappings como Tier 1
        await conn.execute("""
            INSERT INTO nexus_system.cdm_mappings
                (tenant_id, cdm_version, source_system, source_table, source_field,
                 cdm_entity, cdm_field, confidence, tier, approved_by, approved_at)
            VALUES ($1,
                    (SELECT version FROM nexus_system.cdm_versions WHERE tenant_id=$1 AND status='active' LIMIT 1),
                    $2, $3, $4, $5, $6, $7, 1, $8, NOW())
            ON CONFLICT (tenant_id, source_system, source_table, source_field, cdm_version)
            DO UPDATE SET cdm_entity=$5, cdm_field=$6, confidence=$7, tier=1, approved_by=$8
        """,
            tenant_id,
            row["source_system"], row["source_table"], row["source_field"],
            body.final_cdm_entity, body.final_cdm_field, body.confidence,
            body.resolved_by,
        )

        await conn.execute("""
            UPDATE nexus_system.mapping_review_queue
            SET status = 'resolved', resolved_by = $3, resolved_at = NOW()
            WHERE review_id = $1 AND tenant_id = $2
        """, review_id, tenant_id, body.resolved_by)

    return {"status": "resolved", "cdm_entity": body.final_cdm_entity, "cdm_field": body.final_cdm_field}
```

---

## 7. Temporal — OnboardingWorkflow

```python
# m4/workflows/onboarding.py
"""
OnboardingWorkflow — orquesta la creación completa de un nuevo tenant.

Triggered por: POST /api/tenants (M4 REST)
O por: {tid}.m2.workflow_trigger con workflow_type="onboarding"

Activities (ejecutadas secuencialmente con retry):
  1. validate_tenant          — Verifica datos del tenant en BD
  2. create_kafka_topics      — Crea 12 topics per-tenant
  3. setup_pinecone           — Crea 5 indexes en Pinecone (1 por entity_type)
  4. setup_neo4j              — Crea constraints e indexes en Neo4j para el tenant
  5. setup_timescaledb        — Crea schema y políticas de retención
  6. activate_tenant          — Marca tenant como 'active' en BD
"""
import asyncio
import logging
import os
from datetime import timedelta
from temporalio import activity, workflow
from temporalio.common import RetryPolicy
from temporalio.client import Client
from temporalio.worker import Worker
import asyncpg

logger = logging.getLogger(__name__)


# ─── ACTIVITIES ──────────────────────────────────────────────────────────────

@activity.defn
async def validate_tenant(tenant_id: str) -> dict:
    """Verifica que el tenant existe en BD y tiene datos mínimos."""
    pool = await asyncpg.create_pool(dsn=os.environ["NEXUS_DB_DSN"])
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT tenant_id, plan, status FROM nexus_system.tenants
            WHERE tenant_id = $1
        """, tenant_id)
    await pool.close()
    if not row:
        raise ValueError(f"Tenant {tenant_id} no encontrado en BD")
    return {"tenant_id": tenant_id, "plan": row["plan"], "status": row["status"]}


@activity.defn
async def create_kafka_topics(tenant_id: str) -> dict:
    """Llama a onboard_tenant.py para crear 12 topics per-tenant."""
    import subprocess
    result = subprocess.run(
        ["python", "/app/nexus_core/scripts/onboard_tenant.py", "--tenant-id", tenant_id],
        capture_output=True, text=True, timeout=120,
    )
    if result.returncode != 0:
        raise RuntimeError(f"onboard_tenant.py falló: {result.stderr}")
    return {"kafka_topics_created": 12, "tenant_id": tenant_id}


@activity.defn
async def setup_pinecone(tenant_id: str) -> dict:
    """Crea 5 indexes Pinecone para el tenant (1 por entity_type)."""
    from pinecone import Pinecone, ServerlessSpec
    api_key = open("/var/run/secrets/platform/pinecone/api_key").read().strip()
    pc = Pinecone(api_key=api_key)
    existing = [idx.name for idx in pc.list_indexes()]
    entity_types = ["party", "transaction", "product", "employee", "incident"]
    created = []
    for et in entity_types:
        index_name = f"nexus-{tenant_id}-{et}"
        if index_name not in existing:
            pc.create_index(
                name=index_name,
                dimension=384,
                metric="cosine",
                spec=ServerlessSpec(cloud="aws", region="us-east-1"),
            )
            created.append(index_name)
    return {"pinecone_indexes_created": created, "tenant_id": tenant_id}


@activity.defn
async def setup_neo4j(tenant_id: str) -> dict:
    """Crea constraints e indexes en Neo4j para el tenant."""
    import neo4j
    uri = os.environ["NEO4J_URI"]
    user = os.environ["NEO4J_USER"]
    pwd = open("/var/run/secrets/platform/neo4j/password").read().strip()
    driver = neo4j.GraphDatabase.driver(uri, auth=(user, pwd))

    entity_types = ["Party", "Transaction", "Product", "Employee", "Incident"]
    created_constraints = []
    async with driver.async_session() as session:
        for entity in entity_types:
            constraint_name = f"nexus_{tenant_id}_{entity.lower()}_uniq"
            try:
                await session.run(f"""
                    CREATE CONSTRAINT {constraint_name} IF NOT EXISTS
                    FOR (n:{entity}:Tenant_{tenant_id})
                    REQUIRE (n.source_record_id, n.tenant_id) IS UNIQUE
                """)
                created_constraints.append(constraint_name)
            except Exception as e:
                logger.warning(f"Neo4j constraint skip: {e}")
    driver.close()
    return {"neo4j_constraints_created": created_constraints, "tenant_id": tenant_id}


@activity.defn
async def setup_timescaledb(tenant_id: str) -> dict:
    """Configura retención de datos para el tenant en TimescaleDB."""
    pool = await asyncpg.create_pool(dsn=os.environ["NEXUS_DB_DSN"])
    async with pool.acquire() as conn:
        # Política de retención: 2 años para datos del tenant
        await conn.execute("""
            SELECT add_retention_policy(
                'nexus_m3.timeseries',
                INTERVAL '2 years',
                if_not_exists => TRUE
            )
        """)
    await pool.close()
    return {"timescaledb_retention_set": True, "tenant_id": tenant_id}


@activity.defn
async def activate_tenant(tenant_id: str) -> dict:
    """Marca el tenant como activo en la BD principal."""
    pool = await asyncpg.create_pool(dsn=os.environ["NEXUS_DB_DSN"])
    async with pool.acquire() as conn:
        await conn.execute("""
            UPDATE nexus_system.tenants
            SET status = 'active', activated_at = NOW()
            WHERE tenant_id = $1
        """, tenant_id)
    await pool.close()
    return {"tenant_id": tenant_id, "status": "active"}


# ─── WORKFLOW ─────────────────────────────────────────────────────────────────

@workflow.defn
class OnboardingWorkflow:
    """
    Workflow Temporal para onboarding completo de un tenant.
    Idempotente: ejecutar dos veces es seguro.
    Timeout total: 30 minutos.
    """

    ACTIVITY_RETRY = RetryPolicy(
        maximum_attempts=3,
        initial_interval=timedelta(seconds=10),
        maximum_interval=timedelta(minutes=2),
        backoff_coefficient=2.0,
    )

    @workflow.run
    async def run(self, tenant_id: str) -> dict:
        logger.info(f"OnboardingWorkflow iniciado: tenant={tenant_id}")

        # Step 1: Validar tenant
        tenant_info = await workflow.execute_activity(
            validate_tenant,
            tenant_id,
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=self.ACTIVITY_RETRY,
        )

        # Steps 2-5: Setup paralelo de stores
        kafka_result, pinecone_result, neo4j_result, ts_result = await asyncio.gather(
            workflow.execute_activity(
                create_kafka_topics, tenant_id,
                start_to_close_timeout=timedelta(minutes=5),
                retry_policy=self.ACTIVITY_RETRY,
            ),
            workflow.execute_activity(
                setup_pinecone, tenant_id,
                start_to_close_timeout=timedelta(minutes=10),
                retry_policy=self.ACTIVITY_RETRY,
            ),
            workflow.execute_activity(
                setup_neo4j, tenant_id,
                start_to_close_timeout=timedelta(minutes=5),
                retry_policy=self.ACTIVITY_RETRY,
            ),
            workflow.execute_activity(
                setup_timescaledb, tenant_id,
                start_to_close_timeout=timedelta(minutes=2),
                retry_policy=self.ACTIVITY_RETRY,
            ),
        )

        # Step 6: Activar tenant
        activation_result = await workflow.execute_activity(
            activate_tenant, tenant_id,
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=self.ACTIVITY_RETRY,
        )

        result = {
            "tenant_id": tenant_id,
            "status": "onboarded",
            "kafka": kafka_result,
            "pinecone": pinecone_result,
            "neo4j": neo4j_result,
            "timescaledb": ts_result,
            "activation": activation_result,
        }
        logger.info(f"OnboardingWorkflow completado: tenant={tenant_id}")
        return result
```

---

## 8. K8s Deployments M3 + M4

```yaml
# k8s/m3/ai-store-orchestrator-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: m3-ai-store-orchestrator
  namespace: nexus-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: m3-ai-store-orchestrator
  template:
    metadata:
      labels:
        app: m3-ai-store-orchestrator
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "9097"
    spec:
      containers:
        - name: orchestrator
          image: nexus-m3-orchestrator:latest
          resources:
            requests:
              cpu: "500m"
              memory: "2Gi"
            limits:
              cpu: "2"
              memory: "4Gi"
          env:
            - name: KAFKA_BOOTSTRAP_SERVERS
              value: "nexus-kafka-kafka-bootstrap.nexus-data.svc:9092"
            - name: NEXUS_DB_DSN
              valueFrom:
                secretKeyRef:
                  name: nexus-db-credentials
                  key: dsn
            - name: NEO4J_URI
              valueFrom:
                secretKeyRef:
                  name: neo4j-credentials
                  key: uri
            - name: NEO4J_USER
              value: "neo4j"
          volumeMounts:
            - name: platform-secrets
              mountPath: /var/run/secrets/platform
              readOnly: true
      volumes:
        - name: platform-secrets
          projected:
            sources:
              - secret:
                  name: nexus-pinecone-key
              - secret:
                  name: nexus-neo4j-password
---
# k8s/m4/governance-api-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: m4-governance-api
  namespace: nexus-app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: m4-governance-api
  template:
    metadata:
      labels:
        app: m4-governance-api
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "8000"
    spec:
      containers:
        - name: governance-api
          image: nexus-m4-governance:latest
          ports:
            - containerPort: 8000
          command: ["uvicorn", "m4.api.governance:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
          resources:
            requests:
              cpu: "250m"
              memory: "512Mi"
            limits:
              cpu: "1"
              memory: "1Gi"
```

---

## 9. Acceptance Criteria M3 + M4

```bash
# M3 — Test VectorWriter
# Setup: publicar ai_routing_decided con entity_type="party"
# Expected: index nexus-test-alpha-party tiene el vector con ID test-alpha#rec-001
python -c "
from pinecone import Pinecone
pc = Pinecone(api_key='...')
idx = pc.Index('nexus-test-alpha-party')
res = idx.fetch(ids=['test-alpha#rec-001'])
assert res.vectors, 'Vector no encontrado'
print('✅ VectorWriter OK')
"

# M3 — Test GraphWriter
# Expected: nodo Party:Tenant_test-alpha mergeado en Neo4j
python -c "
import neo4j
driver = neo4j.GraphDatabase.driver('...')
with driver.session() as s:
    res = s.run('MATCH (n:Party:Tenant_test-alpha {source_record_id: \$id}) RETURN n', id='rec-001')
    assert res.single(), 'Nodo no encontrado'
print('✅ GraphWriter OK')
"

# M3 — Test TimeSeriesWriter
psql $NEXUS_DB_DSN -c "
SELECT COUNT(*) FROM nexus_m3.timeseries
WHERE tenant_id='test-alpha' AND entity_type='transaction'
AND extracted_at > NOW() - INTERVAL '1 hour';
"
# Expected: count > 0

# M3 — Test routing correcto (party NO va a timeseries)
# Expected: ai_write_completed con stores_written=['vector','graph'] (sin timeseries)

# M4 — Test approve flow
curl -X POST http://m4-governance-api:8000/api/governance/proposals/prop-001/approve \
  -H "X-Tenant-ID: test-alpha" \
  -H "Content-Type: application/json" \
  -d '{"approved_by": "admin@test.com"}'
# Expected: {"status":"approved","new_cdm_version":"1.1.0"}

# M4 — Test nexus.cdm.version_published publicado tras aprobación
kubectl exec -n nexus-data nexus-kafka-kafka-0 -- \
  bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 \
  --topic nexus.cdm.version_published --from-beginning --max-messages 1 | \
  python -m json.tool | grep new_version
# Expected: "new_version": "1.1.0"

# Temporal — Test OnboardingWorkflow
# Trigger: crear tenant nuevo vía API M4
curl -X POST http://m4-governance-api:8000/api/tenants \
  -H "Content-Type: application/json" \
  -d '{"tenant_id":"test-gamma","plan":"starter","admin_email":"gamma@test.com"}'
# Expected: workflow aparece en Temporal UI, completa todos los steps, tenant activo
```

---

*NEXUS Build Plan — Archivo 07 · M3 AI Store Writers + M4 Governance + Temporal · Mentis Consulting · Marzo 2026*
