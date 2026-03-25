# NEXUS — E2E Test Checklists

**Referencia de ejecución:** `scripts/run_e2e.sh`  
**Comando completo:** `./scripts/run_e2e.sh --suite all`  

---

## P8-E2E-01: Happy Path — Sync Completo de Tenant

**Objetivo:** Un tenant existente completa un ciclo completo de sync, los datos fluyen por todo el pipeline y son accesibles desde M4 y M6.

**Prerequisitos:**
- Tenants `test-alpha` y `test-beta` activos en BD
- Todos los pods `Running` en namespace `nexus-app`
- Kafka operativo con 18 topics

### Checklist

- [ ] **E2E-01-1** — `GET /api/v1/connectors?tenant=test-alpha` devuelve status 200 y al menos un conector activo
  ```bash
  curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $TOKEN" \
    "http://localhost:3000/api/v1/connectors?tenant=test-alpha" | grep 200
  ```

- [ ] **E2E-01-2** — Trigger manual de sync publica mensaje en `m1.int.ai_routing_decided` dentro de 2 minutos
  ```bash
  bin/kafka-console-consumer.sh --bootstrap-server $KAFKA --topic m1.int.ai_routing_decided \
    --max-messages 1 --timeout-ms 120000
  ```

- [ ] **E2E-01-3** — El mensaje en `m1.int.ai_routing_decided` contiene `tenant_id`, `entity_type` no nulo y `correlation_id`
  ```bash
  # Verificar estructura del mensaje consumido
  ```

- [ ] **E2E-01-4** — M3 escribe en Pinecone: el vector_id `test-alpha#{source_record_id}` existe
  ```bash
  python -c "
  import pinecone; pc = pinecone.Pinecone(api_key='$PINECONE_API_KEY')
  idx = pc.Index('nexus-test-alpha-party')
  print(idx.describe_index_stats())
  "
  ```

- [ ] **E2E-01-5** — M3 escribe en Neo4j: nodo con label `Tenant_test-alpha` creado
  ```bash
  cypher-shell -a $NEO4J_URI \
    "MATCH (n:Tenant_test-alpha) RETURN count(n) AS cnt" | grep -v "^0$"
  ```

- [ ] **E2E-01-6** — `GET /api/governance/v1/proposals?tenant=test-alpha` devuelve 200 con al menos una propuesta
  ```bash
  curl -s -o /dev/null -w "%{http_code}" \
    -H "X-Tenant-ID: test-alpha" -H "Authorization: Bearer $TOKEN" \
    "http://localhost:8000/api/governance/v1/proposals?tenant=test-alpha" | grep 200
  ```

- [ ] **E2E-01-7** — `POST /api/governance/v1/proposals/{proposal_id}/approve` devuelve 200 y status cambia a `approved`
  ```bash
  # Requiere proposal_id de E2E-01-6
  ```

- [ ] **E2E-01-8** — Tras aprobación, `nexus.cdm.version_published` recibe un mensaje dentro de 30 segundos
  ```bash
  bin/kafka-console-consumer.sh --bootstrap-server $KAFKA \
    --topic nexus.cdm.version_published --max-messages 1 --timeout-ms 30000
  ```

- [ ] **E2E-01-9** — CDMRegistry invalida el cache en < 5 minutos (log visible)
  ```bash
  kubectl logs -n nexus-app -l app=m1-connector-worker --tail=100 | \
    grep "cache invalidated"
  ```

- [ ] **E2E-01-10** — `GET /api/governance/v1/proposals/{proposal_id}` devuelve el campo `cdm_version` actualizado
  ```bash
  # Verificar que la versión CDM nueva está reflejada en la propuesta aprobada
  ```

- [ ] **E2E-01-11** — La UI Angular (`/cdm-governance`) muestra el campo `status: approved` para la propuesta aprobada
  - Verificación manual: Acceder a `/cdm-governance` → propuesta → inspeccionar status

- [ ] **E2E-01-12** — Los logs de M2 RHMA muestran `criticsScore > 0.7` en la última ejecución
  ```bash
  kubectl logs -n nexus-app -l app=m2-rhma-runner --tail=50 | \
    grep "critics_score" | tail -5
  ```

- [ ] **E2E-01-13** — ⚠️ MANUAL: El chat WebSocket en `/ask-nexus` devuelve respuesta coherente con datos del tenant
  - Verificación manual: Abrir UI → `/ask-nexus` → enviar pregunta → verificar respuesta incluye datos reales

- [ ] **E2E-01-14** — ⚠️ MANUAL: El `correlation_id` está presente en logs de M1, M2, M3 y M4 para el mismo ciclo de sync
  - Verificación manual: Buscar el UUID en Jaeger distributed tracing

**Script:** `./scripts/run_e2e.sh --suite e2e01`  
**Target:** 12 automatizados PASS + 2 manuales verificados  

---

## P8-E2E-02: Multi-Tenant Isolation

**Objetivo:** Verificar que `test-alpha` y `test-beta` no comparten datos bajo ninguna circunstancia. El aislamiento aplica en Kafka, PostgreSQL (RLS), Pinecone y Neo4j.

**Prerequisitos:**
- `test-alpha` con ≥ 100 registros sync
- `test-beta` con ≥ 50 registros sync (datos distintos a los de alpha)

### Checklist

- [ ] **E2E-02-1** — Los topics de Kafka de `test-alpha` NO contienen mensajes con `tenant_id = "test-beta"`
  ```bash
  bin/kafka-console-consumer.sh --bootstrap-server $KAFKA \
    --topic "test-alpha.cdm.entity_classified" \
    --max-messages 20 --from-beginning | \
    python3 -c "import sys,json; [print('FAIL') for l in sys.stdin if json.loads(l).get('tenant_id') != 'test-alpha']"
  ```

- [ ] **E2E-02-2** — RLS PostgreSQL: query con `SET app.current_tenant = 'test-alpha'` NO devuelve filas de `test-beta`
  ```bash
  psql $NEXUS_DB_DSN -c "
    SET app.current_tenant = 'test-alpha';
    SELECT COUNT(*) FROM nexus_system.cdm_mappings
    WHERE tenant_id != 'test-alpha'
  " | grep " 0"
  ```

- [ ] **E2E-02-3** — RLS PostgreSQL: query con `SET app.current_tenant = 'test-beta'` devuelve SOLO datos de `test-beta`
  ```bash
  psql $NEXUS_DB_DSN -c "
    SET app.current_tenant = 'test-beta';
    SELECT DISTINCT tenant_id FROM nexus_system.cdm_mappings LIMIT 5
  " | grep -v "test-beta" | grep -v "^-\|^(\|^tenant_id" | wc -l | grep "^0$"
  ```

- [ ] **E2E-02-4** — Pinecone: index de `test-alpha` (`nexus-test-alpha-party`) no devuelve vectores al consultar con metadata `tenant_id: test-beta`
  ```bash
  python -c "
  import pinecone; pc = pinecone.Pinecone(api_key='$PINECONE_API_KEY')
  idx = pc.Index('nexus-test-alpha-party')
  r = idx.query(vector=[0]*384, top_k=1, filter={'tenant_id': 'test-beta'})
  print('PASS' if len(r.matches) == 0 else 'FAIL')
  "
  ```

- [ ] **E2E-02-5** — Neo4j: query con filtro `Tenant_test-alpha` NO devuelve nodos con `tenant_id: test-beta`
  ```bash
  cypher-shell -a $NEO4J_URI \
    "MATCH (n:Tenant_test-alpha) WHERE n.tenant_id <> 'test-alpha' RETURN count(n)"
  # Esperado: 0
  ```

- [ ] **E2E-02-6** — API M4: `GET /proposals` con `X-Tenant-ID: test-alpha` NO devuelve propuestas de `test-beta`
  ```bash
  curl -s -H "X-Tenant-ID: test-alpha" -H "Authorization: Bearer $TOKEN_ALPHA" \
    "http://localhost:8000/api/governance/v1/proposals" | \
    python3 -c "import sys,json; data=json.load(sys.stdin); print('PASS' if all(p['tenant_id']=='test-alpha' for p in data.get('proposals',[])) else 'FAIL')"
  ```

- [ ] **E2E-02-7** — ⚠️ MANUAL: Intentar acceder con token de `test-alpha` al endpoint de `test-beta` → debe devolver 403
  ```bash
  curl -s -o /dev/null -w "%{http_code}" \
    -H "X-Tenant-ID: test-beta" -H "Authorization: Bearer $TOKEN_ALPHA" \
    "http://localhost:8000/api/governance/v1/proposals" | grep 403
  ```

**Script:** `./scripts/run_e2e.sh --suite e2e02`  
**Target:** 6 automatizados PASS + 1 manual verificado  

---

## P8-E2E-03: Structural Cycle End-to-End

**Objetivo:** Agregar una columna nueva a la BD fuente de `test-alpha` y verificar que el ciclo de detección → LLM → propuesta → aprobación → nueva versión CDM funciona de extremo a extremo.

**Duración estimada:** 20-30 minutos  
**Prerequisitos:**
- Acceso de escritura a la BD fuente de `test-alpha`
- M2 Structural Agent corriendo
- M4 Governance API disponible

### Checklist

- [ ] **E2E-03-1** — Agregar nueva columna a tabla fuente de `test-alpha` y verificar que `SchemaProfiler` detecta el cambio en < 5 min
  ```bash
  psql $SOURCE_DB -c "ALTER TABLE test_customers ADD COLUMN loyalty_score NUMERIC(5,2)"
  # Esperar 5 min y verificar:
  bin/kafka-console-consumer.sh --bootstrap-server $KAFKA \
    --topic m1.int.structural_cycle_triggered --max-messages 1 --timeout-ms 300000
  ```

- [ ] **E2E-03-2** — `m1.int.structural_cycle_triggered` contiene `tenant_id = "test-alpha"` y el nombre de la nueva columna
  ```bash
  # Verificar que el mensaje contiene 'loyalty_score'
  ```

- [ ] **E2E-03-3** — `SchemaDriftDetector` detecta drift tipo `new_field` para `loyalty_score`
  ```bash
  kubectl logs -n nexus-app -l app=m2-schema-drift-detector --tail=30 | \
    grep "new_field\|loyalty_score"
  ```

- [ ] **E2E-03-4** — `StructuralAgent` llama a Claude y genera una propuesta de mapping con `confidence > 0.5`
  ```bash
  kubectl logs -n nexus-app -l app=m2-structural-agent --tail=30 | \
    grep "LLM\|confidence\|proposal"
  ```

- [ ] **E2E-03-5** — La propuesta aparece en `governance_queue` con status `pending` en < 30s
  ```bash
  psql $NEXUS_DB_DSN -c "
    SELECT proposal_id, status, confidence_overall, created_at
    FROM nexus_system.governance_queue
    WHERE tenant_id = 'test-alpha'
    ORDER BY created_at DESC
    LIMIT 1
  " | grep "pending"
  ```

- [ ] **E2E-03-6** — Aprobar la propuesta vía API y verificar que `nexus.cdm.version_published` recibe el mensaje
  ```bash
  # Aprobar:
  curl -s -X POST -H "X-Tenant-ID: test-alpha" -H "Authorization: Bearer $TOKEN" \
    "http://localhost:8000/api/governance/v1/proposals/$PROPOSAL_ID/approve"
  # Verificar topic:
  bin/kafka-console-consumer.sh --bootstrap-server $KAFKA \
    --topic nexus.cdm.version_published --max-messages 1 --timeout-ms 60000 | \
    python3 -m json.tool
  ```

- [ ] **E2E-03-7** — ⚠️ MANUAL: La nueva versión CDM aparece en la tabla `nexus_system.cdm_versions`
  ```bash
  psql $NEXUS_DB_DSN -c "
    SELECT version_tag, status, created_at
    FROM nexus_system.cdm_versions
    WHERE tenant_id = 'test-alpha'
    ORDER BY created_at DESC LIMIT 3
  "
  # Verificar que hay una nueva entrada con status='active'
  ```

- [ ] **E2E-03-8** — ⚠️ MANUAL: El siguiente sync usa la nueva versión CDM (verificar en logs de CDMMapper)
  ```bash
  kubectl logs -n nexus-app -l app=m1-connector-worker --tail=50 | \
    grep "cdm_version" | tail -3
  # Debe mostrar la nueva versión
  ```

- [ ] **E2E-03-9** — ⚠️ MANUAL: El campo `loyalty_score` aparece en el siguiente registro vectorizado en Pinecone (en el texto embebido)
  ```bash
  python -c "
  import pinecone; pc = pinecone.Pinecone(api_key='$PINECONE_API_KEY')
  idx = pc.Index('nexus-test-alpha-party')
  r = idx.fetch(['test-alpha#<latest-record-id>'])
  print(r.vectors)
  "
  # Verificar que loyalty_score está en los metadatos o en el texto embebido
  ```

**Script:** `./scripts/run_e2e.sh --suite e2e03`  
**Target:** 6 automatizados PASS + 3 manuales verificados  

---

## Ejecución Automatizada

```bash
# Suite completa
./scripts/run_e2e.sh --suite all

# Suite individual
./scripts/run_e2e.sh --suite e2e01
./scripts/run_e2e.sh --suite e2e02
./scripts/run_e2e.sh --suite e2e03
```

### Variables de entorno requeridas

```bash
export KAFKA="nexus-kafka.nexus-data.svc:9092"
export NEXUS_DB_DSN="postgresql://postgres:postgres@nexus-postgres.nexus-data.svc:5432/nexus_db"
export NEO4J_URI="bolt://neo4j.nexus-data.svc:7687"
export PINECONE_API_KEY="$(kubectl get secret nexus-pinecone-key -n nexus-app -o jsonpath='{.data.api_key}' | base64 -d)"
export TOKEN="$(./scripts/get_test_token.sh test-alpha)"        # Token auth de test-alpha
export TOKEN_ALPHA="$TOKEN"
```

### Resultados esperados

| Suite | Automatizados | Manuales | Total |
|---|---|---|---|
| E2E-01 | 12 PASS | 2 verificados | 14/14 |
| E2E-02 | 6 PASS | 1 verificado | 7/7 |
| E2E-03 | 6 PASS | 3 verificados | 9/9 |
| **Total** | **24 PASS** | **6 verificados** | **30/30** |

---

*NEXUS E2E Test Checklists — v1.0 — Mentis Consulting — Marzo 2026*
