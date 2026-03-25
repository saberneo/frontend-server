# NEXUS Platform — API Reference

**Version:** 1.0.0  
**Last updated:** March 2026  
**Base URLs:**
- NestJS Backend: `http://localhost:3000/api` (dev) · `https://api.nexus.mentis-consulting.be/api` (prod, via Kong)
- M4 Governance API: `http://localhost:8004` (dev) · `https://api.nexus.mentis-consulting.be/governance` (prod, via Kong)

**Authentication:** All NestJS endpoints (except `/auth/login`) require `Authorization: Bearer <JWT>`.  
The JWT is issued by `/auth/login` and signed with RS256. Kong validates the token at the gateway before forwarding.

---

## Contents

1. [Authentication](#1-authentication)
2. [Users](#2-users)
3. [Tenants](#3-tenants)
4. [Customers](#4-customers)
5. [Orders](#5-orders)
6. [Products](#6-products)
7. [Source Connectors](#7-source-connectors)
8. [Schemas](#8-schemas)
9. [Approvals](#9-approvals)
10. [Governance (NestJS)](#10-governance-nestjs)
11. [CDM Versions](#11-cdm-versions)
12. [Audit Log](#12-audit-log)
13. [Dashboard](#13-dashboard)
14. [System Health](#14-system-health)
15. [AI Chat](#15-ai-chat)
16. [M4 Governance API (FastAPI)](#16-m4-governance-api-fastapi)

---

## 1. Authentication

All auth endpoints: `POST/GET /api/auth/*`

### POST `/api/auth/login`
Authenticate with email + password. Returns a signed JWT.

**Request body:**
```json
{
  "email": "admin@nexus.io",
  "password": "Admin1234!"
}
```
**Response 200:**
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "user": { "id": 1, "email": "admin@nexus.io", "role": "admin", "tenantId": "t-001" }
}
```
**Response 401:** Invalid credentials.

---

### GET `/api/auth/me`
Returns the currently authenticated user.

**Headers:** `Authorization: Bearer <token>`  
**Response 200:**
```json
{ "id": 1, "email": "admin@nexus.io", "role": "admin", "tenantId": "t-001" }
```

---

### POST `/api/auth/logout`
Invalidates the current JWT (added to server-side blacklist).

**Response 204:** No content.

---

### POST `/api/auth/totp/setup`
Starts TOTP (Google Authenticator) 2FA enrollment. Returns QR code URI.

**Response 200:**
```json
{ "otpauth_url": "otpauth://totp/NEXUS:admin%40nexus.io?secret=BASE32SECRET&issuer=NEXUS" }
```

### POST `/api/auth/totp/verify`
Verifies a TOTP token during enrollment.

**Request body:** `{ "token": "123456" }`  
**Response 200:** `{ "verified": true }`

### POST `/api/auth/totp/disable`
Disables TOTP for the current user.

### POST `/api/auth/totp/validate`
Validates a TOTP code during login (second factor).

**Request body:** `{ "token": "123456" }`

### POST `/api/auth/forgot-password`
Sends a password-reset email.

**Request body:** `{ "email": "user@nexus.io" }`  
**Response 202:** Reset email dispatched.

### POST `/api/auth/change-password`
Changes password for the authenticated user.

**Request body:**
```json
{ "currentPassword": "Admin1234!", "newPassword": "NewSecure#567" }
```

---

## 2. Users

Base path: `/api/users`  
Required role: `admin`

### GET `/api/users`
Returns paginated list of users.

**Query params:** `page` (default 1), `limit` (default 20), `role`  
**Response 200:**
```json
{
  "data": [{ "id": 1, "email": "admin@nexus.io", "role": "admin", "tenantId": "t-001", "createdAt": "2026-01-15T10:00:00Z" }],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

### GET `/api/users/:id`
Returns a single user by ID.

### POST `/api/users`
Creates a new user.

**Request body:**
```json
{ "email": "new@nexus.io", "password": "Secure#789", "role": "viewer", "tenantId": "t-001" }
```
**Response 201:** Created user object.

### PATCH `/api/users/:id`
Updates user fields (email, role, active status).

**Request body:** Partial user object.

### DELETE `/api/users/:id`
Soft-deletes a user. Cannot delete your own account.

---

## 3. Tenants

Base path: `/api/tenants`  
Required role: `admin`

### GET `/api/tenants`
Returns all tenants.

**Response 200:**
```json
[{ "id": "t-001", "name": "Acme Corp", "plan": "enterprise", "status": "active", "activatedAt": "2026-01-01T00:00:00Z" }]
```

### GET `/api/tenants/:id`
Returns a single tenant.

### POST `/api/tenants`
Creates a new tenant (triggers Kafka topic provisioning via `onboard_tenant.py`).

**Request body:**
```json
{ "id": "t-002", "name": "Beta LLC", "plan": "professional" }
```

### PATCH `/api/tenants/:id`
Updates tenant metadata or plan.

---

## 4. Customers

Base path: `/api/customers`

### GET `/api/customers`
Returns paginated customer list.

**Query params:** `page`, `limit`, `tenantId`, `status` (`active` | `inactive`)  
**Response 200:**
```json
{
  "data": [{ "id": "c-001", "name": "ACME Corp", "industry": "Technology", "status": "active", "tenantId": "t-001" }],
  "total": 5000, "page": 1, "limit": 20
}
```

### GET `/api/customers/:id`
Returns a single customer with full profile.

### GET `/api/customers/:id/orders`
Returns all orders for a specific customer.

### POST `/api/customers`
Creates a customer record.

### PUT `/api/customers/:id`
Full-update a customer record.

### PATCH `/api/customers/:id/status`
Sets a customer's active/inactive status.

**Request body:** `{ "status": "inactive", "reason": "Contract ended" }`

### DELETE `/api/customers/:id`
Soft-deletes a customer.

---

## 5. Orders

Base path: `/api/orders`

### GET `/api/orders`
Returns paginated orders.

**Query params:** `page`, `limit`, `tenantId`, `status`, `customerId`, `from`, `to` (ISO dates)

**Response 200:**
```json
{
  "data": [{ "id": "o-001", "customerId": "c-001", "totalAmount": 12500.00, "status": "CONFIRMED", "createdAt": "2026-01-20T09:00:00Z" }],
  "total": 5000, "page": 1, "limit": 20
}
```

### GET `/api/orders/stats`
Returns aggregated order statistics.

**Response 200:**
```json
{ "totalRevenue": 62500000, "totalOrders": 5000, "avgOrderValue": 12500, "byStatus": { "CONFIRMED": 4100, "PENDING": 600, "CANCELLED": 300 } }
```

### GET `/api/orders/analytics`
Returns time-series revenue analytics.

**Query params:** `from`, `to`, `granularity` (`day` | `week` | `month`)

### GET `/api/orders/:id`
Returns a single order with line items.

### POST `/api/orders`
Creates an order.

### PATCH `/api/orders/:id/status`
Updates order status.

**Request body:** `{ "status": "SHIPPED", "note": "Dispatched from warehouse A" }`

---

## 6. Products

Base path: `/api/products`

### GET `/api/products`
Returns paginated product catalog.

**Query params:** `page`, `limit`, `category`, `tenantId`

### GET `/api/products/stats`
Category breakdown and stock stats.

### GET `/api/products/categories`
List of all product categories.

### GET `/api/products/:id`
Full product detail.

### POST `/api/products`
Create a product.

**Request body:**
```json
{ "name": "Enterprise License", "sku": "ENT-001", "price": 9999.00, "category": "Software", "tenantId": "t-001" }
```

### PUT `/api/products/:id`
Full-replace a product record.

### DELETE `/api/products/:id`
Soft-delete a product.

---

## 7. Source Connectors

Base path: `/api/connectors`  
Required role: `admin`

### GET `/api/connectors`
Returns all configured data source connectors.

**Query params:** `tenantId`, `status` (`active` | `paused` | `error`)  
**Response 200:**
```json
[{
  "id": "conn-001",
  "tenantId": "t-001",
  "systemType": "salesforce",
  "status": "active",
  "lastSyncAt": "2026-03-08T06:00:00Z",
  "syncMode": "incremental"
}]
```

### GET `/api/connectors/:id`
Returns single connector with sync history.

### POST `/api/connectors`
Creates a new connector configuration.

**Request body:**
```json
{
  "tenantId": "t-001",
  "systemType": "salesforce",
  "name": "SF Production",
  "config": { "instance_url": "https://mycompany.salesforce.com" },
  "credentials": { "client_id": "...", "client_secret": "..." },
  "syncMode": "incremental",
  "syncSchedule": "0 */6 * * *"
}
```

### POST `/api/connectors/:id/sync`
Triggers an on-demand sync job for the connector.

**Request body:** `{ "mode": "incremental" }` (`full` also accepted)  
**Response 202:** `{ "syncJobId": "job-001", "status": "queued" }`

### PATCH `/api/connectors/:id`
Updates connector config or schedule.

### DELETE `/api/connectors/:id`
Removes a connector and its credentials.

---

## 8. Schemas

Base path: `/api/schemas`

### GET `/api/schemas`
Returns all registered source schemas.

**Query params:** `tenantId`, `connectorId`

### GET `/api/schemas/:id`
Returns a schema with full column profile.

### GET `/api/schemas/:id/tables`
Returns all tables within a schema with row counts and column stats.

### PATCH `/api/schemas/:id/reprofile`
Triggers a fresh schema profiling scan.

**Response 202:** `{ "jobId": "profile-001", "status": "queued" }`

### POST `/api/schemas/snapshot-all`
Captures a snapshot of all active schemas for drift detection.

**Response 202:** `{ "snapshotsQueued": 12 }`

---

## 9. Approvals

Base path: `/api/approvals`  
Required role: `admin` or `governance-reviewer`

### GET `/api/approvals`
Returns all approval records.

**Query params:** `status` (`pending` | `approved` | `rejected`), `tenantId`

### GET `/api/approvals/pending`
Returns only pending approvals (shortcut).

### GET `/api/approvals/stats`
Summary counts by status and type.

**Response 200:**
```json
{ "pending": 14, "approved": 203, "rejected": 12, "byType": { "cdm_extension": 8, "mapping_review": 6 } }
```

### GET `/api/approvals/:id`
Single approval record detail.

### PATCH `/api/approvals/:id/resolve`
Resolves an approval (approve or reject).

**Request body:** `{ "decision": "approved", "comment": "Verified mapping is correct" }`

### POST `/api/approvals/resolve-all`
Bulk-resolves all pending approvals.

**Request body:** `{ "decision": "approved", "comment": "Batch approved after review" }`

---

## 10. Governance (NestJS)

Base path: `/api/governance`

These mirror the M4 FastAPI governance API but are proxied through the NestJS backend to apply RBAC.

### GET `/api/governance/proposals`
Returns CDM extension proposals from the governance queue.

**Query params:** `status` (`pending` | `approved` | `rejected`), `tenantId`

### POST `/api/governance/proposals/:id/approve`
Approves a CDM proposal. Triggers `nexus.cdm.version_published` Kafka event.

**Request body:** `{ "approver": "lead-architect", "notes": "Schema extension approved" }`  
**Response 200:** Updated proposal object.

### POST `/api/governance/proposals/:id/reject`
Rejects a CDM proposal.

**Request body:** `{ "approver": "lead-architect", "reason": "Duplicate field" }`

### GET `/api/governance/mapping-reviews`
Returns field mapping review requests (Tier 3 low-confidence mappings).

**Query params:** `status`, `tenantId`, `sourceSystem`

### POST `/api/governance/mapping-reviews/:id/approve`
Approves a field mapping. Promotes to Tier 1 for future syncs.

### POST `/api/governance/mapping-reviews/:id/reject`
Rejects a field mapping. Marks as `manual_required`.

### GET `/api/governance/sync-jobs`
Returns sync job history.

**Query params:** `tenantId`, `connectorId`, `status` (`running` | `completed` | `failed`), `limit`

---

## 11. CDM Versions

Base path: `/api/cdm-versions`

### GET `/api/cdm-versions`
Returns all CDM versions across tenants.

**Query params:** `tenantId`

### GET `/api/cdm-versions/active`
Returns the currently active CDM version for the requesting tenant.

**Response 200:**
```json
{ "version": "1.2.0", "tenantId": "t-001", "status": "active", "publishedAt": "2026-03-01T12:00:00Z", "changesSummary": "Added Product.sku field" }
```

---

## 12. Audit Log

Base path: `/api/audit`

### GET `/api/audit`
Returns paginated audit log entries.

**Query params:** `tenantId`, `userId`, `action`, `entityType`, `from`, `to`, `page`, `limit`  
**Response 200:**
```json
{
  "data": [{ "id": 1, "userId": 1, "action": "approve_proposal", "entityType": "cdm_proposal", "entityId": "prop-001", "metadata": {}, "createdAt": "2026-03-08T10:30:00Z" }],
  "total": 2450
}
```

### GET `/api/audit/entity`
Returns audit history for a specific entity.

**Query params:** `entityType`, `entityId`

### POST `/api/audit/governance-action`
Records a governance action in the audit log (internal use by M4).

**Request body:**
```json
{ "action": "approve_proposal", "entityType": "cdm_proposal", "entityId": "prop-001", "metadata": { "approver": "admin@nexus.io" } }
```

---

## 13. Dashboard

Base path: `/api/dashboard`

### GET `/api/dashboard/stats`
Returns platform-wide KPI summary for the authenticated tenant.

**Response 200:**
```json
{
  "totalCustomers": 5000,
  "totalOrders": 5000,
  "totalRevenue": 62500000,
  "activeConnectors": 6,
  "syncJobsToday": 24,
  "pendingApprovals": 14,
  "cdmVersion": "1.2.0",
  "dataHealthScore": 0.95
}
```

---

## 14. System Health

Base path: `/api/system-health`

### GET `/api/system-health`
Overall platform health (aggregated).

**Response 200:**
```json
{
  "status": "healthy",
  "components": { "kafka": "healthy", "postgres": "healthy", "redis": "healthy", "m4Api": "healthy" },
  "uptime": 99.98,
  "timestamp": "2026-03-08T12:00:00Z"
}
```

### GET `/api/system-health/db`
PostgreSQL connectivity and connection pool status.

**Response 200:**
```json
{ "status": "healthy", "responseTimeMs": 4, "poolSize": 10, "idleConnections": 7 }
```

### GET `/api/system-health/components`
Detailed per-component health including Kafka lag and M4 API status.

---

## 15. AI Chat

Base path: `/api/ai`  
Also available via **WebSocket** at `ws://localhost:3000/ai-chat`

### POST `/api/ai/chat`
Sends a message to the NEXUS AI assistant (RHMA M2 agent).

**Request body:**
```json
{
  "message": "What is the revenue trend for ACME Corp last quarter?",
  "tenantId": "t-001",
  "conversationId": "conv-abc123"
}
```
**Response 200 (streaming not yet active, polling mode):**
```json
{
  "response": "ACME Corp FY Q4 2025 revenue was €62.5M, up 12% YoY...",
  "criticsScore": 0.87,
  "confidence": "high",
  "sources": ["orders.2025-Q4", "customers.acme-001"],
  "tracingId": "trace-xyz789"
}
```

**WebSocket events:**
| Event | Direction | Payload |
|---|---|---|
| `ask` | Client → Server | `{ message, tenantId, conversationId }` |
| `response` | Server → Client | `{ chunk, done, criticsScore, tracingId }` |
| `error` | Server → Client | `{ code, message }` |
| `reconnect_attempt` | System | Emitted after disconnect; client should reconnect within 5s |

---

## 16. M4 Governance API (FastAPI)

Base URL: `http://localhost:8004` (direct) · `/api/governance` (via Kong in production)  
**Header required:** `x-tenant-id: <tenant_id>` on all governance endpoints.

This API is the Python FastAPI service (`nexus-python-platform/m4/`), running separately from the NestJS backend. In production it is accessed through Kong only — direct access is blocked by network policy.

---

### GET `/health`
Liveness check — no auth required.

**Response 200:** `{ "status": "ok" }`

---

### GET `/metrics`
Prometheus metrics endpoint.

**Response 200:** Prometheus text format (Content-Type: `text/plain`).

---

### GET `/api/governance/proposals`

List CDM governance proposals.

**Query params:** `status` (`pending` | `approved` | `rejected`), `limit` (default 50), `offset` (default 0)  
**Headers:** `x-tenant-id: t-001`  
**Response 200:**
```json
{
  "items": [{
    "proposal_id": "prop-abc123",
    "tenant_id": "t-001",
    "proposed_entity_type": "Account",
    "status": "pending",
    "confidence_overall": 0.78,
    "requires_cdm_extension": false,
    "source_system": "salesforce",
    "source_table": "account",
    "correlation_id": "corr-xyz",
    "created_at": "2026-03-08T10:00:00Z"
  }],
  "total": 14
}
```

### GET `/api/governance/proposals/{proposal_id}`
Returns a single proposal.

**Response 404** if not found or belongs to a different tenant.

### POST `/api/governance/proposals/{proposal_id}/approve`
Approves a CDM proposal. Publishes `nexus.cdm.version_published` to Kafka and creates a new CDM version entry.

**Request body:**
```json
{ "approver_id": "arch-001", "notes": "Approved after manual field verification" }
```
**Response 200:** Updated proposal object with `status: "approved"`.

### POST `/api/governance/proposals/{proposal_id}/reject`
Rejects a proposal.

**Request body:**
```json
{ "approver_id": "arch-001", "reason": "Duplicate of existing Account.phone field" }
```

---

### GET `/api/governance/mapping-reviews`
Lists field-level mapping review items (Tier 3 from CDMMapperWorker).

**Query params:** `status` (`pending` | `approved` | `rejected`), `source_system`, `limit`, `offset`

### POST `/api/governance/mapping-reviews/{review_id}/approve`
Approves a field mapping. Stores it with confidence=1.0 in `cdm_mappings` table.

**Request body:** `{ "approver_id": "arch-001", "cdm_entity": "Account", "cdm_field": "billingCity" }`

### POST `/api/governance/mapping-reviews/{review_id}/reject`
Rejects and marks for manual intervention.

---

### GET `/api/governance/sync-jobs`
Lists sync job records from M1.

**Query params:** `tenant_id`, `connector_id`, `status` (`running` | `completed` | `failed`), `limit`  
**Response 200:**
```json
{
  "items": [{
    "sync_job_id": "job-001",
    "tenant_id": "t-001",
    "connector_id": "conn-001",
    "system_type": "salesforce",
    "status": "completed",
    "records_extracted": 1240,
    "started_at": "2026-03-08T06:00:00Z",
    "completed_at": "2026-03-08T06:03:12Z"
  }],
  "total": 48
}
```

---

## Error Responses

All APIs return consistent error envelopes:

```json
{
  "statusCode": 400,
  "message": "Validation failed: email must be an email",
  "error": "Bad Request",
  "timestamp": "2026-03-08T12:00:00Z",
  "path": "/api/users"
}
```

| Code | Meaning |
|---|---|
| 400 | Validation error — check `message` for details |
| 401 | Missing or invalid JWT token |
| 403 | Authenticated but insufficient role/scope |
| 404 | Resource not found or belongs to a different tenant |
| 409 | Conflict (e.g., duplicate email or tenant ID) |
| 422 | Unprocessable entity (FastAPI) |
| 429 | Rate limit exceeded (Kong gateway) |
| 500 | Internal server error — check M4 logs |

---

## Rate Limits (Kong gateway)

| Route group | Rate limit |
|---|---|
| `/api/auth/login` | 10 requests/min per IP |
| `/api/ai/chat` | 20 requests/min per tenant |
| All other routes | 1000 requests/min per tenant |

---

*NEXUS API Reference — Mentis Consulting × InfiniteMind — v1.0.0*
