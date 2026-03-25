# NEXUS — Inter-Team Contracts v1.0

**Fecha de creación:** Marzo 2026  
**Estado:** ACTIVO — vigente a partir de NEXUS v1.0.0  
**Owner:** Lead Architect NEXUS  

> Estos contratos son acuerdos formales entre equipos. **NUNCA pueden romperse sin notificación previa y aprobación de todos los involucrados.** Cualquier violación activa el proceso de escalación Nivel 3.

---

## Tabla de Contenidos

1. [Contrato 01: M1 Data Engineering → M2 AI & Knowledge](#contrato-01)
2. [Contrato 02: M2 AI & Knowledge → M3 Knowledge Specialization](#contrato-02)
3. [Contrato 03: M3 Knowledge → M2 RHMA (Read Path)](#contrato-03)
4. [Contrato 04: M2 Structural Agent → M4 Governance](#contrato-04)
5. [Contrato 05: M4 Governance → M6 UI](#contrato-05)
6. [Reglas de Cambio](#reglas-de-cambio)
7. [Proceso de Escalación](#proceso-de-escalación)

---

## Contrato 01: M1 Data Engineering → M2 AI & Knowledge {#contrato-01}

| Campo | Valor |
|---|---|
| **Productor** | M1 Data Engineering |
| **Consumidor** | M2 AI & Knowledge |
| **Topic Kafka** | `m1.int.ai_routing_decided` |
| **Partitionado por** | `tenant_id` |
| **Retención** | 7 días |
| **SLA Latencia** | Publicado en < 5 minutos desde comienzo del sync |
| **Replicación** | 3 réplicas, acks=all |

### Schema mínimo garantizado

```json
{
  "tenant_id":     "string — NUNCA null",
  "entity_type":   "string — uno de: party, transaction, product, employee, incident, unknown",
  "records":       "array — lista de registros clasificados (puede ser vacía)",
  "source_system": "string — identificador del sistema de origen",
  "cdm_version":   "string — versión CDM activa del tenant",
  "correlation_id": "string UUID — mismo UUID en todos los mensajes del pipeline",
  "trace_id":      "string UUID — para Jaeger distributed tracing"
}
```

### Garantías de calidad

- `entity_type` **NUNCA** será `null`. Si la clasificación falla → valor `"unknown"`.
- Si `entity_type = "unknown"`, los `records` son excluidos del routing (M2 los ignora).
- Los `records` contienen siempre `source_record_id` — usado como clave de idempotencia.
- Los mensajes son **backward-compatible**: M1 puede agregar campos pero NUNCA eliminar ni renombrar.

### Comportamiento ante fallos

- Si M1 falla antes de publicar → M2 espera el mensaje (no hay timeout de fallback).
- M2 **NO** llama a M1 via REST para recuperar datos. Solo consume de Kafka.
- Si el message broker no está disponible → ambos módulos quedan en pausa hasta que Kafka se recupere.

### Ownership y contactos

| Rol | Equipo | Slack |
|---|---|---|
| Responsable Producción | M1 Data Engineering Lead | #nexus-m1 |
| Responsable Consumo | M2 ML Engineer | #nexus-ai |

---

## Contrato 02: M2 AI & Knowledge → M3 Knowledge Specialization {#contrato-02}

| Campo | Valor |
|---|---|
| **Productor** | M2 / M1 AIStoreRouter (mismo topic) |
| **Consumidor** | M3 AIStoreWriteOrchestrator |
| **Topic Kafka** | `m1.int.ai_routing_decided` (shared con Contrato 01) |
| **Consumer Group** | `m1-ai-store-writers` |
| **SLA Escritura** | AI stores actualizados < 3 minutos desde recepción |

### Tabla de routing (INMUTABLE — cambios requieren CDR)

| entity_type | Pinecone | Neo4j | TimescaleDB |
|---|---|---|---|
| party | ✅ | ✅ | ❌ |
| transaction | ❌ | ✅ | ✅ |
| product | ✅ | ❌ | ❌ |
| employee | ✅ | ✅ | ❌ |
| incident | ✅ | ❌ | ✅ |

### Garantías de idempotencia

- M3 es **idempotente**: re-delivery del mismo mensaje siempre produce el mismo estado final.
- Pinecone: upsert por `vector_id = {tenant_id}#{source_record_id}`.
- Neo4j: `MERGE` por `(source_record_id, tenant_id)`.
- TimescaleDB: `ON CONFLICT (tenant_id, source_record_id, extracted_at) DO UPDATE`.

### Embeddings — regla CRÍTICA

> **El modelo de embeddings es `all-MiniLM-L6-v2` LOCAL (384 dimensiones). NUNCA cambiar a OpenAI o cualquier otro modelo sin un Change Design Record (CDR) aprobado por Lead Architect.** Cambiar el modelo requiere re-indexar TODOS los vectores de TODOS los tenants.

### Comportamiento ante fallos de stores

- Si falla escritura en Pinecone → registrar en `m1.int.dead_letter`; continuar con Neo4j/TimescaleDB.
- Si falla escritura en Neo4j → registrar en `m1.int.dead_letter`; continuar con los demás.
- M3 **no detiene** el procesamiento por el fallo de un solo store.

### Ownership

| Rol | Equipo | Slack |
|---|---|---|
| Responsable | Platform Engineer | #nexus-platform |

---

## Contrato 03: M3 Knowledge → M2 RHMA (Read Path) {#contrato-03}

| Campo | Valor |
|---|---|
| **Proveedor** | M3 (Pinecone + Neo4j + TimescaleDB) |
| **Consumidor** | M2 RHMA SearchWorker (vía SDK directo, NO Kafka) |
| **Protocolo** | SDK nativo de cada store (pinecone, neo4j driver, asyncpg) |
| **SLA Disponibilidad** | 99.5% en horario laboral (EU/CET) |

### SLA de latencia de lectura

| Store | Operación | P50 | P95 máximo |
|---|---|---|---|
| Pinecone | Query por vector | < 100ms | **500ms** |
| Neo4j | Cypher query simple | < 200ms | **1000ms** |
| TimescaleDB | SELECT + aggregate | < 300ms | **1500ms** |

### Convenciones de naming CRÍTICAS (NUNCA cambiar)

```
Pinecone:
  index_name     = "nexus-{tenant_id}-{entity_type}"
  vector_id      = "{tenant_id}#{source_record_id}"
  metadata field = "tenant_id" — siempre presente

Neo4j:
  node_labels    = ["{entity_type_capitalized}", "Tenant_{tenant_id}"]
  merge_key      = {source_record_id, tenant_id}

TimescaleDB:
  schema         = "nexus_m3"
  table          = "timeseries"
  partition_col  = "extracted_at"
  unique_key     = (tenant_id, source_record_id, extracted_at)
```

### Aislamiento de tenants

- M2 RHMA **SIEMPRE** filtra por `tenant_id` en todas las queries.
- No está permitido hacer queries cross-tenant desde SearchWorker.
- OPA verifica que el `tenant_id` del JWT coincide con el `tenant_id` del request.

### Ownership

| Rol | Equipo | Slack |
|---|---|---|
| Responsable | Platform Engineer | #nexus-platform |

---

## Contrato 04: M2 Structural Agent → M4 Governance {#contrato-04}

| Campo | Valor |
|---|---|
| **Productor** | M2 Structural Agent |
| **Consumidor** | M4 Governance (NestJS + FastAPI) |
| **Topic Kafka** | `nexus.cdm.extension_proposed` |
| **SLA en cola** | Propuesta visible en `governance_queue` < 30 segundos tras publicación |
| **SLA revisión humana** | Equipo de governance revisa en < 24h en días laborables |

### Schema garantizado

```json
{
  "proposal_id":            "string UUID",
  "tenant_id":              "string",
  "proposed_entity_type":   "string",
  "justification":          "string — explicación del LLM",
  "field_mappings": [
    {
      "source_field":  "string",
      "cdm_entity":    "string",
      "cdm_field":     "string",
      "confidence":    "float 0.0-1.0",
      "tier":          "integer 1|2|3"
    }
  ],
  "confidence_overall":     "float 0.0-1.0",
  "requires_cdm_extension": "boolean",
  "schema_snapshot_id":     "string UUID — referencia al snapshot"
}
```

### Flujo de aprobación/rechazo

```
M2 publica →  nexus.cdm.extension_proposed
                         ↓
M4 inserta en governance_queue (status='pending')
                         ↓
Revisor humano aprueba/rechaza en UI
                         ↓
Si APROBADO:   M4 publica nexus.cdm.version_published
               M4 crea nueva versión en nexus_system.cdm_versions
               CDMRegistryService invalida cache en < 5 min
                         ↓
Si RECHAZADO:  M2 Structural Agent puede reintentar 1 vez con feedback
               Si segundo rechazo → archivar propuesta
```

### Ownership

| Rol | Equipo | Slack |
|---|---|---|
| Responsable M2 | ML Engineer | #nexus-ai |
| Responsable M4 | Backend Engineer | #nexus-backend |

---

## Contrato 05: M4 Governance → M6 UI (y usuarios finales) {#contrato-05}

| Campo | Valor |
|---|---|
| **Proveedor** | M4 Governance FastAPI (puerto 8000) |
| **Consumidor** | M6 Angular UI (vía proxy NestJS en puerto 3000) |
| **Protocolo** | REST/JSON HTTPS |
| **Autenticación** | Kong valida JWT Okta ANTES de que el request llegue a M4 |

### SLA de la API

| Tipo | P95 máximo |
|---|---|
| GET (listados, detalles) | **500ms** |
| POST (approve, reject) | **2000ms** |
| GET /health | **100ms** |

### Headers obligatorios

```http
X-Tenant-ID: {tenant_id}   — Inyectado por Kong desde JWT claim (nunca por el frontend)
Authorization: Bearer {jwt} — JWT de Okta validado por Kong
Content-Type: application/json
```

### Formato de error estándar

```json
{
  "error": "mensaje legible para humanos",
  "code": "NEXUS_xxx",
  "request_id": "UUID para trazabilidad"
}
```

Códigos de error definidos:
- `NEXUS_001` — Tenant no encontrado
- `NEXUS_002` — Propuesta no encontrada
- `NEXUS_003` — Estado inválido para la operación (ej: aprobar una propuesta ya aprobada)
- `NEXUS_004` — Error de base de datos
- `NEXUS_401` — No autenticado
- `NEXUS_403` — Sin permisos para este tenant

### Datos visibles

- **Solo** datos del `tenant_id` del usuario autenticado.
- RLS de PostgreSQL garantiza esto a nivel de base de datos.
- M4 **no expone** data de otros tenants bajo ninguna circunstancia.

### Versioning

- URL base: `/api/governance/v1/...`
- Breaking changes requieren nuevo prefijo (`/api/governance/v2/...`).
- Los endpoints v1 deben mantenerse deprecados durante 90 días antes de ser eliminados.

### Ownership

| Rol | Equipo | Slack |
|---|---|---|
| Responsable M4 | Backend Engineer | #nexus-backend |
| Responsable M6 | Frontend Engineer | #nexus-frontend |

---

## Reglas de Cambio {#reglas-de-cambio}

### Cambios que REQUIEREN aprobación

Cualquier cambio que afecte un contrato inter-equipo requiere:

1. **Issue GitHub** etiquetado con `breaking-change` y el contrato afectado (ej: `contract:01`).
2. **48 horas de aviso previo** (excepto hotfixes de seguridad críticos).
3. **Aprobación del Lead** del equipo consumidor.
4. **Actualización** de este documento.
5. **Versión** del contrato incrementada (Major → breaking, Minor → backward-compatible).

### Categorías de cambio

| Tipo | Ejemplos | Proceso |
|---|---|---|
| **Non-breaking (OK)** | Agregar campos opcionales a mensajes Kafka | Notificación en Slack |
| **Deprecation** | Marcar campo como "will be removed" | Issue + 90 días |
| **Breaking** | Renombrar campo, cambiar tipo, eliminar campo | CDR + aprobación + 48h aviso |
| **Naming convention** | Cambiar formato de vector_id, Neo4j labels | CDR + re-indexación planificada |

### Cambios específicamente PROHIBIDOS sin CDR

- Cambiar el modelo de embeddings (`all-MiniLM-L6-v2`).
- Cambiar el formato de `vector_id` (`{tenant_id}#{source_record_id}`).
- Cambiar el formato de labels Neo4j (`{Entity}:Tenant_{tenant_id}`).
- Cambiar el nombre de topics Kafka estáticos.
- Cambiar el `partition_key` de cualquier topic.

---

## Proceso de Escalación {#proceso-de-escalación}

### Nivel 1 — Bloqueo técnico < 2h

- Intentar resolver en Slack del equipo + peer review.
- Si no hay solución: mencionar `@lead` del equipo.

### Nivel 2 — Bloqueo > 4h o afecta a otro equipo

- Crear issue con label `blocked` en GitHub.
- Notificar en `#nexus-leads`.
- Daily standup de 15 minutos adicional.

### Nivel 3 — Contrato Inter-Equipo violado

- **Notificación INMEDIATA** al Lead Architect.
- Post-mortem dentro de 24h.
- Contrato actualizado si se cambió el comportamiento.
- Revisión de si el cambio fue intencional o accidental.

---

*NEXUS Inter-Team Contracts — v1.0.0 — Marzo 2026 — Mentis Consulting*
