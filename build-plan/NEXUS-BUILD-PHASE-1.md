# NEXUS — Plan de Construcción · FASE 1
## Infraestructura + `nexus_core` + CDM Registry
### Semanas 1–3 · DevOps + Tech Lead · HARD GATE para todo el proyecto
**Mentis Consulting · Marzo 2026 · Confidencial**

---

> ⛔ **REGLA ABSOLUTA:** Ningún equipo escribe código de aplicación hasta que cada tarea de esta fase
> pase sus acceptance criteria al 100%. Este documento es un GATE, no una guía.

---

## Tabla de Contenidos

1. [Contexto y Dependencias](#1-contexto-y-dependencias)
2. [Arquitectura de Namespaces Kubernetes](#2-arquitectura-de-namespaces-kubernetes)
3. [P0-INFRA-01 — Kubernetes Namespaces & RBAC](#3-p0-infra-01--kubernetes-namespaces--rbac)
4. [P0-INFRA-02 — Kafka Cluster (Strimzi)](#4-p0-infra-02--kafka-cluster-strimzi)
5. [P0-INFRA-03 — PostgreSQL 15 + Redis 7](#5-p0-infra-03--postgresql-15--redis-7)
6. [P0-INFRA-04 — MinIO (Delta Lake Storage)](#6-p0-infra-04--minio-delta-lake-storage)
7. [P0-INFRA-05 — Kong API Gateway](#7-p0-infra-05--kong-api-gateway)
8. [P0-INFRA-06 — Apache Airflow 2.8+](#8-p0-infra-06--apache-airflow-28)
9. [P0-INFRA-07 — Spark 3.4+ Standalone Cluster](#9-p0-infra-07--spark-34-standalone-cluster)
10. [P0-INFRA-08 — External Secrets Operator](#10-p0-infra-08--external-secrets-operator)
11. [P0-INFRA-09 — Observability Stack Completo](#11-p0-infra-09--observability-stack-completo)
12. [LEAD-00 — Tenant Provisioning Workflow](#12-lead-00--tenant-provisioning-workflow)
13. [LEAD-01 — PostgreSQL Row-Level Security](#13-lead-01--postgresql-row-level-security)
14. [LEAD-02 — Okta OIDC + Kong JWT Config](#14-lead-02--okta-oidc--kong-jwt-config)
15. [P1-CORE-01 — nexus_core: NexusMessage + Producer + Consumer](#15-p1-core-01--nexus_core-nexusmessage--producer--consumer)
16. [P1-CORE-02 — nexus_core: TenantContext + TopicNamer](#16-p1-core-02--nexus_core-tenantcontext--topicnamer)
17. [P1-CORE-03 — nexus_core: CDMRegistryService](#17-p1-core-03--nexus_core-cdmregistryservice)
18. [Estructura Completa del Paquete nexus_core](#18-estructura-completa-del-paquete-nexus_core)
19. [Verificación de Fase 1 Completa](#19-verificación-de-fase-1-completa)
20. [Definition of Done Universal](#20-definition-of-done-universal)

---

## 1. Contexto y Dependencias

### Por qué esta fase existe

NEXUS es una plataforma multi-tenant donde 4 equipos trabajan en paralelo sobre 6 módulos.
Sin una base de infraestructura compartida y una librería de contratos común, cada equipo
resuelve los mismos problemas de forma diferente y la integración falla en la semana 7.

### Lo que se construye en esta fase

| Componente | Responsable | Días |
|---|---|---|
| Kubernetes (4 namespaces + RBAC + network policies) | DevOps | Día 1–2 |
| Kafka Cluster (Strimzi 3 brokers + 18 topics) | DevOps | Día 2–4 |
| PostgreSQL 15 + Redis 7 + DDL completo | DevOps | Día 2–4 |
| MinIO + 3 buckets Delta Lake | DevOps | Día 2–4 |
| Kong API Gateway + 3 plugins globales | DevOps | Día 3–5 |
| Apache Airflow 2.8+ | DevOps | Día 4–6 |
| Spark 3.4+ standalone | DevOps | Día 4–6 |
| External Secrets Operator → AWS Secrets Manager | DevOps | Día 3–4 |
| Prometheus + Grafana + Loki + Jaeger | DevOps | Día 5–7 |
| Tabla `nexus_system.tenants` + `onboard_tenant.py` | Tech Lead | Día 1–3 |
| PostgreSQL RLS en todas las tablas | Tech Lead | Día 3–4 |
| Okta dev org + OIDC config + Kong JWT | Tech Lead | Día 5–8 |
| `nexus_core` librería completa | Tech Lead + Backend-M1 | Semana 2–3 |

### Dependencias externas requeridas antes del Día 1

- [ ] Cuenta AWS activa con permisos EKS, Secrets Manager, S3, IAM
- [ ] `kubectl` configurado contra el cluster EKS de dev
- [ ] Cuenta Okta developer registrada en `developer.okta.com`
- [ ] Repositorio Git `nexus-platform/` creado en GitHub/GitLab
- [ ] Acceso a Pinecone (para Phase 2 — se configura ahora el account)
- [ ] Acceso a Neo4j AuraDB (para Phase 2)
- [ ] Acceso a TimescaleDB (RDS o managed)

---

## 2. Arquitectura de Namespaces Kubernetes

### Topología de red

```
┌─────────────────── AWS EKS Cluster ─────────────────────────┐
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  nexus-infra                                          │   │
│  │  Kong · cert-manager · External Secrets Operator     │   │
│  │  [Solo este namespace puede modificar Kong config]    │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ↑↓ service ports only               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  nexus-data                                           │   │
│  │  Kafka (Strimzi) · PostgreSQL · Redis                 │   │
│  │  Airflow · Spark Master/Workers                       │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ↑↓ S3A endpoint only                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  nexus-storage                                        │   │
│  │  MinIO (nexus-raw · nexus-classified · nexus-cdm)    │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ↑↓ defined service ports only       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  nexus-app                                            │   │
│  │  M1 workers · M2 agents · M3 writers                  │   │
│  │  M4 FastAPI · M6 Next.js                              │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### Reglas de red estrictas

- Un pod en `nexus-app` NO puede hacer `kubectl exec` en un pod de `nexus-data`
- Un pod en `nexus-app` SOLO puede alcanzar `nexus-data` en puertos de servicio definidos
- NINGÚN pod fuera de `nexus-infra` puede modificar la configuración de Kong
- Los pods en `nexus-storage` solo son alcanzables vía el endpoint S3A en puerto 9000

---

## 3. P0-INFRA-01 — Kubernetes Namespaces & RBAC

**Owner:** DevOps
**Depende de:** Nada — PRIMERA tarea del proyecto
**Duración:** Día 1, máximo Día 2

### Manifiestos Kubernetes

#### namespaces.yaml
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: nexus-infra
  labels:
    project: nexus
    tier: platform
---
apiVersion: v1
kind: Namespace
metadata:
  name: nexus-data
  labels:
    project: nexus
    tier: data
---
apiVersion: v1
kind: Namespace
metadata:
  name: nexus-storage
  labels:
    project: nexus
    tier: storage
---
apiVersion: v1
kind: Namespace
metadata:
  name: nexus-app
  labels:
    project: nexus
    tier: application
```

#### network-policies.yaml
```yaml
# Permitir nexus-app → nexus-data solo en puertos definidos
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-app-to-data
  namespace: nexus-data
spec:
  podSelector: {}
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          project: nexus
          tier: application
    ports:
    - port: 5432   # PostgreSQL
    - port: 6379   # Redis
    - port: 9092   # Kafka
    - port: 7077   # Spark
    - port: 8080   # Airflow API
---
# Permitir nexus-app → nexus-storage solo en puerto S3A
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-app-to-storage
  namespace: nexus-storage
spec:
  podSelector: {}
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          tier: application
    - namespaceSelector:
        matchLabels:
          tier: data
    ports:
    - port: 9000   # MinIO S3A
    - port: 9001   # MinIO Console
---
# Bloquear acceso directo entre nexus-app y nexus-infra (solo vía Kong)
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-direct-infra-access
  namespace: nexus-infra
spec:
  podSelector:
    matchLabels:
      app: kong
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          tier: application
    ports:
    - port: 8000   # Kong proxy
```

#### rbac.yaml
```yaml
# ServiceAccount para pods de nexus-app
apiVersion: v1
kind: ServiceAccount
metadata:
  name: nexus-app-sa
  namespace: nexus-app
---
# Role: leer secrets en nexus-app, NO en otros namespaces
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: nexus-app-role
  namespace: nexus-app
rules:
- apiGroups: [""]
  resources: ["secrets"]
  verbs: ["get", "list"]
- apiGroups: [""]
  resources: ["configmaps"]
  verbs: ["get", "list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: nexus-app-binding
  namespace: nexus-app
subjects:
- kind: ServiceAccount
  name: nexus-app-sa
  namespace: nexus-app
roleRef:
  kind: Role
  apiGroup: rbac.authorization.k8s.io
  name: nexus-app-role
---
# ServiceAccount para Airflow (necesita SparkSubmit y leer Kafka offsets)
apiVersion: v1
kind: ServiceAccount
metadata:
  name: airflow-sa
  namespace: nexus-data
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: airflow-spark-role
rules:
- apiGroups: ["sparkoperator.k8s.io"]
  resources: ["sparkapplications"]
  verbs: ["create", "get", "list", "watch", "delete", "patch"]
- apiGroups: [""]
  resources: ["pods", "pods/log"]
  verbs: ["get", "list", "watch"]
```

### Acceptance Criteria P0-INFRA-01

```bash
# 1. Todos los namespaces activos
kubectl get namespaces -l project=nexus
# Expected: nexus-infra · nexus-data · nexus-storage · nexus-app · STATUS: Active

# 2. Network policy activa — pod en nexus-app no puede llegar a nexus-data en puerto no definido
kubectl run test-pod --image=busybox --restart=Never -n nexus-app \
  -- wget -qO- nexus-postgres.nexus-data.svc.cluster.local:5431
# Expected: Connection refused (puerto 5431 no está permitido)

# 3. Puerto correcto sí funciona
kubectl run test-pod2 --image=postgres:15 --restart=Never -n nexus-app \
  -- pg_isready -h nexus-postgres.nexus-data.svc.cluster.local -p 5432
# Expected: accepting connections

# 4. Labels correctos
kubectl get namespace nexus-infra -o jsonpath='{.metadata.labels}'
# Expected: {"project":"nexus","tier":"platform",...}
```

---

## 4. P0-INFRA-02 — Kafka Cluster (Strimzi)

**Owner:** DevOps
**Depende de:** P0-INFRA-01
**Duración:** Día 2–4

### Instalación Strimzi Operator

```bash
# Instalar Strimzi Operator en nexus-data
kubectl create -f 'https://strimzi.io/install/latest?namespace=nexus-data' -n nexus-data

# Verificar operator running
kubectl get pods -n nexus-data -l strimzi.io/kind=cluster-operator
```

### Manifiesto del Kafka Cluster

```yaml
# kafka-cluster.yaml
apiVersion: kafka.strimzi.io/v1beta2
kind: Kafka
metadata:
  name: nexus-kafka
  namespace: nexus-data
spec:
  kafka:
    version: 3.6.0
    replicas: 3
    listeners:
      - name: plain
        port: 9092
        type: internal
        tls: false
      - name: tls
        port: 9093
        type: internal
        tls: true
    config:
      offsets.topic.replication.factor: 2
      transaction.state.log.replication.factor: 2
      transaction.state.log.min.isr: 1
      default.replication.factor: 2
      min.insync.replicas: 1
      num.partitions: 4
      log.retention.hours: 168
      auto.create.topics.enable: "false"
      log.message.format.version: "3.6"
    storage:
      type: persistent-claim
      size: 100Gi
      class: gp3
    metricsConfig:
      type: jmxPrometheusExporter
      valueFrom:
        configMapKeyRef:
          name: kafka-metrics-config
          key: kafka-metrics-config.yml
  zookeeper:
    replicas: 3
    storage:
      type: persistent-claim
      size: 10Gi
      class: gp3
  entityOperator:
    topicOperator: {}
    userOperator: {}
```

### Los 18 Topics Estáticos (crear TODOS antes de que arranque ningún worker)

```yaml
# kafka-topics.yaml — Todos los topics estáticos de la plataforma
# NOTA: Los topics por-tenant ({tid}.m1.*, etc.) los crea onboard_tenant.py dinámicamente

apiVersion: kafka.strimzi.io/v1beta2
kind: KafkaTopic
metadata:
  name: m1-int-structural-cycle-triggered
  namespace: nexus-data
  labels:
    strimzi.io/cluster: nexus-kafka
spec:
  partitions: 4
  replicas: 2
  config:
    retention.ms: 604800000  # 7 días
---
apiVersion: kafka.strimzi.io/v1beta2
kind: KafkaTopic
metadata:
  name: m1-int-source-schema-extracted
  namespace: nexus-data
  labels:
    strimzi.io/cluster: nexus-kafka
spec:
  partitions: 4
  replicas: 2
  config:
    retention.ms: 1209600000  # 14 días
---
apiVersion: kafka.strimzi.io/v1beta2
kind: KafkaTopic
metadata:
  name: m1-int-sync-requested
  namespace: nexus-data
  labels:
    strimzi.io/cluster: nexus-kafka
spec:
  partitions: 4
  replicas: 2
  config:
    retention.ms: 604800000  # 7 días
---
apiVersion: kafka.strimzi.io/v1beta2
kind: KafkaTopic
metadata:
  name: m1-int-raw-records
  namespace: nexus-data
  labels:
    strimzi.io/cluster: nexus-kafka
spec:
  partitions: 16      # MÁS particiones — alto volumen
  replicas: 2
  config:
    retention.ms: 259200000  # 3 días
---
apiVersion: kafka.strimzi.io/v1beta2
kind: KafkaTopic
metadata:
  name: m1-int-delta-batch-ready
  namespace: nexus-data
  labels:
    strimzi.io/cluster: nexus-kafka
spec:
  partitions: 4
  replicas: 2
  config:
    retention.ms: 604800000
---
apiVersion: kafka.strimzi.io/v1beta2
kind: KafkaTopic
metadata:
  name: m1-int-classified-records
  namespace: nexus-data
  labels:
    strimzi.io/cluster: nexus-kafka
spec:
  partitions: 8
  replicas: 2
  config:
    retention.ms: 259200000  # 3 días
---
apiVersion: kafka.strimzi.io/v1beta2
kind: KafkaTopic
metadata:
  name: m1-int-cdm-entities-ready
  namespace: nexus-data
  labels:
    strimzi.io/cluster: nexus-kafka
spec:
  partitions: 8
  replicas: 2
  config:
    retention.ms: 604800000
---
apiVersion: kafka.strimzi.io/v1beta2
kind: KafkaTopic
metadata:
  name: m1-int-ai-routing-decided
  namespace: nexus-data
  labels:
    strimzi.io/cluster: nexus-kafka
spec:
  partitions: 4
  replicas: 2
  config:
    retention.ms: 604800000
---
apiVersion: kafka.strimzi.io/v1beta2
kind: KafkaTopic
metadata:
  name: m1-int-ai-write-completed
  namespace: nexus-data
  labels:
    strimzi.io/cluster: nexus-kafka
spec:
  partitions: 4
  replicas: 2
  config:
    retention.ms: 1209600000  # 14 días
---
apiVersion: kafka.strimzi.io/v1beta2
kind: KafkaTopic
metadata:
  name: m1-int-sync-failed
  namespace: nexus-data
  labels:
    strimzi.io/cluster: nexus-kafka
spec:
  partitions: 4
  replicas: 2
  config:
    retention.ms: 2592000000  # 30 días
---
apiVersion: kafka.strimzi.io/v1beta2
kind: KafkaTopic
metadata:
  name: m1-int-delta-write-failed
  namespace: nexus-data
  labels:
    strimzi.io/cluster: nexus-kafka
spec:
  partitions: 4
  replicas: 2
  config:
    retention.ms: 2592000000  # 30 días
---
apiVersion: kafka.strimzi.io/v1beta2
kind: KafkaTopic
metadata:
  name: m1-int-spark-job-failed
  namespace: nexus-data
  labels:
    strimzi.io/cluster: nexus-kafka
spec:
  partitions: 4
  replicas: 2
  config:
    retention.ms: 2592000000  # 30 días
---
apiVersion: kafka.strimzi.io/v1beta2
kind: KafkaTopic
metadata:
  name: m1-int-mapping-failed
  namespace: nexus-data
  labels:
    strimzi.io/cluster: nexus-kafka
spec:
  partitions: 4
  replicas: 2
  config:
    retention.ms: 2592000000  # 30 días
---
apiVersion: kafka.strimzi.io/v1beta2
kind: KafkaTopic
metadata:
  name: m1-int-dead-letter
  namespace: nexus-data
  labels:
    strimzi.io/cluster: nexus-kafka
spec:
  partitions: 4
  replicas: 3             # RF=3 para el dead letter — NO perder mensajes nunca
  config:
    retention.ms: 7776000000  # 90 días
---
apiVersion: kafka.strimzi.io/v1beta2
kind: KafkaTopic
metadata:
  name: nexus-cdm-extension-proposed
  namespace: nexus-data
  labels:
    strimzi.io/cluster: nexus-kafka
spec:
  partitions: 4
  replicas: 2
  config:
    retention.ms: 2592000000  # 30 días
---
apiVersion: kafka.strimzi.io/v1beta2
kind: KafkaTopic
metadata:
  name: nexus-cdm-version-published
  namespace: nexus-data
  labels:
    strimzi.io/cluster: nexus-kafka
spec:
  partitions: 4
  replicas: 3             # RF=3 — crítico para coordinación CDM entre módulos
  config:
    retention.ms: 7776000000  # 90 días
---
apiVersion: kafka.strimzi.io/v1beta2
kind: KafkaTopic
metadata:
  name: nexus-cdm-extension-rejected
  namespace: nexus-data
  labels:
    strimzi.io/cluster: nexus-kafka
spec:
  partitions: 4
  replicas: 2
  config:
    retention.ms: 2592000000
---
apiVersion: kafka.strimzi.io/v1beta2
kind: KafkaTopic
metadata:
  name: nexus-cdm-rollback-requested
  namespace: nexus-data
  labels:
    strimzi.io/cluster: nexus-kafka
spec:
  partitions: 4
  replicas: 2
  config:
    retention.ms: 2592000000
```

### Kafka UI (Redpanda Console)

```yaml
# kafka-ui.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kafka-ui
  namespace: nexus-data
spec:
  replicas: 1
  selector:
    matchLabels:
      app: kafka-ui
  template:
    metadata:
      labels:
        app: kafka-ui
    spec:
      containers:
      - name: kafka-ui
        image: redpandadata/console:latest
        env:
        - name: KAFKA_BROKERS
          value: "nexus-kafka-kafka-bootstrap.nexus-data.svc.cluster.local:9092"
        ports:
        - containerPort: 8080
---
apiVersion: v1
kind: Service
metadata:
  name: kafka-ui
  namespace: nexus-data
spec:
  selector:
    app: kafka-ui
  ports:
  - port: 80
    targetPort: 8080
```

### Los 4 Consumer Groups — nombres exactos (Grafana los monitoriza desde Día 1)

```
m1-connector-workers     → Connector Worker pods
m1-delta-writers         → Delta Writer pods
m1-cdm-mappers           → CDM Mapper Worker pods
m1-ai-store-writers      → AI Store Router + M3 Writer pods
```

### Acceptance Criteria P0-INFRA-02

```bash
# 1. Todos los topics existen
kubectl exec -n nexus-data nexus-kafka-kafka-0 -- \
  bin/kafka-topics.sh --bootstrap-server localhost:9092 --list
# Expected: los 18 topics aparecen

# 2. Particiones correctas en raw_records
kubectl exec -n nexus-data nexus-kafka-kafka-0 -- \
  bin/kafka-topics.sh --bootstrap-server localhost:9092 \
  --describe --topic m1.int.raw_records
# Expected: PartitionCount: 16, ReplicationFactor: 2

# 3. dead_letter con RF=3
kubectl exec -n nexus-data nexus-kafka-kafka-0 -- \
  bin/kafka-topics.sh --bootstrap-server localhost:9092 \
  --describe --topic m1.int.dead_letter
# Expected: ReplicationFactor: 3

# 4. Kafka UI accesible
curl -s http://kafka-ui.nexus.internal | grep -i "redpanda\|kafka"
# Expected: respuesta HTML con la UI

# 5. Producir y consumir mensaje de prueba
kubectl exec -n nexus-data nexus-kafka-kafka-0 -- \
  bin/kafka-console-producer.sh --bootstrap-server localhost:9092 \
  --topic m1.int.sync_requested <<< '{"test": "message"}'

kubectl exec -n nexus-data nexus-kafka-kafka-0 -- \
  bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 \
  --topic m1.int.sync_requested --from-beginning --max-messages 1
# Expected: {"test": "message"}
```

---

## 5. P0-INFRA-03 — PostgreSQL 15 + Redis 7

**Owner:** DevOps
**Depende de:** P0-INFRA-01
**Duración:** Día 2–4 (paralelo con INFRA-02)

### PostgreSQL — Helm deployment

```yaml
# postgres-values.yaml (usando Bitnami chart)
architecture: replication
auth:
  postgresPassword: "<from-secrets>"
  username: nexus_app
  password: "<from-secrets>"
  database: nexus
primary:
  persistence:
    size: 100Gi
    storageClass: gp3
  resources:
    requests:
      memory: 2Gi
      cpu: "1"
    limits:
      memory: 4Gi
      cpu: "2"
  initdb:
    scripts:
      init.sql: |
        CREATE SCHEMA nexus_system;
        
        -- Tabla de tenants (prerequisito para todo lo demás)
        CREATE TABLE nexus_system.tenants (
            tenant_id              VARCHAR(100) PRIMARY KEY,
            tenant_name            VARCHAR(200) NOT NULL,
            plan                   VARCHAR(50)  NOT NULL DEFAULT 'professional',
            status                 VARCHAR(20)  NOT NULL DEFAULT 'provisioning',
            jwt_issuer             VARCHAR(200),
            jwt_public_key         TEXT,
            max_connectors         INT     NOT NULL DEFAULT 10,
            max_records_per_day    BIGINT  NOT NULL DEFAULT 1000000,
            created_at             TIMESTAMPTZ DEFAULT NOW(),
            activated_at           TIMESTAMPTZ,
            offboarded_at          TIMESTAMPTZ
        );
        
        -- Registro de versiones CDM
        CREATE TABLE nexus_system.cdm_versions (
            version          VARCHAR(20)  NOT NULL,
            tenant_id        VARCHAR(100) NOT NULL REFERENCES nexus_system.tenants(tenant_id),
            status           VARCHAR(20)  NOT NULL CHECK (status IN ('draft','active','deprecated')),
            changes_summary  TEXT,
            published_at     TIMESTAMPTZ,
            published_by     VARCHAR(200),
            created_at       TIMESTAMPTZ DEFAULT NOW(),
            PRIMARY KEY (version, tenant_id)
        );
        
        -- Registro de conectores
        CREATE TABLE nexus_system.connectors (
            connector_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id        VARCHAR(100) NOT NULL REFERENCES nexus_system.tenants(tenant_id),
            system_type      VARCHAR(50)  NOT NULL,
            connector_name   VARCHAR(200) NOT NULL,
            status           VARCHAR(20)  DEFAULT 'inactive',
            config           JSONB,
            last_sync_at     TIMESTAMPTZ,
            created_at       TIMESTAMPTZ DEFAULT NOW()
        );
        
        -- Registro de mapeos CDM
        CREATE TABLE nexus_system.cdm_mappings (
            mapping_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id        VARCHAR(100) NOT NULL,
            cdm_version      VARCHAR(20)  NOT NULL,
            source_system    VARCHAR(100) NOT NULL,
            source_table     VARCHAR(200) NOT NULL,
            source_field     VARCHAR(200) NOT NULL,
            cdm_entity       VARCHAR(100) NOT NULL,
            cdm_field        VARCHAR(100) NOT NULL,
            confidence       DECIMAL(5,2),
            tier             SMALLINT CHECK (tier IN (1,2,3)),
            approved_by      VARCHAR(200),
            approved_at      TIMESTAMPTZ,
            created_at       TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE (tenant_id, source_system, source_table, source_field, cdm_version)
        );
        
        -- Tracking de sync jobs
        CREATE TABLE nexus_system.sync_jobs (
            job_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            connector_id     UUID NOT NULL REFERENCES nexus_system.connectors(connector_id),
            tenant_id        VARCHAR(100) NOT NULL,
            status           VARCHAR(20)  DEFAULT 'pending',
            sync_mode        VARCHAR(20),
            started_at       TIMESTAMPTZ,
            completed_at     TIMESTAMPTZ,
            records_extracted INT DEFAULT 0,
            records_failed    INT DEFAULT 0,
            error_message    TEXT
        );
        
        -- Cola de governance CDM
        CREATE TABLE nexus_system.governance_queue (
            proposal_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            proposal_type    VARCHAR(50)  NOT NULL,
            tenant_id        VARCHAR(100) NOT NULL,
            status           VARCHAR(20)  DEFAULT 'pending',
            payload          JSONB NOT NULL,
            submitted_at     TIMESTAMPTZ DEFAULT NOW(),
            reviewed_at      TIMESTAMPTZ,
            reviewed_by      VARCHAR(200),
            review_notes     TEXT
        );
        
        -- Cola de revisión de mapeos
        CREATE TABLE nexus_system.mapping_review_queue (
            review_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id        VARCHAR(100) NOT NULL,
            source_system    VARCHAR(100) NOT NULL,
            source_table     VARCHAR(200) NOT NULL,
            source_field     VARCHAR(200) NOT NULL,
            cdm_entity       VARCHAR(100),
            cdm_field        VARCHAR(100),
            confidence       DECIMAL(5,2),
            status           VARCHAR(20)  DEFAULT 'pending',
            submitted_at     TIMESTAMPTZ DEFAULT NOW(),
            reviewed_by      VARCHAR(200),
            reviewed_at      TIMESTAMPTZ
        );
        
        -- Snapshots de schema para drift detection
        CREATE TABLE nexus_system.schema_snapshots (
            snapshot_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            connector_id     UUID NOT NULL REFERENCES nexus_system.connectors(connector_id),
            tenant_id        VARCHAR(100) NOT NULL,
            artifact         JSONB NOT NULL,
            created_at       TIMESTAMPTZ DEFAULT NOW()
        );
        
        -- Tabla de identity mapping (Okta → source systems)
        CREATE TABLE nexus_system.identity_mapping (
            mapping_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            nexus_user_id    VARCHAR(200) NOT NULL,
            tenant_id        VARCHAR(100) NOT NULL,
            source_system    VARCHAR(100) NOT NULL,
            source_user_id   VARCHAR(200) NOT NULL,
            created_at       TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE (nexus_user_id, source_system, tenant_id)
        );
        
        -- Tabla RLS registry
        CREATE TABLE nexus_system.tenant_rls_registry (
            tenant_id  VARCHAR(100) PRIMARY KEY,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        -- Índices de rendimiento
        CREATE INDEX idx_cdm_mappings_tenant_system 
            ON nexus_system.cdm_mappings(tenant_id, source_system, source_table, source_field);
        CREATE INDEX idx_sync_jobs_connector 
            ON nexus_system.sync_jobs(connector_id, tenant_id, status);
        CREATE INDEX idx_governance_queue_tenant_status
            ON nexus_system.governance_queue(tenant_id, status);
        CREATE INDEX idx_mapping_review_tenant_status
            ON nexus_system.mapping_review_queue(tenant_id, status);
        CREATE INDEX idx_schema_snapshots_connector
            ON nexus_system.schema_snapshots(connector_id, tenant_id, created_at DESC);
```

### Redis — Helm deployment

```yaml
# redis-values.yaml
architecture: standalone
auth:
  enabled: true
  password: "<from-secrets>"
master:
  persistence:
    size: 10Gi
    storageClass: gp3
  resources:
    requests:
      memory: 512Mi
      cpu: "250m"
    limits:
      memory: 2Gi
      cpu: "1"
```

### Acceptance Criteria P0-INFRA-03

```bash
# 1. Schema nexus_system existe
kubectl exec -n nexus-data nexus-postgres-primary-0 -- \
  psql -U nexus_app -d nexus -c "\dn"
# Expected: nexus_system aparece en la lista

# 2. Todas las tablas con columnas correctas
kubectl exec -n nexus-data nexus-postgres-primary-0 -- \
  psql -U nexus_app -d nexus -c "\dt nexus_system.*"
# Expected: 9 tablas: tenants, cdm_versions, connectors, cdm_mappings, 
#           sync_jobs, governance_queue, mapping_review_queue, 
#           schema_snapshots, identity_mapping, tenant_rls_registry

# 3. Redis responde
kubectl exec -n nexus-app test-pod -- \
  redis-cli -h nexus-redis.nexus-data.svc.cluster.local -p 6379 PING
# Expected: PONG

# 4. PostgreSQL accesible en el hostname correcto
kubectl exec -n nexus-app test-pod -- \
  pg_isready -h nexus-postgres.nexus-data.svc.cluster.local -p 5432
# Expected: accepting connections
```

---

## 6. P0-INFRA-04 — MinIO (Delta Lake Storage)

**Owner:** DevOps
**Depende de:** P0-INFRA-01
**Duración:** Día 2–4

### Helm deployment

```yaml
# minio-values.yaml
mode: standalone
rootUser: nexus-minio-admin
rootPassword: "<from-secrets>"
persistence:
  size: 500Gi
  storageClass: gp3
resources:
  requests:
    memory: 2Gi
    cpu: "1"
buckets:
  - name: nexus-raw
    policy: none
    purge: false
  - name: nexus-classified
    policy: none
    purge: false
  - name: nexus-cdm
    policy: none
    purge: false
users:
  - accessKey: nexus-spark-user
    secretKey: "<from-secrets>"
    policy: readwrite
service:
  type: ClusterIP
  port: 9000
consoleService:
  type: ClusterIP
  port: 9001
```

### Convención de paths obligatoria

```
s3a://nexus-raw/{tenant_id}/{system_type}/{entity}/
s3a://nexus-classified/{tenant_id}/{system_type}/{entity}_classified/
s3a://nexus-cdm/{tenant_id}/{entity}/

Ejemplos:
s3a://nexus-raw/acme-corp/salesforce/Account/
s3a://nexus-raw/acme-corp/odoo/res.partner/
s3a://nexus-classified/acme-corp/salesforce/Account_classified/
s3a://nexus-cdm/acme-corp/party/
```

### Acceptance Criteria P0-INFRA-04

```bash
# 1. MinIO console accesible
curl -s http://minio-console.nexus.internal | grep -i minio
# Expected: HTML con MinIO UI

# 2. Tres buckets existen
mc alias set nexus http://minio.nexus-storage.svc.cluster.local:9000 \
   nexus-spark-user <password>
mc ls nexus/
# Expected: nexus-raw  nexus-classified  nexus-cdm

# 3. Write desde nexus-app
kubectl exec -n nexus-app test-pod -- \
  aws --endpoint-url http://minio.nexus-storage.svc.cluster.local:9000 \
  s3 cp /etc/hostname s3://nexus-raw/test-tenant/test-system/test-entity/test.parquet

# 4. Read back
kubectl exec -n nexus-app test-pod -- \
  aws --endpoint-url http://minio.nexus-storage.svc.cluster.local:9000 \
  s3 cat s3://nexus-raw/test-tenant/test-system/test-entity/test.parquet
# Expected: contenido del archivo

# 5. Delete
kubectl exec -n nexus-app test-pod -- \
  aws --endpoint-url http://minio.nexus-storage.svc.cluster.local:9000 \
  s3 rm s3://nexus-raw/test-tenant/test-system/test-entity/test.parquet
```

---

## 7. P0-INFRA-05 — Kong API Gateway

**Owner:** DevOps
**Depende de:** P0-INFRA-01
**Duración:** Día 3–5

### Kong — Helm deployment

```yaml
# kong-values.yaml
ingressController:
  enabled: true
  installCRDs: true
env:
  database: postgres
  pg_host: nexus-postgres.nexus-data.svc.cluster.local
  pg_database: nexus_kong
  pg_user: kong
  pg_password:
    valueFrom:
      secretKeyRef:
        name: nexus-kong-postgres
        key: password
proxy:
  enabled: true
  type: LoadBalancer
  http:
    enabled: true
    servicePort: 80
  tls:
    enabled: true
    servicePort: 443
admin:
  enabled: true
  type: ClusterIP
  http:
    enabled: true
    servicePort: 8001
```

### Los 3 Plugins Globales — TODOS obligatorios en TODAS las rutas

```bash
# Plugin 1: JWT Validation
# Valida el JWT, extrae tenant_id y lo inyecta como X-Tenant-ID
curl -X POST http://kong-admin.nexus-infra.svc.cluster.local:8001/plugins \
  --data "name=jwt" \
  --data "config.claims_to_verify=exp" \
  --data "config.key_claim_name=kid" \
  --data "config.header_names=Authorization"

# Plugin 2: Rate Limiting por tenant
curl -X POST http://kong-admin.nexus-infra.svc.cluster.local:8001/plugins \
  --data "name=rate-limiting" \
  --data "config.minute=100" \
  --data "config.limit_by=header" \
  --data "config.header_name=X-Tenant-ID" \
  --data "config.policy=local"

# Plugin 3: Correlation ID — inyectado en CADA request
curl -X POST http://kong-admin.nexus-infra.svc.cluster.local:8001/plugins \
  --data "name=correlation-id" \
  --data "config.header_name=X-Correlation-ID" \
  --data "config.generator=uuid#counter" \
  --data "config.echo_downstream=true"
```

### Plugin adicional: Header injection desde JWT claims

```bash
# Extraer tenant_id del JWT y convertirlo en X-Tenant-ID header
curl -X POST http://kong-admin.nexus-infra.svc.cluster.local:8001/plugins \
  --data "name=jwt-keycloak" \
  --data "config.header_mapping[tenant_id]=X-Tenant-ID" \
  --data "config.header_mapping[sub]=X-User-ID" \
  --data "config.header_mapping[email]=X-User-Email"
```

### Acceptance Criteria P0-INFRA-05

```bash
# 1. Request sin JWT → 401
curl -s -o /dev/null -w "%{http_code}" http://api.nexus.internal/api/health
# Expected: 401

# 2. Request con JWT válido → 200, header X-Tenant-ID presente
TOKEN=$(./scripts/get-test-jwt.sh test-tenant-alpha)
curl -s -H "Authorization: Bearer $TOKEN" \
  -D - http://api.nexus.internal/api/health | grep X-Tenant-ID
# Expected: X-Tenant-ID: test-tenant-alpha

# 3. Rate limit: 101 requests en 1 minuto → 429
for i in $(seq 1 101); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -H "Authorization: Bearer $TOKEN" http://api.nexus.internal/api/health
done | tail -5
# Expected: los últimos valores son 429

# 4. X-Correlation-ID único por request
for i in 1 2 3; do
  curl -s -H "Authorization: Bearer $TOKEN" \
    -D - http://api.nexus.internal/api/health | grep X-Correlation-ID
done
# Expected: 3 valores diferentes
```

---

## 8. P0-INFRA-06 — Apache Airflow 2.8+

**Owner:** DevOps
**Depende de:** P0-INFRA-02, P0-INFRA-03
**Duración:** Día 4–6

### Helm deployment

```yaml
# airflow-values.yaml
airflowVersion: "2.8.1"
executor: KubernetesExecutor
dags:
  gitSync:
    enabled: true
    repo: "https://github.com/mentis/nexus-platform"
    branch: main
    subPath: "dags/"
    wait: 60
postgresql:
  enabled: false  # Usar DB separada para Airflow (NO reutilizar nexus-postgres)
externalDatabase:
  type: postgres
  host: airflow-postgres.nexus-data.svc.cluster.local
  port: 5432
  database: airflow
  user: airflow
  passwordSecret: airflow-postgres-secret
  passwordSecretKey: password
workers:
  extraPipInstall: "apache-airflow-providers-apache-kafka apache-airflow-providers-apache-spark"
config:
  AIRFLOW__CORE__DAGS_ARE_PAUSED_AT_CREATION: "True"
  AIRFLOW__CORE__MAX_ACTIVE_RUNS_PER_DAG: "3"
  AIRFLOW__SCHEDULER__MIN_FILE_PROCESS_INTERVAL: "30"
```

### Kafka Connection en Airflow (para KafkaSensor)

```bash
# Crear conexión Kafka en Airflow
airflow connections add 'nexus_kafka' \
  --conn-type 'kafka' \
  --conn-extra '{"bootstrap.servers": "nexus-kafka-kafka-bootstrap.nexus-data.svc.cluster.local:9092",
                  "group.id": "airflow-sensor",
                  "auto.offset.reset": "latest"}'
```

### Acceptance Criteria P0-INFRA-06

```bash
# 1. Airflow UI accesible
curl -s http://airflow.nexus.internal | grep -i airflow
# Expected: HTML con Airflow UI

# 2. KafkaSensor importa correctamente
airflow dags test nexus_kafka_sensor_test 2026-03-01
# Expected: sin ImportError

# 3. SparkSubmitOperator puede alcanzar Spark master
airflow dags test nexus_spark_test 2026-03-01
# Expected: Spark job enviado correctamente

# 4. DB de Airflow es SEPARADA de nexus-postgres
kubectl exec -n nexus-data airflow-scheduler-xxx -- \
  airflow db check
# Expected: conectado a airflow-postgres, no a nexus-postgres
```

---

## 9. P0-INFRA-07 — Spark 3.4+ Standalone Cluster

**Owner:** DevOps
**Depende de:** P0-INFRA-01, P0-INFRA-04
**Duración:** Día 4–6

### Helm deployment spark-operator

```yaml
# spark-operator-values.yaml
sparkJobNamespace: nexus-data
enableWebhook: true
enableMetrics: true
metricsPort: 10254
controllerThreads: 10
image:
  repository: ghcr.io/kubeflow/spark-operator
  tag: v1beta2-1.4.6-3.5.0
defaultSparkConf:
  spark.hadoop.fs.s3a.endpoint: "http://minio.nexus-storage.svc.cluster.local:9000"
  spark.hadoop.fs.s3a.path.style.access: "true"
  spark.hadoop.fs.s3a.aws.credentials.provider: "org.apache.hadoop.fs.s3a.SimpleAWSCredentialsProvider"
  spark.hadoop.fs.s3a.access.key: "<from-secrets>"
  spark.hadoop.fs.s3a.secret.key: "<from-secrets>"
  spark.sql.extensions: "io.delta.sql.DeltaSparkSessionExtension"
  spark.sql.catalog.spark_catalog: "org.apache.spark.sql.delta.catalog.DeltaCatalog"
```

### Paquetes pre-instalados (OBLIGATORIOS — disponibles en TODOS los jobs sin --packages)

```
io.delta:delta-core_2.12:2.4.0
org.apache.spark:spark-sql-kafka-0-10_2.12:3.4.0
org.apache.hadoop:hadoop-aws:3.3.4
com.amazonaws:aws-java-sdk-bundle:1.11.1026
```

### Acceptance Criteria P0-INFRA-07

```bash
# 1. Job de prueba: leer parquet de MinIO e imprimir row count
kubectl apply -f - <<EOF
apiVersion: sparkoperator.k8s.io/v1beta2
kind: SparkApplication
metadata:
  name: test-minio-read
  namespace: nexus-data
spec:
  type: Python
  mode: cluster
  pythonVersion: "3"
  mainApplicationFile: "s3a://nexus-raw/test-spark-script.py"
  sparkVersion: "3.4.0"
  driver:
    cores: 1
    memory: "1g"
  executor:
    cores: 1
    instances: 1
    memory: "1g"
EOF
kubectl wait sparkapplication test-minio-read -n nexus-data --for=condition=Completed --timeout=5m
# Expected: estado COMPLETED

# 2. Job de prueba: leer desde Kafka
# (verificar que spark-sql-kafka disponible sin --packages)
# Expected: job conecta y consume sin NoClassDefFoundError

# 3. Job de prueba: escribir tabla Delta a nexus-classified
# Expected: directorio _delta_log/ creado en MinIO
mc ls nexus/nexus-classified/test-delta/ --recursive | grep _delta_log
# Expected: lista archivos de _delta_log
```

---

## 10. P0-INFRA-08 — External Secrets Operator

**Owner:** DevOps
**Depende de:** P0-INFRA-01
**Duración:** Día 3–4

### Instalación

```bash
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets \
  -n nexus-infra \
  --set installCRDs=true
```

### SecretStore apuntando a AWS Secrets Manager

```yaml
# secretstore.yaml
apiVersion: external-secrets.io/v1beta1
kind: ClusterSecretStore
metadata:
  name: nexus-aws-secretsmanager
spec:
  provider:
    aws:
      service: SecretsManager
      region: eu-west-1
      auth:
        jwt:
          serviceAccountRef:
            name: external-secrets-sa
            namespace: nexus-infra
```

### Convención de paths en AWS Secrets Manager

```
# Credenciales de conectores por tenant
nexus/{tenant_id}/{connector_id}/credentials

# Campos según tipo de sistema:
# Salesforce:   username, password, security_token, domain
# Odoo:         url, database, username, api_key
# ServiceNow:   instance, username, password
# PostgreSQL:   host, port, database, username, password
# MySQL:        host, port, database, username, password
# SQL Server:   host, port, database, username, password

# Credenciales de plataforma
nexus/platform/pinecone/credentials     → api_key, environment
nexus/platform/neo4j/credentials        → uri, username, password
nexus/platform/timescaledb/credentials  → dsn
nexus/platform/minio/credentials        → access_key, secret_key
```

### ExternalSecret template para conectores

```yaml
# external-secret-connector.yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: connector-{{ connector_id }}
  namespace: nexus-app
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: nexus-aws-secretsmanager
    kind: ClusterSecretStore
  target:
    name: connector-{{ connector_id }}-credentials
    creationPolicy: Owner
  data:
  - secretKey: credentials
    remoteRef:
      key: nexus/{{ tenant_id }}/{{ connector_id }}/credentials
```

### Acceptance Criteria P0-INFRA-08

```bash
# 1. Crear secret de prueba en AWS Secrets Manager
aws secretsmanager create-secret \
  --name nexus/test-tenant/test-connector/credentials \
  --region eu-west-1 \
  --secret-string '{"username":"testuser","password":"testpass"}'

# 2. ExternalSecret lo sincroniza en Kubernetes en <60 segundos
kubectl get externalsecret connector-test -n nexus-app
# Expected: STATUS: SecretSynced, READY: True

# 3. Pod puede leer el valor
kubectl exec -n nexus-app test-pod -- \
  cat /var/run/secrets/connector-test-connector/credentials
# Expected: {"username":"testuser","password":"testpass"}

# 4. Verificar que valor NO aparece en logs del pod
kubectl logs test-pod -n nexus-app | grep -c "testpass"
# Expected: 0
```

---

## 11. P0-INFRA-09 — Observability Stack Completo

**Owner:** DevOps
**Depende de:** P0-INFRA-01
**Duración:** Día 5–7

### Stack completo: Prometheus + Grafana + Loki + Jaeger

```bash
# kube-prometheus-stack (incluye Prometheus + Grafana + Alertmanager)
helm install monitoring prometheus-community/kube-prometheus-stack \
  -n nexus-infra \
  -f prometheus-values.yaml

# Loki para logs centralizados
helm install loki grafana/loki-stack \
  -n nexus-infra \
  --set grafana.enabled=false \  # Usar el Grafana del paso anterior
  --set promtail.enabled=true

# Jaeger para distributed tracing
helm install jaeger jaegertracing/jaeger \
  -n nexus-infra \
  --set allInOne.enabled=true \
  --set provisionDataStore.cassandra=false \
  --set storage.type=memory
```

### Kafka JMX Exporter — para consumer group lag en Prometheus

```yaml
# kafka-metrics-config.yaml (ConfigMap)
kind: ConfigMap
metadata:
  name: kafka-metrics-config
  namespace: nexus-data
data:
  kafka-metrics-config.yml: |
    lowercaseOutputName: true
    rules:
    - pattern: kafka.server<type=(.+), name=(.+), clientId=(.+), topic=(.+), partition=(.*)><>Value
      name: kafka_server_$1_$2
      type: GAUGE
      labels:
        clientId: "$3"
        topic: "$4"
        partition: "$5"
    - pattern: kafka.consumer<type=consumer-fetch-manager-metrics, client-id=(.+), topic=(.+), partition=(.+)><>records-lag
      name: kafka_consumer_records_lag
      labels:
        client_id: "$1"
        topic: "$2"
        partition: "$3"
    - pattern: kafka.consumer.group<group=(.+), topic=(.+), partition=(.+)><>Value
      name: kafka_consumer_group_lag
      type: GAUGE
      labels:
        group: "$1"
        topic: "$2"
        partition: "$3"
```

### Dashboard "NEXUS Pipeline Health" — obligatorio desde Día 1

```json
{
  "title": "NEXUS Pipeline Health",
  "panels": [
    {
      "title": "Consumer Lag — m1-connector-workers",
      "type": "timeseries",
      "targets": [{
        "expr": "sum(kafka_consumer_group_lag{group='m1-connector-workers'}) by (topic)"
      }]
    },
    {
      "title": "Consumer Lag — m1-delta-writers",
      "type": "timeseries",
      "targets": [{
        "expr": "sum(kafka_consumer_group_lag{group='m1-delta-writers'}) by (topic)"
      }]
    },
    {
      "title": "Consumer Lag — m1-cdm-mappers",
      "type": "timeseries",
      "targets": [{
        "expr": "sum(kafka_consumer_group_lag{group='m1-cdm-mappers'}) by (topic)"
      }]
    },
    {
      "title": "Consumer Lag — m1-ai-store-writers",
      "type": "timeseries",
      "targets": [{
        "expr": "sum(kafka_consumer_group_lag{group='m1-ai-store-writers'}) by (topic)"
      }]
    },
    {
      "title": "Records producidos a raw_records / min",
      "type": "stat",
      "targets": [{
        "expr": "rate(kafka_server_brokertopicmetrics_messagesinpersec{topic='m1.int.raw_records'}[1m])"
      }]
    },
    {
      "title": "Records completados (ai_write_completed) / min",
      "type": "stat",
      "targets": [{
        "expr": "rate(kafka_server_brokertopicmetrics_messagesinpersec{topic='m1.int.ai_write_completed'}[1m])"
      }]
    }
  ]
}
```

### Alert Rules Prometheus

```yaml
# nexus-alerts.yaml
groups:
- name: nexus.pipeline
  rules:
  - alert: M1DeltaWriterLagCritical
    expr: kafka_consumer_group_lag{group="m1-delta-writers"} > 50000
    for: 2m
    labels:
      severity: critical
    annotations:
      summary: "M1 Delta Writer lag crítico ({{ $value }} mensajes)"
      description: "El worker de Delta está procesando más lento que la extracción"

  - alert: DeadLetterSpike
    expr: rate(kafka_server_brokertopicmetrics_messagesinpersec{topic="m1.int.dead_letter"}[5m]) > 10
    for: 1m
    labels:
      severity: warning
    annotations:
      summary: "Spike en Dead Letter Queue ({{ $value }} msg/s)"

  - alert: ConnectorWorkerDown
    expr: absent(kafka_consumer_group_lag{group="m1-connector-workers"})
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "Connector Worker sin métricas — posiblemente down"

  - alert: KafkaBrokerDown
    expr: count(kafka_server_replicamanager_leadercount) < 3
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Menos de 3 brokers Kafka activos"
```

### Acceptance Criteria P0-INFRA-09

```bash
# 1. Grafana accesible
curl -s http://grafana.nexus.internal | grep -i grafana
# Expected: HTML de Grafana

# 2. Dashboard NEXUS Pipeline Health cargado con 4 paneles de consumer lag
# (todos en 0 — no hay consumers aún, pero los paneles existen)
curl -s -u admin:admin http://grafana.nexus.internal/api/dashboards/uid/nexus-pipeline-health \
  | jq '.dashboard.panels | length'
# Expected: 6 (o más)

# 3. Prometheus scrapeando métricas Kafka JMX
curl -s http://prometheus.nexus.internal/api/v1/query \
  --data-urlencode 'query=kafka_controller_activecontrollercount' \
  | jq '.data.result[0].value[1]'
# Expected: "1"

# 4. Jaeger UI accesible
curl -s http://jaeger.nexus.internal | grep -i jaeger
# Expected: HTML de Jaeger

# 5. Loki recibiendo logs
# Spawnear un pod que loguee algo
kubectl run log-test -n nexus-app --image=busybox --restart=Never \
  -- sh -c 'echo "nexus-test-log-entry" && sleep 5'
# Verificar en Loki/Grafana que el log aparece
```

---

## 12. LEAD-00 — Tenant Provisioning Workflow

**Owner:** Tech Lead
**Depende de:** P0-INFRA-02, P0-INFRA-03
**Duración:** Día 1–3 (paralelo con DevOps)

### onboard_tenant.py — Script principal (idempotente)

```python
# nexus_core/provisioning.py
"""
Tenant provisioning — se ejecuta una vez por cliente.
Idempotente: seguro ejecutarlo 2 veces para el mismo tenant.

Uso:
    python -m nexus_core.provisioning --tenant-id acme-corp --name "Acme Corporation" --plan professional
    # o desde código:
    from nexus_core.provisioning import onboard_tenant
    await onboard_tenant("acme-corp", "Acme Corporation", plan="professional")
"""
import argparse
import asyncio
import logging
from confluent_kafka.admin import AdminClient, NewTopic
import asyncpg

logger = logging.getLogger(__name__)

# Topics creados por tenant — TODOS los módulos
TENANT_TOPIC_TEMPLATES = [
    # M1 outbound
    "{tid}.m1.sync_completed",
    "{tid}.m1.semantic_interpretation_requested",
    "{tid}.m1.mapping_review_needed",
    # M2 outbound
    "{tid}.m2.semantic_interpretation_complete",
    "{tid}.m2.agent_response_ready",
    "{tid}.m2.workflow_trigger",
    "{tid}.m2.knowledge_query",
    "{tid}.m2.knowledge_query_result",
    "{tid}.m2.cdm_extension_proposed",
    # M4 outbound
    "{tid}.m4.mapping_approved",
    "{tid}.m4.workflow_completed",
    "{tid}.m4.routing_override",
]

TOPIC_CONFIG = {
    "num.partitions": 4,
    "replication.factor": 2,
    "retention.ms": str(7 * 24 * 60 * 60 * 1000),  # 7 días default
}


async def onboard_tenant(
    tenant_id: str,
    tenant_name: str,
    plan: str = "professional"
) -> None:
    """
    Provisiona un nuevo tenant en NEXUS.
    Paso 1: Insertar en nexus_system.tenants
    Paso 2: Crear topics Kafka por-tenant
    Paso 3: Verificar que todos los topics existen
    Paso 4: Insertar CDM version 1.0 inicial
    Paso 5: Actualizar status a 'active'
    """
    # Validar tenant_id: sin puntos (romperían Kafka topic names)
    if "." in tenant_id:
        raise ValueError(f"tenant_id no puede contener puntos: '{tenant_id}'")
    if len(tenant_id) < 3 or len(tenant_id) > 100:
        raise ValueError(f"tenant_id debe tener entre 3 y 100 caracteres")

    pool = await asyncpg.create_pool(dsn=_get_postgres_dsn(), min_size=1, max_size=3)

    try:
        async with pool.acquire() as conn:
            # Paso 1: Tenant row (ON CONFLICT DO NOTHING — idempotente)
            existing = await conn.fetchrow(
                "SELECT tenant_id, status FROM nexus_system.tenants WHERE tenant_id = $1",
                tenant_id
            )
            if existing and existing["status"] == "active":
                logger.info(f"Tenant {tenant_id} ya existe y está activo. Nada que hacer.")
                return

            await conn.execute("""
                INSERT INTO nexus_system.tenants 
                    (tenant_id, tenant_name, plan, status)
                VALUES ($1, $2, $3, 'provisioning')
                ON CONFLICT (tenant_id) DO UPDATE 
                    SET tenant_name = EXCLUDED.tenant_name,
                        plan = EXCLUDED.plan
            """, tenant_id, tenant_name, plan)
            logger.info(f"Tenant {tenant_id} insertado en BD")

        # Paso 2: Crear Kafka topics
        topics_created = await _create_kafka_topics(tenant_id)
        logger.info(f"Creados {topics_created} topics Kafka para tenant {tenant_id}")

        # Paso 3: Verificar topics
        await _verify_kafka_topics(tenant_id)
        logger.info(f"Todos los topics verificados para tenant {tenant_id}")

        # Paso 4 y 5: CDM inicial + status active
        async with pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO nexus_system.cdm_versions 
                    (version, tenant_id, status, changes_summary, published_at)
                VALUES ('1.0.0', $1, 'active', 'Initial CDM version', NOW())
                ON CONFLICT DO NOTHING
            """, tenant_id)

            await conn.execute("""
                UPDATE nexus_system.tenants 
                SET status = 'active', activated_at = NOW()
                WHERE tenant_id = $1
            """, tenant_id)

        logger.info(f"✅ Tenant {tenant_id} provisionado exitosamente")

    finally:
        await pool.close()


async def _create_kafka_topics(tenant_id: str) -> int:
    """Crea todos los topics por-tenant. Idempotente."""
    admin = AdminClient({"bootstrap.servers": _get_kafka_bootstrap()})
    
    topics_to_create = [
        NewTopic(
            topic=t.format(tid=tenant_id),
            num_partitions=TOPIC_CONFIG["num.partitions"],
            replication_factor=int(TOPIC_CONFIG["replication.factor"]),
            config={"retention.ms": TOPIC_CONFIG["retention.ms"]}
        )
        for t in TENANT_TOPIC_TEMPLATES
    ]

    result = admin.create_topics(topics_to_create)
    created = 0
    for topic, future in result.items():
        try:
            future.result()
            created += 1
        except Exception as e:
            if "already exists" in str(e).lower():
                created += 1  # Idempotente — ya existe está bien
            else:
                raise RuntimeError(f"Error creando topic {topic}: {e}")
    return created


async def _verify_kafka_topics(tenant_id: str) -> None:
    """Verifica que todos los topics del tenant existen."""
    from confluent_kafka.admin import AdminClient
    admin = AdminClient({"bootstrap.servers": _get_kafka_bootstrap()})
    
    expected = {t.format(tid=tenant_id) for t in TENANT_TOPIC_TEMPLATES}
    metadata = admin.list_topics(timeout=10)
    existing = {t for t in metadata.topics.keys()}
    
    missing = expected - existing
    if missing:
        raise RuntimeError(f"Topics no creados después de provisioning: {missing}")


def cli():
    """Entry point para el comando onboard-tenant."""
    parser = argparse.ArgumentParser(description="Provisionar nuevo tenant NEXUS")
    parser.add_argument("--tenant-id", required=True, help="Tenant ID (sin puntos)")
    parser.add_argument("--name", required=True, help="Nombre del tenant")
    parser.add_argument("--plan", default="professional",
                       choices=["professional", "enterprise"])
    args = parser.parse_args()
    asyncio.run(onboard_tenant(args.tenant_id, args.name, plan=args.plan))
```

### Acceptance Criteria LEAD-00

```bash
# 1. Primera ejecución
onboard-tenant --tenant-id test-alpha --name "Test Alpha Corp" --plan professional
# Expected: "✅ Tenant test-alpha provisionado exitosamente"

# 2. Segunda ejecución (idempotente — no debe fallar)
onboard-tenant --tenant-id test-alpha --name "Test Alpha Corp" --plan professional
# Expected: "Tenant test-alpha ya existe y está activo. Nada que hacer."

# 3. Topics creados en Kafka
kubectl exec -n nexus-data nexus-kafka-kafka-0 -- \
  bin/kafka-topics.sh --list --bootstrap-server localhost:9092 | grep test-alpha
# Expected: test-alpha.m1.sync_completed, test-alpha.m2.*, etc. (12 topics)

# 4. Tenant con punto en ID → error
onboard-tenant --tenant-id "acme.corp" --name "Acme" --plan professional
# Expected: ValueError: tenant_id no puede contener puntos

# 5. Worker recibe mensaje con tenant_id desconocido → rechaza
# (se verifica en P1-CORE-01 con NexusConsumer)
```

---

## 13. LEAD-01 — PostgreSQL Row-Level Security

**Owner:** Tech Lead
**Depende de:** LEAD-00
**Duración:** Día 3–4

### Habilitar RLS en todas las tablas de nexus_system

```sql
-- Habilitar RLS en cada tabla
ALTER TABLE nexus_system.cdm_versions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexus_system.cdm_mappings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexus_system.connectors        ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexus_system.sync_jobs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexus_system.governance_queue  ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexus_system.mapping_review_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexus_system.schema_snapshots  ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexus_system.identity_mapping  ENABLE ROW LEVEL SECURITY;

-- Política: solo filas del tenant activo en la sesión
CREATE POLICY tenant_isolation_cdm_versions ON nexus_system.cdm_versions
    USING (tenant_id = current_setting('app.current_tenant', true));

CREATE POLICY tenant_isolation_cdm_mappings ON nexus_system.cdm_mappings
    USING (tenant_id = current_setting('app.current_tenant', true));

CREATE POLICY tenant_isolation_connectors ON nexus_system.connectors
    USING (tenant_id = current_setting('app.current_tenant', true));

CREATE POLICY tenant_isolation_sync_jobs ON nexus_system.sync_jobs
    USING (tenant_id = current_setting('app.current_tenant', true));

CREATE POLICY tenant_isolation_governance ON nexus_system.governance_queue
    USING (tenant_id = current_setting('app.current_tenant', true));

CREATE POLICY tenant_isolation_mapping_review ON nexus_system.mapping_review_queue
    USING (tenant_id = current_setting('app.current_tenant', true));

CREATE POLICY tenant_isolation_schema_snapshots ON nexus_system.schema_snapshots
    USING (tenant_id = current_setting('app.current_tenant', true));

CREATE POLICY tenant_isolation_identity_mapping ON nexus_system.identity_mapping
    USING (tenant_id = current_setting('app.current_tenant', true));

-- El user nexus_app NO es superuser — no puede bypassear RLS
ALTER ROLE nexus_app NOINHERIT;
```

### get_tenant_scoped_connection() — función obligatoria

```python
# nexus_core/db.py
import asyncpg
from nexus_core.tenant import get_tenant
import logging

logger = logging.getLogger(__name__)

async def get_tenant_scoped_connection(pool: asyncpg.Pool, tenant_id: str = None):
    """
    Retorna conexión PostgreSQL con RLS activado para el tenant.
    
    REGLA: NUNCA llamar pool.acquire() directamente en código de aplicación.
    SIEMPRE usar esta función.
    
    La política RLS filtra automáticamente — un SELECT * WHERE 
    se convierte silenciosamente en SELECT * WHERE tenant_id = <current_tenant>.
    """
    if tenant_id is None:
        try:
            ctx = get_tenant()
            tenant_id = ctx.tenant_id
        except LookupError:
            raise RuntimeError(
                "get_tenant_scoped_connection() llamado fuera de TenantContext. "
                "Usar set_tenant() antes de procesar cualquier mensaje."
            )
    
    conn = await pool.acquire()
    try:
        # Activar RLS para este tenant
        await conn.execute(
            "SET app.current_tenant = $1", tenant_id
        )
        logger.debug(f"Conexión PostgreSQL con RLS para tenant={tenant_id}")
        return conn
    except Exception:
        await pool.release(conn)
        raise
```

---

## 14. LEAD-02 — Okta OIDC + Kong JWT Config

**Owner:** Tech Lead
**Depende de:** P0-INFRA-05 (Kong activo)
**Duración:** Día 5–8

### Paso 1: Registrar Okta Developer Account

```
1. Ir a: https://developer.okta.com
2. Click "Sign up free"
3. Email: nexus-dev@mentis-consulting.be  (email de equipo, NO personal)
4. Company: Mentis Consulting
5. Guardar la URL del org: https://dev-XXXXXXX.okta.com
```

### Paso 2: Crear Authorization Server dedicado

```
Okta Admin Console:
Security → API → Authorization Servers → Add Authorization Server

Name:       nexus-dev
Audience:   api://nexus-dev
Description: NEXUS development and demo authorization server
```

**Resultado:** Issuer URI como `https://dev-XXXXXXX.okta.com/oauth2/<auth-server-id>`
**Este valor ES la variable `OIDC_ISSUER_URL`**

### Paso 3: Agregar custom claim tenant_id al JWT

```
En nexus-dev Authorization Server:
Claims tab → Add Claim

Claim 1:
  Name:              tenant_id
  Include in token:  Access Token
  Value type:        Expression
  Value:             user.nexus_tenant_id
  Include in:        Any scope

Claim 2:
  Name:              email
  Include in token:  Access Token
  Value type:        Expression
  Value:             user.email
  Include in:        Any scope
```

### Paso 4: Agregar atributo nexus_tenant_id al perfil Okta

```
Directory → Profile Editor → User (default) → Add Attribute

Data Type:    string
Display name: NEXUS Tenant ID
Variable:     nexus_tenant_id
Description:  Maps this user to their NEXUS tenant (e.g. 'acme-corp')
```

### Paso 5: Registrar NEXUS como app OIDC

```
Applications → Create App Integration
Sign-in method: OIDC — OpenID Connect
Application type: Web Application

App name:         NEXUS Dev
Sign-in redirect URIs:
  http://localhost:3000/api/auth/callback/okta
  https://nexus.internal/api/auth/callback/okta

Sign-out redirect URIs:
  http://localhost:3000
  https://nexus.internal
```

### Paso 6: Crear usuarios de prueba en Okta

```
Directory → People → Add Person

User 1:
  First: Alice   Last: Alpha
  Username: alice@test-tenant-alpha.com
  nexus_tenant_id: test-alpha

User 2:
  First: Bob     Last: Beta
  Username: bob@test-tenant-beta.com
  nexus_tenant_id: test-beta
```

### Paso 7: Configurar Kong para validar JWTs de Okta

```bash
# Crear Kong Consumer representando el issuer de Okta
curl -X POST http://kong-admin.nexus-infra.svc.cluster.local:8001/consumers \
  --data "username=okta-nexus-dev"

# Crear JWT credential bajo ese consumer
# key-auth usa el JWKS endpoint de Okta para verificar la firma
curl -X POST http://kong-admin.nexus-infra.svc.cluster.local:8001/consumers/okta-nexus-dev/jwt \
  --data "algorithm=RS256" \
  --data "rsa_public_key=<jwks-public-key-from-okta>" \
  --data "key=https://dev-XXXXXXX.okta.com/oauth2/<auth-server-id>"

# Guardar credenciales Okta en Kubernetes Secret
kubectl create secret generic nexus-okta-credentials \
  --namespace nexus-app \
  --from-literal=client_id=<YOUR_CLIENT_ID> \
  --from-literal=client_secret=<YOUR_CLIENT_SECRET> \
  --from-literal=issuer_url=https://dev-XXXXXXX.okta.com/oauth2/<auth-server-id>
```

### nexus_core/oidc.py

```python
# nexus_core/oidc.py
import os
from dataclasses import dataclass
from typing import Optional

@dataclass(frozen=True)
class OIDCConfig:
    issuer_url: str
    client_id: str
    client_secret: str
    jwks_uri: str
    authorization_endpoint: str
    token_endpoint: str


def get_oidc_config() -> OIDCConfig:
    """
    Lee OIDC_ISSUER_URL del entorno y deriva toda la configuración OIDC.
    Un cambio de IdP (Okta → Azure AD) = un cambio de variable de entorno.
    Nunca hardcodear URLs de Okta en código.
    """
    issuer_url = os.environ["OIDC_ISSUER_URL"]
    client_id = os.environ["OIDC_CLIENT_ID"]
    client_secret = os.environ["OIDC_CLIENT_SECRET"]

    # Descubrir endpoints desde el well-known URL
    import httpx
    discovery = httpx.get(f"{issuer_url}/.well-known/openid-configuration").json()

    return OIDCConfig(
        issuer_url=issuer_url,
        client_id=client_id,
        client_secret=client_secret,
        jwks_uri=discovery["jwks_uri"],
        authorization_endpoint=discovery["authorization_endpoint"],
        token_endpoint=discovery["token_endpoint"],
    )


def validate_env() -> None:
    """Llamar al inicio del proceso para fallar rápido si falta config."""
    required = ["OIDC_ISSUER_URL", "OIDC_CLIENT_ID", "OIDC_CLIENT_SECRET"]
    missing = [v for v in required if not os.environ.get(v)]
    if missing:
        raise EnvironmentError(
            f"Variables de entorno OIDC faltantes: {missing}. "
            "Verificar que el Kubernetes Secret nexus-okta-credentials está montado."
        )
```

---

## 15. P1-CORE-01 — nexus_core: NexusMessage + Producer + Consumer

**Owner:** Tech Lead + Backend-M1
**Depende de:** P0-INFRA-02
**Duración:** Semana 2

### nexus_core/messaging.py — Código completo

```python
# nexus_core/messaging.py
from dataclasses import dataclass, field, asdict
from typing import Any, Optional, List, Dict
import uuid
import json
import logging
from datetime import datetime, timezone
from confluent_kafka import Producer, Consumer, KafkaError, KafkaException

logger = logging.getLogger(__name__)

# Campos que NUNCA se loguean (contienen credenciales)
_SENSITIVE_FIELDS = frozenset({
    "password", "api_key", "token", "secret", "credentials",
    "access_key", "secret_key", "private_key", "auth_token",
    "security_token", "refresh_token"
})


@dataclass
class NexusMessage:
    """
    Envelope estándar para TODOS los mensajes Kafka en NEXUS.
    Sin excepción — ningún módulo publica raw dicts.
    """
    topic: str
    tenant_id: str
    event_type: str
    payload: Dict[str, Any]

    # Auto-generados si no se proveen
    message_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    correlation_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    trace_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    schema_version: str = "1.0"
    cdm_version: str = "1.0.0"
    permission_scope: List[str] = field(default_factory=list)
    produced_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    source_module: str = "unknown"

    def to_json(self) -> str:
        return json.dumps(asdict(self))

    @classmethod
    def from_json(cls, data: str | bytes) -> "NexusMessage":
        d = json.loads(data)
        return cls(**d)

    def safe_log_repr(self) -> str:
        """
        Representación para logging — elimina campos sensibles del payload.
        OBLIGATORIO usar esta función en cualquier log que incluya el mensaje.
        """
        safe_payload = {
            k: "***REDACTED***" if k.lower() in _SENSITIVE_FIELDS else v
            for k, v in self.payload.items()
        }
        return (
            f"NexusMessage(id={self.message_id}, "
            f"tenant={self.tenant_id}, "
            f"event={self.event_type}, "
            f"topic={self.topic}, "
            f"payload_keys={list(safe_payload.keys())})"
        )

    def propagate_ids(self, parent: "NexusMessage") -> "NexusMessage":
        """Crea nuevo mensaje propagando correlation_id y trace_id del padre."""
        from dataclasses import replace
        return replace(
            self,
            correlation_id=parent.correlation_id,
            trace_id=parent.trace_id,
        )


class NexusProducer:
    """
    Wrapper sobre confluent_kafka.Producer.
    - Valida formato del topic name
    - Agrega correlation_id y trace_id
    - Nunca loguea payload values — solo metadata
    """

    def __init__(self, bootstrap_servers: str, source_module: str):
        self._producer = Producer({
            "bootstrap.servers": bootstrap_servers,
            "enable.idempotence": True,
            "acks": "all",
        })
        self._source_module = source_module

    def publish(
        self,
        message: NexusMessage,
        partition_key: str = None
    ) -> None:
        """Publica un NexusMessage. Bloquea hasta confirmación del broker."""
        if not message.topic:
            raise ValueError("NexusMessage.topic no puede estar vacío")
        if not message.tenant_id:
            raise ValueError("NexusMessage.tenant_id no puede estar vacío")

        # Inyectar source_module
        from dataclasses import replace
        message = replace(message, source_module=self._source_module)

        key = (partition_key or message.tenant_id).encode("utf-8")
        value = message.to_json().encode("utf-8")

        logger.debug(f"Publicando: {message.safe_log_repr()}")

        self._producer.produce(
            topic=message.topic,
            key=key,
            value=value,
            callback=self._delivery_callback
        )
        self._producer.flush(timeout=30)

    def _delivery_callback(self, err, msg):
        if err:
            logger.error(f"Error publicando a Kafka topic={msg.topic()}: {err}")
        else:
            logger.debug(
                f"Mensaje entregado: topic={msg.topic()} "
                f"partition={msg.partition()} offset={msg.offset()}"
            )


class NexusConsumer:
    """
    Wrapper sobre confluent_kafka.Consumer.
    - NUNCA hace auto-commit — commit manual obligatorio
    - Valida tenant_id contra is_active_tenant antes de procesar
    - Re-entrega mensajes si el procesamiento falla (no commitleado)
    """

    def __init__(
        self,
        bootstrap_servers: str,
        group_id: str,
        topics: List[str],
        tenant_validator=None,
    ):
        self._consumer = Consumer({
            "bootstrap.servers": bootstrap_servers,
            "group.id": group_id,
            "auto.offset.reset": "earliest",
            "enable.auto.commit": False,   # CRÍTICO: commit manual siempre
        })
        self._consumer.subscribe(topics)
        self._tenant_validator = tenant_validator
        logger.info(f"NexusConsumer suscrito a {topics} en grupo {group_id}")

    def poll(self, timeout: float = 1.0) -> Optional[NexusMessage]:
        """
        Retorna el siguiente mensaje o None si timeout.
        NO hace commit automático.
        """
        msg = self._consumer.poll(timeout=timeout)
        if msg is None:
            return None
        if msg.error():
            if msg.error().code() == KafkaError._PARTITION_EOF:
                return None
            raise KafkaException(msg.error())

        try:
            nexus_msg = NexusMessage.from_json(msg.value())
        except Exception as e:
            logger.error(f"Error deserializando mensaje: {e}. Mensaje: {msg.value()[:200]}")
            # Commit de todos modos — mensaje malformado va a dead letter
            self._consumer.commit(message=msg, asynchronous=False)
            return None

        # Validar tenant activo
        if self._tenant_validator and not self._tenant_validator(nexus_msg.tenant_id):
            logger.warning(
                f"Mensaje rechazado para tenant inactivo: {nexus_msg.tenant_id}. "
                f"Commiteando y saltando."
            )
            self._consumer.commit(message=msg, asynchronous=False)
            return None

        # Adjuntar referencia al msg original para commit posterior
        nexus_msg._raw_msg = msg
        return nexus_msg

    def commit(self, message: NexusMessage) -> None:
        """Commit explícito DESPUÉS de procesamiento exitoso."""
        if not hasattr(message, "_raw_msg"):
            raise RuntimeError(
                "No se puede commitear un mensaje que no vino de NexusConsumer.poll()"
            )
        self._consumer.commit(message=message._raw_msg, asynchronous=False)
        logger.debug(f"Offset commiteado para {message.safe_log_repr()}")

    def close(self):
        self._consumer.close()
```

---

## 16. P1-CORE-02 — nexus_core: TenantContext + TopicNamer

**Owner:** Backend-M1
**Depende de:** P1-CORE-01

### nexus_core/tenant.py

```python
# nexus_core/tenant.py
from contextvars import ContextVar
from dataclasses import dataclass
from typing import Optional

_tenant_ctx: ContextVar["TenantContext"] = ContextVar("nexus_tenant_ctx")


@dataclass(frozen=True)
class TenantContext:
    tenant_id: str
    plan: str
    cdm_version: str  # e.g. "1.2.0"


def get_tenant() -> TenantContext:
    """
    Retorna el TenantContext actual.
    Lanza LookupError si se llama fuera de un contexto de procesamiento.
    Esto es intencional — detecta errores de diseño temprano.
    """
    return _tenant_ctx.get()


def set_tenant(ctx: TenantContext) -> None:
    """
    Establece el TenantContext para la corutina actual y sus descendientes.
    Llamar al inicio de procesar cada mensaje Kafka.
    """
    _tenant_ctx.set(ctx)


def clear_tenant() -> None:
    """Limpiar el contexto (usar en cleanup de tests)."""
    _tenant_ctx.set(None)
```

### nexus_core/topics.py

```python
# nexus_core/topics.py
import re

# Caracteres permitidos en tenant_id
_VALID_TENANT_RE = re.compile(r'^[a-z0-9][a-z0-9\-]{1,98}[a-z0-9]$')

# Tipos de eventos válidos por módulo (expandir según se agreguen)
_VALID_M1_EVENTS = frozenset({
    "sync_completed", "sync_failed", "semantic_interpretation_requested",
    "mapping_review_needed", "schema_drift_detected",
})
_VALID_M2_EVENTS = frozenset({
    "semantic_interpretation_complete", "agent_response_ready",
    "workflow_trigger", "knowledge_query", "knowledge_query_result",
    "cdm_extension_proposed",
})
_VALID_M4_EVENTS = frozenset({
    "mapping_approved", "workflow_completed", "routing_override",
})


class CrossModuleTopicNamer:
    """
    ÚNICA fuente de verdad para nombres de topics Kafka en NEXUS.
    
    REGLA: Ningún código fuera de esta clase construye topic names.
    String concatenation para topic names = violación de arquitectura.
    """

    @staticmethod
    def _validate_tenant(tenant_id: str) -> str:
        if not _VALID_TENANT_RE.match(tenant_id):
            raise ValueError(
                f"tenant_id inválido: '{tenant_id}'. "
                "Solo minúsculas, números y guiones. Sin puntos. 3-100 chars."
            )
        return tenant_id

    @staticmethod
    def m1_outbound(tenant_id: str, event: str) -> str:
        CrossModuleTopicNamer._validate_tenant(tenant_id)
        if event not in _VALID_M1_EVENTS:
            raise ValueError(f"Evento M1 desconocido: '{event}'. "
                           f"Válidos: {_VALID_M1_EVENTS}")
        return f"{tenant_id}.m1.{event}"

    @staticmethod
    def m2_outbound(tenant_id: str, event: str) -> str:
        CrossModuleTopicNamer._validate_tenant(tenant_id)
        if event not in _VALID_M2_EVENTS:
            raise ValueError(f"Evento M2 desconocido: '{event}'")
        return f"{tenant_id}.m2.{event}"

    @staticmethod
    def m4_outbound(tenant_id: str, event: str) -> str:
        CrossModuleTopicNamer._validate_tenant(tenant_id)
        if event not in _VALID_M4_EVENTS:
            raise ValueError(f"Evento M4 desconocido: '{event}'")
        return f"{tenant_id}.m4.{event}"

    # Topics estáticos de plataforma (constantes)
    class STATIC:
        SYNC_REQUESTED = "m1.int.sync_requested"
        RAW_RECORDS = "m1.int.raw_records"
        DELTA_BATCH_READY = "m1.int.delta_batch_ready"
        CLASSIFIED_RECORDS = "m1.int.classified_records"
        CDM_ENTITIES_READY = "m1.int.cdm_entities_ready"
        AI_ROUTING_DECIDED = "m1.int.ai_routing_decided"
        AI_WRITE_COMPLETED = "m1.int.ai_write_completed"
        SYNC_FAILED = "m1.int.sync_failed"
        DELTA_WRITE_FAILED = "m1.int.delta_write_failed"
        SPARK_JOB_FAILED = "m1.int.spark_job_failed"
        MAPPING_FAILED = "m1.int.mapping_failed"
        DEAD_LETTER = "m1.int.dead_letter"
        STRUCTURAL_CYCLE_TRIGGERED = "m1.int.structural_cycle_triggered"
        SOURCE_SCHEMA_EXTRACTED = "m1.int.source_schema_extracted"

    class CDM:
        EXTENSION_PROPOSED = "nexus.cdm.extension_proposed"
        VERSION_PUBLISHED = "nexus.cdm.version_published"
        EXTENSION_REJECTED = "nexus.cdm.extension_rejected"
        ROLLBACK_REQUESTED = "nexus.cdm.rollback_requested"
```

---

## 17. P1-CORE-03 — nexus_core: CDMRegistryService

**Owner:** Backend-M1
**Depende de:** P0-INFRA-03, P1-CORE-02

### nexus_core/cdm_registry.py

```python
# nexus_core/cdm_registry.py
import asyncpg
import logging
from dataclasses import dataclass
from typing import Optional, Dict, Tuple
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

# Cache en memoria: key=(tenant_id, source_system, source_table, source_field, cdm_version)
# value=(MappingResult, expires_at)
_MAPPING_CACHE: Dict[Tuple, Tuple] = {}
CACHE_TTL_SECONDS = 300  # 5 minutos


@dataclass
class MappingResult:
    cdm_entity: str
    cdm_field: str
    confidence: float
    tier: int   # 1=auto-aplicar, 2=aplicar+flag, 3=source_extras


class CDMRegistryService:
    """
    Servicio de acceso al registro de mapeos CDM.
    Mantiene cache en memoria con TTL de 5 minutos por tenant.
    Invalida cache al recibir {tid}.m4.mapping_approved.
    """

    def __init__(self, pool: asyncpg.Pool):
        self._pool = pool

    async def get_mapping(
        self,
        tenant_id: str,
        source_system: str,
        source_table: str,
        source_field: str,
        cdm_version: str,
    ) -> Optional[MappingResult]:
        """
        Obtiene el mapeo CDM para un campo de un sistema fuente.
        Retorna None si no existe mapeo (NO lanza excepción).
        Cache: 5 minutos. Invalida con invalidate_cache().
        """
        cache_key = (tenant_id, source_system, source_table, source_field, cdm_version)
        
        # Verificar cache
        if cache_key in _MAPPING_CACHE:
            result, expires_at = _MAPPING_CACHE[cache_key]
            if datetime.utcnow() < expires_at:
                logger.debug(f"Cache hit para {cache_key}")
                return result
            else:
                del _MAPPING_CACHE[cache_key]

        # Cache miss — consultar PostgreSQL con RLS
        from nexus_core.db import get_tenant_scoped_connection
        async with await get_tenant_scoped_connection(self._pool, tenant_id) as conn:
            row = await conn.fetchrow("""
                SELECT cdm_entity, cdm_field, confidence, tier
                FROM nexus_system.cdm_mappings
                WHERE tenant_id    = $1
                  AND source_system = $2
                  AND source_table  = $3
                  AND source_field  = $4
                  AND cdm_version   = $5
                ORDER BY tier ASC, confidence DESC
                LIMIT 1
            """, tenant_id, source_system, source_table, source_field, cdm_version)

        result = MappingResult(**dict(row)) if row else None
        
        # Guardar en cache
        _MAPPING_CACHE[cache_key] = (
            result,
            datetime.utcnow() + timedelta(seconds=CACHE_TTL_SECONDS)
        )
        logger.debug(f"Cache miss para {cache_key} — resultado: {result}")
        return result

    async def invalidate_cache(self, tenant_id: str) -> None:
        """
        Invalida TODAS las entradas del cache para un tenant.
        Llamar cuando se recibe {tid}.m4.mapping_approved.
        """
        keys_to_delete = [k for k in _MAPPING_CACHE if k[0] == tenant_id]
        for k in keys_to_delete:
            del _MAPPING_CACHE[k]
        logger.info(f"Cache CDM invalidado para tenant={tenant_id}: "
                   f"{len(keys_to_delete)} entradas eliminadas")
```

---

## 18. Estructura Completa del Paquete nexus_core

### Layout de archivos

```
nexus-platform/
├── nexus_core/
│   ├── __init__.py
│   ├── messaging.py        # NexusMessage, NexusProducer, NexusConsumer
│   ├── tenant.py           # TenantContext, get_tenant(), set_tenant()
│   ├── tenant_validator.py # is_active_tenant() — validación contra BD
│   ├── provisioning.py     # onboard_tenant() + CLI
│   ├── identity.py         # NexusUserIdentity, get_user_identity()
│   ├── topics.py           # CrossModuleTopicNamer
│   ├── entities.py         # CDMParty, CDMTransaction, CDMEmployee, etc.
│   ├── schemas.py          # SourceKnowledgeArtifact, ProposedInterpretation
│   ├── errors.py           # NexusException hierarchy
│   ├── logging.py          # structlog setup con safe_log
│   ├── db.py               # get_tenant_scoped_connection()
│   ├── cdm_registry.py     # CDMRegistryService
│   └── oidc.py             # get_oidc_config(), validate_env()
├── tests/
│   └── unit/
│       ├── test_messaging.py
│       ├── test_tenant.py
│       ├── test_topics.py
│       └── test_cdm_registry.py
├── pyproject.toml
└── README.md
```

### pyproject.toml

```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "nexus_core"
version = "1.0.0"
description = "NEXUS shared foundation library"
requires-python = ">=3.11"
dependencies = [
    "confluent-kafka>=2.3.0",
    "asyncpg>=0.29.0",
    "httpx>=0.27.0",
    "structlog>=24.0.0",
    "opentelemetry-api>=1.24.0",
    "opentelemetry-sdk>=1.24.0",
]

[project.scripts]
onboard-tenant = "nexus_core.provisioning:cli"

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

---

## 19. Verificación de Fase 1 Completa

### Checklist de Gate — NO se avanza a Fase 2 sin esto

```
INFRAESTRUCTURA (DevOps)
☐ P0-INFRA-01: kubectl get namespaces -l project=nexus muestra 4 namespaces Active
☐ P0-INFRA-01: Network policy verificada: nexus-app NO puede alcanzar nexus-infra directamente
☐ P0-INFRA-02: kafka-topics.sh --list muestra los 18 topics estáticos
☐ P0-INFRA-02: m1.int.raw_records tiene 16 particiones, RF=2
☐ P0-INFRA-02: m1.int.dead_letter tiene RF=3
☐ P0-INFRA-02: Kafka UI accesible en kafka-ui.nexus.internal
☐ P0-INFRA-03: psql muestra schema nexus_system con 10 tablas
☐ P0-INFRA-03: Redis PING → PONG desde nexus-app
☐ P0-INFRA-04: MinIO con 3 buckets. Write/Read/Delete test exitoso.
☐ P0-INFRA-05: Request sin JWT → 401. Con JWT → 200 + X-Tenant-ID header.
☐ P0-INFRA-05: Rate limiting: 101 requests en 1 min → 429
☐ P0-INFRA-06: Airflow UI accesible. KafkaSensor importa sin error.
☐ P0-INFRA-07: SparkJob de prueba lee MinIO y escribe Delta correctamente
☐ P0-INFRA-08: ExternalSecret sincroniza desde AWS Secrets Manager en <60s
☐ P0-INFRA-09: Dashboard NEXUS Pipeline Health con 6 paneles cargado en Grafana
☐ P0-INFRA-09: Prometheus scrapeando métricas Kafka JMX

TECH LEAD
☐ LEAD-00: onboard-tenant --tenant-id test-alpha → exitoso + 12 topics creados
☐ LEAD-00: Segunda ejecución → idempotente (no error, no duplicados)
☐ LEAD-00: tenant_id con punto → ValueError inmediato
☐ LEAD-01: RLS habilitado en las 8 tablas. SELECT sin set_tenant → 0 filas.
☐ LEAD-01: get_tenant_scoped_connection() llamado sin TenantContext → RuntimeError
☐ LEAD-02: Okta dev org activo. JWKS endpoint responde correctamente.
☐ LEAD-02: JWT generado con usuario test-alpha contiene claim tenant_id="test-alpha"
☐ LEAD-02: Kong valida JWT de Okta. X-Tenant-ID inyectado correctamente.

NEXUS_CORE LIBRARY
☐ P1-CORE-01: NexusProducer publica 10 msgs. NexusConsumer los recibe.
☐ P1-CORE-01: Crash mid-batch → mensajes reentregados tras restart
☐ P1-CORE-01: safe_log_repr() no contiene campos sensibles
☐ P1-CORE-02: get_tenant() fuera de contexto → LookupError
☐ P1-CORE-02: CrossModuleTopicNamer con tenant_id con punto → ValueError
☐ P1-CORE-02: m1_outbound("acme-corp", "sync_completed") → "acme-corp.m1.sync_completed"
☐ P1-CORE-03: get_mapping() cache miss → hit PostgreSQL. Segunda llamada → cache hit.
☐ P1-CORE-03: invalidate_cache() → próxima llamada vuelve a PostgreSQL
☐ P1-CORE-03: campo inexistente → None (nunca excepción)
```

---

## 20. Definition of Done Universal

Este checklist aplica a CADA tarea en TODAS las fases del proyecto.
No se marca ninguna tarea como "done" sin verificarlo:

### Calidad de código
```
☐ Unit tests escritos y pasando (mínimo 80% cobertura en lógica de negocio)
☐ Cero print() — solo structured logging (logger = logging.getLogger(__name__))
☐ Cero credenciales hardcodeadas (grep recursivo: password=, api_key=, token=)
☐ Todos los topic names via CrossModuleTopicNamer — cero string concatenation
☐ Type hints en todas las funciones públicas
```

### Comportamiento Kafka
```
☐ Offset commiteado SOLO después de procesamiento exitoso
☐ Test de crash-and-restart: mensajes no se pierden ni duplican
☐ NexusMessage envelope en todos los mensajes — cero raw dict publishes
☐ correlation_id propagado de mensaje entrante a TODOS los salientes
☐ Backpressure implementado donde aplica (Connector Worker)
```

### Seguridad
```
☐ Credenciales nunca en logs (grep pod logs: password, api_key, token, secret)
☐ TenantContext seteado al inicio de cada mensaje y readable downstream
☐ Cero cross-tenant en ningún query result
☐ get_tenant_scoped_connection() usado — nunca pool.acquire() directo
```

### Observabilidad
```
☐ OpenTelemetry span creado para la operación principal del worker
☐ trace_id presente en todos los mensajes Kafka producidos
☐ Prometheus counter incrementado en éxito Y en fallo
☐ Prometheus histogram para latencias de operaciones críticas
☐ Logs estructurados con tenant_id, correlation_id en cada línea
```

### Acceptance criteria
```
☐ Cada acceptance criterion del task spec pasa en entorno compartido (no solo local)
☐ Tech Lead ha revisado y firmado el PR
☐ Prueba de aislamiento multi-tenant ejecutada (si aplica)
```

---

*NEXUS Build Plan — Fase 1 · Mentis Consulting · Marzo 2026 · Confidencial*
*Este documento es el contrato de entrega para Semanas 1–3. Cualquier divergencia se escala al Tech Lead inmediatamente.*
