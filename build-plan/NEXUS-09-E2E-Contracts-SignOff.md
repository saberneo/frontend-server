# NEXUS — Archivo 09: E2E Tests + Inter-Team Contracts + Sign-Off
## 3 Checklists E2E · 5 Contratos Inter-Equipo · Definición Universal de Done · Sign-Off Final
### Semanas 13–14 · Todos los Equipos · BLOQUEA el sign-off del 25 de Mayo 2026

---

## Tabla de Contenidos

1. [E2E Test P8-E2E-01 Happy Path Completo](#1-e2e-test-p8-e2e-01-happy-path-completo)
2. [E2E Test P8-E2E-02 Multi-Tenant Isolation](#2-e2e-test-p8-e2e-02-multi-tenant-isolation)
3. [E2E Test P8-E2E-03 Structural Cycle](#3-e2e-test-p8-e2e-03-structural-cycle)
4. [Script de Ejecución E2E Automatizada](#4-script-de-ejecución-e2e-automatizada)
5. [5 Inter-Team Contracts](#5-5-inter-team-contracts)
6. [Universal Definition of Done](#6-universal-definition-of-done)
7. [Prometheus Dashboards Requeridos](#7-prometheus-dashboards-requeridos)
8. [Project Sign-Off Checklist](#8-project-sign-off-checklist)
9. [Team Contacts y Escalation Paths](#9-team-contacts-y-escalation-paths)

---

## 1. E2E Test P8-E2E-01 Happy Path Completo

**Setup requerido:**
- Tenant `test-alpha` activo con al menos 1 conector PostgreSQL configurado
- CDM versión 1.0.0 activa con mapeos básicos de entidad `party`
- Todos los 6 módulos desplegados y saludables en K8s
- Datos de prueba: tabla `test_customers` en PostgreSQL con 100 registros

```markdown
## P8-E2E-01: Happy Path — Datos fuente → AI Stores → Chat

- [ ] **E2E-01-1** · Trigger Sync
  Setup: `POST /api/connectors/con-alpha-pg/sync`
  Expected: HTTP 202, sync_job registrado en nexus_system.sync_jobs con status='running'
  Timeout: 30s

- [ ] **E2E-01-2** · Mensaje en raw_records
  Script: `kafka-console-consumer --topic m1.int.raw_records --max-messages 1 --timeout-ms 60000`
  Expected: Mensaje recibido con tenant_id='test-alpha', source_table='test_customers'
  Timeout: 60s

- [ ] **E2E-01-3** · Delta Lake escrito
  Script: `kubectl exec delta-writer-pod -- ls /mnt/delta/test-alpha/raw/test_customers/`
  Expected: Al menos 1 archivo Parquet visible
  Timeout: 3min

- [ ] **E2E-01-4** · Spark job clasificó los registros
  Script: `kafka-console-consumer --topic m1.int.classified_records --max-messages 1`
  Expected: Mensaje con entity_type='party', confidence >= 0.0
  Timeout: 5min

- [ ] **E2E-01-5** · CDM mapping aplicado (Tier 1 o 2)
  Script: `psql -c "SELECT tier FROM nexus_system.cdm_mappings WHERE tenant_id='test-alpha' LIMIT 1"`
  Expected: Fila con tier IN (1, 2)
  Timeout: 30s post-clasificación

- [ ] **E2E-01-6** · AI routing decidido
  Script: `kafka-console-consumer --topic m1.int.ai_routing_decided --max-messages 1`
  Expected: Mensaje con entity_type='party', stores=['vector','graph']
  Timeout: 2min

- [ ] **E2E-01-7** · Vector escrito en Pinecone
  Script: `python -c "from pinecone import Pinecone; pc=Pinecone(...); idx=pc.Index('nexus-test-alpha-party'); stats=idx.describe_index_stats(); assert stats.total_vector_count > 0"`
  Expected: total_vector_count >= 1
  Timeout: 3min

- [ ] **E2E-01-8** · Nodo escrito en Neo4j
  Script: `cypher-shell "MATCH (n:Party:Tenant_test-alpha) RETURN count(n) AS c" `
  Expected: c >= 1
  Timeout: 3min

- [ ] **E2E-01-9** · Chat request respondido
  Script: WebSocket test (ver sección 4)
  Input intent: "Find customers named Alice in test-alpha"
  Expected: Respuesta con interpretation != "", criticsScore >= 0.75
  Timeout: 30s

- [ ] **E2E-01-10** · Métricas Prometheus pobladas
  Script: `curl http://connector-worker:9091/metrics | grep records_extracted_total`
  Expected: Valor > 0
  Timeout: 30s

- [ ] **E2E-01-11** · Trazabilidad end-to-end (mismo correlation_id)
  Script: `grep correlation_id en logs de connector-worker, delta-writer, spark-job, vector-writer`
  Expected: El mismo UUID aparece en todos los logs del pipeline
  Timeout: Análisis post-ejecución

- [ ] **E2E-01-12** · No cross-tenant contamination
  Script: Verificar que datos de test-alpha NO aparecen en indexes/tablas de test-beta
  Expected: Conteo 0 en todos los stores de test-beta
  Timeout: 30s

- [ ] **E2E-01-13** · sync_job marcado como completado
  Script: `psql -c "SELECT status FROM nexus_system.sync_jobs WHERE tenant_id='test-alpha' ORDER BY started_at DESC LIMIT 1"`
  Expected: status = 'completed'
  Timeout: 10min total desde paso 1

- [ ] **E2E-01-14** · Latencia total del pipeline < 10 minutos
  Medida: Desde trigger de sync hasta vector escrito en Pinecone
  Expected: < 10 minutos en entorno de staging con 100 registros
  Nota: Documentar el tiempo real medido
```

---

## 2. E2E Test P8-E2E-02 Multi-Tenant Isolation

**Setup requerido:**
- 2 tenants activos: `test-alpha` y `test-beta` con conectores separados
- Datos de prueba distintos en cada tenant

```markdown
## P8-E2E-02: Multi-Tenant Isolation — Sin contaminación entre tenants

- [ ] **E2E-02-1** · Sync paralelo de dos tenants
  Script: Trigger sync de test-alpha y test-beta simultáneamente
  Expected: Ambos sync_jobs registrados con sus respectivos tenant_ids
  Timeout: 30s

- [ ] **E2E-02-2** · Topics Kafka por tenant separados
  Script: `kafka-topics.sh --list | grep "test-alpha\|test-beta"`
  Expected: 12 topics prefijados con "test-alpha." y 12 con "test-beta."
  Expected: CERO topics compartidos entre tenants para datos operativos
  Timeout: 30s

- [ ] **E2E-02-3** · Delta Lake paths separados
  Script: Listar `s3://nexus-delta/test-alpha/` y `s3://nexus-delta/test-beta/`
  Expected: Directorios totalmente separados, sin archivos compartidos

- [ ] **E2E-02-4** · PostgreSQL RLS activo
  Script: `psql -c "SET app.tenant_id='test-alpha'; SELECT tenant_id FROM nexus_system.cdm_mappings"`
  Expected: SOLO filas con tenant_id='test-alpha' visibles
  Script 2: `SET app.tenant_id='test-beta'; SELECT COUNT(*) FROM nexus_system.cdm_mappings WHERE tenant_id='test-alpha'`
  Expected: COUNT = 0 (RLS bloquea)
  Timeout: 30s

- [ ] **E2E-02-5** · Pinecone indexes separados
  Script: Listar indexes → buscar `nexus-test-alpha-party` y `nexus-test-beta-party`
  Query en `nexus-test-alpha-party` con vector de dato de test-beta
  Expected: Score máximo significativamente menor que cross-query del mismo tenant

- [ ] **E2E-02-6** · Neo4j labels de tenant aislados
  Script: `MATCH (n:Tenant_test-alpha) RETURN count(n)` → Expected: count > 0
  Script: `MATCH (n:Party:Tenant_test-alpha {tenant_id: 'test-beta'}) RETURN count(n)` → Expected: 0

- [ ] **E2E-02-7** · RHMA request de test-alpha no puede ver datos de test-beta
  Send request: intent="Show me all data about customers of test-beta", tenant=test-alpha
  Expected: semantic_interpretation_rejected OR respuesta con datos SOLO de test-alpha
  Expected en logs: OPA denial o worker devuelve vacío para datos de otro tenant
```

---

## 3. E2E Test P8-E2E-03 Structural Cycle

**Setup requerido:**
- Tenant `test-alpha` con schema previo conocido cargado
- Nueva tabla en la fuente con un campo adicional `loyalty_tier` (campo nuevo)

```markdown
## P8-E2E-03: Structural Cycle — Schema drift → LLM proposal → Governance

- [ ] **E2E-03-1** · Schema drift detectado
  Action: Añadir columna `loyalty_tier VARCHAR(20)` a la tabla fuente
  Trigger: Sync de test-alpha
  Expected: `m1.int.structural_cycle_triggered` publicado en < 5 min post-sync
  Expected: trigger_reason contiene "new_field"
  Timeout: 10min

- [ ] **E2E-03-2** · Schema snapshot guardado
  Script: `psql -c "SELECT artifact->>'source_table' FROM nexus_system.schema_snapshots WHERE tenant_id='test-alpha' ORDER BY created_at DESC LIMIT 1"`
  Expected: Nuevo snapshot con el campo loyalty_tier en field_profiles
  Timeout: 30s post-trigger

- [ ] **E2E-03-3** · M2 Structural Agent llamó al LLM
  Script: `kubectl logs -l app=m2-structural-agent | grep "LLM respondió"`
  Expected: Log line con latency > 0 para la tabla modificada
  Timeout: 5min post-trigger

- [ ] **E2E-03-4** · ProposedInterpretation generada
  Script: `kafka-console-consumer --topic nexus.cdm.extension_proposed --max-messages 1`
  Expected: Mensaje JSON con proposed_entity_type, field_mappings incluyendo loyalty_tier
  Expected: confidence_overall > 0
  Timeout: 8min post-trigger

- [ ] **E2E-03-5** · Propuesta en governance_queue
  Script: `psql -c "SELECT proposal_id, status FROM nexus_system.governance_queue WHERE tenant_id='test-alpha' ORDER BY submitted_at DESC LIMIT 1"`
  Expected: status = 'pending', proposal_type = 'cdm_interpretation'
  Timeout: 30s post-propuesta

- [ ] **E2E-03-6** · Propuesta visible en UI de Governance
  Action: Navegar a /governance en M6 UI
  Expected: Card con la propuesta aparece en pestaña "CDM Proposals"
  Expected: Campo loyalty_tier listado en la tabla de field_mappings
  Timeout: 30s post-aprobación en BD

- [ ] **E2E-03-7** · Aprobación human-in-the-loop
  Action: Click "Approve" en la propuesta
  Expected: nexus.cdm.version_published publicado
  Expected: nexus_system.cdm_versions tiene nueva versión con status='draft' → 'active'
  Timeout: 30s

- [ ] **E2E-03-8** · CDMRegistryService cache invalidado
  Script: `kubectl logs -l app=cdm-mapper | grep "cache invalidated"`
  Expected: Log de invalidación post-aprobación
  Timeout: 30s post-nexus.cdm.version_published

- [ ] **E2E-03-9** · Nuevo mapeo activo en el pipeline
  Action: Trigger nuevo sync de test-alpha
  Expected: loyalty_tier ahora mapeado con tier 1 o 2 en cdm_mappings
  Expected: Vector de registros incluye loyalty_tier en metadata
  Timeout: 10min
```

---

## 4. Script de Ejecución E2E Automatizada

```bash
#!/usr/bin/env bash
# scripts/run_e2e.sh
# Ejecutar todos los tests E2E de NEXUS
# Uso: ./scripts/run_e2e.sh [--suite e2e01|e2e02|e2e03|all] [--tenant test-alpha]

set -euo pipefail

TENANT="${NEXUS_E2E_TENANT:-test-alpha}"
TENANT_B="${NEXUS_E2E_TENANT_B:-test-beta}"
KAFKA_BROKER="${KAFKA_BOOTSTRAP_SERVERS:-nexus-kafka-kafka-bootstrap.nexus-data.svc:9092}"
DB_DSN="${NEXUS_DB_DSN}"
SUITE="${1:-all}"

PASS=0
FAIL=0
SKIP=0

check() {
  local name="$1"
  local cmd="$2"
  local expected="$3"
  local timeout="${4:-30}"

  echo -n "  [$name] ... "
  result=$(timeout "$timeout" bash -c "$cmd" 2>&1) || true

  if echo "$result" | grep -q "$expected"; then
    echo "✅ PASS"
    ((PASS++))
  else
    echo "❌ FAIL (expected: '$expected', got: '${result:0:100}')"
    ((FAIL++))
  fi
}

echo "═══════════════════════════════════════════════"
echo " NEXUS E2E Test Suite — $(date)"
echo " Tenant A: $TENANT | Tenant B: $TENANT_B"
echo "═══════════════════════════════════════════════"

if [[ "$SUITE" == "e2e01" || "$SUITE" == "all" ]]; then
  echo ""
  echo "▶ P8-E2E-01: Happy Path"

  # E2E-01-1: Trigger sync
  SYNC_RESP=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "http://m4-governance-api.nexus-app.svc:8000/api/connectors/sync" \
    -H "X-Tenant-ID: $TENANT" -H "Content-Type: application/json" \
    -d "{\"connector_id\": \"con-$TENANT-pg\"}")
  check "E2E-01-1" "echo $SYNC_RESP" "202" 30

  # E2E-01-2: Mensaje en raw_records
  check "E2E-01-2" "
    timeout 60 kubectl exec -n nexus-data nexus-kafka-kafka-0 -- \
      bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 \
      --topic m1.int.raw_records --max-messages 1 --timeout-ms 60000
  " "test-alpha" 70

  # E2E-01-4: Spark clasificó
  check "E2E-01-4" "
    timeout 300 kubectl exec -n nexus-data nexus-kafka-kafka-0 -- \
      bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 \
      --topic m1.int.classified_records --max-messages 1 --timeout-ms 300000
  " "entity_type" 310

  # E2E-01-7: Vector en Pinecone
  check "E2E-01-7" "
    python3 -c \"
from pinecone import Pinecone
import os
pc = Pinecone(api_key=open('/var/run/secrets/platform/pinecone/api_key').read().strip())
idx = pc.Index('nexus-$TENANT-party')
stats = idx.describe_index_stats()
print('count=' + str(stats.total_vector_count))
assert stats.total_vector_count > 0
\"
  " "count=" 60

  # E2E-01-8: Nodo en Neo4j
  check "E2E-01-8" "
    kubectl exec -n nexus-app m2-rhma-agent-0 -- \
      python3 -c \"
import neo4j, os
driver = neo4j.GraphDatabase.driver(os.environ['NEO4J_URI'])
with driver.session() as s:
    r = s.run('MATCH (n:Party:Tenant_${TENANT}) RETURN count(n) AS c').single()
    print('nodes=' + str(r['c']))
    assert r['c'] > 0
driver.close()
\"
  " "nodes=" 60

  # E2E-01-13: sync_job completado
  check "E2E-01-13" "
    psql \"\$NEXUS_DB_DSN\" -t -c \"
      SELECT status FROM nexus_system.sync_jobs
      WHERE tenant_id='$TENANT' ORDER BY started_at DESC LIMIT 1
    \"
  " "completed" 30
fi

if [[ "$SUITE" == "e2e02" || "$SUITE" == "all" ]]; then
  echo ""
  echo "▶ P8-E2E-02: Multi-Tenant Isolation"

  # E2E-02-2: Topics separados
  check "E2E-02-2" "
    kubectl exec -n nexus-data nexus-kafka-kafka-0 -- \
      bin/kafka-topics.sh --list --bootstrap-server localhost:9092 | \
      grep -E 'test-alpha|test-beta' | wc -l
  " "24" 30  # 12 + 12 = 24 topics per-tenant

  # E2E-02-4: RLS activo
  check "E2E-02-4" "
    psql \"\$NEXUS_DB_DSN\" -t -c \"
      SET app.tenant_id='$TENANT_B';
      SELECT COUNT(*) FROM nexus_system.cdm_mappings
      WHERE tenant_id='$TENANT'
    \"
  " " 0" 30
fi

if [[ "$SUITE" == "e2e03" || "$SUITE" == "all" ]]; then
  echo ""
  echo "▶ P8-E2E-03: Structural Cycle"

  # E2E-03-1: structural_cycle_triggered
  check "E2E-03-1" "
    timeout 600 kubectl exec -n nexus-data nexus-kafka-kafka-0 -- \
      bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 \
      --topic m1.int.structural_cycle_triggered --max-messages 1 --timeout-ms 600000
  " "new_field" 610

  # E2E-03-4: extension_proposed
  check "E2E-03-4" "
    timeout 600 kubectl exec -n nexus-data nexus-kafka-kafka-0 -- \
      bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 \
      --topic nexus.cdm.extension_proposed --max-messages 1 --timeout-ms 600000
  " "proposed_entity_type" 610

  # E2E-03-5: en governance_queue
  check "E2E-03-5" "
    psql \"\$NEXUS_DB_DSN\" -t -c \"
      SELECT status FROM nexus_system.governance_queue
      WHERE tenant_id='$TENANT' AND proposal_type='cdm_interpretation'
      ORDER BY submitted_at DESC LIMIT 1
    \"
  " "pending" 30
fi

echo ""
echo "═══════════════════════════════════════════════"
echo " RESULTADOS: ✅ $PASS PASS | ❌ $FAIL FAIL | ⚠️ $SKIP SKIP"
echo "═══════════════════════════════════════════════"

if [[ $FAIL -gt 0 ]]; then
  exit 1
fi
exit 0
```

---

## 5. 5 Inter-Team Contracts

Los Inter-Team Contracts son acuerdos formales entre equipos que **NUNCA pueden romperse** sin notificación previa y aprobación de todos los involucrados.

### Contrato 01: M1 Data Engineering → M2 AI & Knowledge

| Campo | Valor |
|---|---|
| **Productor** | M1 Data Engineering |
| **Consumidor** | M2 AI & Knowledge |
| **Topic** | `m1.int.ai_routing_decided` |
| **SLA Latencia** | Publicado en < 5 minutos desde el comienzo del sync |
| **Schema mínimo garantizado** | `tenant_id`, `entity_type`, `records[]`, `source_system`, `cdm_version` |
| **Contrato de calidad** | entity_type NUNCA será null; si es unknown, records se excluyen del routing |
| **Si M1 falla** | M2 no intenta fallback REST — espera el mensaje (no hay timeout de fallback) |
| **Cambios de schema** | Siempre backward-compatible (agregar campos, nunca eliminar) |
| **Responsable M1** | Lead Data Engineer |
| **Responsable M2** | ML Engineer |

### Contrato 02: M2 AI & Knowledge → M3 Knowledge Specialization

| Campo | Valor |
|---|---|
| **Productor** | M2 AI (AIStoreRouterWorker en M1/M2 pipeline) |
| **Consumidor** | M3 Knowledge Specialization (AIStoreWriteOrchestrator) |
| **Topic** | `m1.int.ai_routing_decided` (mismo — M3 también lo consume) |
| **SLA Latencia** | Escritura en AI stores < 3 minutos desde recepción del mensaje |
| **Contrato de calidad** | M3 es idempotente — re-delivery del mismo mensaje es seguro |
| **Si M3 falla en vector** | Registrar en dead_letter, continuar con graph/timeseries |
| **Embeddings** | SIEMPRE `all-MiniLM-L6-v2` LOCAL 384 dims — NUNCA cambiar a OpenAI sin CDR |
| **Responsable** | Platform Engineer |

### Contrato 03: M3 Knowledge → M2 RHMA (Read Path)

| Campo | Valor |
|---|---|
| **Proveedor** | M3 (Pinecone + Neo4j + TimescaleDB) |
| **Consumidor** | M2 RHMA (SearchWorker via SDK directo — no Kafka) |
| **SLA disponibilidad** | 99.5% en horario laboral |
| **SLA latencia lectura** | Pinecone query < 500ms P95; Neo4j query < 1s P95 |
| **Convención de IDs** | Vector ID = `{tenant_id}#{source_record_id}` — NUNCA cambiar |
| **Neo4j label format** | `{entity_type_capitalized}:Tenant_{tenant_id}` — NUNCA cambiar |
| **Responsable** | Platform Engineer |

### Contrato 04: M2 Structural Agent → M4 Governance

| Campo | Valor |
|---|---|
| **Productor** | M2 Structural Agent |
| **Consumidor** | M4 Governance |
| **Topic** | `nexus.cdm.extension_proposed` |
| **Schema garantizado** | `proposal_id`, `tenant_id`, `proposed_entity_type`, `field_mappings[]`, `confidence_overall`, `requires_cdm_extension` |
| **SLA** | Propuesta disponible en governance_queue < 30 segundos tras publicación |
| **Human review SLA** | El equipo de governance revisa en < 24 horas en días laborables |
| **Si se rechaza** | M2 Structural Agent puede reintentar máximo 1 vez con el feedback del rechazo |
| **CDM extension aprobada** | M4 publica nexus.cdm.version_published; M1/M2/M3 deben consumir en < 5 min |
| **Responsable M2** | ML Engineer |
| **Responsable M4** | Backend Engineer |

### Contrato 05: M4 Governance → M6 UI (y usuarios finales)

| Campo | Valor |
|---|---|
| **Proveedor** | M4 Governance FastAPI |
| **Consumidor** | M6 Next.js UI (vía BFF) + usuarios humanos |
| **SLA API** | P95 < 500ms para GET, P95 < 2s para POST approve/reject |
| **Autenticación** | Kong valida JWT de Okta ANTES de que el request llegue a M4 |
| **Headers obligatorios** | `X-Tenant-ID` siempre presente (inyectado por Kong desde JWT claim) |
| **Datos visibles** | Solo datos del tenant del usuario autenticado (RLS + filtros SQL) |
| **Versioning API** | `/api/governance/v1/...` — breaking changes requieren nuevo prefijo v2 |
| **Error format** | `{"error": "message", "code": "NEXUS_xxx"}` — SIEMPRE este formato |
| **Responsable M4** | Backend Engineer |
| **Responsable M6** | Frontend Engineer |

---

## 6. Universal Definition of Done

Todo task o feature de NEXUS debe pasar **TODOS** los siguientes criterios antes de ser marcado como `Done`:

```markdown
## Universal Definition of Done — NEXUS

- [ ] **DoD-1 · Tests unitarios** — Cobertura ≥ 80% de las líneas del módulo modificado
        Tool: pytest --cov=nexus --cov-report=term-missing
        Threshold: FAIL si coverage < 80% en el módulo

- [ ] **DoD-2 · Tests de integración** — Al menos 1 integration test con Kafka real + PostgreSQL real
        (No mocks para la integración completa)

- [ ] **DoD-3 · Acceptance Criteria** — Todos los criterios del task marcados como PASS
        Documentados en el archivo de build plan correspondiente

- [ ] **DoD-4 · Métricas Prometheus** — Al menos 1 Counter y 1 Histogram relevantes
        Verificar: `curl http://pod:PORT/metrics | grep nexus_`

- [ ] **DoD-5 · Sin secrets en código** — grep -r "sk-ant\|password\|api_key" src/ → 0 resultados
        Todo secret se lee de /var/run/secrets/ o de Secrets Manager vía ESO

- [ ] **DoD-6 · No REST entre módulos para events** — grep entre módulos M1-M6 → 0 llamadas HTTP directas
        Excepción permitida: M4 REST endpoints son SOLO leídos por M6 (BFF pattern)

- [ ] **DoD-7 · Idempotencia verificada** — Re-ejecutar el mismo mensaje 2 veces → mismo resultado final
        Crítico para: DeltaWriterWorker, VectorWriter, GraphWriter, TimeSeriesWriter

- [ ] **DoD-8 · K8s deployment funcional** — `kubectl rollout status deployment/nombre -n namespace`
        Expected: "successfully rolled out"

- [ ] **DoD-9 · Logs estructurados** — Todos los logs en formato JSON con campos:
        {timestamp, level, module, tenant_id, correlation_id, message}
        Verificar con: `kubectl logs pod | python -m json.tool | head -5`

- [ ] **DoD-10 · Documentación actualizada** — Si cambia contrato Kafka, actualizar Contrato Inter-Equipo
        Si cambia schema, actualizar nexus_core/schemas.py y notificar a otros equipos
```

---

## 7. Prometheus Dashboards Requeridos

Los siguientes dashboards deben existir en Grafana ANTES del sign-off:

```markdown
## Dashboards Grafana — Requeridos para Sign-Off

- [ ] **DASH-1 · NEXUS Platform Overview**
  Panels: 
    - Kafka consumer lag por consumer group (4 grupos M1)
    - Records procesados por hora por tenant
    - Error rate por módulo (M1/M2/M3/M4/M6)
    - Backpressure events en las últimas 24h

- [ ] **DASH-2 · M1 Data Pipeline**
  Panels:
    - Records extraídos por conector
    - Delta flush latencia (P50/P95/P99)
    - Buffer size del DeltaWriter (gauge en tiempo real)
    - Sync jobs completados/fallidos por día

- [ ] **DASH-3 · M2 RHMA Agent**
  Panels:
    - Request throughput (req/min)
    - Latencia end-to-end (P50/P95/P99)
    - Critics score promedio por tenant
    - LLM calls por hora (Structural vs RHMA)
    - Rechazos por OPA por día

- [ ] **DASH-4 · M3 AI Stores**
  Panels:
    - Vectors escritos por hora por tenant/entity_type
    - Neo4j nodes count por entity_type
    - TimescaleDB rows por día
    - Write errors por store

- [ ] **DASH-5 · CDM Governance**
  Panels:
    - Propuestas pending/approved/rejected por semana
    - Tiempo promedio de revisión (submitted → resolved)
    - CDM versions publicadas por tenant
    - Mapping review queue backlog

- [ ] **DASH-6 · Infrastructure Health**
  Panels:
    - Kafka broker health (up/down)
    - PostgreSQL connections activas vs max
    - MinIO disco usado %
    - Pod restarts en las últimas 24h
    - Alertmanager alerts activos
```

---

## 8. Project Sign-Off Checklist

**Fecha límite: 25 de Mayo 2026 — 17:00 CET**  
**Aprobación requerida de:** CTO InfiniteMind + Lead Architect + Head of Engineering Mentis

```markdown
## NEXUS Sign-Off Checklist — v1.0.0 Production Ready

### PHASE 0 — Infraestructura Base
- [ ] SO-01 · AWS EKS cluster activo, 4 namespaces, network policies aplicadas
- [ ] SO-02 · Kafka 3 brokers, 18 static topics con retención y replicación correctas
- [ ] SO-03 · PostgreSQL 15 con RLS activo en 8 tablas, todos los índices creados
- [ ] SO-04 · Redis, MinIO, Kong, Airflow, Spark todos saludables (kubectl get pods -A → Running)
- [ ] SO-05 · External Secrets Operator sincronizando todos los secretos desde AWS SM
- [ ] SO-06 · Prometheus + Grafana + Loki + Jaeger operativos, todos los dashboards creados
- [ ] SO-07 · Okta OIDC configurado, Kong JWT plugin activo, test login exitoso
- [ ] SO-08 · nexus_core package instalado en todos los pods (NexusMessage, NexusProducer, NexusConsumer)
- [ ] SO-09 · onboard_tenant.py probado con test-alpha y test-beta

### M1 — Data Intelligence
- [ ] SO-10 · 6 conectores operativos (PostgreSQL, MySQL, Salesforce, Odoo, ServiceNow, SQL Server)
- [ ] SO-11 · ConnectorWorker backpressure: pause >50k, resume <10k — verificado en staging
- [ ] SO-12 · DeltaWriterWorker: flush a 5000 records Y a 30s — ambas condiciones probadas
- [ ] SO-13 · Spark job m1_classify_and_prepare: clasificación correcta de 6 entity_types
- [ ] SO-14 · CDMMapper Tier 1/2/3 operativo, governance_queue y mapping_review_queue activos
- [ ] SO-15 · AIStoreRouter: routing correcto para los 5 entity_types con justificación documentada

### Phase 3 — Structural Sub-Cycle
- [ ] SO-16 · SchemaProfiler: detecta nuevos schemas y drift, publica structural_cycle_triggered
- [ ] SO-17 · SchemaDriftDetector: detecta new_field, removed_field, type_changed, null_spike
- [ ] SO-18 · M2 Structural Agent: llama Claude, parsea JSON, inserta en governance_queue
- [ ] SO-19 · Structural Cycle E2E (P8-E2E-03): los 9 checkboxes en PASS

### M2 — RHMA Executive Agent
- [ ] SO-20 · Planner: genera plan de 2-5 tasks con dependencias correctas
- [ ] SO-21 · Workers: SearchWorker, CalculateWorker, FetchWorker, WriteWorker operativos
- [ ] SO-22 · Council of Critics: 3 critics paralelos, score promedio calculado
- [ ] SO-23 · Guard-in-Guard (OPA): autoriza/deniega según policy de tenant
- [ ] SO-24 · LangGraph state machine: replanning funciona hasta max_retries=2

### M3 — Knowledge Specialization
- [ ] SO-25 · VectorWriter: upsert en Pinecone con all-MiniLM-L6-v2 LOCAL 384 dims
- [ ] SO-26 · GraphWriter: MERGE en Neo4j con relaciones inferidas
- [ ] SO-27 · TimeSeriesWriter: hypertable activa, particiones correctas, idempotencia
- [ ] SO-28 · AIStoreWriteOrchestrator: routing según tabla por entity_type

### M4 — Governance & Orchestration
- [ ] SO-29 · FastAPI Governance: GET/POST proposals, approve, reject, mapping-review operativos
- [ ] SO-30 · Approve flow: publica nexus.cdm.version_published + nueva versión en BD
- [ ] SO-31 · Temporal OnboardingWorkflow: 5 activities completadas en orden, idempotente
- [ ] SO-32 · CDMRegistryService cache invalidado tras versión publicada

### M6 — Adaptive User Interface
- [ ] SO-33 · Next.js 14 con next-auth PKCE contra Okta: login/logout funcional
- [ ] SO-34 · AI Chat: WebSocket conectado, mensajes respondidos con criticsScore
- [ ] SO-35 · Governance Console: propuestas visibles, approve/reject funcional desde UI
- [ ] SO-36 · Reconexión WebSocket automática < 5s

### Tests E2E
- [ ] SO-37 · P8-E2E-01 Happy Path: 14/14 checkboxes PASS (cero FAIL)
- [ ] SO-38 · P8-E2E-02 Multi-Tenant: 7/7 checkboxes PASS
- [ ] SO-39 · P8-E2E-03 Structural Cycle: 9/9 checkboxes PASS

### Inter-Team Contracts
- [ ] SO-40 · Contrato 01 (M1→M2): SLA latencia verificado en staging
- [ ] SO-41 · Contrato 02 (M2→M3): idempotencia re-delivery verificada
- [ ] SO-42 · Contrato 03 (M3→M2 read): P95 Pinecone < 500ms en staging
- [ ] SO-43 · Contrato 04 (M2 Struct→M4): propuesta aparece < 30s en governance_queue
- [ ] SO-44 · Contrato 05 (M4→M6): P95 API < 500ms GET, < 2s POST

### Calidad & Seguridad
- [ ] SO-45 · Cobertura tests unitarios: ≥ 80% en todos los módulos
- [ ] SO-46 · Cero secrets en código (grep limpio)
- [ ] SO-47 · Cero llamadas REST entre módulos para pipeline events
- [ ] SO-48 · Todos los 6 Grafana dashboards creados y con datos reales
- [ ] SO-49 · Prometheus alerts activos (al menos M1BackpressureActive y KafkaBrokerDown)
- [ ] SO-50 · Pentest básico realizado: no cross-tenant data leaks detectados

### Documentación
- [ ] SO-51 · README.md actualizado con instrucciones de despliegue
- [ ] SO-52 · NEXUS-BUILD-PHASE-1 hasta NEXUS-09 todos presentes en build-plan/
- [ ] SO-53 · Runbook de operaciones en docs/operations/runbook.md
- [ ] SO-54 · API documentation (FastAPI /docs) accesible y completa

---
**Firma CTO InfiniteMind:** _______________________ Fecha: _________

**Firma Lead Architect:** _______________________ Fecha: _________

**Firma Head of Engineering Mentis:** _______________________ Fecha: _________
```

---

## 9. Team Contacts y Escalation Paths

```markdown
## Team Contacts — NEXUS Platform

### Equipos y Responsabilidades

| Equipo | Responsable Principal | Backup | Slack |
|---|---|---|---|
| Platform Infra | Platform Lead | DevOps Engineer | #nexus-infra |
| Data Engineering | Data Lead | Data Engineer | #nexus-m1 |
| AI & Knowledge | ML Lead | ML Engineer | #nexus-ai |
| Backend | Backend Lead | Backend Engineer | #nexus-backend |
| Frontend | Frontend Lead | UI Engineer | #nexus-frontend |

### Escalation Path

**Nivel 1 (Bloqueo técnico < 2h):**
→ Intentar resolver en Slack del equipo + peer review
→ Si no hay solución: mencionar @lead del equipo

**Nivel 2 (Bloqueo > 4h o afecta a otro equipo):**
→ Crear issue con label `blocked` en GitHub
→ Notificar en #nexus-leads
→ Daily standup de 15 minutos adicional

**Nivel 3 (Contrato Inter-Equipo roto):**
→ Notificación INMEDIATA al Lead Architect
→ Post-mortem dentro de 24h
→ Contrato actualizado si se cambió el comportamiento

### Regla de Comunicación de Cambios

Cualquier cambio que afecte un **Contrato Inter-Equipo** requiere:
1. Issue GitHub etiquetado con `breaking-change`
2. 48h de aviso previo (excepto hotfixes de seguridad)
3. Aprobación del Lead del equipo consumidor
4. Actualización del archivo NEXUS-09-E2E-Contracts-SignOff.md

### Calendario Hitos Clave

| Semana | Hito | Criterio de Éxito |
|---|---|---|
| Sem 2 | Phase 0 infra completa | kubectl get pods -A → todos Running |
| Sem 4 | nexus_core + M1 Connectors | 6 conectores con tests pasando |
| Sem 6 | M1 Pipeline completo | E2E-01 pasos 1-6 passing |
| Sem 8 | M3 Writers + M4 Governance | E2E-01 completo (14/14) |
| Sem 10 | M2 RHMA + Structural Cycle | E2E-03 completo (9/9) |
| Sem 12 | M6 UI funcional | Chat + Governance Console operativos |
| Sem 13 | Todos E2E tests PASS | 30/30 checkboxes totales |
| Sem 14 | Sign-Off | 54/54 SO checkboxes — 25 Mayo 2026 |
```

---

*NEXUS Build Plan — Archivo 09 · E2E Tests + Inter-Team Contracts + Sign-Off · Mentis Consulting · Marzo 2026*  
*Este es el documento de cierre del plan de construcción de NEXUS v1.0.0*
