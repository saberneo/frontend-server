# NEXUS — Archivo 03: M1 Workers
## Phase 2 · ConnectorWorker + Delta Writer Worker
### Semanas 4–6 · Equipo Data Intelligence · Depende de: NEXUS-02-M1-Connectors.md

---

## Tabla de Contenidos

1. [Contexto: El Flujo desde el Conector al Delta Lake](#1-contexto-el-flujo-desde-el-conector-al-delta-lake)
2. [P2-M1-08 — ConnectorWorker (con backpressure)](#2-p2-m1-08--connectorworker-con-backpressure)
3. [P2-M1-09 — Delta Writer Worker](#3-p2-m1-09--delta-writer-worker)
4. [ConnectorFactory — selección dinámica de conector](#4-connectorfactory--selección-dinámica-de-conector)
5. [CredentialLoader — lectura de Secrets Manager](#5-credentialloader--lectura-de-secrets-manager)
6. [Airflow DAG m1_sync_orchestrator](#6-airflow-dag-m1_sync_orchestrator)
7. [Airflow DAG m1_delta_processor (trigger para Spark)](#7-airflow-dag-m1_delta_processor-trigger-para-spark)
8. [Kubernetes Deployments para los Workers](#8-kubernetes-deployments-para-los-workers)
9. [Acceptance Criteria de Workers](#9-acceptance-criteria-de-workers)

---

## 1. Contexto: El Flujo desde el Conector al Delta Lake

```
PASO 1: Airflow DAG m1_sync_orchestrator
        → Publica NexusMessage a m1.int.sync_requested
        → Payload: {tenant_id, connector_id, sync_mode, target_entities}

PASO 2: ConnectorWorker (K8s Deployment, consumer group: m1-connector-workers)
        → Consume m1.int.sync_requested
        → Carga credenciales desde K8s Secret (origen: AWS Secrets Manager)
        → Instancia el conector correcto (postgres/salesforce/etc.)
        → Extrae registros (full o incremental)
        
        BACKPRESSURE (crítico):
          Si kafka_consumer_lag(m1.int.raw_records) > 50,000
            → ConnectorWorker.pause() — deja de extraer
            → espera polling hasta lag < 10,000
            → ConnectorWorker.resume()
        
        → Publica cada RawRecord como NexusMessage a m1.int.raw_records
        → COMMIT offset de sync_requested SOLO si el sync completó sin error
        → Si error → publica a m1.int.sync_failed

PASO 3: Delta Writer Worker (consumer group: m1-delta-writers)
        → Consume m1.int.raw_records
        → Buffer: acumula records
        
        FLUSH CONDITIONS (cualquiera que ocurra primero):
          a) buffer.size >= 5,000 records
          b) 30 segundos transcurridos desde último flush
        
        → Escribe batch a MinIO como Delta Lake (MERGE upsert — no INSERT)
        → Publica NexusMessage a m1.int.delta_batch_ready
        → COMMIT offset DESPUÉS de escribir Delta exitosamente

PASO 4: Airflow KafkaSensor en m1_delta_processor
        → Detecta mensaje en m1.int.delta_batch_ready
        → Lanza SparkApplication (siguiente archivo, Archivo 04)
```

---

## 2. P2-M1-08 — ConnectorWorker (con backpressure)

**Owner:** DI-Senior  
**Duración:** Semana 4–5  
**Consumer group:** `m1-connector-workers`  
**Archivo:** `m1/workers/connector_worker.py`

```python
# m1/workers/connector_worker.py
"""
ConnectorWorker — consume m1.int.sync_requested y extrae datos de sistemas fuente.

Loop principal:
  1. Poll sync_requested
  2. Verificar backpressure (raw_records lag)
  3. Cargar credenciales desde K8s Secret
  4. Instanciar conector correcto
  5. Conectar
  6. Extraer records (full o incremental)
  7. Para cada record: construir NexusMessage + publicar a raw_records
  8. Disconnect
  9. Actualizar sync_job en BD
  10. COMMIT offset de sync_requested
  11. Si error: publicar sync_failed + COMMIT
"""
import asyncio
import logging
import time
import os
from typing import Optional
from prometheus_client import Counter, Histogram, Gauge, start_http_server

import asyncpg
from nexus_core.messaging import NexusMessage, NexusProducer, NexusConsumer
from nexus_core.tenant import set_tenant, TenantContext
from nexus_core.topics import CrossModuleTopicNamer as T
from nexus_core.db import get_tenant_scoped_connection
from m1.connectors.base import ConnectorConfig, SyncMode, SystemType
from m1.connector_factory import ConnectorFactory
from m1.credential_loader import CredentialLoader
from m1.backpressure import BackpressureMonitor

logger = logging.getLogger(__name__)

# ── Métricas Prometheus ─────────────────────────────────────────────────────
records_extracted = Counter(
    "m1_connector_records_extracted_total",
    "Records extraídos y publicados a raw_records",
    ["tenant_id", "system_type", "sync_mode"],
)
sync_duration = Histogram(
    "m1_connector_sync_duration_seconds",
    "Duración del sync completo por conector",
    ["tenant_id", "system_type"],
    buckets=[30, 60, 120, 300, 600, 1800, 3600],
)
sync_failures = Counter(
    "m1_connector_sync_failures_total",
    "Syncs fallidos",
    ["tenant_id", "system_type", "error_type"],
)
backpressure_pauses = Counter(
    "m1_connector_backpressure_pauses_total",
    "Veces que el worker pausó por backpressure",
)
backpressure_active = Gauge(
    "m1_connector_backpressure_active",
    "1 si el worker está en modo backpressure, 0 si está activo",
)
# ─────────────────────────────────────────────────────────────────────────────


class ConnectorWorker:
    """
    Worker principal de extracción de M1.
    Se despliega como K8s Deployment con replicas=N.
    Cada pod es un consumer del grupo m1-connector-workers.
    """

    BACKPRESSURE_PAUSE_LAG = 50_000    # Pausa si el lag supera esto
    BACKPRESSURE_RESUME_LAG = 10_000   # Reanuda cuando baja a esto
    POLL_TIMEOUT_SEC = 2.0
    MAX_PUBLISH_RETRIES = 3

    def __init__(self):
        bootstrap = os.environ["KAFKA_BOOTSTRAP_SERVERS"]
        self._producer = NexusProducer(bootstrap, source_module="m1-connector-worker")
        self._consumer = NexusConsumer(
            bootstrap_servers=bootstrap,
            group_id="m1-connector-workers",
            topics=[T.STATIC.SYNC_REQUESTED],
        )
        self._backpressure = BackpressureMonitor(
            bootstrap_servers=bootstrap,
            topic=T.STATIC.RAW_RECORDS,
            consumer_group="m1-delta-writers",  # El lag que nos importa
        )
        self._db_pool: asyncpg.Pool = None
        self._credential_loader = CredentialLoader()
        self._running = False

    async def start(self) -> None:
        """Inicializar pool BD y arrancar el loop principal."""
        self._db_pool = await asyncpg.create_pool(
            dsn=os.environ["NEXUS_DB_DSN"],
            min_size=2,
            max_size=5,
        )
        start_http_server(9090)  # Prometheus metrics endpoint
        self._running = True
        logger.info("ConnectorWorker iniciado. Esperando mensajes en m1.int.sync_requested")
        await self._run_loop()

    async def _run_loop(self) -> None:
        while self._running:
            try:
                await self._process_one()
            except Exception as e:
                logger.error(f"Error inesperado en loop principal: {e}", exc_info=True)
                await asyncio.sleep(5)

    async def _process_one(self) -> None:
        # PASO 1: Poll
        msg = self._consumer.poll(timeout=self.POLL_TIMEOUT_SEC)
        if msg is None:
            return

        payload = msg.payload
        tenant_id = msg.tenant_id
        connector_id = payload["connector_id"]
        sync_mode_str = payload.get("sync_mode", "full")

        # PASO 2: Verificar backpressure ANTES de conectar al sistema fuente
        lag = await self._backpressure.get_lag()
        if lag > self.BACKPRESSURE_PAUSE_LAG:
            backpressure_pauses.inc()
            backpressure_active.set(1)
            logger.warning(
                f"BACKPRESSURE: raw_records lag={lag} > {self.BACKPRESSURE_PAUSE_LAG}. "
                f"Pausando connector_id={connector_id}"
            )
            # NO hacer commit — el mensaje se re-entregará cuando reanude
            await self._wait_for_backpressure_clear()
            backpressure_active.set(0)
            # Re-poll: el mensaje sigue pendiente
            return

        # PASO 3-4: Cargar credenciales + instanciar conector
        set_tenant(TenantContext(
            tenant_id=tenant_id,
            plan="professional",
            cdm_version=payload.get("cdm_version", "1.0.0"),
        ))

        job_id = await self._create_sync_job(tenant_id, connector_id, sync_mode_str)
        start_ts = time.perf_counter()

        try:
            credentials = await self._credential_loader.load(tenant_id, connector_id)
            system_type = SystemType(payload["system_type"])
            config = ConnectorConfig(
                connector_id=connector_id,
                tenant_id=tenant_id,
                system_type=system_type,
                sync_mode=SyncMode(sync_mode_str),
                credentials=credentials,
                target_entities=payload.get("target_entities", []),
                batch_size=int(payload.get("batch_size", 1000)),
                last_cursor_value=payload.get("last_cursor_value"),
            )
            connector = ConnectorFactory.create(config)

            # PASO 5-7: Conectar + extraer + publicar
            await connector.connect()
            records_count = 0

            extract_fn = (
                connector.extract_full
                if config.sync_mode == SyncMode.FULL
                else connector.extract_incremental
            )

            async for raw_record in extract_fn():
                # Construir NexusMessage manteniendo correlation_id
                nexus_msg = NexusMessage(
                    topic=T.STATIC.RAW_RECORDS,
                    tenant_id=tenant_id,
                    event_type="raw_record_extracted",
                    payload={
                        "record_id": raw_record.record_id,
                        "connector_id": raw_record.connector_id,
                        "system_type": raw_record.system_type,
                        "source_table": raw_record.source_table,
                        "source_schema": raw_record.source_schema,
                        "data": raw_record.data,
                        "extracted_at": raw_record.extracted_at,
                        "sync_mode": raw_record.sync_mode,
                        "batch_id": raw_record.batch_id,
                        "cursor_field": raw_record.cursor_field,
                        "cursor_value": raw_record.cursor_value,
                    },
                    correlation_id=msg.correlation_id,
                    trace_id=msg.trace_id,
                    source_module="m1-connector-worker",
                )
                # Particionar por tenant para ordenamiento
                self._producer.publish(nexus_msg, partition_key=tenant_id)
                records_count += 1

                # Métricas
                records_extracted.labels(
                    tenant_id=tenant_id,
                    system_type=system_type.value,
                    sync_mode=sync_mode_str,
                ).inc()

            # PASO 8: Disconnect
            await connector.disconnect()

            # PASO 9: Actualizar sync_job a completado
            duration = time.perf_counter() - start_ts
            await self._complete_sync_job(tenant_id, job_id, records_count)
            sync_duration.labels(
                tenant_id=tenant_id, system_type=system_type.value
            ).observe(duration)

            logger.info(
                f"Sync completado: connector_id={connector_id} "
                f"records={records_count} duration={duration:.2f}s"
            )

            # PASO 10: COMMIT offset — SOLO después de éxito
            self._consumer.commit(msg)

        except Exception as e:
            # PASO 11: Error path
            error_type = type(e).__name__
            sync_failures.labels(
                tenant_id=tenant_id,
                system_type=payload.get("system_type", "unknown"),
                error_type=error_type,
            ).inc()
            logger.error(
                f"Sync fallido: connector_id={connector_id} error={e}",
                exc_info=True,
            )
            await self._fail_sync_job(tenant_id, job_id, str(e))
            await self._publish_sync_failed(msg, connector_id, str(e))
            # COMMIT de todos modos — no queremos bucle infinito de errores
            self._consumer.commit(msg)

    async def _wait_for_backpressure_clear(self) -> None:
        """Espera activa hasta que el lag baje del umbral de reanudación."""
        while True:
            lag = await self._backpressure.get_lag()
            if lag < self.BACKPRESSURE_RESUME_LAG:
                logger.info(f"Backpressure despejado: lag={lag}. Reanudando extracción.")
                return
            logger.info(f"Backpressure activo: lag={lag}. Esperando 10s...")
            await asyncio.sleep(10)

    async def _create_sync_job(self, tenant_id: str, connector_id: str, sync_mode: str) -> str:
        """Crea un sync_job record en PostgreSQL. Retorna job_id."""
        import uuid
        job_id = str(uuid.uuid4())
        async with await get_tenant_scoped_connection(self._db_pool, tenant_id) as conn:
            await conn.execute("""
                INSERT INTO nexus_system.sync_jobs
                    (job_id, connector_id, tenant_id, status, sync_mode, started_at)
                SELECT $1, connector_id, $2, 'running', $3, NOW()
                FROM nexus_system.connectors
                WHERE connector_id = $4 AND tenant_id = $2
            """, job_id, tenant_id, sync_mode, connector_id)
        return job_id

    async def _complete_sync_job(self, tenant_id: str, job_id: str, records: int) -> None:
        async with await get_tenant_scoped_connection(self._db_pool, tenant_id) as conn:
            await conn.execute("""
                UPDATE nexus_system.sync_jobs
                SET status='completed', completed_at=NOW(), records_extracted=$1
                WHERE job_id=$2 AND tenant_id=$3
            """, records, job_id, tenant_id)

    async def _fail_sync_job(self, tenant_id: str, job_id: str, error: str) -> None:
        async with await get_tenant_scoped_connection(self._db_pool, tenant_id) as conn:
            await conn.execute("""
                UPDATE nexus_system.sync_jobs
                SET status='failed', completed_at=NOW(), error_message=$1
                WHERE job_id=$2 AND tenant_id=$3
            """, error[:1000], job_id, tenant_id)

    async def _publish_sync_failed(self, original: NexusMessage, connector_id: str, error: str) -> None:
        fail_msg = NexusMessage(
            topic=T.STATIC.SYNC_FAILED,
            tenant_id=original.tenant_id,
            event_type="sync_failed",
            payload={"connector_id": connector_id, "error": error},
            correlation_id=original.correlation_id,
            trace_id=original.trace_id,
        )
        self._producer.publish(fail_msg)
```

---

## 3. P2-M1-09 — Delta Writer Worker

**Owner:** DI-Senior  
**Duración:** Semana 5  
**Consumer group:** `m1-delta-writers`  
**Archivo:** `m1/workers/delta_writer_worker.py`

```python
# m1/workers/delta_writer_worker.py
"""
Delta Writer Worker — consume raw_records y escribe a Delta Lake en MinIO.

Reglas de flush:
  - Flush cuando buffer >= 5,000 records
  - Flush cuando han pasado >= 30 segundos desde el último flush
  (La condición que ocurra primero)

Escritura: MERGE upsert (no INSERT) — idempotente ante re-entregas.
Después del flush: publicar delta_batch_ready + COMMIT offset.
"""
import asyncio
import logging
import os
import time
import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Dict, List
from prometheus_client import Counter, Histogram, Gauge, start_http_server

from nexus_core.messaging import NexusMessage, NexusProducer, NexusConsumer
from nexus_core.topics import CrossModuleTopicNamer as T

logger = logging.getLogger(__name__)

# Métricas
records_written = Counter(
    "m1_delta_records_written_total",
    "Records escritos a Delta Lake",
    ["tenant_id", "source_table"],
)
flush_duration = Histogram(
    "m1_delta_flush_duration_seconds",
    "Duración de un flush a Delta Lake",
    ["tenant_id"],
)
buffer_size_gauge = Gauge(
    "m1_delta_buffer_size",
    "Tamaño actual del buffer por tenant",
    ["tenant_id"],
)
flush_failures = Counter(
    "m1_delta_flush_failures_total",
    "Flushes fallidos",
    ["tenant_id", "error_type"],
)

FLUSH_BATCH_SIZE = 5_000     # Flush si buffer alcanza este tamaño
FLUSH_INTERVAL_SEC = 30.0    # Flush si han pasado estos segundos
MINIO_ENDPOINT = os.environ.get("MINIO_ENDPOINT", "http://minio.nexus-storage.svc.cluster.local:9000")


@dataclass
class BufferedRecord:
    nexus_msg: NexusMessage
    table_key: str  # "{tenant_id}|{system_type}|{source_table}"


@dataclass
class WriterBuffer:
    records: List[BufferedRecord] = field(default_factory=list)
    last_flush_ts: float = field(default_factory=time.monotonic)
    pending_commits: List[NexusMessage] = field(default_factory=list)


class DeltaWriterWorker:
    """
    Escribe raw_records a Delta Lake en MinIO.
    Mantiene un buffer por (tenant_id, source_table) y hace flush
    cuando se cumplen las condiciones de tamaño o tiempo.
    """

    def __init__(self):
        bootstrap = os.environ["KAFKA_BOOTSTRAP_SERVERS"]
        self._consumer = NexusConsumer(
            bootstrap_servers=bootstrap,
            group_id="m1-delta-writers",
            topics=[T.STATIC.RAW_RECORDS],
        )
        self._producer = NexusProducer(bootstrap, source_module="m1-delta-writer")
        self._buffer: Dict[str, WriterBuffer] = defaultdict(WriterBuffer)
        self._running = False

    async def start(self) -> None:
        start_http_server(9091)
        self._running = True
        logger.info("DeltaWriterWorker iniciado. Consumiendo m1.int.raw_records")
        await asyncio.gather(
            self._consume_loop(),
            self._flush_timer_loop(),
        )

    async def _consume_loop(self) -> None:
        while self._running:
            msg = self._consumer.poll(timeout=1.0)
            if msg is None:
                continue

            payload = msg.payload
            tenant_id = msg.tenant_id
            source_table = payload.get("source_table", "unknown")
            system_type = payload.get("system_type", "unknown")
            buffer_key = f"{tenant_id}|{system_type}|{source_table}"

            buf = self._buffer[buffer_key]
            buf.records.append(BufferedRecord(nexus_msg=msg, table_key=buffer_key))
            buf.pending_commits.append(msg)
            buffer_size_gauge.labels(tenant_id=tenant_id).set(len(buf.records))

            # Flush por tamaño
            if len(buf.records) >= FLUSH_BATCH_SIZE:
                await self._flush(buffer_key, reason="size")

    async def _flush_timer_loop(self) -> None:
        """Comprueba cada 5 segundos si algún buffer lleva más de 30s sin flush."""
        while self._running:
            await asyncio.sleep(5)
            now = time.monotonic()
            for buffer_key in list(self._buffer.keys()):
                buf = self._buffer[buffer_key]
                if buf.records and (now - buf.last_flush_ts) >= FLUSH_INTERVAL_SEC:
                    await self._flush(buffer_key, reason="time")

    async def _flush(self, buffer_key: str, reason: str) -> None:
        """
        Escribe el buffer a Delta Lake y publica delta_batch_ready.
        COMMIT de TODOS los offsets del batch SOLO después de escritura exitosa.
        """
        buf = self._buffer[buffer_key]
        if not buf.records:
            return

        tenant_id, system_type, source_table = buffer_key.split("|")
        records_to_write = buf.records.copy()
        msgs_to_commit = buf.pending_commits.copy()

        # Limpiar buffer inmediatamente
        buf.records.clear()
        buf.pending_commits.clear()
        buf.last_flush_ts = time.monotonic()
        buffer_size_gauge.labels(tenant_id=tenant_id).set(0)

        batch_id = str(uuid.uuid4())
        start_ts = time.perf_counter()

        try:
            # Escribir a Delta Lake
            await self._write_to_delta(
                tenant_id=tenant_id,
                system_type=system_type,
                source_table=source_table,
                records=records_to_write,
                batch_id=batch_id,
            )

            duration = time.perf_counter() - start_ts
            flush_duration.labels(tenant_id=tenant_id).observe(duration)

            logger.info(
                f"Delta flush completado: tenant={tenant_id} table={source_table} "
                f"records={len(records_to_write)} batch_id={batch_id} "
                f"reason={reason} duration={duration:.2f}s"
            )

            # Publicar delta_batch_ready
            ready_msg = NexusMessage(
                topic=T.STATIC.DELTA_BATCH_READY,
                tenant_id=tenant_id,
                event_type="delta_batch_ready",
                payload={
                    "batch_id": batch_id,
                    "system_type": system_type,
                    "source_table": source_table,
                    "records_count": len(records_to_write),
                    "s3_path": self._get_s3_path(tenant_id, system_type, source_table),
                    "flush_reason": reason,
                },
                correlation_id=msgs_to_commit[-1].correlation_id if msgs_to_commit else str(uuid.uuid4()),
            )
            self._producer.publish(ready_msg)

            # COMMIT de todos los offsets del batch — SOLO aquí
            for commit_msg in msgs_to_commit:
                self._consumer.commit(commit_msg)

            records_written.labels(
                tenant_id=tenant_id, source_table=source_table
            ).inc(len(records_to_write))

        except Exception as e:
            error_type = type(e).__name__
            flush_failures.labels(tenant_id=tenant_id, error_type=error_type).inc()
            logger.error(
                f"Delta flush FALLIDO: tenant={tenant_id} table={source_table} "
                f"error={e}",
                exc_info=True,
            )
            # NO hacer commit — los mensajes se re-entregarán
            # Devolver registros al buffer para reintentar
            buf.records.extend(records_to_write)
            buf.pending_commits.extend(msgs_to_commit)

    async def _write_to_delta(
        self,
        tenant_id: str,
        system_type: str,
        source_table: str,
        records: List[BufferedRecord],
        batch_id: str,
    ) -> None:
        """
        Escribe registros a Delta Lake en MinIO via PySpark Delta API.
        
        MERGE upsert — encuentra record_id existente y actualiza, si no inserta.
        Esto hace el worker idempotente: si el mismo batch llega dos veces
        (crash y re-entrega), el resultado final es el mismo.
        """
        from pyspark.sql import SparkSession
        from delta.tables import DeltaTable
        import pyarrow as pa
        import pyarrow.parquet as pq

        s3_path = self._get_s3_path(tenant_id, system_type, source_table)

        # Preparar datos como lista de dicts
        rows = []
        for br in records:
            p = br.nexus_msg.payload
            rows.append({
                "record_id": p["record_id"],
                "tenant_id": tenant_id,
                "connector_id": p["connector_id"],
                "system_type": p["system_type"],
                "source_table": p["source_table"],
                "source_schema": p.get("source_schema"),
                "data": str(p["data"]),  # JSONB serializado
                "extracted_at": p["extracted_at"],
                "sync_mode": p["sync_mode"],
                "batch_id": batch_id,
                "cursor_value": p.get("cursor_value"),
            })

        # Usar Spark para escritura Delta (MERGE semántico)
        spark = self._get_or_create_spark()
        df_new = spark.createDataFrame(rows)

        try:
            # Si la tabla Delta ya existe: MERGE (upsert)
            delta_table = DeltaTable.forPath(spark, s3_path)
            delta_table.alias("existing").merge(
                df_new.alias("new"),
                "existing.record_id = new.record_id AND existing.tenant_id = new.tenant_id"
            ).whenMatchedUpdateAll().whenNotMatchedInsertAll().execute()
        except Exception:
            # Primera escritura — la tabla no existe aún
            df_new.write.format("delta").mode("append").save(s3_path)
            logger.info(f"Delta table creada: {s3_path}")

    def _get_s3_path(self, tenant_id: str, system_type: str, source_table: str) -> str:
        """Convención de paths S3 para Delta Lake."""
        return f"s3a://nexus-raw/{tenant_id}/{system_type}/{source_table}"

    def _get_or_create_spark(self):
        """Obtiene o crea SparkSession con config Delta + MinIO."""
        from pyspark.sql import SparkSession
        return (
            SparkSession.builder
            .appName("m1-delta-writer")
            .config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension")
            .config("spark.sql.catalog.spark_catalog", "org.apache.spark.sql.delta.catalog.DeltaCatalog")
            .config("spark.hadoop.fs.s3a.endpoint", MINIO_ENDPOINT)
            .config("spark.hadoop.fs.s3a.path.style.access", "true")
            .config("spark.hadoop.fs.s3a.access.key", os.environ["MINIO_ACCESS_KEY"])
            .config("spark.hadoop.fs.s3a.secret.key", os.environ["MINIO_SECRET_KEY"])
            .getOrCreate()
        )
```

---

## 4. ConnectorFactory — selección dinámica de conector

**Archivo:** `m1/connector_factory.py`

```python
# m1/connector_factory.py
from m1.connectors.base import ConnectorConfig, SystemType, BaseConnector


class ConnectorFactory:
    """
    Instancia el conector correcto según SystemType.
    Punto único de creación — no importar conectores directamente en los workers.
    """

    @staticmethod
    def create(config: ConnectorConfig) -> BaseConnector:
        match config.system_type:
            case SystemType.POSTGRESQL:
                from m1.connectors.postgresql_connector import PostgreSQLConnector
                return PostgreSQLConnector(config)
            case SystemType.MYSQL:
                from m1.connectors.mysql_connector import MySQLConnector
                return MySQLConnector(config)
            case SystemType.SALESFORCE:
                from m1.connectors.salesforce_connector import SalesforceConnector
                return SalesforceConnector(config)
            case SystemType.ODOO:
                from m1.connectors.odoo_connector import OdooConnector
                return OdooConnector(config)
            case SystemType.SERVICENOW:
                from m1.connectors.servicenow_connector import ServiceNowConnector
                return ServiceNowConnector(config)
            case SystemType.SQLSERVER:
                from m1.connectors.sqlserver_connector import SQLServerConnector
                return SQLServerConnector(config)
            case _:
                raise ValueError(
                    f"Tipo de sistema no soportado: {config.system_type}. "
                    f"Tipos válidos: {[e.value for e in SystemType]}"
                )
```

---

## 5. CredentialLoader — lectura de Secrets Manager

**Archivo:** `m1/credential_loader.py`

```python
# m1/credential_loader.py
"""
Carga credenciales desde el K8s Secret montado como volumen.
El Secret fue creado por ExternalSecrets Operator desde AWS Secrets Manager.

Path: /var/run/secrets/connectors/{connector_id}/credentials
"""
import json
import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)

SECRETS_BASE_PATH = Path(
    os.environ.get("CONNECTOR_SECRETS_PATH", "/var/run/secrets/connectors")
)


class CredentialLoader:
    """
    Lee credenciales de conectores desde K8s Secret montado como volumen.
    
    El ExternalSecrets Operator sincroniza:
      AWS Secrets Manager: nexus/{tenant_id}/{connector_id}/credentials
      → K8s Secret: connector-{connector_id}-credentials
      → Montado en: /var/run/secrets/connectors/{connector_id}/credentials
    
    NUNCA leer credenciales de variables de entorno del pod.
    NUNCA loguear los valores de las credenciales.
    """

    async def load(self, tenant_id: str, connector_id: str) -> dict:
        """
        Carga credenciales del secret montado.
        Lanza FileNotFoundError si el secret no está montado.
        Lanza KeyError si el campo requerido no existe.
        """
        secret_path = SECRETS_BASE_PATH / connector_id / "credentials"

        if not secret_path.exists():
            raise FileNotFoundError(
                f"Secret no encontrado en {secret_path}. "
                f"Verificar ExternalSecret para connector_id={connector_id} "
                f"tenant_id={tenant_id}"
            )

        with open(secret_path, "r") as f:
            creds = json.load(f)

        # Log solo las keys, NUNCA los values
        logger.info(
            f"Credenciales cargadas para connector_id={connector_id}: "
            f"keys={list(creds.keys())}"
        )
        return creds
```

---

## 6. Airflow DAG m1_sync_orchestrator

**Archivo:** `dags/m1_sync_orchestrator.py`

```python
# dags/m1_sync_orchestrator.py
"""
DAG Airflow que orquesta los syncs de M1.

Dos triggers:
  1. Scheduled: publicar sync_requested para todos los conectores activos (diario)
  2. Manual: publicar sync_requested para un conector específico

NOTA: Este DAG no extrae datos — solo publica el trigger.
La extracción real la hace el ConnectorWorker.
"""
import json
import logging
from datetime import datetime, timedelta

from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.providers.apache.kafka.operators.produce import ProduceToTopicOperator

logger = logging.getLogger(__name__)

default_args = {
    "owner": "nexus-di-team",
    "depends_on_past": False,
    "email_on_failure": True,
    "email": ["di-alerts@mentis-consulting.be"],
    "retries": 1,
    "retry_delay": timedelta(minutes=5),
}

with DAG(
    dag_id="m1_sync_orchestrator",
    default_args=default_args,
    description="Orquestador de syncs M1 — publica sync_requested para todos los conectores",
    schedule_interval="0 2 * * *",  # Todos los días a las 02:00
    start_date=datetime(2026, 3, 2),
    catchup=False,
    max_active_runs=1,
    tags=["m1", "sync", "nexus"],
) as dag:

    def get_active_connectors(**context):
        """Obtiene lista de conectores activos de PostgreSQL."""
        import asyncpg
        import asyncio
        import os

        async def _fetch():
            pool = await asyncpg.create_pool(dsn=os.environ["NEXUS_DB_DSN"])
            rows = await pool.fetch(
                "SELECT connector_id, tenant_id, system_type, config "
                "FROM nexus_system.connectors WHERE status = 'active'"
            )
            await pool.close()
            return [dict(r) for r in rows]

        connectors = asyncio.run(_fetch())
        logger.info(f"Conectores activos a sincronizar: {len(connectors)}")
        context["task_instance"].xcom_push("connectors", connectors)
        return connectors

    def produce_sync_requests(**context):
        """
        Publica un NexusMessage sync_requested por cada conector activo.
        Usa la misma producción que los workers pero desde Airflow.
        """
        import os
        import uuid
        from nexus_core.messaging import NexusMessage, NexusProducer
        from nexus_core.topics import CrossModuleTopicNamer as T

        connectors = context["task_instance"].xcom_pull("connectors") or []
        producer = NexusProducer(
            os.environ["KAFKA_BOOTSTRAP_SERVERS"],
            source_module="airflow-m1-sync-orchestrator"
        )
        correlation_id = str(uuid.uuid4())

        for c in connectors:
            config = c.get("config") or {}
            msg = NexusMessage(
                topic=T.STATIC.SYNC_REQUESTED,
                tenant_id=c["tenant_id"],
                event_type="sync_requested",
                payload={
                    "connector_id": c["connector_id"],
                    "system_type": c["system_type"],
                    "sync_mode": config.get("sync_mode", "incremental"),
                    "target_entities": config.get("target_entities", []),
                    "batch_size": config.get("batch_size", 1000),
                    "last_cursor_value": config.get("last_cursor_value"),
                    "cdm_version": config.get("cdm_version", "1.0.0"),
                },
                correlation_id=correlation_id,
            )
            producer.publish(msg, partition_key=c["tenant_id"])
            logger.info(
                f"sync_requested publicado: connector_id={c['connector_id']} "
                f"tenant_id={c['tenant_id']} mode={config.get('sync_mode','incremental')}"
            )

    fetch_connectors = PythonOperator(
        task_id="fetch_active_connectors",
        python_callable=get_active_connectors,
        provide_context=True,
    )

    publish_requests = PythonOperator(
        task_id="publish_sync_requests",
        python_callable=produce_sync_requests,
        provide_context=True,
    )

    fetch_connectors >> publish_requests
```

---

## 7. Airflow DAG m1_delta_processor (trigger para Spark)

**Archivo:** `dags/m1_delta_processor.py`

```python
# dags/m1_delta_processor.py
"""
DAG que detecta delta_batch_ready en Kafka y lanza el SparkJob de clasificación.
El SparkJob (m1_classify_and_prepare) está en Archivo 04.
"""
from datetime import datetime, timedelta
from airflow import DAG
from airflow.providers.apache.kafka.sensors.kafka import KafkaSensor
from airflow.providers.apache.spark.operators.spark_submit import SparkSubmitOperator

default_args = {
    "owner": "nexus-di-team",
    "retries": 2,
    "retry_delay": timedelta(minutes=3),
}

with DAG(
    dag_id="m1_delta_processor",
    default_args=default_args,
    description="Detecta delta_batch_ready y lanza Spark para clasificar y mapear",
    schedule_interval=None,  # Solo triggered por KafkaSensor
    start_date=datetime(2026, 3, 2),
    catchup=False,
    tags=["m1", "spark", "delta"],
) as dag:

    wait_for_delta_batch = KafkaSensor(
        task_id="wait_for_delta_batch_ready",
        kafka_config_id="nexus_kafka",
        topics=["m1.int.delta_batch_ready"],
        apply_function="m1.airflow.kafka_message_handler.process_delta_batch",
        poll_timeout=5,
        poke_interval=10,
        timeout=3600,
        mode="poke",
    )

    classify_and_prepare = SparkSubmitOperator(
        task_id="spark_classify_and_prepare",
        conn_id="nexus_spark",
        application="s3a://nexus-raw/spark-jobs/m1_classify_and_prepare.py",
        name="m1-classify-{{ ds }}",
        executor_cores=2,
        executor_memory="4g",
        num_executors=4,
        driver_memory="2g",
        conf={
            "spark.sql.extensions": "io.delta.sql.DeltaSparkSessionExtension",
            "spark.sql.catalog.spark_catalog": "org.apache.spark.sql.delta.catalog.DeltaCatalog",
            "spark.dynamicAllocation.enabled": "true",
        },
        application_args=[
            "--batch-id={{ task_instance.xcom_pull('wait_for_delta_batch_ready') }}",
            "--date={{ ds }}",
        ],
    )

    wait_for_delta_batch >> classify_and_prepare
```

---

## 8. Kubernetes Deployments para los Workers

### ConnectorWorker Deployment

```yaml
# k8s/m1/connector-worker-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: m1-connector-worker
  namespace: nexus-app
spec:
  replicas: 3   # 3 pods = 3 particiones de sync_requested procesadas en paralelo
  selector:
    matchLabels:
      app: m1-connector-worker
  template:
    metadata:
      labels:
        app: m1-connector-worker
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "9090"
    spec:
      serviceAccountName: nexus-app-sa
      containers:
      - name: connector-worker
        image: nexus-registry/m1-connector-worker:latest
        command: ["python", "-m", "m1.workers.connector_worker"]
        env:
        - name: KAFKA_BOOTSTRAP_SERVERS
          value: "nexus-kafka-kafka-bootstrap.nexus-data.svc.cluster.local:9092"
        - name: NEXUS_DB_DSN
          valueFrom:
            secretKeyRef:
              name: nexus-db-credentials
              key: dsn
        - name: MINIO_ACCESS_KEY
          valueFrom:
            secretKeyRef:
              name: nexus-minio-credentials
              key: access_key
        - name: MINIO_SECRET_KEY
          valueFrom:
            secretKeyRef:
              name: nexus-minio-credentials
              key: secret_key
        - name: CONNECTOR_SECRETS_PATH
          value: "/var/run/secrets/connectors"
        volumeMounts:
        - name: connector-secrets
          mountPath: /var/run/secrets/connectors
          readOnly: true
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1"
        livenessProbe:
          httpGet:
            path: /metrics
            port: 9090
          initialDelaySeconds: 30
          periodSeconds: 30
      volumes:
      - name: connector-secrets
        projected:
          sources:
          - secret:
              name: connector-credentials-all-tenants
```

### DeltaWriterWorker Deployment

```yaml
# k8s/m1/delta-writer-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: m1-delta-writer
  namespace: nexus-app
spec:
  replicas: 4   # 4 pods para las 16 particiones de raw_records
  selector:
    matchLabels:
      app: m1-delta-writer
  template:
    metadata:
      labels:
        app: m1-delta-writer
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "9091"
    spec:
      serviceAccountName: nexus-app-sa
      containers:
      - name: delta-writer
        image: nexus-registry/m1-delta-writer:latest
        command: ["python", "-m", "m1.workers.delta_writer_worker"]
        env:
        - name: KAFKA_BOOTSTRAP_SERVERS
          value: "nexus-kafka-kafka-bootstrap.nexus-data.svc.cluster.local:9092"
        - name: MINIO_ENDPOINT
          value: "http://minio.nexus-storage.svc.cluster.local:9000"
        - name: MINIO_ACCESS_KEY
          valueFrom:
            secretKeyRef:
              name: nexus-minio-credentials
              key: access_key
        - name: MINIO_SECRET_KEY
          valueFrom:
            secretKeyRef:
              name: nexus-minio-credentials
              key: secret_key
        resources:
          requests:
            memory: "2Gi"
            cpu: "500m"
          limits:
            memory: "6Gi"   # Buffer puede crecer — memoria generosa
            cpu: "2"
```

### BackpressureMonitor — implementación

```python
# m1/backpressure.py
"""
Monitoriza el consumer group lag de m1-delta-writers en raw_records.
Usado por ConnectorWorker para implementar backpressure.
"""
from confluent_kafka.admin import AdminClient
import logging

logger = logging.getLogger(__name__)


class BackpressureMonitor:
    def __init__(self, bootstrap_servers: str, topic: str, consumer_group: str):
        self._admin = AdminClient({"bootstrap.servers": bootstrap_servers})
        self._topic = topic
        self._consumer_group = consumer_group

    async def get_lag(self) -> int:
        """
        Calcula el lag total del consumer group en el topic.
        Retorna la suma de lags de todas las particiones.
        """
        import asyncio
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._get_lag_sync)

    def _get_lag_sync(self) -> int:
        from confluent_kafka import TopicPartition, Consumer
        # Consumer temporal solo para consultar offsets
        c = Consumer({
            "bootstrap.servers": self._admin._conf,
            "group.id": self._consumer_group,
            "enable.auto.commit": False,
        })
        try:
            metadata = c.list_topics(self._topic, timeout=10)
            partitions = [
                TopicPartition(self._topic, p)
                for p in metadata.topics[self._topic].partitions.keys()
            ]
            committed = c.committed(partitions, timeout=10)
            lag_total = 0
            for tp in committed:
                low, high = c.get_watermark_offsets(tp, timeout=5)
                committed_offset = tp.offset if tp.offset >= 0 else low
                lag_total += max(0, high - committed_offset)
            return lag_total
        except Exception as e:
            logger.warning(f"Error calculando lag: {e}. Asumiendo lag=0")
            return 0
        finally:
            c.close()
```

---

## 9. Acceptance Criteria de Workers

### ConnectorWorker

```bash
# Test 1: Happy path — sync completo con 10 records
# Setup: crear sync_requested en Kafka con connector válido
kubectl exec -n nexus-data nexus-kafka-kafka-0 -- \
  bin/kafka-console-producer.sh --bootstrap-server localhost:9092 \
  --topic m1.int.sync_requested << 'EOF'
{
  "message_id": "test-001",
  "tenant_id": "test-alpha",
  "event_type": "sync_requested",
  "payload": {
    "connector_id": "conn-test-001",
    "system_type": "postgresql",
    "sync_mode": "full",
    "target_entities": ["public.test_orders"],
    "batch_size": 100
  },
  "correlation_id": "corr-001",
  "trace_id": "trace-001",
  "schema_version": "1.0",
  "cdm_version": "1.0.0",
  "produced_at": "2026-03-02T10:00:00Z",
  "source_module": "test"
}
EOF

# Verificar que raw_records recibe los mensajes
kubectl exec -n nexus-data nexus-kafka-kafka-0 -- \
  bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 \
  --topic m1.int.raw_records --from-beginning --max-messages 5
# Expected: 5 mensajes con event_type="raw_record_extracted"

# Test 2: Backpressure
# Producir 60,000 mensajes dummy a raw_records para generar lag
# Verificar que ConnectorWorker deja de consumir sync_requested
kubectl logs -n nexus-app -l app=m1-connector-worker | grep "BACKPRESSURE"
# Expected: "BACKPRESSURE: raw_records lag=60000 > 50000. Pausando..."

# Test 3: Crash recovery
# Matar el pod a mitad de un sync
kubectl delete pod -n nexus-app $(kubectl get pods -n nexus-app -l app=m1-connector-worker -o name | head -1)
# Verificar que el nuevo pod re-entrega y completa el sync
# Expected: registros en raw_records sin duplicados masivos (MERGE en Delta Writer)

# Test 4: sync_job en BD
psql -c "SELECT status, records_extracted FROM nexus_system.sync_jobs 
         WHERE connector_id='conn-test-001' ORDER BY started_at DESC LIMIT 1"
# Expected: status='completed', records_extracted=10
```

### DeltaWriterWorker

```bash
# Test 1: Flush por tamaño (5,000 records)
# Producir 5,100 raw_records para el mismo tenant/tabla
# Verificar que flush ocurre después de records 5000
kubectl logs -n nexus-app -l app=m1-delta-writer | grep "Delta flush completado"
# Expected: "records=5000 reason=size"

# Test 2: Flush por tiempo (30 segundos)
# Producir 100 records y esperar 35 segundos
kubectl logs -n nexus-app -l app=m1-delta-writer | grep "Delta flush completado"
# Expected dentro de 35s: "records=100 reason=time"

# Test 3: Verificar MERGE (idempotencia)
# Enviar mismo batch dos veces → Delta Lake no debe duplicar
mc ls nexus/nexus-raw/test-alpha/postgresql/test_orders/ | grep ".parquet" | wc -l
# Expected: mismo count de particiones (no duplicó)

# Test 4: delta_batch_ready publicado tras flush exitoso
kubectl exec -n nexus-data nexus-kafka-kafka-0 -- \
  bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 \
  --topic m1.int.delta_batch_ready --from-beginning --max-messages 1
# Expected: mensaje con batch_id, records_count, s3_path

# Test 5: Flush fallido → NO commit → re-entrega
# Simular MinIO no disponible temporalmente
# Expected: los mensajes se reencolan y se procesan cuando MinIO vuelve
```

---

*NEXUS Build Plan — Archivo 03 · M1 Workers · Mentis Consulting · Marzo 2026*
