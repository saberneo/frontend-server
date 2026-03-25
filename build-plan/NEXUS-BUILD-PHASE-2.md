# NEXUS — Plan de Construcción · FASE 2
## M1 Data Intelligence Pipeline + M3 Knowledge Stores
### Semanas 3–10 · Data Intelligence Team + AI & Knowledge Team
**Mentis Consulting · Marzo 2026 · Confidencial**

---

> **Prerrequisito absoluto:** NEXUS-BUILD-PHASE-1.md completado al 100% antes de comenzar.
> **Regla crítica M1:** Cero LLMs en M1 operacional — toda inferencia vive en M2.
> **Regla crítica todos:** Kafka para eventos de pipeline — cero REST inter-módulos.

---

## Tabla de Contenidos

1. [Arquitectura del Pipeline M1](#1-arquitectura-del-pipeline-m1)
2. [P2-M1-01 — BaseConnector Abstract + ConnectorConfig](#2-p2-m1-01--baseconnector-abstract--connectorconfig)
3. [P2-M1-02 — PostgreSQL Connector](#3-p2-m1-02--postgresql-connector)
4. [P2-M1-03 — Salesforce Connector](#4-p2-m1-03--salesforce-connector)
5. [P2-M1-04 — Odoo Connector](#5-p2-m1-04--odoo-connector)
6. [P2-M1-05 — ServiceNow Connector + Debezium CDC](#6-p2-m1-05--servicenow-connector--debezium-cdc)
7. [P2-M1-06 — ConnectorWorker (Consumidor Kafka Principal)](#7-p2-m1-06--connectorworker-consumidor-kafka-principal)
8. [P2-M1-07 — Delta Writer Worker](#8-p2-m1-07--delta-writer-worker)
9. [P2-M1-08 — Airflow DAG m1_sync_orchestrator](#9-p2-m1-08--airflow-dag-m1_sync_orchestrator)
10. [P2-M1-09 — Spark Job m1_classify_and_prepare](#10-p2-m1-09--spark-job-m1_classify_and_prepare)
11. [P2-M1-10 — CDM Mapper Worker + AI Store Router](#11-p2-m1-10--cdm-mapper-worker--ai-store-router)
12. [P3: Structural Sub-Cycle — Schema Profiler](#12-p3-structural-sub-cycle--schema-profiler)
13. [P3: Structural Sub-Cycle — Airflow DAG m1_structural_cycle](#13-p3-structural-sub-cycle--airflow-dag-m1_structural_cycle)
14. [P3: Structural Sub-Cycle — Schema Drift Detector](#14-p3-structural-sub-cycle--schema-drift-detector)
15. [P5-M3-01 — Vector Writer (Pinecone)](#15-p5-m3-01--vector-writer-pinecone)
16. [P5-M3-02 — Graph Writer (Neo4j)](#16-p5-m3-02--graph-writer-neo4j)
17. [P5-M3-03 — TimeSeries Writer (TimescaleDB)](#17-p5-m3-03--timeseries-writer-timescaledb)
18. [Contratos Inter-Equipo M1↔M2↔M3](#18-contratos-inter-equipo-m1m2m3)
19. [Checklist de Gate Fase 2](#19-checklist-de-gate-fase-2)

---

## 1. Arquitectura del Pipeline M1

### Flujo completo de datos

```
Sistema Externo (Salesforce, Odoo, PG, etc.)
         │
         │  [ConnectorWorker] — consume m1.int.sync_requested
         ▼
RawRecord (extracción por lotes)
         │
         │  → publica a m1.int.raw_records (16 particiones)
         ▼
[DeltaWriter Worker] — consume m1.int.raw_records
         │  flush: 5000 records o 30 segundos (lo que sea primero)
         │  escribe MERGE upsert en Delta Lake (nexus-raw bucket)
         │  → publica a m1.int.delta_batch_ready
         ▼
[Airflow DAG: m1_sync_orchestrator] — trigger por KafkaSensor
         │
         │  SparkSubmit: m1_classify_and_prepare
         ▼
[Spark Job] — lee nexus-raw, clasifica entidades, escribe nexus-classified
  Clasificación:
    party:       partner, account, customer, user, contact, client, kunnr
    transaction: invoice, order, payment, sale, purchase, transaction
    product:     product, item, article, sku, material
    employee:    employee, staff, worker, person, hr
    incident:    incident, ticket, case, issue, problem, request
         │
         │  → publica a m1.int.classified_records
         ▼
[CDM Mapper Worker] — consume m1.int.classified_records
         │  consulta CDMRegistryService (cache 5min)
         │  aplica mapeos Tier 1/2/3
         │  escribe CDMEntity objects en nexus-cdm bucket
         │  → publica m1.int.cdm_entities_ready
         ▼
[AI Store Router] — consume m1.int.cdm_entities_ready
         │
         │  Routing table:
         │    party       → Vector + Graph
         │    transaction → Graph + TimeSeries
         │    product     → Vector
         │    employee    → Vector + Graph
         │    incident    → Vector + TimeSeries
         │
         ├──→ m3/Vector Writer (Pinecone) — all-MiniLM-L6-v2, 384 dims
         ├──→ m3/Graph Writer (Neo4j AuraDB)
         └──→ m3/TimeSeries Writer (TimescaleDB)
                  │
                  └──→ publica m1.int.ai_write_completed
```

### Mapa de Consumer Groups

```
m1-connector-workers → consume: m1.int.sync_requested
m1-delta-writers     → consume: m1.int.raw_records
m1-cdm-mappers       → consume: m1.int.classified_records
m1-ai-store-writers  → consume: m1.int.cdm_entities_ready
```

### Diagrama temporal (con Structural Sub-Cycle en paralelo)

```
Semana 3  Semana 4  Semana 5  Semana 6  Semana 7  Semana 8  Semana 9  Semana 10
├─────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┤
│ BaseConn│PG+SF    │ Odoo    │Service  │Connector│DeltaWrt │Spark    │CDMMapper│
│ P2-M1-01│P2-M1-02 │P2-M1-04 │Now CDC  │Worker   │P2-M1-07 │P2-M1-09 │AIRouter │
│         │P2-M1-03 │         │P2-M1-05 │P2-M1-06 │Airflow  │         │P2-M1-10 │
│         │         │         │         │         │P2-M1-08 │         │         │

─ PARALELO desde Semana 4 ─────────────────────────────────────────────────────────
│         │SchemaProf│Struct.  │Drift    │         │         │         │         │
│         │P3-01    │DAG P3-02│Detect.  │         │         │         │         │
│         │         │         │P3-03    │         │         │         │         │

─ M3 — después de CDM Mapper ────────────────────────────────────────────────────
│         │         │         │         │VecWriter│GraphWrt │TSWriter │Integrado │
│         │         │         │         │P5-M3-01 │P5-M3-02 │P5-M3-03 │E2E ready│
```

---

## 2. P2-M1-01 — BaseConnector Abstract + ConnectorConfig

**Owner:** Senior Backend M1
**Depende de:** NEXUS-BUILD-PHASE-1.md completo
**Duración:** Semana 3 · 3 días

### m1/base_connector.py

```python
# m1/base_connector.py
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, AsyncIterator, Dict, List, Optional
import uuid
import logging

from nexus_core.messaging import NexusMessage
from nexus_core.topics import CrossModuleTopicNamer

logger = logging.getLogger(__name__)


class SyncMode(Enum):
    """
    Modo de sincronización del conector.
    FULL: extrae todos los registros del sistema fuente.
    INCREMENTAL: solo cambios desde last_cursor (fecha, ID, secuencia).
    CDC: Change Data Capture via Debezium stream (para DBs relacionales).
    """
    FULL = "full"
    INCREMENTAL = "incremental"
    CDC = "cdc"


class SystemType(Enum):
    """
    Tipos de sistema ERP/CRM soportados.
    Agregar nuevos tipos requiere actualización de las clasificaciones en Spark.
    """
    SALESFORCE = "salesforce"
    ODOO = "odoo"
    SERVICENOW = "servicenow"
    POSTGRESQL = "postgresql"
    MYSQL = "mysql"
    SQLSERVER = "sqlserver"
    HUBSPOT = "hubspot"
    SAP = "sap"
    DYNAMICS = "dynamics"
    CUSTOM = "custom"


@dataclass
class ConnectorConfig:
    """
    Configuración base. Las credenciales NUNCA van aquí — se leen desde
    AWS Secrets Manager vía External Secrets Operator.
    """
    connector_id: str
    tenant_id: str
    system_type: SystemType
    connector_name: str
    sync_mode: SyncMode
    sync_schedule_cron: str                # e.g. "0 */4 * * *" (cada 4h)
    batch_size: int = 1000                 # Registros por lote Kafka
    secret_path: str = None                # nexus/{tenant_id}/{connector_id}/credentials
    extra: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        if self.secret_path is None:
            self.secret_path = (
                f"nexus/{self.tenant_id}/{self.connector_id}/credentials"
            )


@dataclass
class RawRecord:
    """
    Un registro extraído de un sistema fuente antes de cualquier transformación.
    Regla: sin modificaciones al data dict — exactamente como vino del sistema.
    """
    record_id: str
    source_system: str         # SystemType.value
    source_table: str          # Nombre de la tabla/objeto origen
    tenant_id: str
    data: Dict[str, Any]       # Valores raw — sin transformar, sin filtrar
    extracted_at: datetime = field(default_factory=datetime.utcnow)
    is_deleted: bool = False   # Para soft-delete CDC events
    extract_id: str = field(default_factory=lambda: str(uuid.uuid4()))

    def to_kafka_payload(self) -> Dict[str, Any]:
        """Convierte a dict serializable para NexusMessage.payload."""
        return {
            "record_id": self.record_id,
            "source_system": self.source_system,
            "source_table": self.source_table,
            "tenant_id": self.tenant_id,
            "data": self.data,
            "extracted_at": self.extracted_at.isoformat(),
            "is_deleted": self.is_deleted,
            "extract_id": self.extract_id,
        }


class BaseConnector(ABC):
    """
    Clase abstracta base para todos los conectores de sistema.
    Implementar: extract_batch(), get_schema(), test_connection().
    NO implementar lógica de Kafka — eso es responsabilidad de ConnectorWorker.
    """

    def __init__(self, config: ConnectorConfig):
        self.config = config
        self._logger = logging.getLogger(
            f"{self.__class__.__name__}[{config.connector_id}]"
        )

    @abstractmethod
    async def test_connection(self) -> bool:
        """
        Verifica que la conexión al sistema fuente funciona.
        Retorna True si OK, lanza ConnectorConnectionError si no.
        """
        ...

    @abstractmethod
    async def extract_batch(
        self,
        table: str,
        sync_mode: SyncMode,
        cursor: Optional[Any] = None,
    ) -> AsyncIterator[List[RawRecord]]:
        """
        Extrae registros del sistema fuente por lotes.
        cursor: para INCREMENTAL — fecha, id, secuencia del último registro
        Yields: listas de RawRecord (tamaño = config.batch_size)
        """
        ...

    @abstractmethod
    async def get_schema(self, table: str) -> Dict[str, Any]:
        """
        Retorna el schema de la tabla como dict:
        {field_name: {type: str, nullable: bool, length: int|None}}
        Usado por el Schema Profiler en el structural cycle.
        """
        ...

    async def get_tables(self) -> List[str]:
        """
        Lista todas las tablas/objetos disponibles en el sistema fuente.
        Override en cada conector — default retorna lista vacía.
        """
        return []

    def make_record_id(self, natural_key: str, table: str) -> str:
        """Genera record_id determinístico para idempotencia."""
        import hashlib
        raw = f"{self.config.tenant_id}:{self.config.connector_id}:{table}:{natural_key}"
        return hashlib.sha256(raw.encode()).hexdigest()[:32]
```

---

## 3. P2-M1-02 — PostgreSQL Connector

**Owner:** Senior Backend M1
**Depende de:** P2-M1-01
**Duración:** Semana 3–4

### m1/connectors/postgresql_connector.py

```python
# m1/connectors/postgresql_connector.py
import asyncpg
import logging
from typing import Any, AsyncIterator, Dict, List, Optional
from datetime import datetime

from m1.base_connector import BaseConnector, ConnectorConfig, RawRecord, SyncMode, SystemType

logger = logging.getLogger(__name__)


class PostgreSQLConnector(BaseConnector):
    """
    Conector para bases de datos PostgreSQL.
    Credenciales en AWS Secrets Manager: {host, port, database, username, password}
    Soporta: FULL, INCREMENTAL (por columna updated_at), CDC (vía Debezium)
    """

    def __init__(self, config: ConnectorConfig):
        super().__init__(config)
        self._pool: Optional[asyncpg.Pool] = None
        self._credentials: Optional[Dict[str, str]] = None

    async def _get_credentials(self) -> Dict[str, str]:
        """Lee credenciales desde el Kubernetes Secret (montado por ESO)."""
        if self._credentials:
            return self._credentials

        import json, os
        # Los External Secrets montan el secret en /var/run/secrets/{connector_id}/
        secret_path = f"/var/run/secrets/connector-{self.config.connector_id}/credentials"
        try:
            with open(secret_path) as f:
                self._credentials = json.load(f)
        except FileNotFoundError:
            # Fallback para dev local: leer desde env vars
            self._credentials = {
                "host":     os.environ[f"PG_{self.config.connector_id.upper()}_HOST"],
                "port":     os.environ.get(f"PG_{self.config.connector_id.upper()}_PORT", "5432"),
                "database": os.environ[f"PG_{self.config.connector_id.upper()}_DATABASE"],
                "username": os.environ[f"PG_{self.config.connector_id.upper()}_USERNAME"],
                "password": os.environ[f"PG_{self.config.connector_id.upper()}_PASSWORD"],
            }
        return self._credentials

    async def _get_pool(self) -> asyncpg.Pool:
        if self._pool:
            return self._pool
        creds = await self._get_credentials()
        self._pool = await asyncpg.create_pool(
            host=creds["host"],
            port=int(creds.get("port", 5432)),
            database=creds["database"],
            user=creds["username"],
            password=creds["password"],
            min_size=1,
            max_size=5,
            command_timeout=60,
        )
        return self._pool

    async def test_connection(self) -> bool:
        pool = await self._get_pool()
        async with pool.acquire() as conn:
            result = await conn.fetchval("SELECT 1")
        if result != 1:
            raise ConnectionError(f"Conector PG {self.config.connector_id} test falló")
        logger.info(f"Conexión PostgreSQL OK para conector {self.config.connector_id}")
        return True

    async def get_tables(self) -> List[str]:
        pool = await self._get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT table_schema || '.' || table_name as table_full_name
                FROM information_schema.tables
                WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
                  AND table_type = 'BASE TABLE'
                ORDER BY table_schema, table_name
            """)
        return [r["table_full_name"] for r in rows]

    async def get_schema(self, table: str) -> Dict[str, Any]:
        schema_name, table_name = (
            table.split(".", 1) if "." in table else ("public", table)
        )
        pool = await self._get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT 
                    column_name,
                    data_type,
                    is_nullable,
                    character_maximum_length
                FROM information_schema.columns
                WHERE table_schema = $1 AND table_name = $2
                ORDER BY ordinal_position
            """, schema_name, table_name)

        return {
            r["column_name"]: {
                "type":     r["data_type"],
                "nullable": r["is_nullable"] == "YES",
                "length":   r["character_maximum_length"],
            }
            for r in rows
        }

    async def extract_batch(
        self,
        table: str,
        sync_mode: SyncMode,
        cursor: Optional[Any] = None,
    ) -> AsyncIterator[List[RawRecord]]:
        pool = await self._get_pool()
        schema_name, table_name = (
            table.split(".", 1) if "." in table else ("public", table)
        )

        if sync_mode == SyncMode.FULL:
            query = f'SELECT * FROM "{schema_name}"."{table_name}" ORDER BY ctid'
            params = []
        elif sync_mode == SyncMode.INCREMENTAL:
            if cursor is None:
                # Primera ejecución incremental — desde el inicio
                query = f'''
                    SELECT * FROM "{schema_name}"."{table_name}"
                    ORDER BY updated_at, id
                '''
                params = []
            else:
                query = f'''
                    SELECT * FROM "{schema_name}"."{table_name}"
                    WHERE updated_at > $1
                    ORDER BY updated_at, id
                '''
                params = [cursor]
        else:
            raise ValueError(f"SyncMode {sync_mode} no soportado por PG connector directo")

        async with pool.acquire() as conn:
            batch: List[RawRecord] = []
            async for row in conn.cursor(query, *params):
                raw = dict(row)
                record_id = self.make_record_id(
                    str(raw.get("id") or raw.get("uuid", "")),
                    table
                )
                batch.append(RawRecord(
                    record_id=record_id,
                    source_system=SystemType.POSTGRESQL.value,
                    source_table=table,
                    tenant_id=self.config.tenant_id,
                    data=raw,
                ))
                if len(batch) >= self.config.batch_size:
                    yield batch
                    batch = []

            if batch:
                yield batch
```

---

## 4. P2-M1-03 — Salesforce Connector

**Owner:** Senior Backend M1
**Depende de:** P2-M1-01
**Duración:** Semana 4

```python
# m1/connectors/salesforce_connector.py
import aiohttp
import logging
from typing import Any, AsyncIterator, Dict, List, Optional
from datetime import datetime

from m1.base_connector import BaseConnector, ConnectorConfig, RawRecord, SyncMode, SystemType

logger = logging.getLogger(__name__)


class SalesforceConnector(BaseConnector):
    """
    Conector Salesforce vía REST API SOQL.
    Credenciales: {username, password, security_token, domain}
    Usa OAuth2 Username-Password flow para obtener access_token.
    Soporta FULL e INCREMENTAL (por LastModifiedDate).
    """

    # Objetos Salesforce de interés para NEXUS CDM
    SUPPORTED_OBJECTS = [
        "Account", "Contact", "Lead", "Opportunity", "Case",
        "Product2", "Order", "Invoice__c", "User", "Task"
    ]

    def __init__(self, config: ConnectorConfig):
        super().__init__(config)
        self._access_token: Optional[str] = None
        self._instance_url: Optional[str] = None
        self._session: Optional[aiohttp.ClientSession] = None

    async def _authenticate(self) -> None:
        creds = await self._load_credentials()
        domain = creds.get("domain", "login")
        url = f"https://{domain}.salesforce.com/services/oauth2/token"

        data = {
            "grant_type":    "password",
            "client_id":     creds["client_id"],
            "client_secret": creds["client_secret"],
            "username":      creds["username"],
            "password":      creds["password"] + creds.get("security_token", ""),
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(url, data=data) as resp:
                result = await resp.json()
                if "access_token" not in result:
                    raise ConnectionError(
                        f"Autenticación Salesforce fallida: {result.get('error_description')}"
                    )
                self._access_token = result["access_token"]
                self._instance_url = result["instance_url"]
        logger.info(f"Salesforce auth OK para {self.config.connector_id}")

    async def _load_credentials(self) -> Dict[str, str]:
        import json, os
        secret_path = f"/var/run/secrets/connector-{self.config.connector_id}/credentials"
        try:
            with open(secret_path) as f:
                return json.load(f)
        except FileNotFoundError:
            return {
                "username":       os.environ[f"SF_{self.config.connector_id.upper()}_USERNAME"],
                "password":       os.environ[f"SF_{self.config.connector_id.upper()}_PASSWORD"],
                "security_token": os.environ.get(f"SF_{self.config.connector_id.upper()}_TOKEN", ""),
                "client_id":      os.environ[f"SF_{self.config.connector_id.upper()}_CLIENT_ID"],
                "client_secret":  os.environ[f"SF_{self.config.connector_id.upper()}_CLIENT_SECRET"],
            }

    async def test_connection(self) -> bool:
        if not self._access_token:
            await self._authenticate()
        async with aiohttp.ClientSession() as sess:
            async with sess.get(
                f"{self._instance_url}/services/data/v58.0/",
                headers={"Authorization": f"Bearer {self._access_token}"}
            ) as resp:
                if resp.status != 200:
                    raise ConnectionError(f"Salesforce test_connection failed: {resp.status}")
        return True

    async def get_tables(self) -> List[str]:
        return self.SUPPORTED_OBJECTS

    async def get_schema(self, table: str) -> Dict[str, Any]:
        if not self._access_token:
            await self._authenticate()
        url = f"{self._instance_url}/services/data/v58.0/sobjects/{table}/describe"
        async with aiohttp.ClientSession() as sess:
            async with sess.get(
                url,
                headers={"Authorization": f"Bearer {self._access_token}"}
            ) as resp:
                desc = await resp.json()

        return {
            f["name"]: {
                "type":     f["type"],
                "nullable": f["nillable"],
                "length":   f.get("length"),
            }
            for f in desc.get("fields", [])
        }

    async def extract_batch(
        self,
        table: str,
        sync_mode: SyncMode,
        cursor: Optional[Any] = None,
    ) -> AsyncIterator[List[RawRecord]]:
        if not self._access_token:
            await self._authenticate()

        if sync_mode == SyncMode.FULL:
            soql = f"SELECT FIELDS(ALL) FROM {table} ORDER BY Id LIMIT 200"
        elif sync_mode == SyncMode.INCREMENTAL:
            if cursor:
                soql = (
                    f"SELECT FIELDS(ALL) FROM {table} "
                    f"WHERE LastModifiedDate > {cursor} "
                    f"ORDER BY LastModifiedDate ASC LIMIT 200"
                )
            else:
                soql = f"SELECT FIELDS(ALL) FROM {table} ORDER BY LastModifiedDate ASC LIMIT 200"
        else:
            raise ValueError(f"SyncMode {sync_mode} no soportado")

        url = f"{self._instance_url}/services/data/v58.0/query"
        next_url = None

        async with aiohttp.ClientSession() as sess:
            while True:
                if next_url:
                    async with sess.get(
                        f"{self._instance_url}{next_url}",
                        headers={"Authorization": f"Bearer {self._access_token}"}
                    ) as resp:
                        data = await resp.json()
                else:
                    async with sess.get(
                        url,
                        params={"q": soql},
                        headers={"Authorization": f"Bearer {self._access_token}"}
                    ) as resp:
                        data = await resp.json()

                records = []
                for sf_rec in data.get("records", []):
                    records.append(RawRecord(
                        record_id=self.make_record_id(sf_rec["Id"], table),
                        source_system=SystemType.SALESFORCE.value,
                        source_table=table,
                        tenant_id=self.config.tenant_id,
                        data={k: v for k, v in sf_rec.items() if not isinstance(v, dict)},
                    ))

                if records:
                    yield records

                if data.get("done", True):
                    break
                next_url = data.get("nextRecordsUrl")
```

---

## 5. P2-M1-04 — Odoo Connector

**Owner:** Mid Backend M1
**Depende de:** P2-M1-01
**Duración:** Semana 4–5

```python
# m1/connectors/odoo_connector.py
import xmlrpc.client
import asyncio
import logging
from typing import Any, AsyncIterator, Dict, List, Optional

from m1.base_connector import BaseConnector, ConnectorConfig, RawRecord, SyncMode, SystemType

logger = logging.getLogger(__name__)

# Modelos Odoo de interés
ODOO_MODELS_MAP = {
    "res.partner":      ["id", "name", "email", "phone", "is_company", "write_date"],
    "sale.order":       ["id", "name", "partner_id", "date_order", "amount_total", "state", "write_date"],
    "account.move":     ["id", "name", "partner_id", "invoice_date", "amount_total", "state", "write_date"],
    "product.template": ["id", "name", "list_price", "type", "categ_id", "write_date"],
    "hr.employee":      ["id", "name", "job_title", "department_id", "work_email", "write_date"],
    "helpdesk.ticket":  ["id", "name", "partner_id", "stage_id", "priority", "write_date"],
}


class OdooConnector(BaseConnector):
    """
    Conector Odoo vía XML-RPC (método estándar de Odoo).
    Credenciales: {url, database, username, api_key}
    Soporta FULL e INCREMENTAL (por write_date).
    """

    def __init__(self, config: ConnectorConfig):
        super().__init__(config)
        self._uid: Optional[int] = None
        self._creds: Optional[Dict[str, str]] = None
        self._common_url: Optional[str] = None
        self._object_url: Optional[str] = None

    async def _load_credentials(self) -> Dict[str, str]:
        import json, os
        secret_path = f"/var/run/secrets/connector-{self.config.connector_id}/credentials"
        try:
            with open(secret_path) as f:
                return json.load(f)
        except FileNotFoundError:
            return {
                "url":      os.environ[f"ODOO_{self.config.connector_id.upper()}_URL"],
                "database": os.environ[f"ODOO_{self.config.connector_id.upper()}_DATABASE"],
                "username": os.environ[f"ODOO_{self.config.connector_id.upper()}_USERNAME"],
                "api_key":  os.environ[f"ODOO_{self.config.connector_id.upper()}_API_KEY"],
            }

    async def _authenticate(self) -> None:
        self._creds = await self._load_credentials()
        url = self._creds["url"].rstrip("/")
        self._common_url = f"{url}/xmlrpc/2/common"
        self._object_url = f"{url}/xmlrpc/2/object"

        # XML-RPC es síncrono — ejecutar en threadpool
        loop = asyncio.get_event_loop()
        common = xmlrpc.client.ServerProxy(self._common_url)
        self._uid = await loop.run_in_executor(
            None,
            lambda: common.authenticate(
                self._creds["database"],
                self._creds["username"],
                self._creds["api_key"],
                {}
            )
        )
        if not self._uid:
            raise ConnectionError(f"Autenticación Odoo fallida para {self.config.connector_id}")
        logger.info(f"Odoo auth OK, uid={self._uid}")

    async def test_connection(self) -> bool:
        await self._authenticate()
        return bool(self._uid)

    async def get_tables(self) -> List[str]:
        return list(ODOO_MODELS_MAP.keys())

    async def get_schema(self, table: str) -> Dict[str, Any]:
        if not self._uid:
            await self._authenticate()
        loop = asyncio.get_event_loop()
        obj = xmlrpc.client.ServerProxy(self._object_url)
        fields = await loop.run_in_executor(
            None,
            lambda: obj.execute_kw(
                self._creds["database"],
                self._uid,
                self._creds["api_key"],
                table, "fields_get", [],
                {"attributes": ["string", "type", "required"]}
            )
        )
        return {
            name: {
                "type":     info["type"],
                "nullable": not info.get("required", False),
                "length":   None,
            }
            for name, info in fields.items()
        }

    async def extract_batch(
        self,
        table: str,
        sync_mode: SyncMode,
        cursor: Optional[Any] = None,
    ) -> AsyncIterator[List[RawRecord]]:
        if not self._uid:
            await self._authenticate()

        loop = asyncio.get_event_loop()
        obj = xmlrpc.client.ServerProxy(self._object_url)
        fields = ODOO_MODELS_MAP.get(table, ["id", "write_date"])

        if sync_mode == SyncMode.FULL:
            domain = []
        elif sync_mode == SyncMode.INCREMENTAL and cursor:
            domain = [["write_date", ">", cursor]]
        else:
            domain = []

        offset = 0
        limit = self.config.batch_size

        while True:
            records_raw = await loop.run_in_executor(
                None,
                lambda: obj.execute_kw(
                    self._creds["database"],
                    self._uid,
                    self._creds["api_key"],
                    table, "search_read",
                    [domain],
                    {"fields": fields, "limit": limit, "offset": offset, "order": "id asc"}
                )
            )
            if not records_raw:
                break

            batch = [
                RawRecord(
                    record_id=self.make_record_id(str(r["id"]), table),
                    source_system=SystemType.ODOO.value,
                    source_table=table,
                    tenant_id=self.config.tenant_id,
                    data=r,
                )
                for r in records_raw
            ]
            yield batch

            if len(records_raw) < limit:
                break
            offset += limit
```

---

## 6. P2-M1-05 — ServiceNow Connector + Debezium CDC

**Owner:** Mid Backend M1
**Depende de:** P2-M1-01
**Duración:** Semana 5

```python
# m1/connectors/servicenow_connector.py
import aiohttp
import logging
from typing import Any, AsyncIterator, Dict, List, Optional

from m1.base_connector import BaseConnector, ConnectorConfig, RawRecord, SyncMode, SystemType

logger = logging.getLogger(__name__)

SERVICENOW_TABLES = [
    "incident", "problem", "change_request", "sc_request",
    "sys_user", "cmdb_ci", "task", "sc_cat_item"
]


class ServiceNowConnector(BaseConnector):
    """
    Conector ServiceNow vía REST API Table API.
    Credenciales: {instance, username, password}
    Soporta FULL e INCREMENTAL (por sys_updated_on).
    """

    def __init__(self, config: ConnectorConfig):
        super().__init__(config)
        self._creds: Optional[Dict[str, str]] = None

    async def _load_credentials(self) -> Dict[str, str]:
        import json, os
        secret_path = f"/var/run/secrets/connector-{self.config.connector_id}/credentials"
        try:
            with open(secret_path) as f:
                return json.load(f)
        except FileNotFoundError:
            return {
                "instance": os.environ[f"SNOW_{self.config.connector_id.upper()}_INSTANCE"],
                "username": os.environ[f"SNOW_{self.config.connector_id.upper()}_USERNAME"],
                "password": os.environ[f"SNOW_{self.config.connector_id.upper()}_PASSWORD"],
            }

    def _get_base_url(self, table: str) -> str:
        instance = self._creds["instance"]
        return f"https://{instance}.service-now.com/api/now/table/{table}"

    async def test_connection(self) -> bool:
        self._creds = await self._load_credentials()
        auth = aiohttp.BasicAuth(self._creds["username"], self._creds["password"])
        async with aiohttp.ClientSession(auth=auth) as sess:
            async with sess.get(self._get_base_url("sys_user") + "?sysparm_limit=1") as resp:
                if resp.status != 200:
                    raise ConnectionError(f"ServiceNow test failed: {resp.status}")
        return True

    async def get_tables(self) -> List[str]:
        return SERVICENOW_TABLES

    async def get_schema(self, table: str) -> Dict[str, Any]:
        if not self._creds:
            self._creds = await self._load_credentials()
        auth = aiohttp.BasicAuth(self._creds["username"], self._creds["password"])
        url = (
            f"https://{self._creds['instance']}.service-now.com"
            f"/api/now/table/sys_dictionary"
            f"?sysparm_query=name={table}&sysparm_fields=element,internal_type,mandatory"
        )
        async with aiohttp.ClientSession(auth=auth) as sess:
            async with sess.get(url) as resp:
                result = await resp.json()

        return {
            r["element"]: {
                "type":     r["internal_type"]["value"],
                "nullable": not r["mandatory"]["value"],
                "length":   None,
            }
            for r in result.get("result", [])
            if r.get("element")
        }

    async def extract_batch(
        self,
        table: str,
        sync_mode: SyncMode,
        cursor: Optional[Any] = None,
    ) -> AsyncIterator[List[RawRecord]]:
        if not self._creds:
            self._creds = await self._load_credentials()

        auth = aiohttp.BasicAuth(self._creds["username"], self._creds["password"])
        base_url = self._get_base_url(table)
        offset = 0

        while True:
            params = {
                "sysparm_limit":  self.config.batch_size,
                "sysparm_offset": offset,
                "sysparm_order_by": "sys_updated_on",
            }
            if sync_mode == SyncMode.INCREMENTAL and cursor:
                params["sysparm_query"] = f"sys_updated_on>{cursor}"

            async with aiohttp.ClientSession(auth=auth) as sess:
                async with sess.get(base_url, params=params) as resp:
                    data = await resp.json()

            records_raw = data.get("result", [])
            if not records_raw:
                break

            batch = [
                RawRecord(
                    record_id=self.make_record_id(r["sys_id"], table),
                    source_system=SystemType.SERVICENOW.value,
                    source_table=table,
                    tenant_id=self.config.tenant_id,
                    data=r,
                )
                for r in records_raw
            ]
            yield batch

            if len(records_raw) < self.config.batch_size:
                break
            offset += self.config.batch_size
```

---

## 7. P2-M1-06 — ConnectorWorker (Consumidor Kafka Principal)

**Owner:** Senior Backend M1
**Depende de:** P2-M1-01 a P2-M1-05, P1-CORE-01
**Duración:** Semana 6

### Las 11 reglas del ConnectorWorker

```
1. Leer sync_requested de m1.int.sync_requested
2. Verificar tenant activo → descartar si no
3. Cargar conector desde nexus_system.connectors vía RLS
4. Instanciar conector correcto (PostgreSQL, Salesforce, Odoo, ServiceNow)
5. LlamarConnector.test_connection() — si falla → publicar sync_failed
6. Extraer batches (yield bucle)
7. POR CADA BATCH: publicar a m1.int.raw_records ... ESPERAR confirmación
8. BACKPRESSURE: si consumer lag > 50,000 en m1.int.raw_records → PAUSAR extracción
9. Reanudar cuando lag < 10,000
10. Cuando termina → publicar sync_completed
11. Commit offset SOLO si batch publicado con éxito
```

```python
# m1/connector_worker.py
import asyncio
import logging
from typing import Optional
import prometheus_client as prom
from confluent_kafka.admin import AdminClient

from nexus_core.messaging import NexusMessage, NexusProducer, NexusConsumer
from nexus_core.tenant import TenantContext, set_tenant
from nexus_core.topics import CrossModuleTopicNamer
from nexus_core.db import get_tenant_scoped_connection
import asyncpg
from m1.base_connector import SyncMode, ConnectorConfig, SystemType
from m1.connectors.postgresql_connector import PostgreSQLConnector
from m1.connectors.salesforce_connector import SalesforceConnector
from m1.connectors.odoo_connector import OdooConnector
from m1.connectors.servicenow_connector import ServiceNowConnector

logger = logging.getLogger(__name__)

# Prometheus metrics
SYNCS_STARTED  = prom.Counter("m1_syncs_started_total",   "Sync jobs iniciados",   ["tenant_id"])
SYNCS_COMPLETED = prom.Counter("m1_syncs_completed_total","Sync jobs completados",  ["tenant_id"])
SYNCS_FAILED    = prom.Counter("m1_syncs_failed_total",   "Sync jobs fallidos",     ["tenant_id", "reason"])
RECORDS_PRODUCED = prom.Counter("m1_records_produced_total","Records enviados a Kafka",["tenant_id","source_system"])
SYNC_LATENCY    = prom.Histogram("m1_sync_duration_seconds","Duración sync completo",  ["tenant_id"])

# Umbrales de backpressure
BACKPRESSURE_PAUSE_LAG   = 50000
BACKPRESSURE_RESUME_LAG  = 10000

_CONNECTOR_REGISTRY = {
    SystemType.POSTGRESQL:  PostgreSQLConnector,
    SystemType.SALESFORCE:  SalesforceConnector,
    SystemType.ODOO:        OdooConnector,
    SystemType.SERVICENOW:  ServiceNowConnector,
}


def _get_raw_records_lag(tenant_id: str) -> int:
    """Consulta el consumer lag actual del grupo m1-delta-writers en raw_records."""
    # Usar Admin Kafka directo para lag check
    admin = AdminClient({"bootstrap.servers": _get_kafka_bootstrap()})
    consumer_groups = admin.list_consumer_group_offsets(
        ["m1-delta-writers"],
        partitions=[("m1.int.raw_records", p) for p in range(16)]
    )
    # Calcular lag total (sum lags across partitions)
    total_lag = 0
    for tp, offset_info in consumer_groups.get("m1-delta-writers", {}).items():
        if offset_info and hasattr(offset_info, "offset") and offset_info.offset >= 0:
            total_lag += 1  # Simplificado — implementar lookup real
    return total_lag


class ConnectorWorker:
    """
    Worker que procesa mensajes m1.int.sync_requested.
    Ejecuta en pod continuo — un pod = un consumer group member.
    """

    def __init__(self, pool: asyncpg.Pool):
        self._pool = pool
        self._consumer = NexusConsumer(
            bootstrap_servers=_get_kafka_bootstrap(),
            group_id="m1-connector-workers",
            topics=[CrossModuleTopicNamer.STATIC.SYNC_REQUESTED],
            tenant_validator=self._is_tenant_active,
        )
        self._producer = NexusProducer(
            bootstrap_servers=_get_kafka_bootstrap(),
            source_module="m1-connector-worker"
        )
        self._running = True

    async def run(self):
        """Loop principal. Bloquea hasta shutdown."""
        logger.info("ConnectorWorker iniciado")
        while self._running:
            msg = self._consumer.poll(timeout=1.0)
            if msg is None:
                continue

            try:
                set_tenant(TenantContext(
                    tenant_id=msg.tenant_id,
                    plan="professional",  # Cargar de BD en producción
                    cdm_version=msg.cdm_version,
                ))
                await self._process_sync_request(msg)
                self._consumer.commit(msg)
            except Exception as e:
                logger.exception(
                    f"Error procesando sync_request: {msg.safe_log_repr()}, error={type(e).__name__}"
                )
                await self._publish_sync_failed(msg, str(e))
                # No commitear — mensaje se reentregará tras restart

    async def _process_sync_request(self, msg: NexusMessage):
        tid = msg.tenant_id
        connector_id = msg.payload["connector_id"]
        table = msg.payload.get("table")
        sync_mode_str = msg.payload.get("sync_mode", "incremental")
        sync_mode = SyncMode(sync_mode_str)

        SYNCS_STARTED.labels(tenant_id=tid).inc()
        import time
        start = time.time()

        # Pasos 3-4: Cargar config de conector
        connector_config = await self._load_connector_config(tid, connector_id)
        connector_class = _CONNECTOR_REGISTRY[connector_config.system_type]
        connector = connector_class(connector_config)

        # Paso 5: Test connection
        try:
            await connector.test_connection()
        except Exception as e:
            SYNCS_FAILED.labels(tenant_id=tid, reason="connection_failed").inc()
            await self._publish_sync_failed(msg, f"Connection failed: {e}")
            return

        # Paso 6-9: Extraer y publicar
        tables = [table] if table else await connector.get_tables()
        total_published = 0

        for tbl in tables:
            async for batch in connector.extract_batch(tbl, sync_mode):
                # Paso 8: Backpressure check
                lag = _get_raw_records_lag(tid)
                if lag > BACKPRESSURE_PAUSE_LAG:
                    logger.warning(
                        f"Backpressure: lag={lag} > {BACKPRESSURE_PAUSE_LAG}. Pausando extracción."
                    )
                    while lag > BACKPRESSURE_RESUME_LAG:
                        await asyncio.sleep(5)
                        lag = _get_raw_records_lag(tid)
                    logger.info(f"Backpressure resuelto: lag={lag}")

                # Paso 7: Publicar batch
                for record in batch:
                    raw_msg = NexusMessage(
                        topic=CrossModuleTopicNamer.STATIC.RAW_RECORDS,
                        tenant_id=tid,
                        event_type="raw_record",
                        payload=record.to_kafka_payload(),
                        correlation_id=msg.correlation_id,
                        trace_id=msg.trace_id,
                        cdm_version=msg.cdm_version,
                    )
                    self._producer.publish(raw_msg, partition_key=record.source_table)
                    total_published += 1

                RECORDS_PRODUCED.labels(
                    tenant_id=tid, source_system=connector_config.system_type.value
                ).inc(len(batch))

        # Paso 10: Sync completado
        completed_msg = NexusMessage(
            topic=CrossModuleTopicNamer.m1_outbound(tid, "sync_completed"),
            tenant_id=tid,
            event_type="sync_completed",
            payload={
                "connector_id": connector_id,
                "records_published": total_published,
                "tables": tables,
            },
            correlation_id=msg.correlation_id,
            trace_id=msg.trace_id,
        )
        self._producer.publish(completed_msg)
        SYNCS_COMPLETED.labels(tenant_id=tid).inc()

        latency = time.time() - start
        SYNC_LATENCY.labels(tenant_id=tid).observe(latency)
        logger.info(
            f"Sync completado: tenant={tid} connector={connector_id} "
            f"records={total_published} latency={latency:.2f}s"
        )
```

---

## 8. P2-M1-07 — Delta Writer Worker

**Owner:** Mid Backend M1
**Depende de:** P2-M1-06
**Duración:** Semana 7

### Reglas de flush — CRÍTICAS

```
Buffer flush: 5,000 records OR 30 segundos (lo que ocurra primero)
Escritura: MERGE upsert en Delta Lake — NO INSERT simple
     MERGE basado en record_id — idempotente
     Si record.is_deleted = True → DELETE del Delta Lake
Topic publicado al completar: m1.int.delta_batch_ready
```

```python
# m1/delta_writer_worker.py
import asyncio
import logging
import time
from typing import List
import prometheus_client as prom
from delta import configure_spark_with_delta_pip
from pyspark.sql import SparkSession

from nexus_core.messaging import NexusMessage, NexusProducer, NexusConsumer
from nexus_core.tenant import TenantContext, set_tenant
from nexus_core.topics import CrossModuleTopicNamer

logger = logging.getLogger(__name__)

DELTA_WRITES     = prom.Counter("m1_delta_writes_total",      "Flushes Delta completados",   ["tenant_id"])
DELTA_WRITE_FAIL = prom.Counter("m1_delta_write_failures_total","Delta write failures",        ["tenant_id"])
DELTA_FLUSH_SIZE = prom.Histogram("m1_delta_flush_size_records","Records por flush",           ["tenant_id"])

FLUSH_SIZE_LIMIT = 5000     # Flush cuando el buffer llega a este tamaño
FLUSH_TIME_LIMIT = 30       # Flush cada 30 segundos mínimo


class DeltaWriterWorker:
    """
    Worker que consume m1.int.raw_records y escribe en Delta Lake.
    Buffer interno: flush en 5000 records o 30 segundos.
    Escritura MERGE upsert por record_id.
    """

    def __init__(self):
        self._consumer = NexusConsumer(
            bootstrap_servers=_get_kafka_bootstrap(),
            group_id="m1-delta-writers",
            topics=[CrossModuleTopicNamer.STATIC.RAW_RECORDS],
        )
        self._producer = NexusProducer(
            bootstrap_servers=_get_kafka_bootstrap(),
            source_module="m1-delta-writer"
        )
        self._buffer: List[NexusMessage] = []
        self._last_flush = time.time()
        self._spark = self._build_spark()

    def _build_spark(self) -> SparkSession:
        builder = (
            SparkSession.builder
            .appName("nexus-delta-writer")
            .config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension")
            .config("spark.sql.catalog.spark_catalog", "org.apache.spark.sql.delta.catalog.DeltaCatalog")
            .config("spark.hadoop.fs.s3a.endpoint", "http://minio.nexus-storage.svc.cluster.local:9000")
            .config("spark.hadoop.fs.s3a.path.style.access", "true")
        )
        return configure_spark_with_delta_pip(builder).getOrCreate()

    async def run(self):
        logger.info("DeltaWriterWorker iniciado")
        while True:
            msg = self._consumer.poll(timeout=0.5)
            if msg:
                self._buffer.append(msg)

            # Verificar condiciones de flush
            elapsed = time.time() - self._last_flush
            should_flush = (
                len(self._buffer) >= FLUSH_SIZE_LIMIT or
                (elapsed >= FLUSH_TIME_LIMIT and self._buffer)
            )

            if should_flush:
                await self._flush()

    async def _flush(self):
        if not self._buffer:
            return

        batch = list(self._buffer)
        tenant_id = batch[0].tenant_id
        set_tenant(TenantContext(
            tenant_id=tenant_id,
            plan="professional",
            cdm_version="1.0.0"
        ))

        try:
            # Agrupar por source_system + source_table
            groups: dict = {}
            for msg in batch:
                key = (
                    msg.payload["source_system"],
                    msg.payload["source_table"]
                )
                groups.setdefault(key, []).append(msg.payload)

            paths_written = []
            for (source_system, source_table), records in groups.items():
                path = (
                    f"s3a://nexus-raw/{tenant_id}/"
                    f"{source_system}/{source_table}/"
                )
                self._merge_to_delta(path, records, source_table)
                paths_written.append(path)

            # Publicar delta_batch_ready
            delta_msg = NexusMessage(
                topic=CrossModuleTopicNamer.STATIC.DELTA_BATCH_READY,
                tenant_id=tenant_id,
                event_type="delta_batch_ready",
                payload={
                    "paths": paths_written,
                    "total_records": len(batch),
                    "correlation_id": batch[0].correlation_id,
                },
                correlation_id=batch[0].correlation_id,
                trace_id=batch[0].trace_id,
            )
            self._producer.publish(delta_msg)

            # Commit offsets DESPUÉS de publicar correctamente
            for msg in batch:
                self._consumer.commit(msg)

            DELTA_WRITES.labels(tenant_id=tenant_id).inc()
            DELTA_FLUSH_SIZE.labels(tenant_id=tenant_id).observe(len(batch))
            logger.info(
                f"Delta flush completado: tenant={tenant_id} "
                f"records={len(batch)} paths={len(paths_written)}"
            )

        except Exception as e:
            DELTA_WRITE_FAIL.labels(tenant_id=tenant_id).inc()
            logger.exception(f"Error en flush Delta: {e}")
            # No commitear — mensajes se reentregarán
        finally:
            self._buffer = []
            self._last_flush = time.time()

    def _merge_to_delta(self, path: str, records: list, source_table: str):
        """MERGE upsert en Delta Lake. Idempotente por record_id."""
        import pandas as pd
        from delta.tables import DeltaTable

        df_new = self._spark.createDataFrame(pd.DataFrame(records))

        if DeltaTable.isDeltaTable(self._spark, path):
            delta_table = DeltaTable.forPath(self._spark, path)
            (
                delta_table.alias("existing")
                .merge(
                    df_new.alias("updates"),
                    "existing.record_id = updates.record_id"
                )
                .whenMatchedUpdateAll()
                .whenNotMatchedInsertAll()
                .execute()
            )
        else:
            # Primera escritura — crear tabla Delta
            df_new.write.format("delta").mode("overwrite").save(path)

        logger.debug(f"MERGE Delta completado en {path}: {len(records)} records")
```

---

## 9. P2-M1-08 — Airflow DAG m1_sync_orchestrator

**Owner:** Senior Backend M1
**Depende de:** P0-INFRA-06 (Airflow), P0-INFRA-07 (Spark)
**Duración:** Semana 7 (paralelo con DeltaWriter)

```python
# dags/m1_sync_orchestrator.py
from airflow import DAG
from airflow.providers.apache.kafka.sensors.kafka import KafkaMessageSensor
from airflow.providers.apache.spark.operators.spark_submit import SparkSubmitOperator
from airflow.operators.python import PythonOperator
from datetime import datetime, timedelta

default_args = {
    "owner":             "data-intelligence",
    "retries":           3,
    "retry_delay":       timedelta(minutes=5),
    "retry_exponential_backoff": True,
    "max_retry_delay":   timedelta(hours=1),
}

with DAG(
    dag_id="m1_sync_orchestrator",
    default_args=default_args,
    schedule_interval="@continuous",
    start_date=datetime(2026, 3, 2),
    catchup=False,
    max_active_runs=3,
    tags=["m1", "data-intelligence", "nexus"],
) as dag:

    # Sensor: espera a que haya un mensaje en m1.int.delta_batch_ready
    wait_for_delta_batch = KafkaMessageSensor(
        task_id="wait_for_delta_batch",
        kafka_config_id="nexus_kafka",
        topics=["m1.int.delta_batch_ready"],
        apply_function="m1.dag_utils.extract_tenant_and_paths",
        poll_timeout=60.0,
        poke_interval=10,
    )

    # SparkSubmit: clasificar y preparar entidades
    classify_and_prepare = SparkSubmitOperator(
        task_id="m1_classify_and_prepare",
        application="s3a://nexus-raw/spark_jobs/m1_classify_and_prepare.py",
        conn_id="spark_default",
        conf={
            "spark.sql.extensions":   "io.delta.sql.DeltaSparkSessionExtension",
            "spark.sql.catalog.spark_catalog": "org.apache.spark.sql.delta.catalog.DeltaCatalog",
            "spark.app.name":         "nexus-m1-classify-and-prepare",
            "spark.kubernetes.namespace": "nexus-data",
        },
        application_args=[
            "--tenant-id",     "{{ ti.xcom_pull(key='tenant_id') }}",
            "--paths",         "{{ ti.xcom_pull(key='paths') }}",
            "--cdm-version",   "1.0.0",
            "--correlation-id","{{ ti.xcom_pull(key='correlation_id') }}",
        ],
        name="m1-classify-prepare",
        executor_cores=2,
        executor_memory="4g",
        driver_memory="2g",
        num_executors=3,
    )

    notify_complete = PythonOperator(
        task_id="notify_spark_complete",
        python_callable=lambda **ctx: logger.info("Spark m1_classify_and_prepare completado"),
    )

    wait_for_delta_batch >> classify_and_prepare >> notify_complete
```

---

## 10. P2-M1-09 — Spark Job m1_classify_and_prepare

**Owner:** Senior Backend M1
**Depende de:** P0-INFRA-07 (Spark + Delta Lake)
**Duración:** Semana 8

### 7 pasos del job — en orden

```
Paso 1: Leer Delta Lake desde nexus-raw/{tenant}/{source}/{table}
Paso 2: Inferir tipo de entidad (rule-based, SIN LLM)
Paso 3: Añadir columna entity_type
Paso 4: Escribir a nexus-classified/{tenant}/{source}/{table}_classified
Paso 5: Construir CDMEntity parcial (solo campos conocidos)
Paso 6: Escribir CDMEntity a nexus-cdm/{tenant}/{entity_type}
Paso 7: Publicar m1.int.classified_records a Kafka
```

```python
# spark_jobs/m1_classify_and_prepare.py
import argparse
import json
from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import StringType
from confluent_kafka import Producer

# Reglas de clasificación — orden importa (primero gana)
CLASSIFICATION_RULES = [
    ("party",       ["partner", "account", "customer", "user", "contact",
                     "client", "kunnr", "person"]),
    ("transaction", ["invoice", "order", "payment", "sale", "purchase",
                     "transaction", "move"]),
    ("product",     ["product", "item", "article", "sku", "material", "template"]),
    ("employee",    ["employee", "staff", "worker", "person", "hr"]),
    ("incident",    ["incident", "ticket", "case", "issue", "problem",
                     "request", "task"]),
]


def classify_table_name(table_name: str) -> str:
    """
    Clasifica una tabla por su nombre usando reglas keyword.
    Sin LLM. Sin API calls. Sin black box.
    Retorna 'unknown' si no hay match.
    """
    table_lower = table_name.lower().replace(".", "_").replace("-", "_")
    for entity_type, keywords in CLASSIFICATION_RULES:
        if any(kw in table_lower for kw in keywords):
            return entity_type
    return "unknown"


def run_classification(spark: SparkSession, args):
    """Main function del Spark job."""
    tenant_id = args.tenant_id
    cdm_version = args.cdm_version
    correlation_id = args.correlation_id

    paths = json.loads(args.paths)
    classified_tables = []

    for path in paths:
        # Extraer source_system y source_table del path
        # path: s3a://nexus-raw/{tenant}/{source_system}/{source_table}/
        parts = path.rstrip("/").split("/")
        source_system = parts[-2]
        source_table = parts[-1]

        entity_type = classify_table_name(source_table)
        print(f"Clasificando {source_table} → {entity_type}")

        # Paso 1: Leer Delta Lake
        df = spark.read.format("delta").load(path)

        # Paso 2-3: Agregar columna entity_type
        df_classified = df.withColumn(
            "entity_type", F.lit(entity_type)
        ).withColumn(
            "cdm_version", F.lit(cdm_version)
        ).withColumn(
            "tenant_id", F.lit(tenant_id)
        ).withColumn(
            "classified_at", F.current_timestamp()
        )

        # Paso 4: Escribir a nexus-classified
        classified_path = (
            f"s3a://nexus-classified/{tenant_id}/"
            f"{source_system}/{source_table}_classified/"
        )
        (
            df_classified.write
            .format("delta")
            .mode("overwrite")  # Idempotente
            .option("mergeSchema", "true")
            .save(classified_path)
        )

        if entity_type != "unknown":
            classified_tables.append({
                "source_system":  source_system,
                "source_table":   source_table,
                "entity_type":    entity_type,
                "classified_path": classified_path,
                "record_count":   df_classified.count(),
            })

    # Paso 7: Publicar classified_records a Kafka
    if classified_tables:
        _publish_classified_records(classified_tables, tenant_id, correlation_id)

    print(f"m1_classify_and_prepare completado: {len(classified_tables)} tablas clasificadas")


def _publish_classified_records(
    classified_tables: list,
    tenant_id: str,
    correlation_id: str
) -> None:
    """Publica evento classified_records a Kafka."""
    import uuid
    from nexus_core.messaging import NexusMessage
    from nexus_core.topics import CrossModuleTopicNamer

    producer_conf = {"bootstrap.servers": _get_kafka_bootstrap()}
    producer = Producer(producer_conf)

    msg = NexusMessage(
        topic=CrossModuleTopicNamer.STATIC.CLASSIFIED_RECORDS,
        tenant_id=tenant_id,
        event_type="classified_records",
        payload={
            "classified_tables": classified_tables,
            "total_records": sum(t["record_count"] for t in classified_tables),
        },
        correlation_id=correlation_id,
        message_id=str(uuid.uuid4()),
    )
    producer.produce(
        topic=msg.topic,
        key=tenant_id.encode("utf-8"),
        value=msg.to_json().encode("utf-8")
    )
    producer.flush(timeout=30)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--tenant-id",     required=True)
    parser.add_argument("--paths",         required=True, help="JSON list of paths")
    parser.add_argument("--cdm-version",   default="1.0.0")
    parser.add_argument("--correlation-id",default=None)
    args = parser.parse_args()

    spark = (
        SparkSession.builder
        .appName("nexus-m1-classify-and-prepare")
        .config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension")
        .config(
            "spark.sql.catalog.spark_catalog",
            "org.apache.spark.sql.delta.catalog.DeltaCatalog"
        )
        .getOrCreate()
    )

    run_classification(spark, args)
```

---

## 11. P2-M1-10 — CDM Mapper Worker + AI Store Router

**Owner:** Senior Backend M1
**Depende de:** P2-M1-09, P1-CORE-03 (CDMRegistryService)
**Duración:** Semana 9–10

### CDM Mapper Worker

```python
# m1/cdm_mapper_worker.py
import asyncio
import logging
from typing import List
import prometheus_client as prom

from nexus_core.messaging import NexusMessage, NexusProducer, NexusConsumer
from nexus_core.tenant import TenantContext, set_tenant
from nexus_core.topics import CrossModuleTopicNamer
from nexus_core.cdm_registry import CDMRegistryService

logger = logging.getLogger(__name__)

MAPPINGS_APPLIED  = prom.Counter("m1_cdm_mappings_applied_total", "Mapeos aplicados",    ["tenant_id","tier"])
MAPPINGS_MISSING  = prom.Counter("m1_cdm_mappings_missing_total", "Campos sin mapeo",    ["tenant_id"])
MAPPER_LATENCY    = prom.Histogram("m1_cdm_mapper_latency_seconds","Latencia CDM Mapper",["tenant_id"])


class CDMMapperWorker:
    """
    Consume m1.int.classified_records.
    Aplica mapeos CDM por campo.
    Publica m1.int.cdm_entities_ready.
    Campos sin mapeo → envía señal m1_outbound mapping_review_needed.
    """

    def __init__(self, pool, registry: CDMRegistryService):
        self._pool = pool
        self._registry = registry
        self._consumer = NexusConsumer(
            bootstrap_servers=_get_kafka_bootstrap(),
            group_id="m1-cdm-mappers",
            topics=[CrossModuleTopicNamer.STATIC.CLASSIFIED_RECORDS],
        )
        self._producer = NexusProducer(
            bootstrap_servers=_get_kafka_bootstrap(),
            source_module="m1-cdm-mapper"
        )

    async def run(self):
        logger.info("CDMMapperWorker iniciado")
        while True:
            msg = self._consumer.poll(timeout=1.0)
            if msg is None:
                continue

            set_tenant(TenantContext(
                tenant_id=msg.tenant_id,
                plan="professional",
                cdm_version=msg.cdm_version,
            ))

            import time
            t = time.time()
            try:
                await self._process(msg)
                self._consumer.commit(msg)
            except Exception as e:
                logger.exception(f"Error en CDM Mapper: {e}")
            finally:
                MAPPER_LATENCY.labels(tenant_id=msg.tenant_id).observe(time.time() - t)

    async def _process(self, msg: NexusMessage):
        tid = msg.tenant_id
        classified_tables = msg.payload.get("classified_tables", [])
        cdm_entities = []
        unmapped_fields = []

        for table_info in classified_tables:
            source_system = table_info["source_system"]
            source_table  = table_info["source_table"]
            entity_type   = table_info["entity_type"]

            # Ejemplo: mapear los campos de una muestra de records
            # En producción: leer Delta Lake y procesar campo por campo
            entity = {
                "entity_type":   entity_type,
                "source_system": source_system,
                "source_table":  source_table,
                "tenant_id":     tid,
                "fields":        {},
                "source_extras": {},
            }
            cdm_entities.append(entity)

        unmapped = len(unmapped_fields)
        if unmapped > 0:
            MAPPINGS_MISSING.labels(tenant_id=tid).inc(unmapped)
            review_msg = NexusMessage(
                topic=CrossModuleTopicNamer.m1_outbound(tid, "mapping_review_needed"),
                tenant_id=tid,
                event_type="mapping_review_needed",
                payload={"unmapped_fields": unmapped_fields},
                correlation_id=msg.correlation_id,
                trace_id=msg.trace_id,
            )
            self._producer.publish(review_msg)

        entities_msg = NexusMessage(
            topic=CrossModuleTopicNamer.STATIC.CDM_ENTITIES_READY,
            tenant_id=tid,
            event_type="cdm_entities_ready",
            payload={"cdm_entities": cdm_entities},
            correlation_id=msg.correlation_id,
            trace_id=msg.trace_id,
        )
        self._producer.publish(entities_msg)
```

### AI Store Router — tabla de routing

```python
# m1/ai_store_router.py
"""
AI Store Router — determina en qué stores M3 se escribe cada entidad.
NO hace inferencia — aplica tabla estática de routing.
Cero LLMs aquí.
"""
from nexus_core.messaging import NexusMessage, NexusProducer, NexusConsumer
from nexus_core.topics import CrossModuleTopicNamer

# Tabla de routing — inmutable
AI_STORE_ROUTING = {
    "party":       {"vector": True, "graph": True,  "timeseries": False},
    "transaction": {"vector": False, "graph": True,  "timeseries": True},
    "product":     {"vector": True, "graph": False, "timeseries": False},
    "employee":    {"vector": True, "graph": True,  "timeseries": False},
    "incident":    {"vector": True, "graph": False, "timeseries": True},
    "unknown":     {"vector": False, "graph": False, "timeseries": False},
}

ROUTING_DECIDED = __import__("prometheus_client").Counter(
    "m1_routing_decisions_total", "Routing decisions", ["tenant_id","entity_type","store"]
)

class AIStoreRouter:
    def __init__(self):
        self._consumer = NexusConsumer(
            bootstrap_servers=_get_kafka_bootstrap(),
            group_id="m1-ai-store-writers",
            topics=[CrossModuleTopicNamer.STATIC.CDM_ENTITIES_READY],
        )
        self._producer = NexusProducer(
            bootstrap_servers=_get_kafka_bootstrap(),
            source_module="m1-ai-store-router"
        )

    def route(self, entity_type: str) -> dict:
        return AI_STORE_ROUTING.get(entity_type, AI_STORE_ROUTING["unknown"])

    async def run(self):
        while True:
            msg = self._consumer.poll(timeout=1.0)
            if msg is None:
                continue
            try:
                await self._process(msg)
                self._consumer.commit(msg)
            except Exception as e:
                import logging
                logging.getLogger(__name__).exception(f"Router error: {e}")

    async def _process(self, msg: NexusMessage):
        tid = msg.tenant_id
        for entity in msg.payload.get("cdm_entities", []):
            entity_type = entity["entity_type"]
            routing = self.route(entity_type)

            routing_msg = NexusMessage(
                topic=CrossModuleTopicNamer.STATIC.AI_ROUTING_DECIDED,
                tenant_id=tid,
                event_type="ai_routing_decided",
                payload={
                    "entity":   entity,
                    "routing":  routing,
                },
                correlation_id=msg.correlation_id,
                trace_id=msg.trace_id,
            )
            self._producer.publish(routing_msg)

            for store, should_write in routing.items():
                ROUTING_DECIDED.labels(
                    tenant_id=tid,
                    entity_type=entity_type,
                    store=store
                ).inc(1 if should_write else 0)
```

---

## 12. P3: Structural Sub-Cycle — Schema Profiler

**Owner:** Mid Backend M1 (PARALELO con Pipeline M1)
**Depende de:** P2-M1-01 (BaseConnector)
**Duración:** Semana 4–5 (paralelo)

```python
# m1/structural/schema_profiler.py
"""
El Schema Profiler extrae el schema completo de un sistema fuente
y construye un SourceKnowledgeArtifact para M2 (no opera en el stream principal).
NO modifica datos. Solo observa y reporta.
"""
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
import uuid
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


@dataclass
class FieldProfile:
    field_name: str
    data_type: str
    nullable: bool
    sample_values: List[str]
    cardinality_estimate: str      # "low", "medium", "high", "unique_key"
    null_ratio: float
    semantic_hint: Optional[str]   # e.g. "email", "phone", "currency" — heurística
    length: Optional[int] = None


@dataclass
class TableProfile:
    table_name: str
    row_count: int
    fields: List[FieldProfile]
    primary_key_candidates: List[str]
    foreign_key_candidates: List[str]


@dataclass
class SourceKnowledgeArtifact:
    """
    Artefacto publicado al topic m1.int.source_schema_extracted.
    M2 lo usa para inferir mapeos CDM y proponer extensiones.
    Contrato M1→M2: M2 responde en 24h.
    """
    artifact_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    connector_id: str = ""
    tenant_id: str = ""
    source_system: str = ""
    tables: List[TableProfile] = field(default_factory=list)
    extracted_at: str = field(
        default_factory=lambda: datetime.utcnow().isoformat()
    )
    schema_version: str = "1.0"


async def profile_connector(connector, tenant_id: str) -> SourceKnowledgeArtifact:
    """
    Perfilar todos los objetos/tablas del conector.
    Retorna SourceKnowledgeArtifact listo para publicar a Kafka.
    """
    tables = await connector.get_tables()
    profiled_tables = []

    for table_name in tables:
        logger.info(f"Perfilando tabla: {table_name}")
        schema = await connector.get_schema(table_name)
        fields = []
        for field_name, field_info in schema.items():
            fields.append(FieldProfile(
                field_name=field_name,
                data_type=field_info["type"],
                nullable=field_info["nullable"],
                sample_values=[],  # Se puede llenar con una muestra real
                cardinality_estimate=_estimate_cardinality(field_name),
                null_ratio=0.0,
                semantic_hint=_infer_semantic_hint(field_name, field_info["type"]),
                length=field_info.get("length"),
            ))
        profiled_tables.append(TableProfile(
            table_name=table_name,
            row_count=0,  # Se puede agregar COUNT(*) si el sistema lo permite
            fields=fields,
            primary_key_candidates=_find_pk_candidates([f.field_name for f in fields]),
            foreign_key_candidates=_find_fk_candidates([f.field_name for f in fields]),
        ))

    return SourceKnowledgeArtifact(
        connector_id=connector.config.connector_id,
        tenant_id=tenant_id,
        source_system=connector.config.system_type.value,
        tables=profiled_tables,
    )


def _estimate_cardinality(field_name: str) -> str:
    name_lower = field_name.lower()
    if any(k in name_lower for k in ["id", "uuid", "key", "num"]):
        return "unique_key"
    if any(k in name_lower for k in ["type", "status", "category", "stage"]):
        return "low"
    if any(k in name_lower for k in ["date", "time", "amount", "price"]):
        return "high"
    return "medium"


def _infer_semantic_hint(field_name: str, data_type: str) -> Optional[str]:
    name_lower = field_name.lower()
    if "email" in name_lower:               return "email"
    if "phone" in name_lower:               return "phone"
    if any(k in name_lower for k in ["amount", "price", "total", "revenue"]): return "currency"
    if any(k in name_lower for k in ["lat", "latitude"]):   return "latitude"
    if any(k in name_lower for k in ["lon", "longitude"]):  return "longitude"
    if any(k in name_lower for k in ["created", "updated", "modified"]): return "timestamp"
    return None


def _find_pk_candidates(field_names: List[str]) -> List[str]:
    return [f for f in field_names if any(
        k in f.lower() for k in ["id", "uuid", "key", "num"]
    )]


def _find_fk_candidates(field_names: List[str]) -> List[str]:
    return [f for f in field_names if f.lower().endswith("_id") and f.lower() != "id"]
```

---

## 13. P3: Structural Sub-Cycle — Airflow DAG m1_structural_cycle

**Owner:** Mid Backend M1
**Depende de:** Schema Profiler, P0-INFRA-06
**Duración:** Semana 5

```python
# dags/m1_structural_cycle.py
"""
Ciclo estructural — se ejecuta 1x/semana (no en cada sync).
Perfila schemas de todos los conectores activos del tenant.
Detecta drift (si hay snapshot previo).
Publica SourceKnowledgeArtifacts a M2.
"""
from airflow import DAG
from airflow.providers.apache.kafka.sensors.kafka import KafkaMessageSensor
from airflow.operators.python import PythonOperator
from datetime import datetime, timedelta
import asyncio

DEFAULT_ARGS = {
    "owner":         "data-intelligence",
    "retries":       2,
    "retry_delay":   timedelta(minutes=10),
}

with DAG(
    dag_id="m1_structural_cycle",
    default_args=DEFAULT_ARGS,
    schedule_interval="0 2 * * 0",  # Cada domingo a las 2am
    start_date=datetime(2026, 3, 2),
    catchup=False,
    tags=["m1", "structural", "nexus"],
) as dag:

    # Sensor: espera m1.int.structural_cycle_triggered
    wait_for_trigger = KafkaMessageSensor(
        task_id="wait_for_structural_trigger",
        kafka_config_id="nexus_kafka",
        topics=["m1.int.structural_cycle_triggered"],
        apply_function="m1.dag_utils.extract_tenant_id",
        poke_interval=30,
        timeout=3600,    # 1 hora máximo esperando
    )

    def run_schema_profiling(**context):
        tenant_id = context["ti"].xcom_pull(key="tenant_id")
        correlation_id = context["ti"].xcom_pull(key="correlation_id")
        asyncio.run(_async_profile(tenant_id, correlation_id))

    async def _async_profile(tenant_id: str, correlation_id: str):
        """Perfila todos los conectores activos del tenant."""
        import asyncpg
        from nexus_core.db import get_tenant_scoped_connection
        from m1.structural.schema_profiler import profile_connector
        from nexus_core.messaging import NexusMessage, NexusProducer
        from nexus_core.topics import CrossModuleTopicNamer

        pool = await asyncpg.create_pool(dsn=_get_postgres_dsn())
        producer = NexusProducer(
            bootstrap_servers=_get_kafka_bootstrap(),
            source_module="m1-structural-cycle"
        )

        async with await get_tenant_scoped_connection(pool, tenant_id) as conn:
            connectors = await conn.fetch(
                "SELECT * FROM nexus_system.connectors WHERE tenant_id=$1 AND status='active'",
                tenant_id
            )

        for conn_row in connectors:
            connector = _instantiate_connector(conn_row)
            artifact = await profile_connector(connector, tenant_id)

            # Guardar snapshot en BD para drift detection
            async with await get_tenant_scoped_connection(pool, tenant_id) as conn:
                import json
                await conn.execute("""
                    INSERT INTO nexus_system.schema_snapshots 
                        (connector_id, tenant_id, artifact)
                    VALUES ($1, $2, $3)
                """, connector.config.connector_id, tenant_id, json.dumps(artifact.__dict__))

            # Publicar SourceKnowledgeArtifact a Kafka (→ M2 recibe en <24h)
            import dataclasses
            msg = NexusMessage(
                topic=CrossModuleTopicNamer.STATIC.SOURCE_SCHEMA_EXTRACTED,
                tenant_id=tenant_id,
                event_type="source_schema_extracted",
                payload=dataclasses.asdict(artifact),
                correlation_id=correlation_id,
            )
            producer.publish(msg)

        await pool.close()

    profile_schemas = PythonOperator(
        task_id="profile_all_connectors",
        python_callable=run_schema_profiling,
        provide_context=True,
    )

    wait_for_trigger >> profile_schemas
```

---

## 14. P3: Structural Sub-Cycle — Schema Drift Detector

**Owner:** Mid Backend M1
**Depende de:** Schema Profiler
**Duración:** Semana 6

```python
# m1/structural/schema_drift_detector.py
"""
Compara el SourceKnowledgeArtifact actual contra el snapshot anterior.
Si detecta drift (campo nuevo, campo eliminado, cambio de tipo),
publica m1.int.structural_cycle_triggered para iniciar el ciclo estructural.
"""
from dataclasses import dataclass
from typing import List
import logging

from nexus_core.messaging import NexusMessage, NexusProducer
from nexus_core.topics import CrossModuleTopicNamer

logger = logging.getLogger(__name__)


@dataclass
class DriftEvent:
    drift_type: str   # "field_added", "field_removed", "type_changed"
    table_name: str
    field_name: str
    old_value: str = None
    new_value: str = None


def detect_drift(
    previous_artifact_dict: dict,
    current_artifact_dict: dict,
) -> List[DriftEvent]:
    """
    Compara dos SourceKnowledgeArtifacts.
    Retorna lista de DriftEvents (vacía si no hay drift).
    """
    drift_events = []

    prev_tables = {t["table_name"]: t for t in previous_artifact_dict.get("tables", [])}
    curr_tables = {t["table_name"]: t for t in current_artifact_dict.get("tables", [])}

    # Tablas nuevas
    for table_name in curr_tables:
        if table_name not in prev_tables:
            drift_events.append(DriftEvent(
                drift_type="table_added",
                table_name=table_name,
                field_name="*",
            ))
            continue

        # Campos modificados
        prev_fields = {f["field_name"]: f for f in prev_tables[table_name].get("fields", [])}
        curr_fields = {f["field_name"]: f for f in curr_tables[table_name].get("fields", [])}

        for field_name in curr_fields:
            if field_name not in prev_fields:
                drift_events.append(DriftEvent(
                    drift_type="field_added",
                    table_name=table_name,
                    field_name=field_name,
                ))
            elif prev_fields[field_name]["data_type"] != curr_fields[field_name]["data_type"]:
                drift_events.append(DriftEvent(
                    drift_type="type_changed",
                    table_name=table_name,
                    field_name=field_name,
                    old_value=prev_fields[field_name]["data_type"],
                    new_value=curr_fields[field_name]["data_type"],
                ))

        for field_name in prev_fields:
            if field_name not in curr_fields:
                drift_events.append(DriftEvent(
                    drift_type="field_removed",
                    table_name=table_name,
                    field_name=field_name,
                ))

    # Tablas eliminadas
    for table_name in prev_tables:
        if table_name not in curr_tables:
            drift_events.append(DriftEvent(
                drift_type="table_removed",
                table_name=table_name,
                field_name="*",
            ))

    return drift_events


async def check_and_trigger_if_drift(
    tenant_id: str,
    connector_id: str,
    current_artifact: dict,
    pool,
    producer: NexusProducer,
    correlation_id: str = None,
) -> bool:
    """
    Carga el snapshot más reciente de BD y compara.
    Si hay drift → publica structural_cycle_triggered.
    Retorna True si hay drift.
    """
    from nexus_core.db import get_tenant_scoped_connection
    import json
    import uuid

    async with await get_tenant_scoped_connection(pool, tenant_id) as conn:
        row = await conn.fetchrow("""
            SELECT artifact FROM nexus_system.schema_snapshots
            WHERE connector_id = $1 AND tenant_id = $2
            ORDER BY created_at DESC
            LIMIT 1 OFFSET 1   -- El OFFSET 1 omite el snapshot que acabamos de guardar
        """, connector_id, tenant_id)

    if not row:
        logger.info(f"Sin snapshot previo para conector {connector_id} — no hay drift posible")
        return False

    previous_artifact = json.loads(row["artifact"])
    drift = detect_drift(previous_artifact, current_artifact)

    if drift:
        logger.warning(
            f"Drift detectado para tenant={tenant_id} conector={connector_id}: "
            f"{len(drift)} cambios"
        )
        msg = NexusMessage(
            topic=CrossModuleTopicNamer.STATIC.STRUCTURAL_CYCLE_TRIGGERED,
            tenant_id=tenant_id,
            event_type="structural_cycle_triggered",
            payload={
                "connector_id":   connector_id,
                "drift_events":   [vars(d) for d in drift],
                "drift_count":    len(drift),
            },
            correlation_id=correlation_id or str(uuid.uuid4()),
        )
        producer.publish(msg)

    return bool(drift)
```

---

## 15. P5-M3-01 — Vector Writer (Pinecone)

**Owner:** ML Engineer (AI & Knowledge Team)
**Depende de:** P2-M1-10 (AI Store Router en funcionamiento)
**Duración:** Semana 7

### Modelo de embeddings — CRÍTICO

```
Modelo: sentence-transformers/all-MiniLM-L6-v2
Dimensiones: 384
Tipo: LOCAL — cargado en el pod, NO llamada a OpenAI API ni ninguna API externa
Por qué: latencia predecible, sin costos por token, sin datos saliendo del cluster
```

```python
# m3/vector_writer.py
import logging
from typing import List, Dict, Any
from pinecone import Pinecone, ServerlessSpec
from sentence_transformers import SentenceTransformer
import prometheus_client as prom
import torch

from nexus_core.messaging import NexusMessage, NexusProducer, NexusConsumer
from nexus_core.topics import CrossModuleTopicNamer

logger = logging.getLogger(__name__)

VECTORS_WRITTEN  = prom.Counter("m3_vectors_written_total", "Vectores escritos",    ["tenant_id","entity_type"])
VECTOR_WRITE_FAIL = prom.Counter("m3_vector_write_failures", "Vector write failures",["tenant_id"])
EMBED_LATENCY    = prom.Histogram("m3_embedding_latency_seconds","Latencia de embedding",["entity_type"])

# ÚNICO modelo de embeddings en todo el sistema — no cambiar sin actualizar índices Pinecone
_EMBEDDING_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
_EMBEDDING_DIMS = 384

# Singleton — cargado una vez al inicio del pod
_model: SentenceTransformer = None


def get_embedding_model() -> SentenceTransformer:
    global _model
    if _model is None:
        logger.info(f"Cargando modelo de embeddings: {_EMBEDDING_MODEL_NAME}")
        device = "cuda" if torch.cuda.is_available() else "cpu"
        _model = SentenceTransformer(_EMBEDDING_MODEL_NAME, device=device)
        logger.info(f"Modelo cargado en {device}")
    return _model


def vectorize_entity(entity: Dict[str, Any]) -> List[float]:
    """
    Convierte un CDMEntity en vector de 384 dimensiones.
    Concatena los valores más relevantes en texto.
    """
    model = get_embedding_model()
    
    # Construir texto representativo del entity
    parts = []
    entity_type = entity.get("entity_type", "")
    
    if entity_type == "party":
        fields = entity.get("fields", {})
        parts = [
            str(fields.get("name", "")),
            str(fields.get("email", "")),
            str(fields.get("company", "")),
            str(fields.get("industry", "")),
        ]
    elif entity_type == "product":
        fields = entity.get("fields", {})
        parts = [
            str(fields.get("name", "")),
            str(fields.get("description", "")),
            str(fields.get("category", "")),
        ]
    elif entity_type == "employee":
        fields = entity.get("fields", {})
        parts = [
            str(fields.get("name", "")),
            str(fields.get("job_title", "")),
            str(fields.get("department", "")),
            str(fields.get("email", "")),
        ]
    elif entity_type == "incident":
        fields = entity.get("fields", {})
        parts = [
            str(fields.get("title", "")),
            str(fields.get("description", "")),
            str(fields.get("category", "")),
        ]
    else:
        # Fallback: todos los campos como texto
        parts = [f"{k}: {v}" for k, v in entity.get("fields", {}).items()]

    text = " | ".join(filter(None, parts))
    if not text.strip():
        text = f"{entity_type} unknown"

    import time
    t = time.time()
    vector = model.encode(text, normalize_embeddings=True).tolist()
    EMBED_LATENCY.labels(entity_type=entity_type).observe(time.time() - t)

    assert len(vector) == _EMBEDDING_DIMS, (
        f"Dimensión incorrecta: {len(vector)} (esperado {_EMBEDDING_DIMS})"
    )
    return vector


class VectorWriter:
    """
    Escribe CDMEntities en Pinecone.
    Índice por tenant + entity_type: nexus-{tenant_id}-{entity_type}
    """

    def __init__(self, pinecone_api_key: str):
        self._pc = Pinecone(api_key=pinecone_api_key)
        self._indexes: Dict[str, Any] = {}

    def _get_index(self, tenant_id: str, entity_type: str):
        index_name = f"nexus-{tenant_id}-{entity_type}"
        if index_name not in self._indexes:
            # Crear índice si no existe
            if index_name not in [idx.name for idx in self._pc.list_indexes()]:
                self._pc.create_index(
                    name=index_name,
                    dimension=_EMBEDDING_DIMS,
                    metric="cosine",
                    spec=ServerlessSpec(cloud="aws", region="us-east-1"),
                )
                logger.info(f"Índice Pinecone creado: {index_name}")
            self._indexes[index_name] = self._pc.Index(index_name)
        return self._indexes[index_name]

    def write_entity(self, entity: Dict[str, Any], tenant_id: str) -> None:
        entity_type = entity.get("entity_type", "unknown")
        if entity_type == "unknown":
            logger.debug(f"Saltando entidad sin entity_type para tenant={tenant_id}")
            return

        try:
            vector = vectorize_entity(entity)
            index = self._get_index(tenant_id, entity_type)

            record_id = entity.get("record_id", str(__import__("uuid").uuid4()))
            metadata = {
                "tenant_id":     tenant_id,
                "entity_type":   entity_type,
                "source_system": entity.get("source_system", ""),
                "source_table":  entity.get("source_table", ""),
                "cdm_version":   entity.get("cdm_version", "1.0.0"),
            }

            index.upsert(vectors=[{
                "id":       record_id,
                "values":   vector,
                "metadata": metadata,
            }])
            VECTORS_WRITTEN.labels(tenant_id=tenant_id, entity_type=entity_type).inc()

        except Exception as e:
            VECTOR_WRITE_FAIL.labels(tenant_id=tenant_id).inc()
            logger.exception(f"Error escribiendo vector para entity_type={entity_type}: {e}")
            raise
```

---

## 16. P5-M3-02 — Graph Writer (Neo4j)

**Owner:** Backend M3
**Depende de:** P2-M1-10
**Duración:** Semana 8

```python
# m3/graph_writer.py
"""
Escribe entidades CDM party, transaction, employee nel grafo Neo4j AuraDB.
Usa MERGE para idempotencia — seguro ejecutar 2 veces con el mismo entity.
Patrón: (:Entity {id, tenant_id, cdm_entity_type}) -[:RELATES_TO]-> (:Entity)
"""
import logging
from typing import Dict, Any
from neo4j import GraphDatabase
import prometheus_client as prom

logger = logging.getLogger(__name__)

GRAPH_WRITES  = prom.Counter("m3_graph_writes_total",    "Nodos+aristas escritos", ["tenant_id","entity_type"])
GRAPH_FAILURES= prom.Counter("m3_graph_failures_total",  "Graph write failures",   ["tenant_id"])


class GraphWriter:
    """
    Gestiona escritura en Neo4j AuraDB.
    Índices separados por tenant vía propiedad tenant_id.
    """

    def __init__(self, neo4j_uri: str, neo4j_user: str, neo4j_password: str):
        self._driver = GraphDatabase.driver(neo4j_uri, auth=(neo4j_user, neo4j_password))
        logger.info(f"GraphWriter conectado a Neo4j AuraDB")

    def _get_label(self, entity_type: str) -> str:
        return entity_type.capitalize()  # party → Party, transaction → Transaction

    def write_entity(self, entity: Dict[str, Any], tenant_id: str) -> None:
        entity_type = entity.get("entity_type", "unknown")
        if entity_type not in ("party", "transaction", "employee"):
            return

        record_id = entity.get("record_id", str(__import__("uuid").uuid4()))
        label = self._get_label(entity_type)
        fields = entity.get("fields", {})

        try:
            with self._driver.session() as session:
                # MERGE: crea nodo si no existe, actualiza si existe
                session.run(f"""
                    MERGE (e:{label} {{id: $record_id, tenant_id: $tenant_id}})
                    SET e += $props
                    SET e.updated_at = datetime()
                """, {
                    "record_id": record_id,
                    "tenant_id": tenant_id,
                    "props": {
                        **{k: str(v) for k, v in fields.items() if v is not None},
                        "source_system": entity.get("source_system", ""),
                        "source_table":  entity.get("source_table", ""),
                    }
                })

                # Crear relaciones si hay contexto disponible
                if entity_type == "transaction" and fields.get("party_id"):
                    session.run("""
                        MATCH (t:Transaction {id: $txn_id, tenant_id: $tid})
                        MATCH (p:Party {id: $party_id, tenant_id: $tid})
                        MERGE (t)-[:INVOLVES]->(p)
                    """, {
                        "txn_id":   record_id,
                        "party_id": str(fields["party_id"]),
                        "tid":      tenant_id,
                    })

            GRAPH_WRITES.labels(tenant_id=tenant_id, entity_type=entity_type).inc()

        except Exception as e:
            GRAPH_FAILURES.labels(tenant_id=tenant_id).inc()
            logger.exception(f"Error escribiendo en grafo: entity_type={entity_type}: {e}")
            raise

    def close(self):
        self._driver.close()
```

---

## 17. P5-M3-03 — TimeSeries Writer (TimescaleDB)

**Owner:** Backend M3
**Depende de:** P2-M1-10
**Duración:** Semana 9

```python
# m3/timeseries_writer.py
"""
Escribe entidades CDM transaction e incident en TimescaleDB.
TimescaleDB = PostgreSQL + hypertables para series temporales.
Una tabla por entity_type — particionada por tiempo.
"""
import asyncpg
import logging
from typing import Dict, Any, Optional
from datetime import datetime
import prometheus_client as prom

logger = logging.getLogger(__name__)

TS_WRITES   = prom.Counter("m3_ts_writes_total",   "Filas TimeSeries escritas",  ["tenant_id","entity_type"])
TS_FAILURES = prom.Counter("m3_ts_failures_total", "TimeSeries write failures",  ["tenant_id"])


# DDL para hypertables — ejecutar una sola vez en provisioning
TIMESERIES_DDL = """
CREATE TABLE IF NOT EXISTS cdm_transactions (
    time         TIMESTAMPTZ NOT NULL,
    tenant_id    VARCHAR(100) NOT NULL,
    record_id    VARCHAR(64)  NOT NULL,
    party_id     VARCHAR(64),
    amount       DECIMAL(18,2),
    currency     VARCHAR(10),
    transaction_type VARCHAR(50),
    source_system VARCHAR(100),
    cdm_version  VARCHAR(20),
    extra_fields JSONB
);

SELECT create_hypertable('cdm_transactions', 'time', if_not_exists => TRUE);

CREATE TABLE IF NOT EXISTS cdm_incidents (
    time         TIMESTAMPTZ NOT NULL,
    tenant_id    VARCHAR(100) NOT NULL,
    record_id    VARCHAR(64)  NOT NULL,
    category     VARCHAR(200),
    priority     VARCHAR(20),
    status       VARCHAR(50),
    source_system VARCHAR(100),
    cdm_version  VARCHAR(20),
    extra_fields JSONB
);

SELECT create_hypertable('cdm_incidents', 'time', if_not_exists => TRUE);
"""


class TimeSeriesWriter:
    """
    Escribe en TimescaleDB usando asyncpg.
    Aislamiento por tenant_id en WHERE clauses (complementa RLS de nexus-postgres).
    """

    def __init__(self, dsn: str):
        self._dsn = dsn
        self._pool: Optional[asyncpg.Pool] = None

    async def _get_pool(self) -> asyncpg.Pool:
        if not self._pool:
            self._pool = await asyncpg.create_pool(
                dsn=self._dsn,
                min_size=1,
                max_size=10,
            )
        return self._pool

    async def initialize(self) -> None:
        """Crear hypertables si no existen. Idempotente."""
        pool = await self._get_pool()
        async with pool.acquire() as conn:
            await conn.execute(TIMESERIES_DDL)
        logger.info("TimescaleDB hypertables inicializadas")

    async def write_entity(self, entity: Dict[str, Any], tenant_id: str) -> None:
        entity_type = entity.get("entity_type", "unknown")
        if entity_type not in ("transaction", "incident"):
            return

        pool = await self._get_pool()
        record_id = entity.get("record_id", str(__import__("uuid").uuid4()))
        fields = entity.get("fields", {})

        try:
            async with pool.acquire() as conn:
                if entity_type == "transaction":
                    ts_field = (
                        fields.get("transaction_date") or
                        fields.get("order_date") or
                        fields.get("invoice_date") or
                        datetime.utcnow().isoformat()
                    )
                    await conn.execute("""
                        INSERT INTO cdm_transactions
                            (time, tenant_id, record_id, party_id, amount,
                             currency, transaction_type, source_system, cdm_version, extra_fields)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                        ON CONFLICT DO NOTHING
                    """,
                        _parse_ts(ts_field),
                        tenant_id,
                        record_id,
                        _safe_str(fields.get("party_id")),
                        _safe_decimal(fields.get("amount") or fields.get("total")),
                        _safe_str(fields.get("currency", "USD")),
                        _safe_str(fields.get("transaction_type") or fields.get("type")),
                        entity.get("source_system", ""),
                        entity.get("cdm_version", "1.0.0"),
                        _extra_fields(fields, ["party_id","amount","currency","transaction_type"]),
                    )

                elif entity_type == "incident":
                    ts_field = (
                        fields.get("created_at") or
                        fields.get("opened_at") or
                        datetime.utcnow().isoformat()
                    )
                    await conn.execute("""
                        INSERT INTO cdm_incidents
                            (time, tenant_id, record_id, category, priority,
                             status, source_system, cdm_version, extra_fields)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                        ON CONFLICT DO NOTHING
                    """,
                        _parse_ts(ts_field),
                        tenant_id,
                        record_id,
                        _safe_str(fields.get("category")),
                        _safe_str(fields.get("priority")),
                        _safe_str(fields.get("status")),
                        entity.get("source_system", ""),
                        entity.get("cdm_version", "1.0.0"),
                        _extra_fields(fields, ["category","priority","status"]),
                    )

            TS_WRITES.labels(tenant_id=tenant_id, entity_type=entity_type).inc()

        except Exception as e:
            TS_FAILURES.labels(tenant_id=tenant_id).inc()
            logger.exception(f"Error escribiendo TimeSeries: entity_type={entity_type}: {e}")
            raise


def _parse_ts(val) -> datetime:
    if isinstance(val, datetime): return val
    if isinstance(val, str):
        for fmt in ["%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"]:
            try:
                return datetime.strptime(val[:len(fmt)], fmt)
            except ValueError: pass
    return datetime.utcnow()


def _safe_str(val) -> Optional[str]:
    return str(val) if val is not None else None


def _safe_decimal(val) -> Optional[float]:
    try: return float(val)
    except (TypeError, ValueError): return None


def _extra_fields(fields: dict, exclude: list) -> dict:
    import json
    return json.dumps({k: str(v) for k, v in fields.items() if k not in exclude})
```

---

## 18. Contratos Inter-Equipo M1↔M2↔M3

### Contrato 1: M1 → M2 (SourceKnowledgeArtifact)

```
Topic:      m1.int.source_schema_extracted (static)
Payload:    SourceKnowledgeArtifact (dataclass)
SLA M2:     M2 DEBE responder en ≤24 horas con ProposedInterpretation
Acción M2:  Publicar {tid}.m2.semantic_interpretation_complete
Error si:   M2 tarda >24h → M1 escalates a governance_queue manualmente
```

### Contrato 2: M1 → M3 (CDMEntity objects)

```
Topic:      m1.int.ai_routing_decided → m3 readers
Payload:    CDMEntity con {entity_type, fields, source_system, source_table}
Regla:      M3 escribe EXACTAMENTE lo que M1 envía — cero transformaciones
Regla:      M3 NO filtra ni interpreta datos — eso es trabajo de M2
Error si:   M3 modifica o re-clasifica entity_type → violación de contrato
```

### Contrato 3: M2 → M4 (workflow_trigger)

```
Topic:      {tid}.m2.workflow_trigger
Payload:    {workflow_type, workflow_params, entity_context}
Regla:      M4 DEBE tener el workflow implementado ANTES de que M2 lo publique
Error si:   M2 publica workflow_type que M4 no conoce → mensaje muere en dead_letter
Sincronización: M4 publica lista de workflows activos en startup → M2 la carga
```

### Contrato 4: M4 → M1 (mapping_approved)

```
Topic:      {tid}.m4.mapping_approved
Payload:    {mapping_id, source_system, source_table, source_field, cdm_entity, cdm_field}
SLA:        M1 recibe y aplica en ≤5 segundos (CDM cache invalidado inmediatamente)
Acción M1:  Llamar CDMRegistryService.invalidate_cache(tenant_id)
Error si:   Aprobación tarda >5s → alert Prometheus + escalación
```

### Contrato 5: CDM Versioning (todos los módulos)

```
Topic:      nexus.cdm.version_published (RF=3, retención 90 días)
Regla:      Ningún módulo usa 2 versiones CDM distintas dentro del mismo batch
Regla:      Todos los módulos subscriben a nexus.cdm.version_published en startup
Acción:     Al recibir nueva versión → invalidar caches, actualizar TenantContext.cdm_version
Error si:   Módulo ignora version_published → silencio ≥10 min → alert crítico
```

---

## 19. Checklist de Gate Fase 2

```
PIPELINE M1 OPERACIONAL
☐ ConnectorWorker consume sync_requested y extrae de PostgreSQL (FULL + INCREMENTAL)
☐ ConnectorWorker consume sync_requested y extrae de Salesforce
☐ ConnectorWorker consume sync_requested y extrae de Odoo
☐ ConnectorWorker consume sync_requested y extrae de ServiceNow
☐ Backpressure funciona: lag >50,000 pausa extracción; <10,000 la reanuda
☐ DeltaWriter: flush en 5,000 records (sin esperar 30s)
☐ DeltaWriter: flush en 30s (con solo 10 records)
☐ DeltaWriter: MERGE idempotente — ejecutar 2 veces mismos records = sin duplicados
☐ Delta Lake verificable en MinIO: nexus-raw/{tenant}/{source}/{table}/
☐ Spark job m1_classify_and_prepare clasifica account → party
☐ Spark job clasifica invoice → transaction
☐ Spark job clasifica employee → employee
☐ Spark job clasifica incident → incident
☐ Spark job clasifica desconocido → unknown (sin crash)
☐ CDM Mapper aplica mapeo Tier 1 correctamente
☐ CDM Mapper envía mapping_review_needed si campo sin mapeo
☐ AI Store Router: party → Vector + Graph (no TimeSeries)
☐ AI Store Router: transaction → Graph + TimeSeries (no Vector)
☐ AI Store Router: product → solo Vector

CICLO ESTRUCTURAL (PARALELO)
☐ Schema Profiler extrae schema de PostgreSQL correctamente
☐ Schema Profiler extrae schema de Salesforce correctamente
☐ SourceKnowledgeArtifact publicado a m1.int.source_schema_extracted
☐ Drift Detector detecta campo nuevo y publica structural_cycle_triggered
☐ Drift Detector detecta cambio de tipo y publica structural_cycle_triggered
☐ Sin drift → NO se publica ningún evento

M3 KNOWLEDGE STORES
☐ VectorWriter: entidad party → vector en Pinecone (índice nexus-{tid}-party)
☐ VectorWriter: dimensión = 384 (all-MiniLM-L6-v2 LOCAL)
☐ VectorWriter: modelo se carga LOCALMENTE sin llamadas API externas
☐ GraphWriter: nodo Party creado en Neo4j con MERGE (idempotente)
☐ GraphWriter: nodo Transaction relacionado con Party via INVOLVES
☐ GraphWriter: cero cross-tenant (tenant_id en todos los MATCH)
☐ TimeSeriesWriter: transaction escrita en hypertable cdm_transactions
☐ TimeSeriesWriter: incident escrita en hypertable cdm_incidents
☐ TimeSeriesWriter: ON CONFLICT DO NOTHING (idempotente)
☐ ai_write_completed publicado tras escribir todos los stores

CONTRATOS INTER-EQUIPO
☐ M1 → M2: SourceKnowledgeArtifact recibido por M2 agent (validado manualmente)
☐ M1 → M3: CDMEntity escrito exactamente como llegó (sin modificaciones)
☐ Cache CDM invalidado en <1s al recibir mapping_approved
☐ Todos los mensajes tienen correlation_id propagado de inicio a fin

DEFINITION OF DONE
☐ Cero print() — solo structlog
☐ Cero credenciales en código
☐ Topic names via CrossModuleTopicNamer
☐ Offset commit solo después de éxito
☐ NexusMessage envelope en todos los mensajes
☐ OpenTelemetry span en ConnectorWorker, DeltaWriter, CDMMapper, VectorWriter
☐ Prometheus counters trabajando en Grafana dashboard
```

---

*NEXUS Build Plan — Fase 2 · Mentis Consulting · Semanas 3–10 · Confidencial*
*Ver NEXUS-BUILD-PHASE-1.md para prerrequisitos. Ver NEXUS-BUILD-PHASE-3.md para continuación.*
