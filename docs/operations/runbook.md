# NEXUS Platform — Runbook de Operaciones v1.0

**Audiencia:** Ingenieros de operaciones, DevOps, on-call engineers  
**Última actualización:** Marzo 2026  
**Slack de soporte:** `#nexus-ops`, `#nexus-alerts`  

> Este runbook cubre los procedimientos de respuesta a incidentes más frecuentes de la plataforma NEXUS. Seguir los pasos en orden antes de escalar.

---

## Tabla de Contenidos

1. [Kafka Broker Down](#1-kafka-broker-down)
2. [Kafka Consumer Lag Crítico](#2-kafka-consumer-lag-crítico)
3. [M1 Backpressure Activo](#3-m1-backpressure-activo)
4. [PostgreSQL Connection Pool Exhausted](#4-postgresql-connection-pool-exhausted)
5. [Pinecone Rate Limit / API Error](#5-pinecone-rate-limit--api-error)
6. [Tenant Onboarding — Temporal Workflow Failed](#6-tenant-onboarding--temporal-workflow-failed)
7. [CDM Version Rollback](#7-cdm-version-rollback)
8. [M2 RHMA Agent — LLM Timeout](#8-m2-rhma-agent--llm-timeout)
9. [MinIO Disk Space High](#9-minio-disk-space-high)
10. [M4 Governance API Down](#10-m4-governance-api-down)
11. [Dead Letter Queue — Mensajes Acumulados](#11-dead-letter-queue--mensajes-acumulados)
12. [Procedimientos de Mantenimiento](#12-procedimientos-de-mantenimiento)

---

## 1. Kafka Broker Down

**Alerta:** `KafkaBrokerDown` (severity: critical)  
**SLA de respuesta:** 15 minutos desde el alert  

### Diagnóstico

```bash
# Ver estado de los pods de Kafka
kubectl get pods -n nexus-data -l app.kubernetes.io/name=kafka

# Ver logs del broker caído
kubectl logs -n nexus-data <broker-pod> --tail=100

# Verificar si hay líderes sin réplica suficiente
kubectl exec -n nexus-data nexus-kafka-kafka-0 -- \
  bin/kafka-topics.sh --bootstrap-server localhost:9092 \
  --describe | grep "Isr:" | awk -F'Isr:' '{print $2}' | sort -u
```

### Pasos de resolución

1. **Si el pod está en CrashLoopBackOff:**
   ```bash
   kubectl describe pod -n nexus-data <broker-pod>
   # Buscar: OOMKilled, disk pressure, network issues
   kubectl delete pod -n nexus-data <broker-pod>
   # K8s reiniciará el pod automáticamente
   ```

2. **Si es un fallo de disco:**
   ```bash
   # Verificar PVC
   kubectl get pvc -n nexus-data
   kubectl describe pvc <pvc-name> -n nexus-data
   # Si está lleno: ampliar PVC o liminar logs antiguos
   kubectl exec -n nexus-data <broker-pod> -- \
     du -sh /var/lib/kafka/data/*
   ```

3. **Si 2/3 brokers están caídos** (pérdida de quórum):
   - Escalar INMEDIATAMENTE a Platform Lead vía Slack `#nexus-leads`.
   - El pipeline queda en pausa hasta recuperar el quórum.
   - No reiniciar brokers en paralelo — hacerlo uno a uno.

4. **Verificar recuperación:**
   ```bash
   kubectl exec -n nexus-data nexus-kafka-kafka-0 -- \
     bin/kafka-broker-api-versions.sh --bootstrap-server localhost:9092
   ```

---

## 2. Kafka Consumer Lag Crítico

**Alerta:** `M1KafkaConsumerLagCritical` (lag > 100,000)  
**Alerta:** `M1KafkaConsumerLagWarning` (lag > 50,000)  

### Diagnóstico

```bash
# Ver lag por consumer group
kubectl exec -n nexus-data nexus-kafka-kafka-0 -- \
  bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 \
  --describe --group m1-connector-workers

# Ver throughput actual del consumer
kubectl top pods -n nexus-app -l app=m1-connector-worker
```

### Pasos de resolución

1. **Verificar si los pods del consumer están corriendo:**
   ```bash
   kubectl get pods -n nexus-app -l app=m1-connector-worker
   ```

2. **Escalar horizontalmente el consumer group:**
   ```bash
   kubectl scale deployment m1-connector-worker -n nexus-app --replicas=6
   # Máximo: número de particiones del topic (por defecto: 12)
   ```

3. **Si el lag persiste tras escalar — verificar backpressure:**
   ```bash
   # Verificar si la BD está saturada
   kubectl exec -n nexus-app -l app=m1-connector-worker -- \
     curl -s http://localhost:9091/metrics | grep backpressure
   ```

4. **Volver a réplicas normales** cuando el lag baje a < 10,000:
   ```bash
   kubectl scale deployment m1-connector-worker -n nexus-app --replicas=3
   ```

---

## 3. M1 Backpressure Activo

**Alerta:** `M1BackpressureActive` (duración > 5 min)  

### Causa raíz habitual

El buffer del `DeltaWriterWorker` superó 50,000 registros porque:
- MinIO está lento o no disponible.
- La BD de destino está saturada.
- El Spark job está retrasado.

### Diagnóstico

```bash
# Ver métricas del worker
kubectl exec -n nexus-app -l app=m1-delta-writer -- \
  wget -qO- http://localhost:9092/metrics | grep m1_delta

# Ver state del buffer
kubectl exec -n nexus-app -l app=m1-delta-writer -- \
  wget -qO- http://localhost:9092/metrics | grep buffer_size
```

### Pasos de resolución

1. **Verificar MinIO disponibilidad:**
   ```bash
   kubectl exec -n nexus-data nexus-minio-0 -- \
     mc admin info local
   ```

2. **Si MinIO está saturado** → ver sección [9. MinIO Disk Space High](#9-minio-disk-space-high).

3. **Forzar flush manual** (en caso de urgencia):
   ```bash
   kubectl exec -n nexus-app -l app=m1-delta-writer -- \
     python -c "from m1.workers.delta_writer_worker import DeltaWriterWorker; ..."
   # Nota: Solo usar si el backpressure lleva > 30 min activo
   ```

4. La backpressure se resuelve automáticamente cuando el buffer baja a < 10,000.

---

## 4. PostgreSQL Connection Pool Exhausted

**Alerta:** `PostgreSQLConnectionPoolExhausted` (> 85% de `max_connections`)  

### Diagnóstico

```bash
# Ver conexiones activas por aplicación
psql $NEXUS_DB_DSN -c "
  SELECT application_name, state, COUNT(*)
  FROM pg_stat_activity
  GROUP BY 1, 2
  ORDER BY 3 DESC
  LIMIT 20
"

# Ver queries bloqueadas
psql $NEXUS_DB_DSN -c "
  SELECT pid, wait_event_type, wait_event, query
  FROM pg_stat_activity
  WHERE wait_event IS NOT NULL
  LIMIT 10
"
```

### Pasos de resolución

1. **Terminar conexiones idle > 30 min:**
   ```sql
   SELECT pg_terminate_backend(pid)
   FROM pg_stat_activity
   WHERE state = 'idle'
     AND state_change < now() - interval '30 minutes'
     AND application_name NOT IN ('pgbouncer', 'nexus-monitor');
   ```

2. **Si pgBouncer está configurado** — reiniciar el pool:
   ```bash
   kubectl rollout restart deployment pgbouncer -n nexus-data
   ```

3. **Ajuste temporal de `max_connections`** (solo si es urgente):
   ```bash
   psql $NEXUS_DB_DSN -c "ALTER SYSTEM SET max_connections = 300"
   psql $NEXUS_DB_DSN -c "SELECT pg_reload_conf()"
   ```

4. **Escalar pods con connection pools** para distribuir carga.

---

## 5. Pinecone Rate Limit / API Error

**Alerta:** `M3VectorWriteErrors` (errores > 0 por 2 min)  

### Diagnóstico

```bash
# Ver logs del orchestrator M3
kubectl logs -n nexus-app -l app=m3-ai-store-orchestrator --tail=50 | \
  grep -i "error\|rate\|limit\|pinecone"

# Ver métricas de errores
kubectl exec -n nexus-app -l app=m3-ai-store-orchestrator -- \
  wget -qO- http://localhost:9097/metrics | grep vector_write_error
```

### Pasos de resolución

1. **Si es `429 Too Many Requests`** — el pod ya tiene backoff exponencial automático. Esperar 5 min.

2. **Si es error de autenticación** (`401 Unauthorized`):
   ```bash
   # Verificar que el secret está sincronizado
   kubectl get secret nexus-pinecone-key -n nexus-app -o yaml | \
     grep api_key
   # Renovar desde AWS SM si expiró:
   kubectl annotate externalsecret nexus-pinecone-key -n nexus-app \
     force-sync=$(date +%s) --overwrite
   ```

3. **Si Pinecone está en outage** — los mensajes van a `m1.int.dead_letter`. Pipeline continúa con Neo4j/TimescaleDB. Ver sección [11. Dead Letter Queue](#11-dead-letter-queue--mensajes-acumulados) para reprocesar cuando vuelva.

---

## 6. Tenant Onboarding — Temporal Workflow Failed

### Diagnóstico

```bash
# Ver workflows en Temporal
# Acceder a Temporal UI: http://temporal-ui.nexus-infra.svc:8080
# Buscar workflow con workflow_type=OnboardingWorkflow y status=Failed

# Ver historial del workflow específico
tctl workflow show --workflow-id onboarding-{tenant_id} --run-id {run_id}
```

### Pasos de resolución

1. **Identificar la Activity que falló** en el historial del workflow.

2. **Si falló `create_kafka_topics`:**
   ```bash
   # Ejecutar manualmente el script
   python scripts/init_kafka_topics.py --tenant-id {tenant_id}
   ```

3. **Si falló `setup_pinecone`** — verificar API key y estado de Pinecone.

4. **Si falló `activate_tenant`:**
   ```bash
   psql $NEXUS_DB_DSN -c "
     UPDATE nexus_system.tenants
     SET status = 'active', activated_at = NOW()
     WHERE tenant_id = '{tenant_id}'
   "
   ```

5. **Re-ejecutar el workflow** (es idempotente):
   ```bash
   tctl workflow start \
     --task-queue nexus-onboarding \
     --workflow-type OnboardingWorkflow \
     --input '"{tenant_id}"'
   ```

---

## 7. CDM Version Rollback

**Cuándo usar:** Una versión de CDM aprobada causa errores en el pipeline (mappings incorrectos, tipos incompatibles).

### Diagnóstico

```bash
# Ver versiones activas
psql $NEXUS_DB_DSN -c "
  SELECT version_id, version_tag, status, created_at
  FROM nexus_system.cdm_versions
  WHERE tenant_id = '{tenant_id}'
  ORDER BY created_at DESC
  LIMIT 5
"
```

### Pasos de rollback

1. **Revertir la versión activa a la anterior:**
   ```sql
   BEGIN;
   -- Desactivar la versión problemática
   UPDATE nexus_system.cdm_versions
   SET status = 'deprecated'
   WHERE tenant_id = '{tenant_id}'
     AND status = 'active'
     AND version_tag = '{bad_version}';

   -- Reactivar la versión anterior
   UPDATE nexus_system.cdm_versions
   SET status = 'active'
   WHERE tenant_id = '{tenant_id}'
     AND version_tag = '{previous_version}';
   COMMIT;
   ```

2. **Forzar invalidación del cache de CDMRegistry:**
   ```bash
   # Publicar nexus.cdm.version_published manualmente
   kubectl exec -n nexus-data nexus-kafka-kafka-0 -- \
     bin/kafka-console-producer.sh \
       --bootstrap-server localhost:9092 \
       --topic nexus.cdm.version_published << EOF
   {"tenant_id":"{tenant_id}","new_version":"{previous_version}","action":"rollback"}
   EOF
   ```

3. **Verificar que el pipeline usa la versión correcta:**
   ```bash
   psql $NEXUS_DB_DSN -c "
     SELECT cdm_version FROM nexus_system.cdm_mappings
     WHERE tenant_id = '{tenant_id}'
     GROUP BY cdm_version
   "
   ```

---

## 8. M2 RHMA Agent — LLM Timeout

**Alerta:** `M2RHMAHighLatency` (P95 > 30s)  

### Diagnóstico

```bash
# Ver logs del runner
kubectl logs -n nexus-app -l app=m2-rhma-runner --tail=100 | \
  grep -i "timeout\|LLM\|anthropic\|latency"

# Verificar conectividad con Anthropic API
kubectl exec -n nexus-app -l app=m2-rhma-runner -- \
  curl -s -o /dev/null -w "%{http_code}" \
    "https://api.anthropic.com/v1/messages" \
    -H "x-api-key: $(cat /var/run/secrets/platform/anthropic/api_key)" \
    -H "Content-Type: application/json" \
    -d '{"model":"claude-3-5-haiku-20241022","max_tokens":1,"messages":[{"role":"user","content":"ping"}]}'
```

### Pasos de resolución

1. **Si Anthropic API está lenta** — los requests ya tienen timeout de 60s con reintento. Esperar normalización.

2. **Si el API key está inválido** — renovar desde Anthropic Console y actualizar el secret:
   ```bash
   kubectl create secret generic nexus-anthropic-key \
     --from-literal=api_key='{new_key}' \
     -n nexus-app --dry-run=client -o yaml | kubectl apply -f -
   kubectl rollout restart deployment m2-rhma-runner -n nexus-app
   ```

3. **Como fallback temporal** — cambiar a `claude-3-5-haiku-20241022` para RHMA también (más rápido):
   ```bash
   kubectl set env deployment/m2-rhma-runner \
     RHMA_LLM_MODEL=claude-3-5-haiku-20241022 \
     -n nexus-app
   ```

---

## 9. MinIO Disk Space High

**Alerta:** `MinIODiskUsageHigh` (> 80%)  

### Diagnóstico

```bash
# Ver uso por bucket
kubectl exec -n nexus-data nexus-minio-0 -- \
  mc du --depth 2 local/

# Ver archivos más grandes
kubectl exec -n nexus-data nexus-minio-0 -- \
  mc ls --recursive local/nexus-delta/ | sort -k5 -rn | head -20
```

### Pasos de resolución

1. **Limpiar Delta Lake de versiones antiguas** (retención: 30 días por defecto):
   ```bash
   # Para cada tenant
   kubectl exec -n nexus-data nexus-minio-0 -- \
     mc rm --recursive --force \
       --older-than 30d \
       local/nexus-delta/{tenant_id}/raw/
   ```

2. **Aplicar política de lifecycle a MinIO:**
   ```bash
   kubectl exec -n nexus-data nexus-minio-0 -- \
     mc ilm add \
       --expiry-days 90 \
       local/nexus-delta
   ```

3. **Si el espacio sigue crítico (> 90%)** — ampliar el PVC:
   ```bash
   kubectl patch pvc nexus-minio-data -n nexus-data \
     -p '{"spec":{"resources":{"requests":{"storage":"500Gi"}}}}'
   ```

---

## 10. M4 Governance API Down

### Diagnóstico

```bash
kubectl get pods -n nexus-app -l app=m4-governance-api
kubectl logs -n nexus-app -l app=m4-governance-api --tail=50

# Verificar health endpoint
kubectl exec -n nexus-app <any-pod> -- \
  wget -qO- http://m4-governance-api.nexus-app.svc:8000/health
```

### Pasos de resolución

1. **Reiniciar los pods:**
   ```bash
   kubectl rollout restart deployment m4-governance-api -n nexus-app
   kubectl rollout status deployment m4-governance-api -n nexus-app
   ```

2. **Si falla por problema de DB:**
   ```bash
   # Verificar conectividad a PostgreSQL desde el pod
   kubectl exec -n nexus-app -l app=m4-governance-api -- \
     python -c "import asyncpg, asyncio, os; asyncio.run(asyncpg.connect(os.environ['NEXUS_DB_DSN']))"
   ```

3. **Si el error es `too many connections`** → ver sección [4. PostgreSQL Connection Pool Exhausted](#4-postgresql-connection-pool-exhausted).

---

## 11. Dead Letter Queue — Mensajes Acumulados

**Topic:** `m1.int.dead_letter`  

### Diagnóstico

```bash
# Ver cantidad de mensajes en dead_letter
kubectl exec -n nexus-data nexus-kafka-kafka-0 -- \
  bin/kafka-run-class.sh kafka.tools.GetOffsetShell \
    --bootstrap-server localhost:9092 \
    --topic m1.int.dead_letter \
    --time -1

# Ver contenido de los mensajes
kubectl exec -n nexus-data nexus-kafka-kafka-0 -- \
  bin/kafka-console-consumer.sh \
    --bootstrap-server localhost:9092 \
    --topic m1.int.dead_letter \
    --max-messages 5 \
    --from-beginning | python3 -m json.tool
```

### Pasos de resolución

1. **Identificar la causa del rechazo** en el campo `error` del mensaje.

2. **Si la causa está resuelta** (ej: Pinecone volvió, error transitorio), republicar al topic original:
   ```bash
   # Script de replay
   kubectl exec -n nexus-data nexus-kafka-kafka-0 -- \
     bin/kafka-console-consumer.sh \
       --bootstrap-server localhost:9092 \
       --topic m1.int.dead_letter \
       --from-beginning | \
     kubectl exec -i -n nexus-data nexus-kafka-kafka-0 -- \
       bin/kafka-console-producer.sh \
         --bootstrap-server localhost:9092 \
         --topic m1.int.ai_routing_decided
   ```

3. **Si los mensajes son irrecuperables** → archivar en S3 y limpiar el topic.

---

## 12. Procedimientos de Mantenimiento

### Actualización de imagen de un módulo

```bash
# 1. Construir la nueva imagen
docker build -t nexus-m4-governance:v1.1.0 -f Dockerfile.m4 .
docker push nexus-registry/nexus-m4-governance:v1.1.0

# 2. Actualizar el deployment con rolling update (0 downtime)
kubectl set image deployment/m4-governance-api \
  governance-api=nexus-registry/nexus-m4-governance:v1.1.0 \
  -n nexus-app

# 3. Monitorear el rollout
kubectl rollout status deployment/m4-governance-api -n nexus-app

# 4. Si hay problemas — rollback inmediato
kubectl rollout undo deployment/m4-governance-api -n nexus-app
```

### Crear nuevo tenant manualmente (sin Temporal)

```bash
# 1. Insertar en BD
psql $NEXUS_DB_DSN << EOF
INSERT INTO nexus_system.tenants (tenant_id, plan, status, created_at)
VALUES ('{tenant_id}', 'starter', 'provisioning', NOW());
EOF

# 2. Crear topics Kafka
python nexus-python-platform/scripts/init_kafka_topics.py \
  --tenant-id {tenant_id}

# 3. Activar tenant
psql $NEXUS_DB_DSN -c "
  UPDATE nexus_system.tenants
  SET status = 'active', activated_at = NOW()
  WHERE tenant_id = '{tenant_id}'
"
```

### Backup manual de PostgreSQL

```bash
kubectl exec -n nexus-data nexus-postgres-0 -- \
  pg_dump -U postgres nexus_db | \
  gzip > nexus_db_backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Comprobación de salud del sistema (health check completo)

```bash
#!/usr/bin/env bash
# Ejecutar antes de cualquier mantenimiento mayor
echo "=== NEXUS Health Check ==="
echo ""

echo "Kafka brokers:"
kubectl get pods -n nexus-data -l app.kubernetes.io/name=kafka -o wide

echo ""
echo "PostgreSQL:"
kubectl get pods -n nexus-data -l app=nexus-postgres -o wide

echo ""
echo "Módulos activos:"
kubectl get pods -n nexus-app -o wide

echo ""
echo "Consumer groups lag:"
kubectl exec -n nexus-data nexus-kafka-kafka-0 -- \
  bin/kafka-consumer-groups.sh \
    --bootstrap-server localhost:9092 \
    --describe --all-groups 2>/dev/null | \
  grep -v "^GROUP\|^$" | \
  awk '$6 > 1000 {print "⚠️  HIGH LAG:", $0}'

echo ""
echo "=== Health Check completado ==="
```

---

*NEXUS Operations Runbook v1.0 — Mentis Consulting — Marzo 2026*  
*Próxima revisión: post sign-off, Mayo 2026*
