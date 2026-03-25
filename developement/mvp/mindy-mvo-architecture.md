# Mindy MVP Architecture

## Executive Summary

This document defines the **MVP Architecture** for Mindy - a simplified, achievable version of the full 6-module enterprise AI platform. The MVP focuses on delivering real business value (Finance + HR automation) while establishing the foundation for future expansion.

### Full Vision vs. MVP Scope

| Module | Full Vision | MVP Scope |
|--------|-------------|-----------|
| M1 - Data Mediation | 20+ connectors, real-time CDC, complex transformations | 5 connectors, basic CDC, simple normalization |
| M2 - RHMA Intelligence | Hierarchical agents, Council of Critics, World Model, RLHF | Planner + 2 Workers, simple validation |
| M3 - AI Database Engine | Advanced vector search, dynamic graph, predictive analytics | Basic RAG, static relationships, metrics storage |
| M4 - Workflow & Integration | Complex orchestration, dynamic workflows, multi-approval | 10 pre-defined workflows, simple approval chains |
| M5 - Infrastructure | Multi-region, auto-scaling, self-healing | Single region, manual scaling, basic monitoring |
| M6 - User Experience | Adaptive UI, voice, mobile, personalization | Web dashboard, chat interface, basic reports |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                   USERS                                          │
│                        (Web Browser - 20-30 Beta Users)                         │
└─────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        M6 - USER EXPERIENCE LAYER                                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                  │
│  │   Dashboard     │  │  Chat Interface │  │  Report Viewer  │                  │
│  │   (Next.js)     │  │   (WebSocket)   │  │     (PDF)       │                  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              API GATEWAY (NGINX)                                 │
│                    Authentication (JWT) │ Rate Limiting │ CORS                   │
└─────────────────────────────────────────────────────────────────────────────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    ▼                  ▼                  ▼
┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────────┐
│    CORE API SERVICE   │ │   WORKFLOW SERVICE    │ │    AGENT SERVICE      │
│      (Express.js)     │ │     (Express.js)      │ │     (Express.js)      │
│                       │ │                       │ │                       │
│ • User Management     │ │ • Workflow Execution  │ │ • Agent Orchestration │
│ • Dashboard APIs      │ │ • Task Management     │ │ • LLM Integration     │
│ • Report Generation   │ │ • Approval Routing    │ │ • RAG Queries         │
└───────────────────────┘ └───────────────────────┘ └───────────────────────┘
           │                         │                         │
           └─────────────────────────┼─────────────────────────┘
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        M2 - INTELLIGENCE LAYER (Simplified)                      │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                          PLANNER AGENT                                   │    │
│  │  • Receives user requests                                                │    │
│  │  • Decomposes into tasks                                                 │    │
│  │  • Routes to appropriate Worker                                          │    │
│  │  • Aggregates responses                                                  │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                          │                    │                                  │
│              ┌───────────┴───────┐    ┌──────┴────────┐                         │
│              ▼                   ▼    ▼               ▼                         │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐     │
│  │   FINANCE WORKER    │  │     HR WORKER       │  │  VALIDATION LAYER   │     │
│  │                     │  │                     │  │                     │     │
│  │ • ERP Queries       │  │ • Employee Queries  │  │ • Output Checking   │     │
│  │ • Financial Calcs   │  │ • HR Actions        │  │ • Error Detection   │     │
│  │ • Report Generation │  │ • Resume Analysis   │  │ • Quality Scoring   │     │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘     │
│              │                       │                       │                  │
│              └───────────────────────┴───────────────────────┘                  │
│                                      │                                          │
│                                      ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                         LLM INTEGRATION LAYER                            │    │
│  │         ┌─────────────┐              ┌─────────────┐                     │    │
│  │         │   GPT-4     │              │   Claude    │                     │    │
│  │         │  (Primary)  │              │ (Fallback)  │                     │    │
│  │         └─────────────┘              └─────────────┘                     │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        M3 - AI DATABASE LAYER (Simplified)                       │
│                                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                  │
│  │   VECTOR DB     │  │    GRAPH DB     │  │  TIME-SERIES DB │                  │
│  │   (Pinecone)    │  │  (Neo4j Aura)   │  │  (TimescaleDB)  │                  │
│  │                 │  │                 │  │                 │                  │
│  │ • Doc Embeddings│  │ • Entity Links  │  │ • Agent Metrics │                  │
│  │ • Semantic Search│ │ • Org Hierarchy │  │ • System Health │                  │
│  │ • RAG Context   │  │ • Relationships │  │ • Cost Tracking │                  │
│  │                 │  │                 │  │                 │                  │
│  │ 200-500 GB      │  │ 4vCPU/16GB/100GB│  │ 1yr hot/3yr arch│                  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          M4 - WORKFLOW LAYER (Simplified)                        │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                    WORKFLOW ENGINE (Simple State Machine)                │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                      │                                          │
│          ┌───────────────────────────┼───────────────────────────┐              │
│          ▼                           ▼                           ▼              │
│  ┌───────────────┐          ┌───────────────┐          ┌───────────────┐        │
│  │   FINANCE     │          │      HR       │          │    SHARED     │        │
│  │  WORKFLOWS    │          │  WORKFLOWS    │          │   SERVICES    │        │
│  │               │          │               │          │               │        │
│  │ 1. Expense    │          │ 1. Onboarding │          │ • Approvals   │        │
│  │ 2. Invoice    │          │ 2. Resume     │          │ • Notifications│       │
│  │ 3. Budget     │          │ 3. Time-Off   │          │ • Audit Log   │        │
│  │ 4. Close      │          │ 4. Review     │          │ • Email/Slack │        │
│  │ 5. Reports    │          │ 5. Offboard   │          │               │        │
│  └───────────────┘          └───────────────┘          └───────────────┘        │
└─────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        MESSAGE BROKER (Apache Kafka - MSK)                       │
│                                                                                  │
│    Topics: connector-events │ agent-tasks │ workflow-events │ notifications     │
└─────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                     M1 - DATA MEDIATION LAYER (Simplified)                       │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                    DATA TRANSFORMATION SERVICE                           │    │
│  │              (Normalize data to unified schema)                          │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                      │                                          │
│     ┌──────────┬──────────┬──────────┼──────────┬──────────┐                   │
│     ▼          ▼          ▼          ▼          ▼          │                   │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────────┐  ┌──────────┐  │                   │
│  │ ERP  │  │  HR  │  │ CRM  │  │ E-Commerce│ │Production │  │                   │
│  │Connec│  │Connec│  │Connec│  │ Connector │ │ Connector │  │                   │
│  └──────┘  └──────┘  └──────┘  └──────────┘  └──────────┘  │                   │
│     │          │          │          │            │         │                   │
│     ▼          ▼          ▼          ▼            ▼         │                   │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────────┐  ┌──────────┐  │                   │
│  │ SAP/ │  │Workday│ │Sales-│  │ Shopify/ │  │ MES/     │  │                   │
│  │Oracle│  │ /ADP │  │force │  │ Magento  │  │ SCADA    │  │                   │
│  └──────┘  └──────┘  └──────┘  └──────────┘  └──────────┘  │                   │
│                                                             │                   │
│  ┌─────────────────────────────────────────────────────────┐│                   │
│  │              DEBEZIUM CDC (Change Data Capture)          ││                   │
│  │              Captures real-time database changes         ││                   │
│  └─────────────────────────────────────────────────────────┘│                   │
└─────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              PRIMARY DATA STORES                                 │
│                                                                                  │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐               │
│  │    PostgreSQL (RDS)         │  │       Redis (ElastiCache)   │               │
│  │                             │  │                             │               │
│  │  • Unified Data Lake        │  │  • Session Cache            │               │
│  │  • Application State        │  │  • Query Cache              │               │
│  │  • Workflow State           │  │  • Rate Limiting            │               │
│  │  • Audit Logs               │  │  • Real-time Counters       │               │
│  └─────────────────────────────┘  └─────────────────────────────┘               │
└─────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      M5 - INFRASTRUCTURE LAYER (Simplified)                      │
│                                                                                  │
│  ┌──────────────────────────── AWS Cloud ───────────────────────────────────┐   │
│  │                                                                           │   │
│  │  ┌─────────────────────── EKS Cluster ─────────────────────────────┐     │   │
│  │  │                                                                  │     │   │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │     │   │
│  │  │  │System Nodes │  │  App Nodes  │  │  DB Nodes   │              │     │   │
│  │  │  │  (2-4)      │  │   (3-10)    │  │   (2-4)     │              │     │   │
│  │  │  │2vCPU/8GB    │  │ 4vCPU/16GB  │  │4vCPU/32GB   │              │     │   │
│  │  │  └─────────────┘  └─────────────┘  └─────────────┘              │     │   │
│  │  │                                                                  │     │   │
│  │  └──────────────────────────────────────────────────────────────────┘     │   │
│  │                                                                           │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │   │
│  │  │   ArgoCD    │  │GitHub Actions│ │ Prometheus  │  │  Grafana    │      │   │
│  │  │  (GitOps)   │  │  (CI/CD)    │  │ (Metrics)   │  │(Dashboards) │      │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘      │   │
│  │                                                                           │   │
│  └───────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Module Deep Dives

### M1 - Data Mediation Layer (MVP)

#### Purpose
Connect to 5 business systems and stream data changes to the unified data lake.

#### MVP Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    CONNECTOR SERVICE                             │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  BaseConnector (Abstract)                 │   │
│  │  • connect(): Promise<void>                               │   │
│  │  • disconnect(): Promise<void>                            │   │
│  │  • fetchData(query): Promise<DataResult>                  │   │
│  │  • streamChanges(): AsyncIterator<ChangeEvent>            │   │
│  │  • getStatus(): ConnectorStatus                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│       ┌──────────┬──────────┼──────────┬──────────┐             │
│       ▼          ▼          ▼          ▼          ▼             │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐        │
│  │  ERP   │ │   HR   │ │  CRM   │ │E-Comm  │ │  Prod  │        │
│  │Connector│ │Connector│ │Connector│ │Connector│ │Connector│        │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

#### Data Flow (MVP)

```
Source DB ──► Debezium ──► Kafka ──► Transform Service ──► PostgreSQL
                │                           │
                │                           ▼
                │                    Embedding Service ──► Pinecone
                │                           │
                │                           ▼
                │                    Entity Extractor ──► Neo4j
                │
                └──► connector-events topic
```

#### MVP Schema (Unified Data Lake)

```sql
-- Core unified tables
CREATE TABLE unified_entities (
    id UUID PRIMARY KEY,
    source_system VARCHAR(50),      -- 'erp', 'hr', 'crm', etc.
    source_id VARCHAR(255),
    entity_type VARCHAR(100),       -- 'employee', 'invoice', 'customer'
    data JSONB,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    embedding_id VARCHAR(255)       -- Reference to Pinecone
);

CREATE TABLE change_events (
    id UUID PRIMARY KEY,
    source_system VARCHAR(50),
    entity_id UUID REFERENCES unified_entities(id),
    change_type VARCHAR(20),        -- 'INSERT', 'UPDATE', 'DELETE'
    old_data JSONB,
    new_data JSONB,
    captured_at TIMESTAMPTZ
);

CREATE TABLE connector_status (
    connector_id VARCHAR(50) PRIMARY KEY,
    status VARCHAR(20),             -- 'active', 'error', 'paused'
    last_sync TIMESTAMPTZ,
    records_synced BIGINT,
    error_message TEXT
);
```

#### What's Deferred to Post-MVP
- Complex data transformations (dbt models)
- Data quality scoring
- Schema evolution handling
- Multi-tenant data isolation
- Historical data backfill

---

### M2 - RHMA Intelligence Hub (MVP)

#### Purpose
Orchestrate AI agents to answer questions and execute tasks across business domains.

#### MVP Architecture (Simplified)

```
┌─────────────────────────────────────────────────────────────────┐
│                    AGENT SERVICE                                 │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    PLANNER AGENT                          │   │
│  │                                                           │   │
│  │  Input: User Query + Context                              │   │
│  │                    │                                      │   │
│  │                    ▼                                      │   │
│  │  ┌─────────────────────────────────┐                     │   │
│  │  │   1. Intent Classification       │                     │   │
│  │  │   (finance | hr | general)       │                     │   │
│  │  └─────────────────────────────────┘                     │   │
│  │                    │                                      │   │
│  │                    ▼                                      │   │
│  │  ┌─────────────────────────────────┐                     │   │
│  │  │   2. Task Decomposition          │                     │   │
│  │  │   Break into sub-tasks           │                     │   │
│  │  └─────────────────────────────────┘                     │   │
│  │                    │                                      │   │
│  │                    ▼                                      │   │
│  │  ┌─────────────────────────────────┐                     │   │
│  │  │   3. Context Enrichment (RAG)    │                     │   │
│  │  │   Query Vector DB for context    │                     │   │
│  │  └─────────────────────────────────┘                     │   │
│  │                    │                                      │   │
│  │                    ▼                                      │   │
│  │  ┌─────────────────────────────────┐                     │   │
│  │  │   4. Route to Worker             │                     │   │
│  │  │   Finance or HR Agent            │                     │   │
│  │  └─────────────────────────────────┘                     │   │
│  │                    │                                      │   │
│  │                    ▼                                      │   │
│  │  ┌─────────────────────────────────┐                     │   │
│  │  │   5. Validate & Respond          │                     │   │
│  │  │   Check output, format response  │                     │   │
│  │  └─────────────────────────────────┘                     │   │
│  │                                                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│              ┌───────────────┴───────────────┐                  │
│              ▼                               ▼                  │
│  ┌─────────────────────┐       ┌─────────────────────┐         │
│  │   FINANCE WORKER    │       │     HR WORKER       │         │
│  │                     │       │                     │         │
│  │  Tools:             │       │  Tools:             │         │
│  │  • query_erp()      │       │  • query_employees()│         │
│  │  • calculate()      │       │  • check_pto()      │         │
│  │  • generate_report()│       │  • org_chart()      │         │
│  │  • approve_expense()│       │  • screen_resume()  │         │
│  └─────────────────────┘       └─────────────────────┘         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Agent Communication Protocol (MVP)

```typescript
// Simple request/response via Redis pub/sub
interface AgentTask {
  taskId: string;
  type: 'finance' | 'hr' | 'general';
  action: string;
  params: Record<string, any>;
  context: string[];           // RAG context snippets
  userId: string;
  priority: 'low' | 'medium' | 'high';
  createdAt: Date;
}

interface AgentResponse {
  taskId: string;
  status: 'success' | 'error' | 'needs_clarification';
  result: any;
  confidence: number;          // 0-1 score
  sources: string[];           // Referenced documents
  processingTime: number;      // ms
}
```

#### LLM Integration (MVP)

```typescript
// Unified LLM service with fallback
class LLMService {
  private primaryProvider = 'openai';      // GPT-4
  private fallbackProvider = 'anthropic';  // Claude
  
  async complete(prompt: string, options: LLMOptions): Promise<string> {
    try {
      return await this.callProvider(this.primaryProvider, prompt, options);
    } catch (error) {
      console.warn('Primary LLM failed, using fallback');
      return await this.callProvider(this.fallbackProvider, prompt, options);
    }
  }
  
  async embed(text: string): Promise<number[]> {
    // Always use OpenAI for embeddings (consistency)
    return await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text
    });
  }
}
```

#### What's Deferred to Post-MVP
- Council of Critics (multi-agent validation)
- World Model Simulation
- RLHF optimization loop
- Agent memory/learning
- Multi-level hierarchical planning
- Agent negotiation protocols

---

### M3 - AI Database Engine (MVP)

#### Purpose
Store and retrieve AI-relevant data: embeddings, relationships, and time-series metrics.

#### MVP Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    AI DATA SERVICE                               │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    VECTOR STORE                           │   │
│  │                    (Pinecone)                             │   │
│  │                                                           │   │
│  │  Namespaces:                                              │   │
│  │  • documents    - Policy docs, manuals, procedures        │   │
│  │  • employees    - Employee profiles, skills               │   │
│  │  • transactions - Financial records, invoices             │   │
│  │  • tickets      - Support tickets, requests               │   │
│  │                                                           │   │
│  │  Index Config:                                            │   │
│  │  • Dimension: 1536 (OpenAI ada-002)                       │   │
│  │  • Metric: Cosine                                         │   │
│  │  • Pods: 1 (p1.x1) - MVP                                  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    GRAPH STORE                            │   │
│  │                    (Neo4j Aura)                           │   │
│  │                                                           │   │
│  │  Node Types:                                              │   │
│  │  • Employee     - id, name, role, department              │   │
│  │  • Department   - id, name, budget                        │   │
│  │  • Document     - id, title, type                         │   │
│  │  • Transaction  - id, amount, date                        │   │
│  │  • Customer     - id, name, tier                          │   │
│  │                                                           │   │
│  │  Relationships:                                           │   │
│  │  • REPORTS_TO   - Employee hierarchy                      │   │
│  │  • BELONGS_TO   - Department membership                   │   │
│  │  • APPROVED_BY  - Transaction approvals                   │   │
│  │  • OWNS         - Document ownership                      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    TIME-SERIES STORE                      │   │
│  │                    (TimescaleDB)                          │   │
│  │                                                           │   │
│  │  Tables:                                                  │   │
│  │  • agent_metrics     - Response times, success rates      │   │
│  │  • system_metrics    - CPU, memory, API calls             │   │
│  │  • business_metrics  - Workflows executed, costs          │   │
│  │  • llm_usage         - Tokens consumed, model costs       │   │
│  │                                                           │   │
│  │  Retention: 1 year hot, 3 years compressed                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### RAG Pipeline (MVP)

```
User Query
     │
     ▼
┌─────────────┐
│  Embedding  │ ──► OpenAI text-embedding-3-small
└─────────────┘
     │
     ▼
┌─────────────┐
│  Pinecone   │ ──► Top 5 similar documents
│   Query     │
└─────────────┘
     │
     ▼
┌─────────────┐
│   Neo4j     │ ──► Related entities (1-hop)
│   Query     │
└─────────────┘
     │
     ▼
┌─────────────┐
│  Context    │ ──► Combine and format
│  Assembly   │
└─────────────┘
     │
     ▼
┌─────────────┐
│    LLM      │ ──► Generate response with context
│   Prompt    │
└─────────────┘
```

#### What's Deferred to Post-MVP
- Hybrid search (vector + keyword)
- Dynamic graph updates
- Predictive analytics
- Custom embedding models
- Multi-modal embeddings (images)

---

### M4 - Workflow & Integration Layer (MVP)

#### Purpose
Execute 10 pre-defined business workflows with simple approval chains.

#### MVP Workflow Engine

```
┌─────────────────────────────────────────────────────────────────┐
│                    WORKFLOW SERVICE                              │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              WORKFLOW STATE MACHINE                       │   │
│  │                                                           │   │
│  │  States: PENDING → IN_PROGRESS → AWAITING_APPROVAL        │   │
│  │              ↓           ↓              ↓                 │   │
│  │          CANCELLED    FAILED       APPROVED → COMPLETED   │   │
│  │                                        ↓                  │   │
│  │                                    REJECTED               │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  WORKFLOW DEFINITIONS                     │   │
│  │                                                           │   │
│  │  Finance:                    HR:                          │   │
│  │  ├── expense_approval        ├── employee_onboarding      │   │
│  │  ├── invoice_processing      ├── resume_screening         │   │
│  │  ├── budget_variance         ├── time_off_request         │   │
│  │  ├── month_end_close         ├── performance_review       │   │
│  │  └── financial_report        └── employee_offboarding     │   │
│  │                                                           │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

#### Workflow Definition Example (MVP)

```typescript
// workflows/expense_approval.ts
const expenseApprovalWorkflow: WorkflowDefinition = {
  id: 'expense_approval',
  name: 'Expense Approval',
  domain: 'finance',
  
  steps: [
    {
      id: 'extract_data',
      type: 'agent_task',
      agent: 'finance',
      action: 'extract_expense_details',
      inputs: ['expense_report'],
      outputs: ['amount', 'category', 'receipts']
    },
    {
      id: 'validate_policy',
      type: 'agent_task',
      agent: 'finance',
      action: 'check_expense_policy',
      inputs: ['amount', 'category'],
      outputs: ['policy_compliant', 'violations']
    },
    {
      id: 'route_approval',
      type: 'decision',
      condition: {
        if: 'amount < 500 AND policy_compliant',
        then: 'auto_approve',
        else: 'manager_approval'
      }
    },
    {
      id: 'auto_approve',
      type: 'action',
      action: 'approve_expense',
      outputs: ['approval_id']
    },
    {
      id: 'manager_approval',
      type: 'human_task',
      assignee: 'manager',
      timeout: '48h',
      actions: ['approve', 'reject', 'request_info']
    },
    {
      id: 'update_erp',
      type: 'integration',
      system: 'erp',
      action: 'update_expense_status',
      inputs: ['expense_id', 'approval_status']
    },
    {
      id: 'notify',
      type: 'notification',
      channels: ['email', 'slack'],
      template: 'expense_decision'
    }
  ]
};
```

#### Database Schema (Workflows)

```sql
CREATE TABLE workflows (
    id UUID PRIMARY KEY,
    definition_id VARCHAR(100),
    status VARCHAR(50),
    current_step VARCHAR(100),
    input_data JSONB,
    step_results JSONB,
    started_by UUID,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

CREATE TABLE workflow_steps (
    id UUID PRIMARY KEY,
    workflow_id UUID REFERENCES workflows(id),
    step_id VARCHAR(100),
    status VARCHAR(50),
    input_data JSONB,
    output_data JSONB,
    error TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

CREATE TABLE approvals (
    id UUID PRIMARY KEY,
    workflow_id UUID REFERENCES workflows(id),
    step_id VARCHAR(100),
    approver_id UUID,
    decision VARCHAR(20),
    comments TEXT,
    decided_at TIMESTAMPTZ
);
```

#### What's Deferred to Post-MVP
- Dynamic workflow builder
- Complex approval matrices
- Parallel step execution
- Workflow versioning
- SLA monitoring
- External webhook triggers

---

### M5 - Infrastructure & DevOps (MVP)

#### Purpose
Provide reliable, monitored infrastructure for all services.

#### MVP Infrastructure

```
┌─────────────────────────────────────────────────────────────────┐
│                        AWS CLOUD                                 │
│                     (Single Region: us-east-1)                   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                      VPC (10.0.0.0/16)                   │    │
│  │                                                          │    │
│  │  ┌─────────────────┐  ┌─────────────────┐               │    │
│  │  │  Public Subnet  │  │  Public Subnet  │               │    │
│  │  │   10.0.1.0/24   │  │   10.0.2.0/24   │               │    │
│  │  │    (AZ-1a)      │  │    (AZ-1b)      │               │    │
│  │  │                 │  │                 │               │    │
│  │  │  ┌───────────┐  │  │  ┌───────────┐  │               │    │
│  │  │  │    ALB    │  │  │  │    NAT    │  │               │    │
│  │  │  └───────────┘  │  │  └───────────┘  │               │    │
│  │  └─────────────────┘  └─────────────────┘               │    │
│  │                                                          │    │
│  │  ┌─────────────────┐  ┌─────────────────┐               │    │
│  │  │ Private Subnet  │  │ Private Subnet  │               │    │
│  │  │  10.0.10.0/24   │  │  10.0.20.0/24   │               │    │
│  │  │    (AZ-1a)      │  │    (AZ-1b)      │               │    │
│  │  │                 │  │                 │               │    │
│  │  │  ┌───────────┐  │  │  ┌───────────┐  │               │    │
│  │  │  │EKS Nodes  │  │  │  │EKS Nodes  │  │               │    │
│  │  │  └───────────┘  │  │  └───────────┘  │               │    │
│  │  └─────────────────┘  └─────────────────┘               │    │
│  │                                                          │    │
│  │  ┌─────────────────┐  ┌─────────────────┐               │    │
│  │  │   DB Subnet     │  │   DB Subnet     │               │    │
│  │  │  10.0.100.0/24  │  │  10.0.200.0/24  │               │    │
│  │  │    (AZ-1a)      │  │    (AZ-1b)      │               │    │
│  │  │                 │  │                 │               │    │
│  │  │  ┌───────────┐  │  │  ┌───────────┐  │               │    │
│  │  │  │    RDS    │  │  │  │   Redis   │  │               │    │
│  │  │  └───────────┘  │  │  └───────────┘  │               │    │
│  │  └─────────────────┘  └─────────────────┘               │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### EKS Cluster Configuration (MVP)

```yaml
# terraform/eks.tf (simplified)
module "eks" {
  source          = "terraform-aws-modules/eks/aws"
  cluster_name    = "mindy-mvp"
  cluster_version = "1.28"
  
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets
  
  eks_managed_node_groups = {
    system = {
      name           = "system"
      instance_types = ["t3.medium"]
      min_size       = 2
      max_size       = 4
      desired_size   = 2
      
      labels = {
        role = "system"
      }
    }
    
    app = {
      name           = "app"
      instance_types = ["t3.large"]
      min_size       = 3
      max_size       = 10
      desired_size   = 3
      
      labels = {
        role = "app"
      }
    }
    
    db = {
      name           = "db"
      instance_types = ["r5.large"]
      min_size       = 2
      max_size       = 4
      desired_size   = 2
      
      labels = {
        role = "db"
      }
      
      taints = [{
        key    = "dedicated"
        value  = "db"
        effect = "NO_SCHEDULE"
      }]
    }
  }
}
```

#### CI/CD Pipeline (MVP)

```yaml
# .github/workflows/deploy.yml
name: Deploy to EKS

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - run: npm run build

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/build-push-action@v5
        with:
          push: true
          tags: ${{ env.ECR_REGISTRY }}/mindy:${{ github.sha }}

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Update Kubernetes manifests
        run: |
          cd k8s/overlays/production
          kustomize edit set image mindy=${{ env.ECR_REGISTRY }}/mindy:${{ github.sha }}
      - name: Commit and push
        run: |
          git add .
          git commit -m "Deploy ${{ github.sha }}"
          git push
      # ArgoCD auto-syncs from git
```

#### Monitoring Stack (MVP)

```
┌─────────────────────────────────────────────────────────────────┐
│                    MONITORING STACK                              │
│                                                                  │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐        │
│  │  Prometheus   │  │    Grafana    │  │    Jaeger     │        │
│  │               │  │               │  │               │        │
│  │ • Node metrics│  │ • Dashboards  │  │ • Tracing     │        │
│  │ • Pod metrics │  │ • Alerts      │  │ • Debugging   │        │
│  │ • Custom      │  │ • Visualize   │  │               │        │
│  └───────────────┘  └───────────────┘  └───────────────┘        │
│          │                  │                  │                 │
│          └──────────────────┼──────────────────┘                 │
│                             ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    ALERTING                               │   │
│  │                                                           │   │
│  │  Critical Alerts (PagerDuty):                            │   │
│  │  • API error rate > 5%                                    │   │
│  │  • Pod restarts > 3 in 5min                               │   │
│  │  • Database connection failures                           │   │
│  │                                                           │   │
│  │  Warning Alerts (Slack):                                  │   │
│  │  • API latency p99 > 1s                                   │   │
│  │  • Memory usage > 80%                                     │   │
│  │  • Queue depth > 1000                                     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### What's Deferred to Post-MVP
- Multi-region deployment
- Auto-scaling based on custom metrics
- Blue/green deployments
- Chaos engineering
- Cost optimization automation

---

### M6 - User Experience Layer (MVP)

#### Purpose
Provide web-based interfaces for interacting with Mindy.

#### MVP Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND APPLICATION                          │
│                       (Next.js 14)                               │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                      PAGES                                │   │
│  │                                                           │   │
│  │  /                     - Dashboard (KPIs, recent activity)│   │
│  │  /chat                 - Chat interface with agents       │   │
│  │  /workflows            - Workflow list and status         │   │
│  │  /workflows/[id]       - Individual workflow detail       │   │
│  │  /finance              - Finance dashboard                │   │
│  │  /finance/expenses     - Expense approval queue           │   │
│  │  /finance/invoices     - Invoice processing               │   │
│  │  /finance/reports      - Financial reports                │   │
│  │  /hr                   - HR dashboard                     │   │
│  │  /hr/onboarding        - Onboarding tracker               │   │
│  │  /hr/requests          - PTO and other requests           │   │
│  │  /settings             - User and system settings         │   │
│  │  /admin                - Admin panel (connectors, users)  │   │
│  │                                                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    COMPONENTS                             │   │
│  │                                                           │   │
│  │  Layout:              Data Display:        Forms:         │   │
│  │  • Sidebar            • DataTable          • ExpenseForm  │   │
│  │  • Header             • KPICard            • InvoiceForm  │   │
│  │  • Breadcrumbs        • Chart              • RequestForm  │   │
│  │                       • Timeline           • ApprovalForm │   │
│  │  Chat:                • StatusBadge                       │   │
│  │  • ChatWindow                                             │   │
│  │  • MessageList        Workflow:                           │   │
│  │  • MessageInput       • WorkflowCard                      │   │
│  │  • AgentSelector      • StepProgress                      │   │
│  │  • ContextPanel       • ApprovalActions                   │   │
│  │                                                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Chat Interface (MVP)

```
┌─────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  🤖 Agent: Finance                              [v] ▼   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  👤 You                                      10:30 AM   │    │
│  │  ─────────────────────────────────────────────────────  │    │
│  │  What's our current budget variance for Q4?             │    │
│  │                                                          │    │
│  │  🤖 Finance Agent                             10:30 AM   │    │
│  │  ─────────────────────────────────────────────────────  │    │
│  │  Based on the latest ERP data, here's your Q4 budget    │    │
│  │  variance analysis:                                      │    │
│  │                                                          │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │  Department    Budget      Actual    Variance   │    │    │
│  │  │  ──────────────────────────────────────────────│    │    │
│  │  │  Engineering   $500K       $520K     +4.0% ⚠️  │    │    │
│  │  │  Marketing     $200K       $185K     -7.5% ✅  │    │    │
│  │  │  Operations    $300K       $298K     -0.7% ✅  │    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  │                                                          │    │
│  │  📎 Sources: ERP-GL-2024Q4, Budget-Plan-2024            │    │
│  │                                                          │    │
│  │  [📊 View Full Report]  [📤 Export]  [👍] [👎]         │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  💬 Ask a question...                         [Send →]  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### What's Deferred to Post-MVP
- Mobile application
- Voice interface
- Personalized dashboards
- Real-time collaboration
- Advanced visualizations

---

## API Contracts (MVP)

### Core APIs

```typescript
// Authentication
POST   /api/auth/login          // Login with credentials
POST   /api/auth/refresh        // Refresh JWT token
POST   /api/auth/logout         // Invalidate session

// Chat/Agents
POST   /api/chat/message        // Send message to agent
GET    /api/chat/history        // Get conversation history
GET    /api/chat/suggestions    // Get suggested questions

// Workflows
GET    /api/workflows           // List all workflows
GET    /api/workflows/:id       // Get workflow details
POST   /api/workflows           // Start new workflow
PATCH  /api/workflows/:id       // Update workflow (approve/reject)

// Finance
GET    /api/finance/expenses    // List pending expenses
POST   /api/finance/expenses    // Submit expense
GET    /api/finance/invoices    // List invoices
GET    /api/finance/reports     // Get financial reports
GET    /api/finance/budget      // Get budget data

// HR
GET    /api/hr/employees        // List employees
GET    /api/hr/onboarding       // Get onboarding tasks
POST   /api/hr/requests         // Submit HR request
GET    /api/hr/requests         // List HR requests

// Admin
GET    /api/admin/connectors    // List connector status
POST   /api/admin/connectors/:id/sync  // Trigger sync
GET    /api/admin/metrics       // System metrics
GET    /api/admin/users         // User management
```

---

## Security Architecture (MVP)

```
┌─────────────────────────────────────────────────────────────────┐
│                    SECURITY LAYERS                               │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    PERIMETER                              │   │
│  │  • AWS WAF (Web Application Firewall)                     │   │
│  │  • CloudFront (DDoS protection)                           │   │
│  │  • Rate limiting (100 req/min per user)                   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                             │                                    │
│                             ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    AUTHENTICATION                         │   │
│  │  • JWT tokens (1h access, 7d refresh)                     │   │
│  │  • OIDC integration ready (future SSO)                    │   │
│  │  • Session management in Redis                            │   │
│  └──────────────────────────────────────────────────────────┘   │
│                             │                                    │
│                             ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    AUTHORIZATION                          │   │
│  │  • Role-based access control (RBAC)                       │   │
│  │  • Roles: admin, manager, user                            │   │
│  │  • Resource-level permissions                             │   │
│  └──────────────────────────────────────────────────────────┘   │
│                             │                                    │
│                             ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    DATA PROTECTION                        │   │
│  │  • Encryption at rest (RDS, S3)                           │   │
│  │  • Encryption in transit (TLS 1.3)                        │   │
│  │  • PII masking in logs                                    │   │
│  │  • Audit logging for all actions                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## MVP Limitations & Constraints

### Intentional Limitations

| Area | Limitation | Reason |
|------|------------|--------|
| Scale | 20-30 concurrent users | Beta testing phase |
| Data | 5 connector types only | Focus on core business |
| Agents | 2 domain agents only | Reduce complexity |
| Workflows | 10 pre-defined only | No dynamic builder |
| Region | Single AWS region | Cost and complexity |
| Auth | Basic JWT only | No SSO integration |

### Technical Constraints

| Constraint | Value | Mitigation |
|------------|-------|------------|
| API Response | < 500ms p95 | Caching, query optimization |
| Agent Response | < 10s | Streaming responses |
| Uptime | 95% SLA | Basic redundancy |
| Data Freshness | < 5 min | CDC streaming |
| Storage | 1TB total | Data retention policies |

---

## Migration Path to Full Architecture

After MVP success, the path to full architecture:

### Phase 2 (Months 7-9): Scale
- Add 5 more connectors
- Implement dynamic workflow builder
- Add 2 more domain agents
- Multi-region deployment

### Phase 3 (Months 10-12): Intelligence
- Council of Critics validation
- World Model simulation (basic)
- RLHF data collection
- Advanced analytics

### Phase 4 (Year 2): Enterprise
- Full RHMA implementation
- SSO/SAML integration
- Multi-tenant isolation
- Mobile applications
- Voice interface

---

## Appendix: Technology Stack Summary

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| Frontend | Next.js | 14.x | React framework |
| Frontend | Tailwind CSS | 3.x | Styling |
| Frontend | Shadcn/ui | latest | Component library |
| Backend | Node.js | 18.x | Runtime |
| Backend | Express.js | 4.x | API framework |
| Backend | TypeScript | 5.x | Type safety |
| ORM | Prisma | 5.x | Database access |
| Database | PostgreSQL | 14.x | Primary data store |
| Cache | Redis | 6.x | Session/query cache |
| Vector DB | Pinecone | latest | Embeddings |
| Graph DB | Neo4j Aura | 5.x | Relationships |
| Time-Series | TimescaleDB | 2.x | Metrics |
| Message Queue | Kafka (MSK) | 3.x | Event streaming |
| Container | Docker | 24.x | Containerization |
| Orchestration | Kubernetes (EKS) | 1.28 | Container orchestration |
| CI/CD | GitHub Actions | latest | Automation |
| GitOps | ArgoCD | 2.x | Deployment |
| Monitoring | Prometheus | 2.x | Metrics collection |
| Dashboards | Grafana | 10.x | Visualization |
| Tracing | Jaeger | 1.x | Distributed tracing |
| LLM | OpenAI GPT-4 | latest | Primary AI |
| LLM | Anthropic Claude | latest | Fallback AI |