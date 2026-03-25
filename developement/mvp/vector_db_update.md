Below is a **clean, new specification document** rewritten explicitly for **high-throughput operation**, assuming:


# NEXUS Vector Database High-Throughput Sync

**Technical Specification v3.0 (Throughput-Optimized)**
**January 2025**

---

## 1. Design Goals

This specification defines a **high-throughput, write-optimized** vector synchronization pipeline.

### Primary goals

* Sustain **high event rates** with predictable latency
* Eliminate **read-before-write** operations on the hot path
* Scale linearly with Kafka partitions and worker replicas
* Minimize VectorDB read and list operations

### Non-goals

* Perfect semantic minimal-diff updates
* Reconstructing document state from VectorDB alone

---

## 2. System Assumptions

1. Upstream ingestion systems:

   * Emit events **only when document content changes**
   * Use the **same canonicalization and hashing logic** as the worker
2. `version` is **monotonically increasing** per `(source_system, document_id)`
3. Kafka ensures **per-document ordering** via partitioning
4. VectorDB is optimized for **bulk writes**, not frequent reads

---

## 3. Architecture Overview

### Data Flow

```
[Source Systems]
     └─→ Ingestion Services
           └─→ Kafka (partitioned by document key)
                 └─→ Vector Sync Worker (stateless)
                       ├─→ Embedding Service
                       ├─→ Document Manifest Store
                       └─→ VectorDB
```

### Responsibility Boundaries

| Component          | Responsibility                              |
| ------------------ | ------------------------------------------- |
| Ingestion services | Change detection, canonicalization, hashing |
| Kafka              | Ordering, buffering, backpressure           |
| Vector Sync Worker | Chunking, embedding, vector lifecycle       |
| Manifest Store     | Minimal per-document state                  |
| VectorDB           | Vector storage & retrieval                  |

---

## 4. Event Schema (INSERT / UPDATE)

Upstream guarantees that each event represents a **content change**.

### Required Fields

| Field                      | Type     | Description                       |
| -------------------------- | -------- | --------------------------------- |
| `event_id`                 | string   | Unique event identifier           |
| `operation`                | enum     | `INSERT`, `UPDATE`, `DELETE`      |
| `source_system`            | string   | Origin system                     |
| `document_id`              | string   | Document identifier               |
| `document_type`            | string   | Category                          |
| `version`                  | integer  | Monotonically increasing          |
| `timestamp`                | ISO 8601 | Event time                        |
| `title`                    | string   | Document title                    |
| `content`                  | string   | Canonicalized full text           |
| `doc_hash`                 | string   | SHA-256 hash of canonical content |
| `hash_algo`                | string   | `sha256`                          |
| `canonicalization_version` | string   | Canonicalization contract         |

---

## 5. Canonicalization & Hashing Contract

Hashing is performed **upstream** and trusted by the worker.

Canonical form MUST be:

* UTF-8 encoded
* Unicode normalized (NFC)
* Normalized newlines (`\n`)
* Defined HTML → text rules (if applicable)

The worker MUST reject events where:

* `canonicalization_version` is unknown or incompatible

---

## 6. Document Manifest (Critical for Throughput)

A **Document Manifest** stores minimal per-document state.

### Manifest Fields

| Field            | Description                        |
| ---------------- | ---------------------------------- |
| `source_system`  | Partition key                      |
| `document_id`    | Partition key                      |
| `latest_version` | Last processed version             |
| `chunk_count`    | Number of chunks in latest version |
| `namespace`      | Target Pinecone namespace          |
| `doc_hash`       | Hash of latest version             |
| `updated_at`     | Timestamp                          |

### Storage Options

* Preferred: Redis / DynamoDB / PostgreSQL
* Acceptable (POC): Doc-level metadata record in VectorDB

---

## 7. Vector ID Strategy

Vector IDs are **deterministic and version-scoped**.

```
{source_system}:{document_id}:chunk:{index}:v{version}
```

This enables:

* Parallel writes
* Deterministic deletes
* No ID listing

---

## 8. Namespace Resolution

| Document Type     | Namespace      |
| ----------------- | -------------- |
| policy, procedure | policies       |
| email, message    | communications |
| contract, invoice | documents      |
| transcript        | transcripts    |
| default           | general        |

Namespace is resolved **once per event** and stored in the manifest.

---

## 9. Processing Logic (Write-Optimized)

### 9.1 INSERT

1. Validate event
2. Resolve namespace
3. Chunk document
4. Generate embeddings (batched)
5. Upsert vectors (≤100 per call)
6. Write manifest
7. Emit audit + metrics

---

### 9.2 UPDATE (High-Throughput Mode)

> **Default behavior: full re-chunk & re-embed**

1. Read document manifest
2. If `version <= latest_version` → skip (stale event)
3. Chunk new content
4. Generate embeddings (batched)
5. Upsert vectors for version `v`
6. Delete vectors for **previous version only**:

   ```
   {source_system}:{document_id}:chunk:*:v{v-1}
   ```

   (using known `chunk_count`)
7. Update manifest
8. Emit audit + metrics

❗ No vector listing
❗ No Pinecone reads on hot path

---

### 9.3 DELETE

1. Read manifest
2. Delete all known versions (bounded by manifest)
3. Remove manifest entry
4. Emit audit + metrics

---

## 10. Optional Incremental Update Mode (Cold Path)

Incremental chunk-level updates MAY be enabled for:

* Small documents
* Cost-sensitive sources

This mode:

* Runs in a **separate consumer group**
* May perform chunk-level diffing
* Is explicitly **non-default**

---

## 11. Concurrency & Ordering

* Kafka partition key:

  ```
  {source_system}:{document_id}
  ```
* Guarantees in-order processing per document
* Worker replicas scale linearly with partitions

---

## 12. Batching & Backpressure

### Embedding

* Batch by token count and/or chunk count
* Worker must apply backpressure if embedding queue grows

### VectorDB

* Max 100 vectors per upsert
* Group operations by namespace
* Commit Kafka offsets **after successful batch writes**

---

## 13. Metrics (Throughput-Focused)

| Metric                        | Type      |
| ----------------------------- | --------- |
| `vector_sync_events_total`    | Counter   |
| `vector_sync_latency_seconds` | Histogram |
| `embedding_tokens_total`      | Counter   |
| `embedding_latency_seconds`   | Histogram |
| `pinecone_upserts_total`      | Counter   |
| `pinecone_deletes_total`      | Counter   |
| `manifest_reads_total`        | Counter   |
| `stale_events_skipped_total`  | Counter   |
| `kafka_consumer_lag`          | Gauge     |

---

## 14. Failure Handling

| Failure                | Strategy            |
| ---------------------- | ------------------- |
| Embedding failure      | Retry with backoff  |
| VectorDB failure       | Retry batch         |
| Manifest write failure | Abort event         |
| Duplicate event        | Skip via `event_id` |
| Stale version          | Skip                |

---

## 15. Performance Characteristics

### Hot-path complexity (UPDATE)

* **Reads:** 1 manifest lookup
* **Writes:** O(chunks)
* **Deletes:** O(chunks)
* **VectorDB reads:** 0

This scales predictably with:

* document size
* embedding throughput
* Pinecone write bandwidth

---

## 16. Summary

This v3.0 specification:

* Trades **perfect minimal diffs** for **predictable high throughput**
* Removes Pinecone read/list bottlenecks
* Keeps the worker stateless and horizontally scalable
* Makes performance characteristics explicit and controllable


