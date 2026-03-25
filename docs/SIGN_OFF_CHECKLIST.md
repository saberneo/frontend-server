# NEXUS Platform — Sign-Off Checklist v1.0.0

**Fecha límite:** 25 de Mayo 2026 — 17:00 CET  
**Aprobación requerida:** CTO InfiniteMind · Lead Architect · Head of Engineering Mentis  
**Estado actual:** 🔄 En progreso  

> Este documento es el **criterio final de aceptación** de la plataforma NEXUS v1.0.0. La plataforma no puede ir a producción hasta que todos los ítems estén marcados como PASS.

---

## Progreso General

```
PHASE 0 — Infraestructura Base     [ 0/9 ]
M1    — Data Intelligence          [ 0/6 ]
Phase 3 — Structural Sub-Cycle     [ 0/4 ]
M2    — RHMA Executive Agent       [ 0/5 ]
M3    — Knowledge Specialization   [ 0/4 ]
M4    — Governance & Orchestration [ 0/4 ]
M6    — Adaptive UI                [ 0/4 ]
E2E Tests                          [ 0/3 ]
Inter-Team Contracts               [ 0/5 ]
Calidad & Seguridad                [ 0/6 ]
Documentación                      [ 0/4 ]
────────────────────────────────────────
TOTAL                              [ 0/54 ]
```

---

## PHASE 0 — Infraestructura Base

- [ ] **SO-01** · AWS EKS cluster activo, 4 namespaces creados (`nexus-app`, `nexus-data`, `nexus-infra`, `nexus-monitoring`), network policies aplicadas entre namespaces
  - Verificar: `kubectl get namespaces && kubectl get networkpolicies -A`

- [ ] **SO-02** · Kafka con 3 brokers, 18 topics estáticos con retención y replicación correctas (`replication.factor=3`, `min.insync.replicas=2`)
  - Verificar: `kafka-topics.sh --describe --bootstrap-server ... | grep "ReplicationFactor: 3"`

- [ ] **SO-03** · PostgreSQL 15+ con RLS activo en 8 tablas, todos los índices creados según `ddl_nexus_system.sql`
  - Verificar: `psql -c "SELECT tablename FROM pg_policies WHERE schemaname='nexus_system'"` → 8 tablas

- [ ] **SO-04** · Redis, MinIO, Kong, Airflow, Spark todos en estado `Running` o `Completed`
  - Verificar: `kubectl get pods -A | grep -v Running | grep -v Completed | grep -v Pending`

- [ ] **SO-05** · External Secrets Operator sincronizando todos los secretos desde AWS Secrets Manager
  - Verificar: `kubectl get externalsecrets -A | grep -v SecretSynced` → 0 resultados

- [ ] **SO-06** · Prometheus + Grafana + Loki + Jaeger operativos; todos los 6 dashboards requeridos creados con datos reales
  - Verificar: Acceder a Grafana UI → 6 dashboards en carpeta "NEXUS"

- [ ] **SO-07** · Okta OIDC configurado, Kong JWT plugin activo, test de login/logout exitoso con usuario real
  - Verificar: Login en `https://app.nexus.mentis-consulting.be` → redirecta a Okta → sesión activa

- [ ] **SO-08** · Paquete `nexus-platform` instalado en todos los pods Python (`nexus_core`, `NexusMessage`, `NexusProducer`, `NexusConsumer`)
  - Verificar: `kubectl exec -n nexus-app <pod> -- python -c "import nexus_core; print(nexus_core.__version__)"`

- [ ] **SO-09** · `onboard_tenant.py` probado con `test-alpha` y `test-beta`, 12 topics por tenant creados
  - Verificar: `kafka-topics.sh --list | grep test-alpha | wc -l` → 12

---

## M1 — Data Intelligence

- [ ] **SO-10** · 6 conectores operativos (PostgreSQL, MySQL, Salesforce, Odoo, ServiceNow, SQL Server), cada uno con test de sync exitoso
  - Verificar: `GET /api/v1/connectors?tenant=test-alpha` → 6 conectores con `status: active`

- [ ] **SO-11** · ConnectorWorker backpressure: pausa cuando buffer > 50,000; resume cuando < 10,000 — verificado en staging
  - Verificar: `m1_backpressure_active{tenant_id="test-alpha"}` cambia entre 0 y 1 correctamente

- [ ] **SO-12** · DeltaWriterWorker: flush a 5,000 records Y flush a 30 segundos — ambas condiciones probadas
  - Verificar logs: `m1_delta_flush_reason{reason="size"}` y `m1_delta_flush_reason{reason="timer"}` ambos > 0

- [ ] **SO-13** · Spark job `m1_classify_and_prepare`: clasificación correcta de los 6 entity_types con confidence > 0.7
  - Verificar: `SELECT entity_type, AVG(confidence) FROM nexus_system.cdm_mappings GROUP BY entity_type`

- [ ] **SO-14** · CDMMapper Tier 1/2/3 operativo; `governance_queue` y `mapping_review_queue` activos con datos
  - Verificar: `SELECT COUNT(*) FROM nexus_system.governance_queue WHERE status='pending'`

- [ ] **SO-15** · AIStoreRouter: routing correcto para los 5 entity_types; `m1.int.ai_routing_decided` publicado con stores correctos
  - Verificar: `kafka-console-consumer --topic m1.int.ai_routing_decided --max-messages 5` → entity_type y stores correctos

---

## Phase 3 — Structural Sub-Cycle

- [ ] **SO-16** · SchemaProfiler: detecta nuevos schemas y drift, publica `m1.int.structural_cycle_triggered` en < 5 min post-sync
  - Verificar: Trigger sync con nueva columna → mensaje en topic dentro de 5 min

- [ ] **SO-17** · SchemaDriftDetector: detecta los 5 tipos de drift (`new_field`, `removed_field`, `type_changed`, `null_spike`, `cardinality_drop`)
  - Verificar: `pytest tests/test_m2_structural.py -v` → todos los 23 tests pasando

- [ ] **SO-18** · M2 Structural Agent: llama a Claude, parsea JSON de respuesta, inserta en `governance_queue`
  - Verificar: `kubectl logs -l app=m2-structural-agent | grep "LLM respondió"` → latency > 0

- [ ] **SO-19** · E2E-03 Structural Cycle: los 9 checkboxes en PASS (ver SO-39)

---

## M2 — RHMA Executive Agent

- [ ] **SO-20** · Planner: genera plan de 2-5 tasks con dependencias correctas para requests complejos
  - Verificar: `pytest tests/test_m2_rhma.py -v` → todos los 25 tests pasando

- [ ] **SO-21** · Workers: `SearchWorker`, `CalculateWorker`, `FetchWorker`, `WriteWorker` ejecutan correctamente
  - Verificar: Logs del runner con resultado de cada worker type

- [ ] **SO-22** · Council of Critics: 3 critics en paralelo, score promedio calculado, umbral 0.7 para pasar
  - Verificar: Métrica `m2_critics_score_avg` disponible en Prometheus

- [ ] **SO-23** · Guard-in-Guard (OPA): autoriza requests válidos, deniega cross-tenant, timeout fail-secure
  - Verificar: `curl -X POST http://opa:8181/v1/data/nexus/authz/allow -d '{"input":{"tenant_id":"t1","user_tenant":"t2"}}'` → `{"result":false}`

- [ ] **SO-24** · LangGraph state machine: replanning funciona hasta `max_retries=2`, reject funciona cuando se agota
  - Verificar: Test con request inválido → `m2.{tenant}.semantic_interpretation_rejected` publicado

---

## M3 — Knowledge Specialization

- [ ] **SO-25** · VectorWriter: upsert en Pinecone con `all-MiniLM-L6-v2` LOCAL 384 dims, batches de 100
  - Verificar: `pc.Index('nexus-test-alpha-party').describe_index_stats()` → `total_vector_count > 0`

- [ ] **SO-26** · GraphWriter: MERGE en Neo4j con relaciones `PARTICIPATED_IN`, `MANAGES`, `AFFECTS`, `INVOLVED_IN` inferidas
  - Verificar: `MATCH (n:Tenant_test-alpha) RETURN count(n)` → count > 0

- [ ] **SO-27** · TimeSeriesWriter: hypertable activa, particiones diarias correctas, idempotencia verificada
  - Verificar: `SELECT count(*) FROM nexus_m3.timeseries WHERE tenant_id='test-alpha'` → count > 0

- [ ] **SO-28** · AIStoreWriteOrchestrator: routing según tabla por entity_type, `m1.int.ai_write_completed` publicado
  - Verificar: `pytest tests/test_m3_writers.py -v` → todos los 36 tests pasando ✅

---

## M4 — Governance & Orchestration

- [ ] **SO-29** · FastAPI Governance: todos los endpoints GET/POST de proposals, approve, reject, mapping-review responden correctamente
  - Verificar: `pytest tests/test_m4_governance.py -v` → todos los 27 tests pasando ✅

- [ ] **SO-30** · Approve flow: publica `nexus.cdm.version_published` + nueva versión activa en `nexus_system.cdm_versions`
  - Verificar: `kafka-console-consumer --topic nexus.cdm.version_published --max-messages 1` post-aprobación

- [ ] **SO-31** · Temporal OnboardingWorkflow: las 6 actividades completadas en orden, idempotente (2 ejecuciones = mismo resultado)
  - Verificar: Workflow visible en Temporal UI con `status: Completed`

- [ ] **SO-32** · CDMRegistryService cache invalidado < 5 min tras publicación de `nexus.cdm.version_published`
  - Verificar: Logs del CDMMapper: `cache invalidated` dentro de 5 min post-aprobación

---

## M6 — Adaptive User Interface

- [ ] **SO-33** · Angular UI con autenticación Okta OIDC: login/logout funcional, `tenant_id` disponible en sesión
  - Verificar: Acceso a `/overview` sin sesión → redirect a login → post-login → dashboard visible

- [ ] **SO-34** · AI Chat (`/ask-nexus`): WebSocket conectado, request enviado, respuesta con `criticsScore` mostrada
  - Verificar: DevTools Network WS → mensaje enviado → respuesta recibida en < 30s con badge de calidad

- [ ] **SO-35** · Governance Console (`/cdm-governance`): propuestas visibles, approve/reject funcional desde UI
  - Verificar: Click "Approve" en propuesta → status cambia a "approved" en UI sin recargar

- [ ] **SO-36** · Reconexión WebSocket automática < 5s tras desconexión
  - Verificar: `kubectl delete pod <m6-pod>` → UI muestra "Reconnecting..." → reconecta en < 5s

---

## Tests E2E

- [ ] **SO-37** · P8-E2E-01 Happy Path: 14/14 checkboxes PASS (0 FAIL)
  - Ejecutar: `./scripts/run_e2e.sh --suite e2e01`

- [ ] **SO-38** · P8-E2E-02 Multi-Tenant: 7/7 checkboxes PASS
  - Ejecutar: `./scripts/run_e2e.sh --suite e2e02`

- [ ] **SO-39** · P8-E2E-03 Structural Cycle: 9/9 checkboxes PASS
  - Ejecutar: `./scripts/run_e2e.sh --suite e2e03`

---

## Inter-Team Contracts

- [ ] **SO-40** · Contrato 01 (M1→M2): SLA latencia < 5 min verificado en staging con 1,000 registros
- [ ] **SO-41** · Contrato 02 (M2→M3): idempotencia re-delivery verificada (mismo mensaje enviado 2 veces → mismo resultado)
- [ ] **SO-42** · Contrato 03 (M3→M2 read): P95 Pinecone < 500ms medido en staging bajo carga moderada
- [ ] **SO-43** · Contrato 04 (M2 Structural→M4): propuesta aparece en `governance_queue` en < 30s verificado
- [ ] **SO-44** · Contrato 05 (M4→M6): P95 API GET < 500ms, P95 POST < 2s medidos con k6/wrk

---

## Calidad & Seguridad

- [ ] **SO-45** · Cobertura tests unitarios ≥ 80% en todos los módulos Python
  - Verificar: `pytest --cov=nexus_core --cov=m1 --cov=m2 --cov=m3 --cov=m4 --cov-report=term-missing --cov-fail-under=80`
  - Estado actual: 176 tests pasando ✅

- [ ] **SO-46** · Cero secrets en código fuente
  - Verificar: `grep -r "sk-ant\|AKIA\|password\s*=\s*['\"][^'\"]\|api_key\s*=\s*['\"]" src/ nexus-python-platform/ --include="*.py" --include="*.ts"` → 0 resultados

- [ ] **SO-47** · Cero llamadas REST directas entre módulos para pipeline events (solo Kafka)
  - Verificar: `grep -r "requests.get\|axios.get\|fetch(" m1/ m2/ m3/ --include="*.py"` → 0 resultados en paths de pipeline

- [ ] **SO-48** · Los 6 dashboards Grafana creados con datos reales
  - DASH-1: NEXUS Platform Overview
  - DASH-2: M1 Data Pipeline
  - DASH-3: M2 RHMA Agent
  - DASH-4: M3 AI Stores
  - DASH-5: CDM Governance
  - DASH-6: Infrastructure Health

- [ ] **SO-49** · Prometheus alerts activos; `M1BackpressureActive` y `KafkaBrokerDown` probados en staging
  - Verificar: `k8s/monitoring/nexus-alerts.yaml` aplicado → alertas visibles en Alertmanager UI ✅

- [ ] **SO-50** · Pentest básico realizado: no cross-tenant data leaks detectados, RLS verificado
  - Verificar: Reporte de pentest firmado por Security Lead

---

## Documentación

- [ ] **SO-51** · `README.md` actualizado con instrucciones de despliegue y prerequisitos
  - Verificar: Un nuevo ingeniero puede desplegar la plataforma siguiendo solo el README

- [ ] **SO-52** · Archivos NEXUS-BUILD-PHASE-1 hasta NEXUS-09 presentes en `build-plan/`
  - Verificar: `ls build-plan/NEXUS-0*.md | wc -l` → 8 archivos ✅

- [ ] **SO-53** · Runbook de operaciones en `docs/operations/runbook.md`
  - Verificar: Cubre: Kafka down, PostgreSQL full, Pinecone rate limit, tenant onboarding, CDM rollback ✅

- [ ] **SO-54** · API documentation (FastAPI `/docs`) accesible y completa con todos los endpoints
  - Verificar: `http://m4-governance-api:8000/docs` → 12+ endpoints documentados con schemas

---

## Firmas de Aprobación

> **IMPORTANTE:** Las tres firmas son obligatorias para el go-live. Ninguna firma individual es suficiente.

| Rol | Nombre | Firma | Fecha |
|---|---|---|---|
| CTO InfiniteMind | | _______________________ | _________ |
| Lead Architect NEXUS | | _______________________ | _________ |
| Head of Engineering Mentis | | _______________________ | _________ |

---

**Fecha de generación:** Marzo 2026  
**Versión del documento:** 1.0.0  
**Próxima revisión:** Antes del sign-off final (25 Mayo 2026)  

*NEXUS Sign-Off Checklist — Mentis Consulting × InfiniteMind*
