# NEXUS — Archivo 04: M1 Spark + CDM Mapper + AI Store Router
## Phase 2 · Módulo 1 · Procesamiento Spark, Mapeo CDM y Routing AI
### Semanas 5–7 · Equipo Data Intelligence · Depende de: NEXUS-03-M1-Workers.md

---

## Tabla de Contenidos

1. [Flujo completo de datos M1 — segunda mitad](#1-flujo-completo-de-datos-m1--segunda-mitad)
2. [P2-M1-10 — Spark Job m1_classify_and_prepare](#2-p2-m1-10--spark-job-m1_classify_and_prepare)
3. [Tabla de Clasificación de Entidades](#3-tabla-de-clasificación-de-entidades)
4. [P2-M1-11 — CDM Mapper Worker](#4-p2-m1-11--cdm-mapper-worker)
5. [P2-M1-12 — AI Store Router Worker](#5-p2-m1-12--ai-store-router-worker)
6. [Tabla de Routing por Tipo de Entidad](#6-tabla-de-routing-por-tipo-de-entidad)
7. [Acceptance Criteria fase completa M1](#7-acceptance-criteria-fase-completa-m1)

---

## 1. Flujo completo de datos M1 — segunda mitad

```
m1.int.delta_batch_ready
       │
       ▼
[Spark Job: m1_classify_and_prepare]
   7 pasos:
   1. Leer Delta desde nexus-raw
   2. Clasificar entity_type por nombre de tabla
   3. Escalar/normalizar data types
   4. Enriquecer con metadata (tenant_id, cdm_version, etc.)
   5. Escribir a nexus-classified (Delta)
   6. Publicar m1.int.classified_records
   7. Publicar m1.int.source_schema_extracted (para structural cycle)
       │
       ▼
m1.int.classified_records
       │
       ▼
[CDM Mapper Worker] — consumer group: m1-cdm-mappers
   → Lee mapping de CDMRegistryService (cache 5 min)
   → Tier 1 (confidence > 0.9): aplica automáticamente
   → Tier 2 (0.7–0.9): aplica + flag en governance_queue
   → Tier 3 (<0.7): envía a mapping_review_queue
   → Publica m1.int.cdm_entities_ready
       │
       ▼
m1.int.cdm_entities_ready
       │
       ▼
[AI Store Router Worker] — consumer group: m1-ai-store-writers
   → Lee entity_type del CDMEntity
   → Aplica tabla de routing (party→Vector+Graph, transaction→Graph+TimeSeries, etc.)
   → Publica m1.int.ai_routing_decided
   → Los M3 Writers (Archivo 07) consumen ai_routing_decided
       │
       ▼
m1.int.ai_routing_decided → M3 Writers → m1.int.ai_write_completed
```

---

## 2. P2-M1-10 — Spark Job m1_classify_and_prepare

**Owner:** DI-Senior  
**Duración:** Semana 5–6  
**Tipo:** SparkApplication (K8s) + submit vía Airflow  
**Archivo:** `spark_jobs/m1_classify_and_prepare.py`

```python
# spark_jobs/m1_classify_and_prepare.py
"""
Spark Job: m1_classify_and_prepare

Entrada: Delta table en nexus-raw/{tenant_id}/{system_type}/{source_table}
Salida:  Delta table en nexus-classified/{tenant_id}/{system_type}/{source_table}_classified
         + mensaje m1.int.classified_records
         + mensaje m1.int.source_schema_extracted (para cycle estructural)

Lógica de clasificación: por nombre de tabla, sin LLM.
"""
import sys
import argparse
import logging
from pyspark.sql import SparkSession, DataFrame
from pyspark.sql import functions as F
from pyspark.sql.types import StringType
from delta.tables import DeltaTable

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Clasificación por nombre de tabla ─────────────────────────────────────
ENTITY_TYPE_RULES = {
    "party": [
        "partner", "account", "customer", "user", "contact", "client",
        "kunnr", "res.partner", "sys_user", "lead"
    ],
    "transaction": [
        "invoice", "order", "payment", "sale", "purchase", "transaction",
        "sale.order", "account.invoice", "change_request"
    ],
    "product": [
        "product", "item", "article", "sku", "material",
        "product.template", "product.product"
    ],
    "employee": [
        "employee", "staff", "worker", "person", "hr",
        "hr.employee", "resource.calendar"
    ],
    "incident": [
        "incident", "ticket", "case", "issue", "problem", "request",
        "helpdesk.ticket", "helpdesk.stage"
    ],
}


def classify_entity(source_table: str) -> str:
    """
    Clasifica la tabla fuente en un tipo de entidad CDM.
    Retorna 'unknown' si ninguna regla aplica.
    """
    table_lower = source_table.lower()
    for entity_type, keywords in ENTITY_TYPE_RULES.items():
        for kw in keywords:
            if kw in table_lower:
                return entity_type
    return "unknown"


def main(batch_id: str, date: str, tenant_id: str = None):
    spark = (
        SparkSession.builder
        .appName(f"m1-classify-{batch_id}")
        .config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension")
        .config("spark.sql.catalog.spark_catalog",
                "org.apache.spark.sql.delta.catalog.DeltaCatalog")
        .getOrCreate()
    )
    spark.sparkContext.setLogLevel("WARN")

    # PASO 1: Leer el batch recién escrito por DeltaWriter
    # El batch_id viene del mensaje delta_batch_ready
    if tenant_id:
        # Procesamiento de un tenant específico
        tenant_ids = [tenant_id]
    else:
        # Procesar todos los tenants con datos nuevos en este batch
        tenant_ids = _get_tenants_with_new_data(spark, batch_id, date)

    for tid in tenant_ids:
        _process_tenant_batch(spark, batch_id, date, tid)

    spark.stop()
    logger.info(f"Spark job completado: batch_id={batch_id}")


def _process_tenant_batch(
    spark: SparkSession, batch_id: str, date: str, tenant_id: str
) -> None:
    """Procesa todos los nuevos registros de un tenant en este batch."""
    import os
    minio = os.environ.get("MINIO_ENDPOINT", "http://minio.nexus-storage.svc.cluster.local:9000")
    raw_base = f"s3a://nexus-raw/{tenant_id}"
    classified_base = f"s3a://nexus-classified/{tenant_id}"

    # Listar todas las tablas fuente del tenant
    source_tables = _list_source_tables(spark, raw_base, batch_id)
    logger.info(f"tenant={tenant_id}: {len(source_tables)} tablas a clasificar")

    published_classified = 0
    schemas_extracted = []

    for system_type, source_table in source_tables:
        raw_path = f"{raw_base}/{system_type}/{source_table}"
        classified_path = f"{classified_base}/{system_type}/{source_table}_classified"

        # PASO 2: Leer datos raw
        try:
            df_raw = spark.read.format("delta").load(raw_path)
        except Exception as e:
            logger.error(f"No se puede leer {raw_path}: {e}")
            continue

        # Filtrar solo el batch actual
        df_batch = df_raw.filter(F.col("batch_id") == batch_id)
        if df_batch.count() == 0:
            continue

        # PASO 3: Clasificar
        entity_type = classify_entity(source_table)
        classify_udf = F.udf(lambda t: classify_entity(t), StringType())

        # PASO 4: Enriquecer con metadata
        df_classified = df_batch.withColumns({
            "entity_type": F.lit(entity_type),
            "classified_at": F.current_timestamp(),
            "cdm_version": F.lit("1.0.0"),
            "classification_source": F.lit("rule_engine"),
        })

        # PASO 5: Escribir a nexus-classified (MERGE upsert)
        try:
            delta_classified = DeltaTable.forPath(spark, classified_path)
            delta_classified.alias("existing").merge(
                df_classified.alias("new"),
                "existing.record_id = new.record_id AND existing.tenant_id = new.tenant_id"
            ).whenMatchedUpdateAll().whenNotMatchedInsertAll().execute()
        except Exception:
            # Primera escritura
            df_classified.write.format("delta").mode("append").save(classified_path)
            logger.info(f"Classified table creada: {classified_path}")

        records_count = df_batch.count()
        published_classified += records_count

        # PASO 6: Extraer schema para structural cycle
        schema_info = _extract_schema(df_raw, source_table, system_type, tenant_id)
        schemas_extracted.append(schema_info)

        logger.info(
            f"Clasificado: tenant={tenant_id} table={source_table} "
            f"entity_type={entity_type} records={records_count}"
        )

    # PASO 6: Publicar m1.int.classified_records (summary)
    _publish_classified_records(tenant_id, batch_id, published_classified, date)

    # PASO 7: Publicar m1.int.source_schema_extracted (para cycle estructural)
    for schema in schemas_extracted:
        _publish_schema_extracted(tenant_id, batch_id, schema)


def _extract_schema(
    df: DataFrame, source_table: str, system_type: str, tenant_id: str
) -> dict:
    """
    Extrae perfil del schema para el structural sub-cycle.
    SourceKnowledgeArtifact con estadísticas de campos.
    """
    field_profiles = []
    for field in df.schema.fields:
        # Calcular estadísticas básicas
        null_count = df.filter(F.col(field.name).isNull()).count()
        total_count = df.count()
        null_pct = round(null_count / max(total_count, 1) * 100, 2)

        field_profiles.append({
            "field_name": field.name,
            "inferred_type": str(field.dataType),
            "nullable": field.nullable,
            "null_percentage": null_pct,
            "sample_values": [],  # Se llena en structural cycle
        })

    return {
        "source_system": system_type,
        "source_table": source_table,
        "tenant_id": tenant_id,
        "field_profiles": field_profiles,
        "row_count": df.count(),
    }


def _publish_classified_records(
    tenant_id: str, batch_id: str, record_count: int, date: str
) -> None:
    """Publica summary de clasificación a Kafka."""
    import os, uuid
    from nexus_core.messaging import NexusMessage, NexusProducer
    from nexus_core.topics import CrossModuleTopicNamer as T

    producer = NexusProducer(
        os.environ["KAFKA_BOOTSTRAP_SERVERS"],
        source_module="spark-m1-classify"
    )
    msg = NexusMessage(
        topic=T.STATIC.CLASSIFIED_RECORDS,
        tenant_id=tenant_id,
        event_type="classified_records_ready",
        payload={
            "batch_id": batch_id,
            "records_classified": record_count,
            "processing_date": date,
            "source": "spark-m1-classify",
        },
        correlation_id=str(uuid.uuid4()),
    )
    producer.publish(msg, partition_key=tenant_id)
    logger.info(f"classified_records publicado: tenant={tenant_id} count={record_count}")


def _publish_schema_extracted(tenant_id: str, batch_id: str, schema: dict) -> None:
    """Publica schema extraído para el structural cycle (M2 Structural Agent)."""
    import os, uuid
    from nexus_core.messaging import NexusMessage, NexusProducer
    from nexus_core.topics import CrossModuleTopicNamer as T

    producer = NexusProducer(
        os.environ["KAFKA_BOOTSTRAP_SERVERS"],
        source_module="spark-m1-classify"
    )
    msg = NexusMessage(
        topic=T.STATIC.SOURCE_SCHEMA_EXTRACTED,
        tenant_id=tenant_id,
        event_type="source_schema_extracted",
        payload=schema,
        correlation_id=str(uuid.uuid4()),
    )
    producer.publish(msg, partition_key=tenant_id)


def _list_source_tables(spark: SparkSession, raw_base: str, batch_id: str):
    """Lista todas las (system_type, source_table) con datos del batch."""
    # En producción: leer el mensaje delta_batch_ready del batch_id dado
    # Para simplificar: listar directorios en MinIO
    import subprocess, json
    result = subprocess.run(
        ["mc", "ls", "--json", f"nexus/{raw_base.replace('s3a://','')}/"],
        capture_output=True, text=True
    )
    tables = []
    for line in result.stdout.strip().split('\n'):
        if not line:
            continue
        try:
            obj = json.loads(line)
            path = obj.get("key", "")
            parts = path.strip("/").split("/")
            if len(parts) >= 2:
                tables.append((parts[-2], parts[-1]))
        except Exception:
            continue
    return tables


def _get_tenants_with_new_data(spark, batch_id, date):
    """Retorna lista de tenant_ids con datos nuevos (stub — expand en producción)."""
    return []


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch-id", required=True)
    parser.add_argument("--date", required=True)
    parser.add_argument("--tenant-id", default=None)
    args = parser.parse_args()
    main(args.batch_id, args.date, args.tenant_id)
```

---

## 3. Tabla de Clasificación de Entidades

### Reglas de clasificación (exhaustivas)

| Keyword en nombre de tabla | Tipo de entidad CDM |
|---|---|
| partner, account, customer, user, contact, client, kunnr | `party` |
| res.partner, sys_user, lead, prospect | `party` |
| invoice, order, payment, sale, purchase, transaction | `transaction` |
| sale.order, account.invoice, change_request | `transaction` |
| product, item, article, sku, material | `product` |
| product.template, product.product | `product` |
| employee, staff, worker, person, hr | `employee` |
| hr.employee, resource.calendar | `employee` |
| incident, ticket, case, issue, problem, request | `incident` |
| helpdesk.ticket, helpdesk.stage | `incident` |
| **cualquier otro** | `unknown` |

### Qué pasa con `unknown`

Los registros de tipo `unknown` se escriben a nexus-classified igual, pero:
- CDM Mapper los pone en `mapping_review_queue` siempre (Tier 3)
- M2 Structural Agent los recibe vía `source_schema_extracted`
- El Tech Lead revisa y puede añadir nuevas reglas de clasificación

---

## 4. P2-M1-11 — CDM Mapper Worker

**Owner:** DI-Mid  
**Duración:** Semana 6  
**Consumer group:** `m1-cdm-mappers`  
**Archivo:** `m1/workers/cdm_mapper_worker.py`

```python
# m1/workers/cdm_mapper_worker.py
"""
CDM Mapper Worker — consume classified_records y aplica mapeos CDM.

Tiers de mapeo:
  Tier 1 (confidence >= 0.9): aplica automáticamente, no flag
  Tier 2 (confidence 0.7–0.9): aplica + inserta en governance_queue para revisión
  Tier 3 (confidence < 0.7 o no existe):
    - Si existe mapeo: aplica pero inserta en mapping_review_queue
    - Si NO existe: inserta en mapping_review_queue + publica mapping_review_needed
"""
import asyncio
import logging
import os
import uuid
from prometheus_client import Counter, Histogram, start_http_server

import asyncpg
from nexus_core.messaging import NexusMessage, NexusProducer, NexusConsumer
from nexus_core.tenant import set_tenant, TenantContext
from nexus_core.topics import CrossModuleTopicNamer as T
from nexus_core.db import get_tenant_scoped_connection
from nexus_core.cdm_registry import CDMRegistryService, MappingResult

logger = logging.getLogger(__name__)

# Métricas
entities_mapped = Counter(
    "m1_cdm_entities_mapped_total",
    "Entidades CDM mapeadas exitosamente",
    ["tenant_id", "entity_type", "tier"],
)
mapping_reviews = Counter(
    "m1_cdm_mapping_reviews_total",
    "Mapeos enviados a revisión humana",
    ["tenant_id"],
)
mapping_duration = Histogram(
    "m1_cdm_mapping_duration_seconds",
    "Duración del mapeo de un batch",
    ["tenant_id"],
)

TIER_1_THRESHOLD = 0.90
TIER_2_THRESHOLD = 0.70


class CDMMapperWorker:
    """
    Aplica mapeos CDM a registros clasificados.
    Lee nexus-classified, transforma a CDMEntity, publica cdm_entities_ready.
    """

    def __init__(self):
        bootstrap = os.environ["KAFKA_BOOTSTRAP_SERVERS"]
        self._consumer = NexusConsumer(
            bootstrap_servers=bootstrap,
            group_id="m1-cdm-mappers",
            topics=[T.STATIC.CLASSIFIED_RECORDS],
        )
        self._producer = NexusProducer(bootstrap, source_module="m1-cdm-mapper")
        self._db_pool: asyncpg.Pool = None
        self._cdm_registry: CDMRegistryService = None

    async def start(self) -> None:
        self._db_pool = await asyncpg.create_pool(dsn=os.environ["NEXUS_DB_DSN"])
        self._cdm_registry = CDMRegistryService(self._db_pool)
        start_http_server(9092)
        logger.info("CDMMapperWorker iniciado.")

        while True:
            await self._process_one()

    async def _process_one(self) -> None:
        msg = self._consumer.poll(timeout=2.0)
        if msg is None:
            return

        tenant_id = msg.tenant_id
        batch_id = msg.payload.get("batch_id")

        set_tenant(TenantContext(tenant_id=tenant_id, plan="professional", cdm_version="1.0.0"))

        import time
        start_ts = time.perf_counter()

        try:
            cdm_entities = await self._map_batch(tenant_id, batch_id, msg)
            duration = time.perf_counter() - start_ts
            mapping_duration.labels(tenant_id=tenant_id).observe(duration)

            # Publicar cdm_entities_ready
            ready_msg = NexusMessage(
                topic=T.STATIC.CDM_ENTITIES_READY,
                tenant_id=tenant_id,
                event_type="cdm_entities_ready",
                payload={
                    "batch_id": batch_id,
                    "entities_count": len(cdm_entities),
                    "entities": cdm_entities,  # Lista de CDMEntity dicts
                },
                correlation_id=msg.correlation_id,
                trace_id=msg.trace_id,
            )
            self._producer.publish(ready_msg, partition_key=tenant_id)

            self._consumer.commit(msg)
            logger.info(
                f"CDM mapping completado: tenant={tenant_id} batch={batch_id} "
                f"entities={len(cdm_entities)} duration={duration:.2f}s"
            )

        except Exception as e:
            logger.error(f"CDM mapping fallido: tenant={tenant_id} batch={batch_id}: {e}", exc_info=True)
            self._consumer.commit(msg)  # No reintentar infinitamente

    async def _map_batch(
        self, tenant_id: str, batch_id: str, original_msg: NexusMessage
    ) -> list:
        """
        Lee registros clasificados de nexus-classified y aplica mapeos CDM.
        """
        from pyspark.sql import SparkSession

        spark = SparkSession.builder.appName("cdm-mapper").getOrCreate()
        classified_base = f"s3a://nexus-classified/{tenant_id}"

        # Obtener todos los paths clasificados para este batch
        # En producción: leer del payload del mensaje classified_records
        source_system = original_msg.payload.get("source_system", "unknown")
        source_table = original_msg.payload.get("source_table", "unknown")
        classified_path = f"{classified_base}/{source_system}/{source_table}_classified"

        try:
            df = spark.read.format("delta").load(classified_path)
            df_batch = df.filter(df.batch_id == batch_id)
        except Exception as e:
            logger.warning(f"No se puede leer classified para batch={batch_id}: {e}")
            return []

        # Obtener schema único del batch
        schemas = df_batch.select("source_table", "entity_type").distinct().collect()
        cdm_entities = []
        cdm_version = original_msg.cdm_version

        for schema_row in schemas:
            src_table = schema_row["source_table"]
            entity_type = schema_row["entity_type"]

            # Leer rows de esta tabla
            rows = df_batch.filter(df_batch.source_table == src_table).collect()

            for row in rows:
                import json
                data = json.loads(row["data"]) if isinstance(row["data"], str) else row["data"]

                cdm_entity = {
                    "entity_id": str(uuid.uuid4()),
                    "entity_type": entity_type,
                    "tenant_id": tenant_id,
                    "source_system": row["system_type"],
                    "source_table": src_table,
                    "source_record_id": row["record_id"],
                    "cdm_version": cdm_version,
                    "fields": {},
                    "unmapped_fields": {},
                    "mapping_tiers_applied": [],
                }

                # Mapear cada campo
                for field_name, field_value in data.items():
                    mapping = await self._cdm_registry.get_mapping(
                        tenant_id=tenant_id,
                        source_system=row["system_type"],
                        source_table=src_table,
                        source_field=field_name,
                        cdm_version=cdm_version,
                    )

                    if mapping is None:
                        # Sin mapeo: Tier 3 — enviar a revisión
                        cdm_entity["unmapped_fields"][field_name] = field_value
                        await self._submit_to_review(
                            tenant_id, row["system_type"], src_table, field_name, None
                        )
                        mapping_reviews.labels(tenant_id=tenant_id).inc()

                    elif mapping.tier == 1 or mapping.confidence >= TIER_1_THRESHOLD:
                        # Tier 1: aplicar automáticamente
                        cdm_entity["fields"][mapping.cdm_field] = field_value
                        cdm_entity["mapping_tiers_applied"].append(1)
                        entities_mapped.labels(tenant_id=tenant_id, entity_type=entity_type, tier="1").inc()

                    elif mapping.confidence >= TIER_2_THRESHOLD:
                        # Tier 2: aplicar + flag para revisión
                        cdm_entity["fields"][mapping.cdm_field] = field_value
                        cdm_entity["mapping_tiers_applied"].append(2)
                        await self._flag_for_governance(
                            tenant_id, row["system_type"], src_table, field_name, mapping
                        )
                        entities_mapped.labels(tenant_id=tenant_id, entity_type=entity_type, tier="2").inc()

                    else:
                        # Tier 3: bajo confidence — aplicar pero con revisión
                        cdm_entity["fields"][mapping.cdm_field] = field_value
                        cdm_entity["mapping_tiers_applied"].append(3)
                        await self._submit_to_review(
                            tenant_id, row["system_type"], src_table, field_name, mapping
                        )
                        entities_mapped.labels(tenant_id=tenant_id, entity_type=entity_type, tier="3").inc()

                cdm_entities.append(cdm_entity)

        return cdm_entities

    async def _submit_to_review(
        self, tenant_id, source_system, source_table, source_field, mapping
    ) -> None:
        """Inserta en mapping_review_queue."""
        async with await get_tenant_scoped_connection(self._db_pool, tenant_id) as conn:
            await conn.execute("""
                INSERT INTO nexus_system.mapping_review_queue
                    (tenant_id, source_system, source_table, source_field,
                     cdm_entity, cdm_field, confidence, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
                ON CONFLICT DO NOTHING
            """,
                tenant_id, source_system, source_table, source_field,
                mapping.cdm_entity if mapping else None,
                mapping.cdm_field if mapping else None,
                float(mapping.confidence) if mapping else 0.0,
            )

    async def _flag_for_governance(
        self, tenant_id, source_system, source_table, source_field, mapping
    ) -> None:
        """Inserta en governance_queue para revisión Tier 2."""
        async with await get_tenant_scoped_connection(self._db_pool, tenant_id) as conn:
            await conn.execute("""
                INSERT INTO nexus_system.governance_queue
                    (tenant_id, proposal_type, status, payload)
                VALUES ($1, 'mapping_confidence_review', 'pending', $2)
            """,
                tenant_id,
                {
                    "source_system": source_system,
                    "source_table": source_table,
                    "source_field": source_field,
                    "cdm_entity": mapping.cdm_entity,
                    "cdm_field": mapping.cdm_field,
                    "confidence": float(mapping.confidence),
                }
            )
```

---

## 5. P2-M1-12 — AI Store Router Worker

**Owner:** DI-Mid  
**Duración:** Semana 6–7  
**Consumer group:** `m1-ai-store-writers`  
**Archivo:** `m1/workers/ai_store_router_worker.py`

```python
# m1/workers/ai_store_router_worker.py
"""
AI Store Router Worker — consume cdm_entities_ready y decide qué AI Stores escribir.

TABLA DE ROUTING:
  party       → Vector Store + Graph Store
  transaction → Graph Store + TimeSeries Store
  product     → Vector Store
  employee    → Vector Store + Graph Store
  incident    → Vector Store + TimeSeries Store
  unknown     → Solo Vector Store (fallback)

Después de decidir: publica ai_routing_decided
Los M3 Writers leen ai_routing_decided y hacen las escrituras reales.
"""
import asyncio
import logging
import os
import uuid
from typing import List
from prometheus_client import Counter, Histogram, start_http_server

from nexus_core.messaging import NexusMessage, NexusProducer, NexusConsumer
from nexus_core.tenant import set_tenant, TenantContext
from nexus_core.topics import CrossModuleTopicNamer as T

logger = logging.getLogger(__name__)

# Métricas
routing_decisions = Counter(
    "m1_ai_routing_decisions_total",
    "Decisiones de routing por tipo de entidad y destino",
    ["entity_type", "destination"],
)
routing_duration = Histogram(
    "m1_ai_routing_duration_seconds",
    "Duración del routing decision",
)


class AIStoreRouterWorker:
    """
    Determina a qué AI Stores enviar cada CDMEntity.
    NO escribe a ningún store — solo publica ai_routing_decided.
    """

    # Tabla de routing: entity_type → lista de destinos
    ROUTING_TABLE = {
        "party":       ["vector", "graph"],
        "transaction": ["graph", "timeseries"],
        "product":     ["vector"],
        "employee":    ["vector", "graph"],
        "incident":    ["vector", "timeseries"],
        "unknown":     ["vector"],  # Fallback seguro
    }

    def __init__(self):
        bootstrap = os.environ["KAFKA_BOOTSTRAP_SERVERS"]
        self._consumer = NexusConsumer(
            bootstrap_servers=bootstrap,
            group_id="m1-ai-store-writers",
            topics=[T.STATIC.CDM_ENTITIES_READY],
        )
        self._producer = NexusProducer(bootstrap, source_module="m1-ai-store-router")

    async def start(self) -> None:
        start_http_server(9093)
        logger.info("AIStoreRouterWorker iniciado. Consumiendo cdm_entities_ready")

        while True:
            await self._process_one()

    async def _process_one(self) -> None:
        msg = self._consumer.poll(timeout=2.0)
        if msg is None:
            return

        tenant_id = msg.tenant_id
        batch_id = msg.payload.get("batch_id")
        entities = msg.payload.get("entities", [])

        set_tenant(TenantContext(tenant_id=tenant_id, plan="professional", cdm_version="1.0.0"))

        import time
        start_ts = time.perf_counter()

        routing_plan = []

        for entity in entities:
            entity_type = entity.get("entity_type", "unknown")
            destinations = self.ROUTING_TABLE.get(entity_type, ["vector"])

            entity_routing = {
                "entity_id": entity["entity_id"],
                "entity_type": entity_type,
                "source_system": entity.get("source_system"),
                "source_table": entity.get("source_table"),
                "source_record_id": entity.get("source_record_id"),
                "destinations": destinations,
                "fields": entity.get("fields", {}),
                "cdm_version": entity.get("cdm_version", "1.0.0"),
            }
            routing_plan.append(entity_routing)

            # Métricas por destino
            for dest in destinations:
                routing_decisions.labels(
                    entity_type=entity_type, destination=dest
                ).inc()

        duration = time.perf_counter() - start_ts
        routing_duration.observe(duration)

        # Publicar ai_routing_decided
        routing_msg = NexusMessage(
            topic=T.STATIC.AI_ROUTING_DECIDED,
            tenant_id=tenant_id,
            event_type="ai_routing_decided",
            payload={
                "batch_id": batch_id,
                "routing_plan": routing_plan,
                "entities_count": len(routing_plan),
            },
            correlation_id=msg.correlation_id,
            trace_id=msg.trace_id,
        )
        self._producer.publish(routing_msg, partition_key=tenant_id)

        self._consumer.commit(msg)
        logger.info(
            f"Routing decidido: tenant={tenant_id} batch={batch_id} "
            f"entities={len(routing_plan)} duration={duration:.4f}s"
        )
```

---

## 6. Tabla de Routing por Tipo de Entidad

### Referencia completa

| Tipo de Entidad | Vector Store | Graph Store | TimeSeries | Justificación |
|---|---|---|---|---|
| `party` | ✅ | ✅ | ❌ | Búsqueda semántica de clientes + relaciones entre partners |
| `transaction` | ❌ | ✅ | ✅ | Grafo de transacciones + histórico temporal de pagos |
| `product` | ✅ | ❌ | ❌ | Búsqueda semántica de productos por descripción |
| `employee` | ✅ | ✅ | ❌ | Búsqueda de empleados + organigrama en grafo |
| `incident` | ✅ | ❌ | ✅ | Búsqueda semántica de tickets + métricas de SLA en tiempo |
| `unknown` | ✅ | ❌ | ❌ | Fallback: solo vector (siempre útil para búsqueda) |

### Qué escribe cada M3 Writer (detalle en Archivo 07)

**Vector Store (Pinecone):**
- 1 índice por tenant por tipo de entidad
- Embedding: all-MiniLM-L6-v2 LOCAL, 384 dimensiones
- ID del vector: `{tenant_id}#{entity_id}`

**Graph Store (Neo4j AuraDB):**
- Nodo con labels: `[entity_type, tenant_id]`
- MERGE por `source_record_id` — idempotente
- Relaciones inferidas del grafo CDM (party→owns→product, etc.)

**TimeSeries Store (TimescaleDB):**
- Hypertable por tipo de entidad
- Partición temporal por `extracted_at`
- Índice compuesto: (tenant_id, entity_type, extracted_at)

---

## 7. Acceptance Criteria fase completa M1

### Spark Job m1_classify_and_prepare

```bash
# Test 1: Clasificación correcta por nombre de tabla
python -c "
from spark_jobs.m1_classify_and_prepare import classify_entity

tests = [
    ('res.partner', 'party'),
    ('sale.order', 'transaction'),
    ('product.template', 'product'),
    ('hr.employee', 'employee'),
    ('helpdesk.ticket', 'incident'),
    ('Account', 'party'),          # Salesforce Account
    ('invoice', 'transaction'),
    ('weird_table_xyz', 'unknown'),
]
for table, expected in tests:
    result = classify_entity(table)
    assert result == expected, f'{table}: expected {expected}, got {result}'
    print(f'✅ {table} → {result}')
print('Todas las clasificaciones correctas')
"

# Test 2: Spark job completo en datos reales
# Setup: 100 records en nexus-raw/test-alpha/postgresql/test_orders
# Ejecutar: python spark_jobs/m1_classify_and_prepare.py \
#           --batch-id test-batch-001 --date 2026-03-02 --tenant-id test-alpha

# Verificar nexus-classified:
mc ls nexus/nexus-classified/test-alpha/ --recursive | grep "_classified"
# Expected: directorio test_orders_classified existe

# Test 3: Columna entity_type correcta en nexus-classified
# SELECT DISTINCT entity_type FROM delta.`s3a://nexus-classified/test-alpha/*/test_orders_classified`
# Expected: 'transaction' (para table test_orders)

# Test 4: source_schema_extracted publicado
kubectl exec -n nexus-data nexus-kafka-kafka-0 -- \
  bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 \
  --topic m1.int.source_schema_extracted --from-beginning --max-messages 1
# Expected: JSON con field_profiles, row_count
```

### CDM Mapper Worker

```bash
# Test 1: Tier 1 mapping aplica automáticamente
# Setup: insertar mapeo con confidence=0.95
psql -c "
  INSERT INTO nexus_system.cdm_mappings 
  (tenant_id, cdm_version, source_system, source_table, source_field, 
   cdm_entity, cdm_field, confidence, tier)
  VALUES 
  ('test-alpha', '1.0.0', 'postgresql', 'test_orders', 'customer_name',
   'party', 'name', 0.95, 1)
"
# Trigger CDM mapping → Verificar cdm_entities_ready
kubectl exec -n nexus-data nexus-kafka-kafka-0 -- \
  bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 \
  --topic m1.int.cdm_entities_ready --from-beginning --max-messages 1 | python -m json.tool
# Expected: entities[0].fields.name = valor del customer_name

# Test 2: Campo sin mapeo → mapping_review_queue
psql -c "SELECT count(*) FROM nexus_system.mapping_review_queue 
         WHERE tenant_id='test-alpha' AND status='pending'"
# Expected: > 0 (campos sin mapeo insertados)

# Test 3: Tier 2 mapping → governance_queue
# Setup: mapeo con confidence=0.80
psql -c "SELECT count(*) FROM nexus_system.governance_queue 
         WHERE tenant_id='test-alpha' AND proposal_type='mapping_confidence_review'"
# Expected: > 0

# Test 4: CDMRegistryService cache
# Primer call → hit PostgreSQL
# Segundo call inmediato → cache hit (sin SQL)
# Después de 5 min o invalidate_cache → PostgreSQL nuevamente
```

### AI Store Router Worker

```bash
# Test 1: party → vector+graph
python -c "
from m1.workers.ai_store_router_worker import AIStoreRouterWorker
worker = AIStoreRouterWorker()
assert worker.ROUTING_TABLE['party'] == ['vector', 'graph']
assert worker.ROUTING_TABLE['transaction'] == ['graph', 'timeseries']
assert worker.ROUTING_TABLE['product'] == ['vector']
assert worker.ROUTING_TABLE['employee'] == ['vector', 'graph']
assert worker.ROUTING_TABLE['incident'] == ['vector', 'timeseries']
assert worker.ROUTING_TABLE['unknown'] == ['vector']
print('✅ Tabla de routing correcta')
"

# Test 2: ai_routing_decided publicado correctamente
kubectl exec -n nexus-data nexus-kafka-kafka-0 -- \
  bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 \
  --topic m1.int.ai_routing_decided --from-beginning --max-messages 1 | python -m json.tool
# Expected: routing_plan con destinations: ['vector', 'graph'] para party entities

# Test 3: Métricas Prometheus correctas
curl -s http://m1-ai-store-router.nexus-app.svc.cluster.local:9093/metrics | \
  grep m1_ai_routing_decisions_total
# Expected: contador por entity_type y destination
```

### E2E Test M1 Pipeline Completo

```bash
# Pre-requisito: tenant test-alpha provisionado, conector PostgreSQL registrado y activo

# Paso 1: Trigger manual sync
kubectl exec -n nexus-data nexus-kafka-kafka-0 -- \
  bin/kafka-console-producer.sh --bootstrap-server localhost:9092 \
  --topic m1.int.sync_requested << 'EOF'
{"message_id":"e2e-001","tenant_id":"test-alpha","event_type":"sync_requested",
 "payload":{"connector_id":"conn-pg-001","system_type":"postgresql","sync_mode":"full",
             "target_entities":["public.res_partner"],"batch_size":100},
 "correlation_id":"e2e-corr-001","trace_id":"e2e-trace-001",
 "schema_version":"1.0","cdm_version":"1.0.0","produced_at":"2026-03-02T10:00:00Z",
 "source_module":"test","permission_scope":[]}
EOF

# Paso 2: Esperar ~5 minutos y verificar pipeline completo
sleep 300

# Verificar cada topic en orden
for topic in m1.int.raw_records m1.int.delta_batch_ready m1.int.classified_records \
             m1.int.cdm_entities_ready m1.int.ai_routing_decided m1.int.ai_write_completed; do
  count=$(kubectl exec -n nexus-data nexus-kafka-kafka-0 -- \
    bin/kafka-run-class.sh kafka.tools.GetOffsetShell \
    --broker-list localhost:9092 --topic $topic --time -1 2>/dev/null | \
    awk -F: '{sum+=$3} END {print sum}')
  echo "$topic: $count mensajes"
done

# Expected: todos los topics con mensajes > 0 en orden cronológico
```

---

*NEXUS Build Plan — Archivo 04 · M1 Spark + CDM Mapper + AI Store Router · Mentis Consulting · Marzo 2026*
