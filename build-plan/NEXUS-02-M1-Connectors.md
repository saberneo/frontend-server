# NEXUS — Archivo 02: M1 Conectores
## Phase 2 · Módulo 1 · Conectores (BaseConnector + 6 implementaciones)
### Semanas 3–6 · Equipo Data Intelligence · Depende de: NEXUS-BUILD-PHASE-1.md completado al 100%

---

## Tabla de Contenidos

1. [Contexto y Dependencias](#1-contexto-y-dependencias)
2. [Reglas Absolutas de M1](#2-reglas-absolutas-de-m1)
3. [Arquitectura del Pipeline M1](#3-arquitectura-del-pipeline-m1)
4. [P2-M1-01 — BaseConnector (Clase Abstracta)](#4-p2-m1-01--baseconnector-clase-abstracta)
5. [P2-M1-02 — PostgreSQL Connector](#5-p2-m1-02--postgresql-connector)
6. [P2-M1-03 — MySQL Connector](#6-p2-m1-03--mysql-connector)
7. [P2-M1-04 — Salesforce Connector](#7-p2-m1-04--salesforce-connector)
8. [P2-M1-05 — Odoo Connector](#8-p2-m1-05--odoo-connector)
9. [P2-M1-06 — ServiceNow Connector](#9-p2-m1-06--servicenow-connector)
10. [P2-M1-07 — SQL Server Connector](#10-p2-m1-07--sql-server-connector)
11. [Registro de Conectores en BD](#11-registro-de-conectores-en-bd)
12. [Acceptance Criteria de Conectores](#12-acceptance-criteria-de-conectores)

---

## 1. Contexto y Dependencias

### Qué son los conectores en NEXUS

Los conectores son la capa de extracción de datos. Cada conector:
- Se conecta a un sistema fuente (Salesforce, Odoo, PostgreSQL, etc.)
- Extrae registros en modo FULL o INCREMENTAL (CDC)
- Publica cada RawRecord al topic `m1.int.raw_records` vía NexusProducer
- NO transforma, NO mapea, NO razona — solo extrae

### Dependencias HARD antes de escribir una sola línea

| Prerequisito | Cómo verificar |
|---|---|
| nexus_core instalado en el venv del equipo | `python -c "from nexus_core.messaging import NexusMessage; print('OK')"` |
| Topic `m1.int.raw_records` existe (16 particiones) | kafka-topics.sh --describe |
| Topic `m1.int.sync_requested` existe | kafka-topics.sh --describe |
| Topic `m1.int.sync_failed` existe | kafka-topics.sh --describe |
| AWS Secrets Manager accesible | `aws secretsmanager list-secrets --region eu-west-1` |
| ExternalSecrets Operator activo | `kubectl get pods -n nexus-infra -l app.kubernetes.io/name=external-secrets` |
| Consumer group `m1-connector-workers` visible en Grafana | Dashboard NEXUS Pipeline Health |

### Convención de nombres de secrets

```
nexus/{tenant_id}/{connector_id}/credentials

Campos por tipo de sistema:
  postgresql:   host, port, database, username, password
  mysql:        host, port, database, username, password  
  sqlserver:    host, port, database, username, password
  salesforce:   username, password, security_token, domain
  odoo:         url, database, username, api_key
  servicenow:   instance, username, password
```

---

## 2. Reglas Absolutas de M1

```
REGLA 1: Ningún conector llama a LLM ni a M2 directamente.
         El conector solo publica RawRecord al topic.

REGLA 2: Ningún conector escribe directamente a PostgreSQL nexus_system.
         Únicamente el ConnectorWorker (siguiente archivo) escribe sync_jobs.

REGLA 3: Las credenciales se leen SIEMPRE de AWS Secrets Manager vía el K8s Secret
         montado como volumen. NUNCA de variables de entorno hardcodeadas.

REGLA 4: Un conector que falla UNA operación debe:
         a) Loguear con structlog (level=error)
         b) Publicar a m1.int.sync_failed
         c) Detener el sync limpiamente (no crashear el pod)

REGLA 5: El sync_mode FULL elimina y reescribe. INCREMENTAL añade/actualiza.
         Nunca confundir los dos modos en el mismo batch.
```

---

## 3. Arquitectura del Pipeline M1

```
Sistemas Fuente                    Kafka                    Procesamiento
─────────────────                  ─────                    ─────────────

Salesforce ──┐                    m1.int.
Odoo ────────┤  ConnectorWorker → sync_requested
PostgreSQL ──┤  (6 conectores)  → raw_records (16p) → DeltaWriter
MySQL ───────┤                  → sync_failed        → SparkJob
ServiceNow ──┤                                        → CDMMapper
SQL Server ──┘                  → delta_batch_ready  → AIStoreRouter
                                → classified_records
                                → cdm_entities_ready
                                → ai_routing_decided
                                → ai_write_completed

Backpressure:
  raw_records lag > 50,000 → ConnectorWorker.pause()
  raw_records lag < 10,000 → ConnectorWorker.resume()
```

---

## 4. P2-M1-01 — BaseConnector (Clase Abstracta)

**Owner:** DI-Senior  
**Duración:** Día 1–2 de Semana 3  
**Archivo:** `m1/connectors/base.py`

```python
# m1/connectors/base.py
"""
BaseConnector — clase abstracta que TODOS los conectores deben extender.

Contrato:
  1. Implementar connect() / disconnect()
  2. Implementar extract_full() para sync FULL
  3. Implementar extract_incremental() para CDC / timestamp-based
  4. Jamás invocar LLM ni llamar a otros módulos directamente
"""
import uuid
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import AsyncIterator, Optional, Dict, Any
from enum import Enum

logger = logging.getLogger(__name__)


class SyncMode(str, Enum):
    FULL = "full"
    INCREMENTAL = "incremental"
    CDC = "cdc"


class SystemType(str, Enum):
    POSTGRESQL = "postgresql"
    MYSQL = "mysql"
    SQLSERVER = "sqlserver"
    SALESFORCE = "salesforce"
    ODOO = "odoo"
    SERVICENOW = "servicenow"


@dataclass
class ConnectorConfig:
    connector_id: str
    tenant_id: str
    system_type: SystemType
    sync_mode: SyncMode
    credentials: Dict[str, str]             # Leídas de AWS Secrets Manager
    target_entities: list[str]              # ["Account", "Contact", "Opportunity"]
    batch_size: int = 1000
    incremental_cursor_field: str = "updated_at"
    last_cursor_value: Optional[str] = None
    extra_config: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RawRecord:
    """
    Un registro extraído de un sistema fuente.
    El campo 'data' contiene el registro tal como viene del sistema fuente
    — sin transformación, sin filtrado de campos.
    """
    record_id: str
    tenant_id: str
    connector_id: str
    system_type: str
    source_table: str
    source_schema: Optional[str]
    data: Dict[str, Any]              # Registro RAW del sistema fuente
    extracted_at: str                  # ISO8601
    sync_mode: str
    batch_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    cursor_field: Optional[str] = None
    cursor_value: Optional[str] = None


class BaseConnector(ABC):
    """
    Clase base para todos los conectores NEXUS.
    
    Implementación típica:
        class SalesforceConnector(BaseConnector):
            async def connect(self): ...
            async def disconnect(self): ...
            async def extract_full(self) -> AsyncIterator[RawRecord]: ...
            async def extract_incremental(self) -> AsyncIterator[RawRecord]: ...
    """

    def __init__(self, config: ConnectorConfig):
        self.config = config
        self._connected = False
        self._batch_id = str(uuid.uuid4())

    @abstractmethod
    async def connect(self) -> None:
        """Establece conexión con el sistema fuente. Lanza ConnectorError si falla."""
        ...

    @abstractmethod
    async def disconnect(self) -> None:
        """Cierra la conexión limpiamente."""
        ...

    @abstractmethod
    async def extract_full(self) -> AsyncIterator[RawRecord]:
        """
        Extrae TODOS los registros de las entidades configuradas.
        Debe ser un async generator que yield RawRecord uno a uno.
        """
        ...

    @abstractmethod
    async def extract_incremental(self) -> AsyncIterator[RawRecord]:
        """
        Extrae solo los registros modificados desde last_cursor_value.
        Debe actualizar self.config.last_cursor_value al final.
        """
        ...

    def _make_raw_record(
        self,
        source_table: str,
        data: Dict[str, Any],
        source_schema: str = None,
        cursor_value: str = None,
    ) -> RawRecord:
        """Helper para construir RawRecord con valores comunes."""
        import datetime
        return RawRecord(
            record_id=str(uuid.uuid4()),
            tenant_id=self.config.tenant_id,
            connector_id=self.config.connector_id,
            system_type=self.config.system_type.value,
            source_table=source_table,
            source_schema=source_schema,
            data=data,
            extracted_at=datetime.datetime.utcnow().isoformat(),
            sync_mode=self.config.sync_mode.value,
            batch_id=self._batch_id,
            cursor_field=self.config.incremental_cursor_field,
            cursor_value=cursor_value,
        )

    async def test_connection(self) -> bool:
        """
        Verifica que la conexión funciona sin extraer datos.
        Llamado al registrar un nuevo conector desde la UI.
        """
        try:
            await self.connect()
            await self.disconnect()
            return True
        except Exception as e:
            logger.error(
                f"test_connection fallido para connector_id={self.config.connector_id}: {e}"
            )
            return False
```

### ConnectorError — jerarquía de excepciones para conectores

```python
# m1/connectors/errors.py
class ConnectorError(Exception):
    """Error base de conectores."""
    def __init__(self, msg: str, connector_id: str = None, tenant_id: str = None):
        super().__init__(msg)
        self.connector_id = connector_id
        self.tenant_id = tenant_id


class ConnectorAuthError(ConnectorError):
    """Credenciales inválidas o expiradas."""


class ConnectorConnectionError(ConnectorError):
    """No se puede establecer conexión con el sistema fuente."""


class ConnectorRateLimitError(ConnectorError):
    """Sistema fuente ha aplicado rate limiting."""


class ConnectorQuotaError(ConnectorError):
    """Excedida la cuota del sistema fuente (ej. API calls)."""
```

---

## 5. P2-M1-02 — PostgreSQL Connector

**Owner:** DI-Mid  
**Duración:** Día 2–3 de Semana 3  
**Archivo:** `m1/connectors/postgresql_connector.py`

```python
# m1/connectors/postgresql_connector.py
import asyncpg
import logging
from typing import AsyncIterator
from m1.connectors.base import BaseConnector, RawRecord, ConnectorConfig
from m1.connectors.errors import ConnectorAuthError, ConnectorConnectionError

logger = logging.getLogger(__name__)


class PostgreSQLConnector(BaseConnector):
    """
    Conector para bases de datos PostgreSQL.
    
    Soporta:
    - FULL: SELECT * FROM tabla ORDER BY primary_key
    - INCREMENTAL: SELECT * FROM tabla WHERE updated_at > last_cursor ORDER BY updated_at
    
    No soporta CDC con Debezium en esta versión (se agrega en M1 Phase 3).
    """

    def __init__(self, config: ConnectorConfig):
        super().__init__(config)
        self._pool: asyncpg.Pool = None

    async def connect(self) -> None:
        creds = self.config.credentials
        try:
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
            # Verificar conexión con query simple
            async with self._pool.acquire() as conn:
                await conn.execute("SELECT 1")
            self._connected = True
            logger.info(
                f"PostgreSQL conectado: host={creds['host']} "
                f"db={creds['database']} connector_id={self.config.connector_id}"
            )
        except asyncpg.InvalidPasswordError as e:
            raise ConnectorAuthError(
                f"Credenciales PostgreSQL inválidas para {creds.get('host')}: {e}",
                connector_id=self.config.connector_id,
                tenant_id=self.config.tenant_id,
            )
        except (OSError, asyncpg.CannotConnectNowError) as e:
            raise ConnectorConnectionError(
                f"No se puede conectar a PostgreSQL {creds.get('host')}: {e}",
                connector_id=self.config.connector_id,
                tenant_id=self.config.tenant_id,
            )

    async def disconnect(self) -> None:
        if self._pool:
            await self._pool.close()
            self._connected = False
            logger.info(f"PostgreSQL desconectado: connector_id={self.config.connector_id}")

    async def extract_full(self) -> AsyncIterator[RawRecord]:
        """
        Extrae todos los registros de cada tabla configurada.
        Usa cursor server-side para no cargar todo en memoria.
        """
        if not self._connected:
            raise ConnectorConnectionError("No conectado. Llamar connect() primero.")

        for table in self.config.target_entities:
            schema, tbl = self._parse_table(table)
            logger.info(
                f"FULL extract: schema={schema} table={tbl} "
                f"connector_id={self.config.connector_id}"
            )

            async with self._pool.acquire() as conn:
                # Server-side cursor para streaming
                async with conn.transaction():
                    async for row in conn.cursor(
                        f'SELECT * FROM "{schema}"."{tbl}" ORDER BY 1',
                        prefetch=self.config.batch_size,
                    ):
                        yield self._make_raw_record(
                            source_table=tbl,
                            source_schema=schema,
                            data=dict(row),
                        )

    async def extract_incremental(self) -> AsyncIterator[RawRecord]:
        """
        Extrae solo registros modificados desde last_cursor_value.
        Cursor field: configurado en ConnectorConfig.incremental_cursor_field
        """
        if not self._connected:
            raise ConnectorConnectionError("No conectado.")

        cursor_field = self.config.incremental_cursor_field
        last_cursor = self.config.last_cursor_value or "1970-01-01T00:00:00"

        for table in self.config.target_entities:
            schema, tbl = self._parse_table(table)
            max_cursor = last_cursor

            async with self._pool.acquire() as conn:
                async with conn.transaction():
                    query = (
                        f'SELECT * FROM "{schema}"."{tbl}" '
                        f'WHERE "{cursor_field}" > $1 '
                        f'ORDER BY "{cursor_field}" ASC'
                    )
                    async for row in conn.cursor(
                        query, last_cursor, prefetch=self.config.batch_size
                    ):
                        row_dict = dict(row)
                        cursor_val = str(row_dict.get(cursor_field, ""))
                        if cursor_val > max_cursor:
                            max_cursor = cursor_val
                        yield self._make_raw_record(
                            source_table=tbl,
                            source_schema=schema,
                            data=row_dict,
                            cursor_value=cursor_val,
                        )

            # Actualizar cursor para este conector
            self.config.last_cursor_value = max_cursor
            logger.info(
                f"Incremental cursor actualizado: {cursor_field}={max_cursor} "
                f"table={tbl} connector_id={self.config.connector_id}"
            )

    def _parse_table(self, table: str):
        """
        Parsea 'schema.table' o 'table' (default schema = public).
        """
        if "." in table:
            parts = table.split(".", 1)
            return parts[0], parts[1]
        return "public", table
```

---

## 6. P2-M1-03 — MySQL Connector

**Owner:** DI-Mid  
**Duración:** Día 3 de Semana 3  
**Archivo:** `m1/connectors/mysql_connector.py`

```python
# m1/connectors/mysql_connector.py
import logging
from typing import AsyncIterator
import aiomysql
from m1.connectors.base import BaseConnector, RawRecord, ConnectorConfig
from m1.connectors.errors import ConnectorAuthError, ConnectorConnectionError

logger = logging.getLogger(__name__)


class MySQLConnector(BaseConnector):
    """
    Conector para bases de datos MySQL / MariaDB.
    
    Requiere: pip install aiomysql
    """

    def __init__(self, config: ConnectorConfig):
        super().__init__(config)
        self._pool = None

    async def connect(self) -> None:
        creds = self.config.credentials
        try:
            self._pool = await aiomysql.create_pool(
                host=creds["host"],
                port=int(creds.get("port", 3306)),
                db=creds["database"],
                user=creds["username"],
                password=creds["password"],
                minsize=1,
                maxsize=5,
                connect_timeout=30,
            )
            # Verificar
            async with self._pool.acquire() as conn:
                async with conn.cursor() as cur:
                    await cur.execute("SELECT 1")
            self._connected = True
            logger.info(f"MySQL conectado: host={creds['host']} connector_id={self.config.connector_id}")
        except aiomysql.OperationalError as e:
            if "Access denied" in str(e):
                raise ConnectorAuthError(str(e), connector_id=self.config.connector_id)
            raise ConnectorConnectionError(str(e), connector_id=self.config.connector_id)

    async def disconnect(self) -> None:
        if self._pool:
            self._pool.close()
            await self._pool.wait_closed()
            self._connected = False

    async def extract_full(self) -> AsyncIterator[RawRecord]:
        for table in self.config.target_entities:
            logger.info(f"MySQL FULL extract: table={table}, connector={self.config.connector_id}")
            async with self._pool.acquire() as conn:
                async with conn.cursor(aiomysql.DictCursor) as cur:
                    await cur.execute(f"SELECT * FROM `{table}` ORDER BY 1")
                    while True:
                        rows = await cur.fetchmany(size=self.config.batch_size)
                        if not rows:
                            break
                        for row in rows:
                            yield self._make_raw_record(
                                source_table=table,
                                data={k: str(v) if v is not None else None for k, v in row.items()},
                            )

    async def extract_incremental(self) -> AsyncIterator[RawRecord]:
        cursor_field = self.config.incremental_cursor_field
        last_cursor = self.config.last_cursor_value or "1970-01-01 00:00:00"
        for table in self.config.target_entities:
            max_cursor = last_cursor
            async with self._pool.acquire() as conn:
                async with conn.cursor(aiomysql.DictCursor) as cur:
                    await cur.execute(
                        f"SELECT * FROM `{table}` WHERE `{cursor_field}` > %s ORDER BY `{cursor_field}` ASC",
                        (last_cursor,)
                    )
                    while True:
                        rows = await cur.fetchmany(size=self.config.batch_size)
                        if not rows:
                            break
                        for row in rows:
                            row_dict = {k: str(v) if v is not None else None for k, v in row.items()}
                            cv = row_dict.get(cursor_field, "")
                            if cv and cv > max_cursor:
                                max_cursor = cv
                            yield self._make_raw_record(table, row_dict, cursor_value=cv)
            self.config.last_cursor_value = max_cursor
```

---

## 7. P2-M1-04 — Salesforce Connector

**Owner:** DI-Senior  
**Duración:** Día 4–5 de Semana 3  
**Archivo:** `m1/connectors/salesforce_connector.py`

```python
# m1/connectors/salesforce_connector.py
"""
Conector Salesforce vía REST API + Bulk API 2.0.

Autenticación: Username-Password OAuth flow
Credenciales en Secrets Manager: username, password, security_token, domain

Entidades típicas: Account, Contact, Opportunity, Lead, Case, Task
"""
import logging
import asyncio
from typing import AsyncIterator
import httpx
from m1.connectors.base import BaseConnector, RawRecord, ConnectorConfig
from m1.connectors.errors import ConnectorAuthError, ConnectorConnectionError, ConnectorRateLimitError

logger = logging.getLogger(__name__)

SF_OAUTH_URL = "https://{domain}.salesforce.com/services/oauth2/token"
SF_QUERY_URL = "{instance_url}/services/data/v59.0/query/"
SF_BULK_JOBS_URL = "{instance_url}/services/data/v59.0/jobs/query"


class SalesforceConnector(BaseConnector):
    """
    Conector Salesforce con:
    - Autenticación OAuth username-password
    - SOQL para sync incremental
    - Bulk API 2.0 para sync full de tablas grandes
    """

    def __init__(self, config: ConnectorConfig):
        super().__init__(config)
        self._access_token: str = None
        self._instance_url: str = None
        self._client: httpx.AsyncClient = None

    async def connect(self) -> None:
        creds = self.config.credentials
        domain = creds.get("domain", "login")

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    SF_OAUTH_URL.format(domain=domain),
                    data={
                        "grant_type": "password",
                        "client_id": creds.get("client_id", ""),
                        "client_secret": creds.get("client_secret", ""),
                        "username": creds["username"],
                        "password": creds["password"] + creds.get("security_token", ""),
                    },
                )
                if resp.status_code == 400:
                    raise ConnectorAuthError(
                        f"Salesforce auth fallida: {resp.json().get('error_description')}",
                        connector_id=self.config.connector_id,
                    )
                resp.raise_for_status()
                data = resp.json()
                self._access_token = data["access_token"]
                self._instance_url = data["instance_url"]

        except httpx.ConnectError as e:
            raise ConnectorConnectionError(str(e), connector_id=self.config.connector_id)

        self._client = httpx.AsyncClient(
            headers={"Authorization": f"Bearer {self._access_token}"},
            timeout=60,
        )
        self._connected = True
        logger.info(
            f"Salesforce conectado: instance={self._instance_url} "
            f"connector_id={self.config.connector_id}"
        )

    async def disconnect(self) -> None:
        if self._client:
            await self._client.aclose()
        self._connected = False

    async def extract_full(self) -> AsyncIterator[RawRecord]:
        """Full extract usando Bulk API 2.0 para evitar límites de REST."""
        for entity in self.config.target_entities:
            fields = await self._get_entity_fields(entity)
            soql = f"SELECT {','.join(fields)} FROM {entity}"
            async for record in self._bulk_query(entity, soql):
                yield record

    async def extract_incremental(self) -> AsyncIterator[RawRecord]:
        """Incremental usando SystemModstamp como cursor."""
        last_cursor = self.config.last_cursor_value or "1970-01-01T00:00:00.000+0000"
        max_cursor = last_cursor

        for entity in self.config.target_entities:
            fields = await self._get_entity_fields(entity)
            soql = (
                f"SELECT {','.join(fields)} FROM {entity} "
                f"WHERE SystemModstamp > {last_cursor} "
                f"ORDER BY SystemModstamp ASC"
            )
            async for record in self._rest_query(entity, soql):
                cv = record.data.get("SystemModstamp", "")
                if cv and cv > max_cursor:
                    max_cursor = cv
                yield record

        self.config.last_cursor_value = max_cursor
        logger.info(f"Salesforce cursor actualizado: {max_cursor}")

    async def _get_entity_fields(self, entity: str) -> list[str]:
        """Obtiene lista de campos del objeto Salesforce."""
        url = f"{self._instance_url}/services/data/v59.0/sobjects/{entity}/describe"
        resp = await self._client.get(url)
        if resp.status_code == 429:
            raise ConnectorRateLimitError("Salesforce API rate limit", connector_id=self.config.connector_id)
        resp.raise_for_status()
        fields = resp.json().get("fields", [])
        return [f["name"] for f in fields if not f.get("deprecatedAndHidden", False)]

    async def _rest_query(self, entity: str, soql: str) -> AsyncIterator[RawRecord]:
        """SOQL query vía REST API con paginación automática."""
        url = SF_QUERY_URL.format(instance_url=self._instance_url)
        params = {"q": soql}
        while url:
            resp = await self._client.get(url, params=params)
            if resp.status_code == 429:
                await asyncio.sleep(60)  # Esperar rate limit
                continue
            resp.raise_for_status()
            data = resp.json()
            for record in data.get("records", []):
                record.pop("attributes", None)
                yield self._make_raw_record(entity, record)
            url = data.get("nextRecordsUrl")
            if url:
                url = f"{self._instance_url}{url}"
                params = None

    async def _bulk_query(self, entity: str, soql: str) -> AsyncIterator[RawRecord]:
        """
        Bulk API 2.0 query — para tablas grandes (>50,000 registros).
        Crea el job, espera a que complete, recupera resultados.
        """
        # Crear job
        resp = await self._client.post(
            SF_BULK_JOBS_URL.format(instance_url=self._instance_url),
            json={"operation": "query", "query": soql, "contentType": "CSV"},
        )
        resp.raise_for_status()
        job_id = resp.json()["id"]
        logger.info(f"Bulk API job creado: {job_id} para {entity}")

        # Esperar completitud
        job_url = f"{self._instance_url}/services/data/v59.0/jobs/query/{job_id}"
        for attempt in range(60):  # timeout: 5 minutos
            await asyncio.sleep(5)
            status_resp = await self._client.get(job_url)
            state = status_resp.json().get("state")
            if state == "JobComplete":
                break
            if state in ("Failed", "Aborted"):
                raise ConnectorConnectionError(
                    f"Bulk job {job_id} fallido. State={state}",
                    connector_id=self.config.connector_id
                )
        else:
            raise ConnectorConnectionError(f"Bulk job {job_id} timeout")

        # Obtener resultados CSV paginados
        result_url = f"{job_url}/results"
        locator = None
        import csv, io

        while True:
            params = {"maxRecords": 50000}
            if locator:
                params["locator"] = locator
            results_resp = await self._client.get(result_url, params=params)
            results_resp.raise_for_status()
            csv_data = results_resp.text
            reader = csv.DictReader(io.StringIO(csv_data))
            for row in reader:
                yield self._make_raw_record(entity, dict(row))
            locator = results_resp.headers.get("Sforce-Locator")
            if not locator or locator == "null":
                break
```

---

## 8. P2-M1-05 — Odoo Connector

**Owner:** DI-Mid  
**Duración:** Día 5 de Semana 3 y Día 1 de Semana 4  
**Archivo:** `m1/connectors/odoo_connector.py`

```python
# m1/connectors/odoo_connector.py
"""
Conector Odoo vía XML-RPC (protocolo nativo de Odoo).

Credenciales: url, database, username, api_key

Modelos típicos:
  res.partner → party
  sale.order → transaction
  product.template → product
  hr.employee → employee
  helpdesk.ticket → incident
"""
import logging
import asyncio
from typing import AsyncIterator
import xmlrpc.client
from m1.connectors.base import BaseConnector, RawRecord
from m1.connectors.errors import ConnectorAuthError, ConnectorConnectionError

logger = logging.getLogger(__name__)


class OdooConnector(BaseConnector):
    """
    Conector Odoo XML-RPC.
    
    NOTA: xmlrpc.client es síncrono.
    Se ejecuta en executor para no bloquear el event loop.
    """

    def __init__(self, config):
        super().__init__(config)
        self._uid: int = None
        self._models_proxy = None
        self._url: str = None

    async def connect(self) -> None:
        creds = self.config.credentials
        self._url = creds["url"].rstrip("/")
        db = creds["database"]
        user = creds["username"]
        api_key = creds["api_key"]

        try:
            loop = asyncio.get_event_loop()

            # Auth vía XML-RPC (síncrono, en executor)
            common_proxy = xmlrpc.client.ServerProxy(f"{self._url}/xmlrpc/2/common")
            self._uid = await loop.run_in_executor(
                None, common_proxy.authenticate, db, user, api_key, {}
            )

            if not self._uid:
                raise ConnectorAuthError(
                    f"Odoo auth fallida para url={self._url} user={user}",
                    connector_id=self.config.connector_id,
                )

            self._models_proxy = xmlrpc.client.ServerProxy(f"{self._url}/xmlrpc/2/object")
            self._db = db
            self._api_key = api_key
            self._connected = True
            logger.info(f"Odoo conectado: url={self._url} uid={self._uid}")

        except xmlrpc.client.Fault as e:
            raise ConnectorConnectionError(str(e), connector_id=self.config.connector_id)

    async def disconnect(self) -> None:
        self._uid = None
        self._models_proxy = None
        self._connected = False

    async def extract_full(self) -> AsyncIterator[RawRecord]:
        for model in self.config.target_entities:
            fields = await self._get_model_fields(model)
            offset = 0
            limit = self.config.batch_size

            while True:
                records = await self._call_odoo(
                    model, "search_read",
                    [[]], {"fields": fields, "limit": limit, "offset": offset}
                )
                if not records:
                    break
                for rec in records:
                    yield self._make_raw_record(
                        source_table=model,
                        data={str(k): str(v) if v is not None else None for k, v in rec.items()},
                    )
                offset += len(records)
                if len(records) < limit:
                    break

    async def extract_incremental(self) -> AsyncIterator[RawRecord]:
        cursor_field = "write_date"  # Campo estándar de Odoo
        last_cursor = self.config.last_cursor_value or "2000-01-01 00:00:00"
        max_cursor = last_cursor

        for model in self.config.target_entities:
            fields = await self._get_model_fields(model)
            domain = [[cursor_field, ">", last_cursor]]
            offset = 0

            while True:
                records = await self._call_odoo(
                    model, "search_read",
                    [domain], {
                        "fields": fields,
                        "limit": self.config.batch_size,
                        "offset": offset,
                        "order": f"{cursor_field} asc",
                    }
                )
                if not records:
                    break
                for rec in records:
                    rec_dict = {str(k): str(v) if v is not None else None for k, v in rec.items()}
                    cv = rec_dict.get(cursor_field, "")
                    if cv and cv > max_cursor:
                        max_cursor = cv
                    yield self._make_raw_record(model, rec_dict, cursor_value=cv)
                offset += len(records)
                if len(records) < self.config.batch_size:
                    break

        self.config.last_cursor_value = max_cursor

    async def _get_model_fields(self, model: str) -> list[str]:
        """Retorna lista de campos del modelo (solo escalares, sin relaciones)."""
        fields_info = await self._call_odoo(model, "fields_get", [], {})
        return [
            fname for fname, fmeta in fields_info.items()
            if fmeta.get("type") not in ("one2many", "many2many")
        ]

    async def _call_odoo(self, model: str, method: str, args: list, kwargs: dict):
        """Wrapper para llamadas XML-RPC en executor."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            self._models_proxy.execute_kw,
            self._db, self._uid, self._api_key,
            model, method, args, kwargs
        )
```

---

## 9. P2-M1-06 — ServiceNow Connector

**Owner:** DI-Senior  
**Duración:** Día 2–3 de Semana 4  
**Archivo:** `m1/connectors/servicenow_connector.py`

```python
# m1/connectors/servicenow_connector.py
"""
Conector ServiceNow vía REST API Table API.

Credenciales: instance (sin .service-now.com), username, password

Tables típicas:
  incident → incident
  sys_user → employee
  cmdb_ci → product/asset
  change_request → transaction
"""
import logging
import asyncio
from typing import AsyncIterator
import httpx
from m1.connectors.base import BaseConnector, RawRecord
from m1.connectors.errors import ConnectorAuthError, ConnectorConnectionError, ConnectorRateLimitError

logger = logging.getLogger(__name__)


class ServiceNowConnector(BaseConnector):

    def __init__(self, config):
        super().__init__(config)
        self._client: httpx.AsyncClient = None
        self._base_url: str = None

    async def connect(self) -> None:
        creds = self.config.credentials
        instance = creds["instance"]
        self._base_url = f"https://{instance}.service-now.com/api/now/table"

        auth = httpx.BasicAuth(creds["username"], creds["password"])
        self._client = httpx.AsyncClient(
            auth=auth,
            headers={"Accept": "application/json", "Content-Type": "application/json"},
            timeout=60,
        )

        # Verificar conexión
        try:
            resp = await self._client.get(
                f"{self._base_url}/incident",
                params={"sysparm_limit": 1, "sysparm_fields": "sys_id"},
            )
            if resp.status_code == 401:
                raise ConnectorAuthError(
                    f"ServiceNow auth fallida para instance={instance}",
                    connector_id=self.config.connector_id,
                )
            resp.raise_for_status()
        except httpx.ConnectError as e:
            raise ConnectorConnectionError(str(e), connector_id=self.config.connector_id)

        self._connected = True
        logger.info(f"ServiceNow conectado: instance={instance}")

    async def disconnect(self) -> None:
        if self._client:
            await self._client.aclose()
        self._connected = False

    async def extract_full(self) -> AsyncIterator[RawRecord]:
        for table in self.config.target_entities:
            async for record in self._paginate(table, extra_params={}):
                yield record

    async def extract_incremental(self) -> AsyncIterator[RawRecord]:
        last_cursor = self.config.last_cursor_value or "javascript:gs.beginningOfYear()"
        max_cursor = ""

        for table in self.config.target_entities:
            params = {"sysparm_query": f"sys_updated_on>{last_cursor}^ORDERBYsys_updated_on"}
            async for record in self._paginate(table, extra_params=params):
                cv = record.data.get("sys_updated_on", "")
                if cv and cv > max_cursor:
                    max_cursor = cv
                yield record

        if max_cursor:
            self.config.last_cursor_value = max_cursor

    async def _paginate(self, table: str, extra_params: dict) -> AsyncIterator[RawRecord]:
        """Pagina usando sysparm_offset."""
        limit = self.config.batch_size
        offset = 0
        url = f"{self._base_url}/{table}"

        while True:
            params = {
                "sysparm_limit": limit,
                "sysparm_offset": offset,
                "sysparm_display_value": "false",
                **extra_params,
            }
            for attempt in range(3):
                resp = await self._client.get(url, params=params)
                if resp.status_code == 429:
                    await asyncio.sleep(30 * (attempt + 1))
                    continue
                if resp.status_code == 401:
                    raise ConnectorAuthError("ServiceNow 401", connector_id=self.config.connector_id)
                resp.raise_for_status()
                break
            else:
                raise ConnectorRateLimitError("ServiceNow rate limit después de 3 reintentos")

            records = resp.json().get("result", [])
            if not records:
                break
            for rec in records:
                yield self._make_raw_record(table, dict(rec))
            offset += len(records)
            if len(records) < limit:
                break
```

---

## 10. P2-M1-07 — SQL Server Connector

**Owner:** DI-Mid  
**Duración:** Día 3–4 de Semana 4  
**Archivo:** `m1/connectors/sqlserver_connector.py`

```python
# m1/connectors/sqlserver_connector.py
"""
Conector SQL Server vía pyodbc/aioodbc.

Requiere: pip install aioodbc pyodbc
Driver ODBC instalado en el pod: apt-get install -y unixodbc-dev mssql-tools

Credenciales: host, port, database, username, password
"""
import logging
import asyncio
from typing import AsyncIterator
import aioodbc
from m1.connectors.base import BaseConnector, RawRecord
from m1.connectors.errors import ConnectorAuthError, ConnectorConnectionError

logger = logging.getLogger(__name__)


class SQLServerConnector(BaseConnector):

    def __init__(self, config):
        super().__init__(config)
        self._pool = None

    async def connect(self) -> None:
        creds = self.config.credentials
        host = creds["host"]
        port = creds.get("port", "1433")
        db = creds["database"]
        dsn = (
            f"DRIVER={{ODBC Driver 18 for SQL Server}};"
            f"SERVER={host},{port};"
            f"DATABASE={db};"
            f"UID={creds['username']};"
            f"PWD={creds['password']};"
            f"TrustServerCertificate=Yes;"
        )
        try:
            self._pool = await aioodbc.create_pool(dsn=dsn, minsize=1, maxsize=5)
            async with self._pool.acquire() as conn:
                async with conn.cursor() as cur:
                    await cur.execute("SELECT 1")
            self._connected = True
            logger.info(f"SQL Server conectado: {host}:{port}/{db}")
        except Exception as e:
            if "Login failed" in str(e) or "password" in str(e).lower():
                raise ConnectorAuthError(str(e), connector_id=self.config.connector_id)
            raise ConnectorConnectionError(str(e), connector_id=self.config.connector_id)

    async def disconnect(self) -> None:
        if self._pool:
            self._pool.close()
            await self._pool.wait_closed()
        self._connected = False

    async def extract_full(self) -> AsyncIterator[RawRecord]:
        for table in self.config.target_entities:
            schema, tbl = (table.split(".", 1) if "." in table else ("dbo", table))
            async with self._pool.acquire() as conn:
                async with conn.cursor() as cur:
                    await cur.execute(f"SELECT * FROM [{schema}].[{tbl}] ORDER BY 1")
                    columns = [d[0] for d in cur.description]
                    while True:
                        rows = await cur.fetchmany(self.config.batch_size)
                        if not rows:
                            break
                        for row in rows:
                            rec = dict(zip(columns, (str(v) if v is not None else None for v in row)))
                            yield self._make_raw_record(tbl, rec, source_schema=schema)

    async def extract_incremental(self) -> AsyncIterator[RawRecord]:
        cursor_field = self.config.incremental_cursor_field
        last_cursor = self.config.last_cursor_value or "1970-01-01T00:00:00"
        max_cursor = last_cursor

        for table in self.config.target_entities:
            schema, tbl = (table.split(".", 1) if "." in table else ("dbo", table))
            async with self._pool.acquire() as conn:
                async with conn.cursor() as cur:
                    await cur.execute(
                        f"SELECT * FROM [{schema}].[{tbl}] "
                        f"WHERE [{cursor_field}] > ? ORDER BY [{cursor_field}] ASC",
                        last_cursor
                    )
                    columns = [d[0] for d in cur.description]
                    while True:
                        rows = await cur.fetchmany(self.config.batch_size)
                        if not rows:
                            break
                        for row in rows:
                            rec = dict(zip(columns, (str(v) if v is not None else None for v in row)))
                            cv = rec.get(cursor_field, "")
                            if cv and cv > max_cursor:
                                max_cursor = cv
                            yield self._make_raw_record(tbl, rec, source_schema=schema, cursor_value=cv)

        self.config.last_cursor_value = max_cursor
```

---

## 11. Registro de Conectores en BD

Cuando el product team (UI) registra un nuevo conector, el backend llama:

```python
# m1/connector_registry.py
import uuid
import asyncpg
from nexus_core.db import get_tenant_scoped_connection
from nexus_core.tenant import set_tenant, TenantContext


async def register_connector(
    pool: asyncpg.Pool,
    tenant_id: str,
    system_type: str,
    name: str,
    config: dict,
) -> str:
    """
    Registra un nuevo conector en nexus_system.connectors.
    Retorna connector_id generado.
    """
    connector_id = str(uuid.uuid4())
    set_tenant(TenantContext(tenant_id=tenant_id, plan="professional", cdm_version="1.0.0"))

    async with await get_tenant_scoped_connection(pool, tenant_id) as conn:
        await conn.execute("""
            INSERT INTO nexus_system.connectors
                (connector_id, tenant_id, system_type, connector_name, status, config)
            VALUES ($1, $2, $3, $4, 'inactive', $5)
        """, connector_id, tenant_id, system_type, name, config)

    return connector_id


async def update_connector_status(
    pool: asyncpg.Pool,
    tenant_id: str,
    connector_id: str,
    status: str,
) -> None:
    """Actualiza el status del conector (inactive/active/error)."""
    async with await get_tenant_scoped_connection(pool, tenant_id) as conn:
        await conn.execute("""
            UPDATE nexus_system.connectors
            SET status = $1, last_sync_at = NOW()
            WHERE connector_id = $2 AND tenant_id = $3
        """, status, connector_id, tenant_id)
```

---

## 12. Acceptance Criteria de Conectores

### P2-M1-02: PostgreSQL Connector

```bash
# Setup: DB PostgreSQL dummy con tabla de prueba
psql -h localhost -U testuser testdb -c "
  CREATE TABLE public.test_orders (
    id SERIAL, customer_name TEXT, amount DECIMAL, 
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  INSERT INTO test_orders (customer_name, amount) 
  SELECT 'Customer ' || i, (random()*1000)::decimal 
  FROM generate_series(1,1500) i; "

# Test 1: FULL extract genera 1500 RawRecords
python -c "
import asyncio
from m1.connectors.postgresql_connector import PostgreSQLConnector
from m1.connectors.base import ConnectorConfig, SyncMode, SystemType

async def test():
    config = ConnectorConfig(
        connector_id='test-001',
        tenant_id='test-alpha',
        system_type=SystemType.POSTGRESQL,
        sync_mode=SyncMode.FULL,
        credentials={'host':'localhost','port':'5432','database':'testdb',
                     'username':'testuser','password':'testpass'},
        target_entities=['public.test_orders'],
        batch_size=200,
    )
    c = PostgreSQLConnector(config)
    await c.connect()
    count = 0
    async for record in c.extract_full():
        count += 1
        assert record.tenant_id == 'test-alpha'
        assert record.system_type == 'postgresql'
        assert 'customer_name' in record.data
    await c.disconnect()
    assert count == 1500, f'Expected 1500, got {count}'
    print('✅ PASS: FULL extract OK')

asyncio.run(test())
"

# Test 2: INCREMENTAL solo extrae nuevos
# insertar 5 registros nuevos → verifica count=5 en incremental

# Test 3: Credenciales incorrectas → ConnectorAuthError
# Test 4: Host inaccesible → ConnectorConnectionError (no crash)
# Test 5: RawRecord.data no contiene passwords (campo no existe en test_orders — verificar en conectores donde sí puede haber)
```

### P2-M1-04: Salesforce Connector

```
☐ connect() con user/password/security_token válidos → access_token obtenido
☐ extract_incremental() para Account extrae solo records con SystemModstamp > cursor
☐ Rate limit (429) → esperar 60s y reintentar automáticamente
☐ Bulk API Job Status = Failed → ConnectorConnectionError con mensaje claro
☐ extract_full() para Opportunity > 50,000 registros → usa Bulk API
```

### P2-M1-05: Odoo Connector

```
☐ XML-RPC authenticate → uid > 0
☐ extract_full() para res.partner extrae todos los partners
☐ Campo relacional (many2many) excluido de fields (no crashea serialización)
☐ api_key inválida → ConnectorAuthError (no uid=0)
```

### P2-M1-06: ServiceNow Connector

```
☐ Basic auth con usuario correcto → respuesta 200
☐ extract_full() para incident pagina correctamente (offset incrementa)
☐ 429 → esperar 30s y reintentar hasta 3 veces
☐ extract_incremental() filtra por sys_updated_on > cursor
```

### Verificación de seguridad — TODOS los conectores

```bash
# Verificar que password NO aparece en ningún log
kubectl logs -n nexus-app -l app=m1-connector-worker | grep -i "password\|api_key\|secret_token"
# Expected: cero líneas con valores reales
```

---

*NEXUS Build Plan — Archivo 02 · M1 Conectores · Mentis Consulting · Marzo 2026*
