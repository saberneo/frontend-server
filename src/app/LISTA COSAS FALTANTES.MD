# ESTADO REAL DEL PROYECTO NEXUS PLATFORM
*Ultima actualizacion: 2026-03-08 — verificada contra codebase, Docker y BD real*

---

## COMANDOS DE EJECUCION MANUAL

### Requisito previo — Docker Desktop corriendo

### 1. Base de datos PostgreSQL (nexus-postgres)
```powershell
# Arrancar (ya configurado en puerto 15432)
docker start nexus-postgres

# Primera vez / reset completo
cd "C:\Users\ROG STRIX\Desktop\NEXUS PROJET MINDY\nexus-python-platform"
docker compose up postgres -d
```

### 2. BFF FastAPI (puerto 3000)
```powershell
cd "C:\Users\ROG STRIX\Desktop\NEXUS PROJET MINDY\nexus-python-platform"
.\.venv\Scripts\python.exe -m uvicorn bff.main:socket_app --host 0.0.0.0 --port 3000 --log-level info
```

### 3. Frontend Angular (puerto 4200)
```powershell
cd "C:\Users\ROG STRIX\Desktop\NEXUS PROJET MINDY\nexus-platform-dashboard"
npx ng serve --port 4200
```

### 4. Servicios adicionales (Neo4j, Kafka, MinIO, OPA)
```powershell
cd "C:\Users\ROG STRIX\Desktop\NEXUS PROJET MINDY\nexus-python-platform"
docker compose up neo4j minio opa -d
```

### 5. Stack completo con Docker (producción / demo)
```powershell
cd "C:\Users\ROG STRIX\Desktop\NEXUS PROJET MINDY"
docker compose up --build    # Primera vez
docker compose up            # Siguientes veces
# Dashboard disponible en http://localhost:8080
```

### Acceso
- **Dashboard (dev):** http://localhost:4200
- **Dashboard (Docker):** http://localhost:8080
- **BFF Swagger:** http://localhost:3000/api/v1/docs
- **BFF Health:** http://localhost:3000/api/v1/health
- **Neo4j Browser:** http://localhost:7474 (neo4j / nexusneo4j)
- **MinIO Console:** http://localhost:9101 (nexus / nexuspass123)
- **Kafdrop (Kafka UI):** http://localhost:9000

---

## INFRAESTRUCTURA - CONTAINERS ACTIVOS HOY

| Servicio | Container | Puerto | Estado |
|---|---|---|---|
| PostgreSQL (NEXUS) | nexus-postgres | 15432 | ✅ ACTIVO — 1220 customers, 3005 orders |
| Neo4j | nexus-neo4j | 7474/7687 | ✅ ACTIVO (healthy) — 7 dominios CDM, 62 relaciones |
| MinIO (BFF) | nexus-minio | 9100/9101 | ✅ ACTIVO (healthy) |
| OPA | nexus-opa | 8181 | ✅ ACTIVO (healthy) — imagen debug con wget |
| Kafka | mindy-kafka | 9092 | ✅ ACTIVO (healthy) |
| Airflow | mindy-airflow | 8081 | ✅ ACTIVO (starting) |
| Spark Master | mindy-spark-master | 7077/8085 | ✅ ACTIVO (healthy) |
| Spark Worker | mindy-spark-worker | — | ✅ ACTIVO |
| MinIO (Mindy) | mindy-minio | 9000/9001 | ✅ ACTIVO (healthy) |
| nexus-dashboard (Docker build) | nexus-dashboard | 8080 | ✅ ACTIVO |
| BFF FastAPI | proceso local | 3000 | ✅ ACTIVO — db:connected, okta:configured |
| Angular dev server | proceso local | 4200 | ✅ ACTIVO |

---

## BASE DE DATOS REAL (nexus-postgres:15432/nexus_db)

| Tabla | Filas | Estado |
|---|---|---|
| nexus_biz.customers | 1.220 | ✅ DATOS REALES |
| nexus_biz.orders | 3.005 | ✅ DATOS REALES |
| nexus_biz.products | 44 | ✅ DATOS REALES |
| nexus_biz.users | 6 | ✅ DATOS REALES |
| nexus_biz.audit_logs | 1.020 | ✅ DATOS REALES |
| nexus_biz.identity_mapping | 0 | ⚠️ VACÍA — se puebla con JIT en primer login Okta |
| nexus_system.connectors | 6 | ✅ DATOS REALES |
| nexus_system.tenants | 5 | ✅ DATOS REALES |
| nexus_system.cdm_mappings | 21 | ✅ DATOS REALES |
| nexus_system.cdm_versions | 6 | ✅ DATOS REALES |
| nexus_system.sync_jobs | 5 | ✅ DATOS REALES |

**ANTES (bug corregido):** El BFF tenía DSN incorrecto (`postgres@localhost:15432` sin password, usuario equivocado). Ahora usa `nexus_user:nexuspass@localhost:15432`. nexus-postgres estaba parado → toda la data era mock. **AHORA CORREGIDO.**

---

## VARIABLES DE ENTORNO (.env)

| Variable | Estado |
|---|---|
| NEXUS_DB_DSN | ✅ CORREGIDO — postgresql://nexus_user:nexuspass@localhost:15432/nexus_db |
| OPENAI_API_KEY | ✅ sk-proj-8YYB... CONFIGURADA |
| OIDC_ISSUER_URL | ✅ https://trial-2885233.okta.com/oauth2/default |
| OIDC_CLIENT_ID | ✅ 0oa10svuld6t1gUUM698 |
| PINECONE_API_KEY | ✅ pcsk_5rftxw... CONFIGURADA |
| NEO4J_URI / PASSWORD | ✅ Configuradas |
| OPA_SIDECAR_URL | ✅ http://localhost:8181/... |
| NEXUS_TOTP_ENABLED | true (código TOTP eliminado del BFF — se puede desactivar) |

---

## FRONTEND (Angular) — puerto 4200 / 8080

| Feature | Estado | Notas |
|---|---|---|
| 17 pantallas/componentes | ✅ HECHO | Supera specs M6 |
| Login Okta PKCE | ✅ HECHO | Único método de login — email/password eliminado |
| Logout funcional | ✅ HECHO (corregido hoy) | Navegaba a la misma página — ahora redirige a /login |
| Auth callback /auth/callback | ✅ HECHO (corregido hoy) | Antes mostraba login en vez del componente callback |
| Hidratación sesión post-Okta | ✅ HECHO | ?s= param base64 → hydrateFromSessionParam() |
| CDM Governance - live stats | ✅ HECHO | Carga getCdmGraphStats() real de Neo4j |
| Schema Registry - CDM Domains | ✅ HECHO | Lazy loading, expandable, PII highlight |
| Ask Nexus / AI Chat | ⚠️ PARCIAL | Llama a OpenAI GPT-5.4 directamente, NO al grafo LangGraph M2 |
| Datos reales en dashboard | ✅ HECHO (corregido hoy) | Antes: mock data por bug de DSN. Ahora: BD real |
| Selección de idioma (i18n) | ✅ HECHO (corregido hoy) | Archivos en src/assets/i18n/, angular.json corregido, switchLang activo |
| Reasoning trace del agente | ❌ FALTA | Backend no devuelve trace al frontend |
| Pipeline Health métricas Kafka reales | ❌ FALTA | Workers M1 no publican activamente |

---

## BFF (FastAPI — Puerto 3000)

| Feature | Estado | Notas |
|---|---|---|
| 16 routers activos | ✅ HECHO | Health: db:connected, okta:configured |
| Conexión BD real | ✅ HECHO (corregido hoy) | DSN corregido, pool activo |
| RLS por tenant (get_conn) | ✅ HECHO ACTIVO | Todos los routers con RLS |
| Rate limiting por tenant | ✅ HECHO ACTIVO | SlowAPI: 30/min unauth, 120/min/tenant |
| Okta PKCE completo | ✅ HECHO | /authorize, /callback, /config — flow end-to-end |
| Login email/password | ✅ ELIMINADO | Por decisión CTO — solo Okta |
| TOTP endpoints | ✅ ELIMINADO | /totp/* eliminado del BFF |
| /forgot-password, /change-password | ✅ ELIMINADO | Eliminado hoy |
| Cookie httpOnly para sesión | ✅ HECHO | nexus_token, samesite=lax, 8h TTL |
| JIT Provisioning Okta | ✅ HECHO | Crea usuario en BD en primer login Okta |
| /api/v1/ai/chat | ⚠️ PARCIAL | Llama OpenAI GPT, no grafo LangGraph M2 |
| Kong API Gateway | ❌ FALTA | BFF expuesto directo en puerto 3000 |
| WebSocket M2 a frontend | ❌ FALTA | Socket.IO en BFF sin streaming real de M2 |

---

## nexus_core (Librería interna)

| Módulo | Estado |
|---|---|
| provisioning.py - onboard_tenant() | ✅ HECHO |
| identity.py - NexusUserIdentity | ✅ HECHO |
| tenant_validator.py - is_active_tenant() | ✅ HECHO |
| logging.py - structlog setup | ✅ HECHO |

---

## M1 - Conectores e Ingesta

| Feature | Estado | Notas |
|---|---|---|
| Conectores Python propios | ✅ HECHO | MySQL, PostgreSQL, Salesforce, ServiceNow, Odoo, SQL Server |
| credential_loader.py | ✅ HECHO (78% cobertura) | Sin AWS Secrets Manager real |
| Kafka producer/consumer | ⚠️ código existe | mindy-kafka corriendo, workers no publican activamente |
| Airflow DAGs M1 | ⚠️ código existe | mindy-airflow running, DAGs no auto-trigger |
| Spark jobs | ⚠️ código existe | Spark running, jobs no en producción |
| Debezium CDC | ❌ FALTA | Extracción por polling |
| Odoo connector | ⚠️ 39% cobertura | Implementación incompleta |
| SQL Server connector | ⚠️ 40% cobertura | Implementación incompleta |

---

## M2 - Agente RHMA (LangGraph)

| Feature | Estado | Notas |
|---|---|---|
| critics, graph, guard, planner, runner | ✅ código completo | |
| state, types, workers, structural_agent | ✅ código completo | |
| schema_drift_detector, schema_profiler | ✅ código completo | |
| LLM calls reales (OpenAI) | ⚠️ POSIBLE | OpenAI key presente — M2 puede activarse |
| OPA policy enforcement | ✅ HECHO | nexus-opa running |
| LangGraph E2E corriendo | ❌ FALTA | Sin pipeline Kafka M1 activo en producción |
| WebSocket streaming a Angular | ❌ FALTA | Código existe, no activo end-to-end |

---

## M3 - Knowledge Store

| Feature | Estado | Notas |
|---|---|---|
| graph_writer.py (Neo4j) | ✅ HECHO | Neo4j running, seeded con datos CDM |
| timeseries_writer.py | ✅ HECHO | PostgreSQL plain (nexus_m3.timeseries) |
| vector_writer.py (Pinecone) | ✅ HECHO | nexus-embeddings creado (dim=1536) |
| TimescaleDB hypertable | ❌ FALTA | create_hypertable() comentado |
| Pipeline M1→M3 activo | ❌ FALTA | Kafka producers no publican continuamente |

---

## M4 - CDM Governance

| Feature | Estado | Notas |
|---|---|---|
| main.py, models.py, proposals.py | ✅ HECHO | Código completo |
| sync_jobs.py, onboarding.py | ✅ HECHO | Código completo |
| CDM API endpoints via BFF | ✅ HECHO | /cdm/domains, /cdm/schemas, /cdm/mappings |
| governance_queue BD | ✅ HECHO | Tabla existe en nexus_system |
| Temporal server | ❌ FALTA | Workflow 80% — sin servidor Temporal |
| Kafka consumers M4 | ❌ FALTA | Código existe, consumers no corriendo |

---

## OPA (Open Policy Agent)

| Feature | Estado |
|---|---|
| Container nexus-opa | ✅ ACTIVO puerto 8181 — imagen latest-debug, healthcheck HEALTHY |
| Policy authz.rego | ✅ Rego v1 validada |
| OPA_DEV_BYPASS | true — auto-autoriza si OPA no responde |

---

## BUGS CORREGIDOS HOY (2026-03-08)

| Bug | Causa | Fix |
|---|---|---|
| Datos mock en dashboard | nexus-postgres parado + DSN incorrecto (usuario/password) | docker start nexus-postgres + corregido NEXUS_DB_DSN |
| /auth/callback mostraba pantalla de login | app.html usaba `<app-login>` hardcoded en @else, nunca renderizaba router-outlet | Cambiado a `<router-outlet>` en la rama @else |
| Logout no redirigía al login | dataService.logout() no llamaba a router.navigate | Añadido this.router.navigate(['/login']) |
| at_hash JWT validation | python-jose verificaba at_hash sin access_token | verify_at_hash: False en opciones de decode |
| Cookie perdida en redirect Okta | FastAPI ignora response inyectado al retornar RedirectResponse | _set_auth_cookie llamado sobre el objeto RedirectResponse |
| €NaN en columna Amount de Orders | orders-sales.component leía o.amount pero BFF devuelve o.totalAmount | Mapeo corregido: o.totalAmount ?? o.amount, o.customerName, o.createdAt |
| KPIs Orders mostraban 1248 (mock) en vez de 3005 (real) | endpoint /orders/analytics retornaba MOCK_ORDER_ANALYTICS hardcoded sin query | Reescrito para consultar COUNT/AVG/SUM reales de la BD |
| Products inventoryValue = $0 | /products/stats no incluía SUM(price*stock) | Añadido inventory_value a la query SQL del endpoint |
| Products stats campos no coincidían | BFF devolvía totalProducts/activeProducts pero template usaba total/active | Normalizado para devolver ambos alias |
| Overview KPIs siempre mostraban 0/— | /dashboard/stats no devolvía estructura orders/customers/revenue/approvals | Reescrito con queries reales y estructura anidada correcta |
| System Health: Kafka siempre "Down" | _check_kafka() chequeaba Kafdrop en puerto 9000 (no instalado) | Cambiado a check TCP en localhost:9092 (mindy-kafka real) |
| System Health: Neo4j siempre "degraded" | Código intentaba usar neo4j SDK (no instalado) | Cambiado a check HTTP en localhost:7474 |
| System Health: MinIO latency — | MINIO_ENDPOINT variable incorrecta en algunos entornos | Mantenido endpoint localhost:9100, mejorado mensaje de error |
| OPA container status "unhealthy" | healthcheck usaba curl (no disponible en imagen distroless) | Cambiado a imagen openpolicyagent/opa:latest-debug + wget |
| i18n: traducciones no cargaban | angular.json solo incluía /public pero JSON estaban en src/assets/i18n/ | Añadida entrada assets en angular.json apuntando a src/assets |

---

## PENDIENTE PRIORITARIO

### Alta prioridad
| Tarea | Impacto |
|---|---|
| Semilla identity_mapping para usuarios Okta existentes | Okta JIT provisioning funciona, pero la tabla está vacía hasta primer login |
| ~~OPA healthcheck fix~~ | ~~Container reporta unhealthy~~ ✅ CORREGIDO — imagen debug, wget healthcheck |
| ~~Selección de idioma i18n~~ | ~~Solo inglés~~ ✅ CORREGIDO — EN/ES/FR funcionales |

### Media prioridad
| Tarea | Impacto |
|---|---|
| AI Chat conectar a M2 LangGraph real | Ahora llama OpenAI directo sin el grafo de agentes |
| Reasoning trace en UI | El agente no envía su trace al frontend |
| Pipeline M1→Kafka activo | Workers no publican continuamente |

### Baja prioridad / Phase 2
| Componente | Impacto |
|---|---|
| Kong API Gateway | Enterprise JWT, sin esto rate limiting via SlowAPI |
| Temporal server | OnboardingWorkflow no corre en Temporal real |
| Prometheus + Grafana | Sin métricas de observabilidad |
| TimescaleDB | create_hypertable() comentado, plain PostgreSQL |
| AWS EKS | Solo local, no cloud |
| Debezium CDC | Polling en lugar de CDC real |
| Airbyte | Conectores Python propios en su lugar |

---

## RESUMEN EJECUTIVO

**Lo que funciona hoy para una demo (2026-03-08):**
Stack Angular 4200 + BFF 3000 + PostgreSQL 15432 + Neo4j. **Datos reales** en todas las pantallas (1220 clientes, 3005 pedidos, 44 productos, 1020 audit logs). CDM Governance con stats live de Neo4j. AI Chat con OpenAI (key configurada). OPA policy activa (imagen debug, status **healthy**). RLS por tenant activo. Kafka, Airflow y Spark corriendo. **Okta PKCE login 100% funcional** — flujo completo: botón → BFF → Okta → cookie httpOnly → hydratación sesión → dashboard. Logout funcional. **i18n EN/ES/FR funcional.** KPIs reales en Overview, Orders, Products.

**Lo que falta para el pipeline completo:**
- Pipeline M1→Kafka→M2→M3 activo en producción continua
- Temporal server para OnboardingWorkflow
- WebSocket streaming M2 → Angular

**Phase 2 / producción enterprise:**
AWS EKS, Kong API Gateway, Debezium CDC, TimescaleDB, Prometheus/Grafana.


---

## INFRAESTRUCTURA - CONTAINERS ACTIVOS HOY

| Servicio | Container | Estado |
|---|---|---|
| PostgreSQL | nexus-postgres | ACTIVO |
| Neo4j | nexus-neo4j | ACTIVO (healthy) - 7 dominios, 4 schemas, 62 relaciones CDM |
| MinIO (BFF) | nexus-minio | ACTIVO (healthy) |
| OPA | nexus-opa | ACTIVO (healthy) - imagen latest-debug, policy Rego v1 validada |
| Kafka | mindy-kafka | ACTIVO (healthy) |
| Airflow | mindy-airflow | ACTIVO (healthy) |
| Spark Master | mindy-spark-master | ACTIVO (healthy) |
| Spark Worker | mindy-spark-worker | ACTIVO |
| MinIO (Mindy) | mindy-minio | ACTIVO (healthy) |

---

## VARIABLES DE ENTORNO (.env)

| Variable | Estado |
|---|---|
| NEXUS_DB_DSN | OK - PostgreSQL localhost:15432 |
| OPENAI_API_KEY | OK - sk-proj-8YYB... CONFIGURADA |
| OIDC_ISSUER_URL | OK - https://trial-2885233.okta.com/oauth2/default |
| OIDC_CLIENT_ID | OK - 0oa10svuld6t1gUUM698 CONFIGURADO |
| PINECONE_API_KEY | OK - pcsk_5rftxw... CONFIGURADA |
| NEO4J_URI / PASSWORD | OK - Configuradas |
| OPA_SIDECAR_URL | OK - http://localhost:8181/... |
| NEXUS_TOTP_ENABLED | OK - true |

---

## FRONTEND (Angular)

| Feature | Estado | Notas |
|---|---|---|
| 17 pantallas/componentes | HECHO | Supera specs M6 (4 pantallas minimas) |
| Login JWT cookie | HECHO | admin@nexus.local / nexusadmin funcional |
| CDM Governance - live stats | HECHO | Carga getCdmGraphStats() real de Neo4j |
| Schema Registry - CDM Domains tab | HECHO | Lazy loading, expandable schemas, PII highlight |
| Ask Nexus / AI Chat | PARCIAL | BFF llama a OpenAI (key presente), no a M2 RHMA real |
| Reasoning trace del agente | FALTA | El backend no devuelve el trace al frontend |
| Pipeline Health con metricas Kafka reales | FALTA | Workers M1 no publican a Kafka activamente |
| Seleccion de idioma | FALTA | Solo ingles |
| Okta PKCE login en Angular | HECHO | Boton activo en login - ngOnInit carga config, loginWithOkta() redirige |

---

## BFF (FastAPI - Puerto 3000)

| Feature | Estado | Notas |
|---|---|---|
| 16 routers activos | HECHO | Smoke test 14/14 ok |
| RLS por tenant (get_conn) | HECHO ACTIVO | customers, orders, users, products, audit migrados |
| Rate limiting por tenant | HECHO ACTIVO | SlowAPI: 30/min unauth, 120/min/tenant, 20/min AI |
| X-Tenant-ID header injection | HECHO ACTIVO | TenantHeaderMiddleware en main.py |
| Okta PKCE endpoints | HECHO | /okta/authorize, /okta/callback, /okta/config en auth.py |
| Okta JWT validation activa | HECHO | okta_is_configured() = true, PKCE validado, /okta/authorize funciona |
| /api/v1/ai/chat | PARCIAL | Llama a OpenAI GPT (key presente), NO al grafo LangGraph de M2 |
| Kong API Gateway | FALTA | BFF expuesto directamente en puerto 3000 |
| WebSocket M2 a frontend | FALTA | Socket.IO en BFF pero sin streaming real de M2 |

---

## nexus_core (Libreria interna)

| Modulo | Estado |
|---|---|
| provisioning.py - onboard_tenant() | HECHO - Implementado completo (CLI + API programatica) |
| identity.py - NexusUserIdentity | HECHO - Implementado completo |
| tenant_validator.py - is_active_tenant() | HECHO - Implementado completo con cache 60s |
| logging.py - structlog setup | HECHO - Implementado completo |

---

## M1 - Conectores e Ingesta

| Feature | Estado | Notas |
|---|---|---|
| Conectores Python propios | HECHO | MySQL, PostgreSQL, Salesforce, ServiceNow, Odoo, SQL Server |
| credential_loader.py | HECHO (78% cobertura) | Sin AWS Secrets Manager real |
| Kafka producer/consumer | HECHO - codigo existe | mindy-kafka corriendo, workers no publicando activamente |
| Airflow DAGs M1 | HECHO - codigo existe | mindy-airflow running, DAGs no auto-trigger |
| Spark jobs | HECHO - codigo existe | Spark running, jobs no en modo produccion |
| Debezium CDC | FALTA | Extraccion por polling en lugar de CDC real |
| Airbyte managed connectors | FALTA | Conectores Python propios en su lugar |

---

## M2 - Agente RHMA (LangGraph)

| Feature | Estado | Notas |
|---|---|---|
| critics, graph, guard, planner, runner | HECHO | Codigo completo |
| state, types, workers, structural_agent | HECHO | Codigo completo |
| schema_drift_detector, schema_profiler | HECHO | Codigo completo |
| LLM calls reales (OpenAI) | POSIBLE | OpenAI key PRESENTE - M2 puede llamar si se activa |
| OPA policy enforcement | HECHO | nexus-opa running, policy Rego v1 validada |
| LangGraph E2E corriendo | FALTA | Sin pipeline Kafka M1 en produccion |
| WebSocket streaming a Angular | FALTA | Codigo existe, no activo end-to-end |

---

## M3 - Knowledge Store

| Feature | Estado | Notas |
|---|---|---|
| graph_writer.py (Neo4j) | HECHO | Neo4j corriendo y seeded con datos CDM |
| timeseries_writer.py | HECHO | PostgreSQL plain (hypertable comentado) |
| vector_writer.py (Pinecone) | HECHO | PINECONE_API_KEY configurada, indice nexus-embeddings creado (dim=1536) |
| TimescaleDB hypertable | FALTA | create_hypertable() comentado - plain PostgreSQL |
| Pinecone vector store | HECHO | Indice nexus-embeddings creado y operativo en Pinecone cloud |
| Pipeline M1 a M3 activo | FALTA | Kafka producers M1 no publicando continuamente |

---

## M4 - CDM Governance

| Feature | Estado | Notas |
|---|---|---|
| main.py, models.py, proposals.py | HECHO | Codigo completo |
| sync_jobs.py, onboarding.py | HECHO | Codigo completo |
| CDM API endpoints via BFF | HECHO | /cdm/domains, /cdm/schemas, /cdm/mappings, /cdm/graph-stats |
| Temporal server | FALTA | Workflow 80% - sin servidor Temporal deployado |
| Kafka consumers M4 | FALTA | Codigo existe, consumers no corriendo en produccion |

---

## BASE DE DATOS

| Feature | Estado |
|---|---|
| RLS activo en BFF | HECHO - get_conn(tenant_id) en todos los routers |
| 15 tablas segun specs | HECHO - DDL correcto |
| Neo4j seeded | HECHO - 7 DataDomains, 4 CdmSchemas, 28 CdmFields, 62 relaciones |
| Audit log (1020 filas) | HECHO - datos reales |
| Products (44 registros) | HECHO - datos reales |
| TimescaleDB extension | FALTA - plain PostgreSQL |
| identity_mapping seed | FALTA - necesaria para Okta OIDC |

---

## OPA (Open Policy Agent)

| Feature | Estado |
|---|---|
| Container nexus-opa | ACTIVO en puerto 8181 |
| Policy authz.rego | Rego v1 - import rego.v1, sintaxis if/contains |
| Roles definidos | platform-admin, data-steward, analyst, viewer |
| Guard cross-tenant | Implementado |
| Validacion manual | admin GET = true, viewer POST = false |
| OPA_DEV_BYPASS | true (auto-autoriza si OPA no responde) |

---

## PENDIENTE - ACCIONES REQUERIDAS

### YA NO HAY ACCIONES PENDIENTES DE USUARIO

Todo lo que requeria accion manual esta completado:
- Okta: NEXUS Platform SPA creada y activa, Client ID en .env, boton en login Angular
- Pinecone: API key configurada, indice nexus-embeddings creado (dim=1536, cosine, aws/us-east-1)

---

### INFRAESTRUCTURA NO DEPLOYADA (Phase 2)

| Componente | Impacto |
|---|---|
| Kong API Gateway | Sin JWT enterprise - rate limiting ya activo via SlowAPI |
| Temporal server | OnboardingWorkflow no corre en Temporal real |
| Prometheus + Grafana | Sin metricas de observabilidad |
| AWS EKS | Solo local - no en cloud |

---

### MEJORAS DE CALIDAD

- Pipeline M1 a Kafka activo en produccion (Kafka corre pero workers no publican continuamente)
- AI Chat con M2 RHMA real (BFF llama a OpenAI directamente, no al grafo LangGraph)
- Reasoning trace en UI (frontend no muestra el trace del agente)
- datetime.utcnow() a datetime.now(UTC) (deprecation warning Python 3.12+)
- Odoo connector (39% cobertura) - implementacion incompleta
- SQL Server connector (40% cobertura) - implementacion incompleta
- 5000 filas de demo (seed actual ~25 filas por tabla)

---

## RESUMEN EJECUTIVO

Lo que funciona hoy para una demo:
Stack Angular 4200 + BFF 3000 + PostgreSQL + Neo4j. Datos reales en todas las pantallas. CDM Governance con stats live de Neo4j. AI Chat funcional con OpenAI (key configurada). OPA policy activa. RLS por tenant activo en todos los routers. Kafka, Airflow y Spark corriendo. Okta PKCE login activo y funcional (boton en pantalla de login). Pinecone nexus-embeddings creado y operativo.

Lo que falta para el pipeline completo:
- Kong API Gateway (deployment)
- Pipeline M1 a Kafka a M2 a M3 activo en produccion continua
- Temporal server para OnboardingWorkflow

Lo que es Phase 2 / produccion enterprise:
AWS EKS, Debezium CDC, Airbyte, TimescaleDB, Prometheus/Grafana, RLHF active loop.