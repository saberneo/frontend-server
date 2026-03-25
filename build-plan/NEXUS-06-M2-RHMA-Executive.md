# NEXUS — Archivo 06: M2 RHMA Executive Agent (LangGraph)
## Planner → Workers → Council of Critics → Guard-in-Guard
### Semanas 7–11 · Equipo AI & Knowledge · PARALELO con M3 Writers
### Depende de: NEXUS-04 (ai_routing_decided activo) + NEXUS-05 (schemas.py completo)

---

## Tabla de Contenidos

1. [Arquitectura RHMA](#1-arquitectura-rhma)
2. [nexus_core/schemas.py — Tipos RHMA](#2-nexus_coreschemaspy--tipos-rhma)
3. [LangGraph State](#3-langgraph-state)
4. [Planner Agent](#4-planner-agent)
5. [Worker Agents (4 tipos)](#5-worker-agents-4-tipos)
6. [Council of Critics](#6-council-of-critics)
7. [Guard-in-Guard (OPA)](#7-guard-in-guard-opa)
8. [Graph Assembly + Runner](#8-graph-assembly--runner)
9. [Consumer / Producer Wiring](#9-consumer--producer-wiring)
10. [K8s Deployment + Prometheus](#10-k8s-deployment--prometheus)
11. [Acceptance Criteria M2](#11-acceptance-criteria-m2)

---

## 1. Arquitectura RHMA

RHMA (Reflexive Hierarchical Multi-Agent) es la arquitectura de agentes de M2.

```
{tid}.m2.semantic_interpretation_requested
                │
                ▼
        ┌───────────────┐
        │  PLANNER AGENT │  LangGraph node: "plan"
        │  (Claude)      │  → Descompone la tarea en sub-tasks
        └───────┬────────┘
                │ Sub-tasks list
                ▼
        ┌───────────────────────────────────────┐
        │           WORKER AGENTS               │
        │  ┌────────┐  ┌────────┐  ┌────────┐  │
        │  │ Search │  │ Calc   │  │ Fetch  │  │
        │  │ Worker │  │ Worker │  │ Worker │  │
        │  └────────┘  └────────┘  └────────┘  │
        │         ┌──────────────┐              │
        │         │ Write Worker │              │
        │         └──────────────┘              │
        └───────────────────────────────────────┘
                │ Worker Results
                ▼
        ┌───────────────────┐
        │  COUNCIL OF CRITICS│  3 critics en paralelo
        │  Critic A (Claude) │  → Factual check
        │  Critic B (Claude) │  → Coherence check
        │  Critic C (Claude) │  → Tenant-policy check
        └─────────┬──────────┘
                  │
          ┌───────┴────────┐
          │ critics pass?  │
          │ score ≥ 0.75   │
          └───┬────────┬───┘
         YES  │        │  NO (max 2 retries)
              ▼        ▼
       ┌─────────┐  [Replanner]
       │GUARD-in-│  → Replanner llama al Planner de nuevo
       │GUARD OPA│    con feedback de Critics
       └─────┬───┘
             │ OPA authorized?
        YES  │ NO → semantic_interpretation_rejected published
             ▼
{tid}.m2.semantic_interpretation_complete
             +
{tid}.m2.workflow_trigger  (si la acción requiere orquestación)
```

---

## 2. nexus_core/schemas.py — Tipos RHMA

```python
# nexus_core/schemas.py (añadir a los tipos de Archivo 05)
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from enum import Enum


class WorkerType(str, Enum):
    SEARCH = "search"       # Busca en Pinecone/Neo4j
    CALCULATE = "calculate" # Cálculos numéricos / SQL
    FETCH = "fetch"         # Recupera datos externos (REST, connectors)
    WRITE = "write"         # Escribe/actualiza en AI stores


@dataclass
class SubTask:
    """Una tarea generada por el Planner Agent."""
    task_id: str
    description: str
    worker_type: WorkerType
    dependencies: List[str]  # Lista de task_ids que deben completar primero
    context: Dict[str, Any]  # Datos adicionales para el worker


@dataclass
class WorkerResult:
    """Resultado de un Worker Agent."""
    task_id: str
    worker_type: WorkerType
    success: bool
    data: Any
    error: Optional[str] = None


@dataclass
class CriticScore:
    """Evaluación de un Critic Agent."""
    critic_name: str          # "factual", "coherence", "policy"
    score: float              # 0.0 a 1.0
    passed: bool              # True si score >= umbral del critic
    feedback: str
    issues_found: List[str]


@dataclass
class RHMARequest:
    """Payload de entrada al RHMA Agent."""
    request_id: str
    tenant_id: str
    user_id: str
    intent: str               # Intención en lenguaje natural
    context: Dict[str, Any]   # Contexto adicional: {entity_type, record_ids, etc.}
    max_retries: int = 2


@dataclass
class RHMAResponse:
    """Resultado final después de pasar Guard-in-Guard."""
    request_id: str
    tenant_id: str
    user_id: str
    interpretation: str           # Respuesta final en lenguaje natural
    actions_taken: List[str]      # Acciones ejecutadas
    data_retrieved: Dict[str, Any]
    critics_score: float          # Score promedio del Council
    requires_workflow: bool       # True si necesita dispatching a M4
    workflow_payload: Optional[Dict[str, Any]] = None
    total_latency_ms: Optional[float] = None
```

---

## 3. LangGraph State

```python
# m2/rhma/state.py
from typing import TypedDict, List, Optional, Dict, Any, Annotated
import operator
from nexus_core.schemas import SubTask, WorkerResult, CriticScore, RHMARequest, RHMAResponse


class RHMAState(TypedDict):
    """Estado del grafo LangGraph para el RHMA Agent."""

    # Input
    request: RHMARequest

    # Planner output
    plan: List[SubTask]
    plan_iteration: int                  # Cuántas veces se replaneó (max 2)

    # Worker results (se acumulan con operator.add)
    worker_results: Annotated[List[WorkerResult], operator.add]

    # Council of Critics output
    critic_scores: List[CriticScore]
    critics_passed: Optional[bool]       # True si todos los critics ≥ umbral

    # Guard-in-Guard output
    opa_authorized: Optional[bool]
    opa_denial_reason: Optional[str]

    # Final output
    response: Optional[RHMAResponse]
    error: Optional[str]

    # Metadata
    start_time_ms: float
    messages: Annotated[List[dict], operator.add]  # Para trazabilidad
```

---

## 4. Planner Agent

```python
# m2/rhma/planner.py
"""
Planner Agent — descompone el request en sub-tasks ejecutables.

Node LangGraph: "plan"
Input: state["request"]
Output: state["plan"]

El Planner usa Claude para entender la intención del usuario y generar
una lista ordenada de SubTasks con dependencias explícitas.
"""
import json
import logging
import uuid
from typing import List
import anthropic

from nexus_core.schemas import SubTask, WorkerType, RHMARequest
from m2.rhma.state import RHMAState

logger = logging.getLogger(__name__)

PLANNER_SYSTEM_PROMPT = """
You are the NEXUS Planner Agent. Your role is to decompose a user's enterprise data 
request into atomic sub-tasks that can be executed by specialized Worker Agents.

Available worker types:
- search: Query vector store (Pinecone) or graph (Neo4j) for entities
- calculate: Run SQL aggregations or numeric analysis  
- fetch: Retrieve raw data from Delta Lake or connectors
- write: Update or enrich records in AI stores

CRITICAL RULES:
1. Each sub-task must have exactly ONE worker_type
2. Dependencies must reference task_ids from the SAME plan (not external)
3. Keep plans concise — 2 to 5 sub-tasks maximum
4. Respond ONLY with valid JSON (```json markers)
5. If the request requires writing, always add a search step first for context
"""

PLANNER_PROMPT_TEMPLATE = """
## User Request
**Intent:** {intent}
**Tenant Context:** {tenant_context}
**Additional Context:** {context_json}

## Previous Critic Feedback (if replanning)
{critic_feedback}

## Task
Decompose this request into 2-5 sub-tasks. Each sub-task must be atomic and complete.

## Response Format
```json
{{
  "tasks": [
    {{
      "task_id": "t1",
      "description": "Search for customer entities matching the query",
      "worker_type": "search",
      "dependencies": [],
      "context": {{
        "entity_type": "party",
        "query": "...",
        "top_k": 10
      }}
    }},
    {{
      "task_id": "t2",
      "description": "Calculate transaction totals for found customers",
      "worker_type": "calculate",
      "dependencies": ["t1"],
      "context": {{
        "operation": "sum",
        "field": "amount_base_currency"
      }}
    }}
  ]
}}
```
"""


def plan_node(state: RHMAState, anthropic_client: anthropic.Anthropic) -> dict:
    """LangGraph node: Genera el plan de ejecución."""
    request = state["request"]
    plan_iter = state.get("plan_iteration", 0)

    critic_feedback = ""
    if plan_iter > 0 and state.get("critic_scores"):
        issues = []
        for cs in state["critic_scores"]:
            if not cs.passed:
                issues.extend(cs.issues_found)
        critic_feedback = f"Issues from previous attempt: {'; '.join(issues)}"

    prompt = PLANNER_PROMPT_TEMPLATE.format(
        intent=request.intent,
        tenant_context=f"tenant_id={request.tenant_id}",
        context_json=json.dumps(request.context, indent=2),
        critic_feedback=critic_feedback,
    )

    response = anthropic_client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
        system=PLANNER_SYSTEM_PROMPT,
    )

    raw = response.content[0].text
    try:
        json_start = raw.find("```json") + 7
        json_end = raw.rfind("```")
        data = json.loads(raw[json_start:json_end].strip())
        tasks = [SubTask(
            task_id=t["task_id"],
            description=t["description"],
            worker_type=WorkerType(t["worker_type"]),
            dependencies=t.get("dependencies", []),
            context=t.get("context", {}),
        ) for t in data["tasks"]]
    except Exception as e:
        logger.error(f"Planner parse error: {e}")
        tasks = []

    logger.info(f"Plan generado: {len(tasks)} tasks para request={request.request_id}")
    return {
        "plan": tasks,
        "plan_iteration": plan_iter + 1,
        "messages": [{"role": "planner", "content": f"Plan: {[t.task_id for t in tasks]}"}],
    }
```

---

## 5. Worker Agents (4 tipos)

```python
# m2/rhma/workers.py
"""
Worker Agents — ejecutan sub-tasks según su worker_type.

Node LangGraph: "execute_workers"
Ejecuta tareas del plan en orden de dependencias.
Usa topological sort para ejecutar en paralelo cuando es posible.
"""
import asyncio
import json
import logging
from typing import Dict, List, Any
import asyncpg

from nexus_core.schemas import SubTask, WorkerResult, WorkerType, RHMAState

logger = logging.getLogger(__name__)


class SearchWorker:
    """Busca entidades en Pinecone (vector) y/o Neo4j (graph)."""

    def __init__(self, pinecone_client, neo4j_driver, embedder):
        self._pc = pinecone_client
        self._neo4j = neo4j_driver
        self._embedder = embedder

    async def execute(self, task: SubTask, tenant_id: str) -> WorkerResult:
        ctx = task.context
        entity_type = ctx.get("entity_type", "party")
        query_text = ctx.get("query", "")
        top_k = ctx.get("top_k", 10)

        results = {}

        # Búsqueda vectorial
        if ctx.get("use_vector", True):
            query_vector = self._embedder.encode(query_text).tolist()
            # Index = nexus-{tenant_id}-{entity_type} (ver Archivo 07 para convención completa)
            index_name = f"nexus-{tenant_id}-{entity_type}"
            index = self._pc.Index(index_name)
            res = index.query(vector=query_vector, top_k=top_k, include_metadata=True)
            results["vector"] = [
                {
                    "id": m.id,
                    "score": m.score,
                    "metadata": m.metadata,
                }
                for m in res.matches
            ]

        # Búsqueda en grafo
        if ctx.get("use_graph", False):
            cypher = ctx.get("cypher_query", "")
            if cypher:
                async with self._neo4j.session() as session:
                    res = await session.run(cypher, tenant_id=tenant_id)
                    records = await res.data()
                results["graph"] = records

        return WorkerResult(
            task_id=task.task_id,
            worker_type=WorkerType.SEARCH,
            success=True,
            data=results,
        )


class CalculateWorker:
    """Ejecuta agregaciones SQL en PostgreSQL o TimescaleDB."""

    def __init__(self, db_pool: asyncpg.Pool):
        self._pool = db_pool

    async def execute(self, task: SubTask, tenant_id: str) -> WorkerResult:
        ctx = task.context
        table = ctx.get("table", "")
        operation = ctx.get("operation", "count")
        field = ctx.get("field", "*")
        filters = ctx.get("filters", {})

        where_clauses = " AND ".join(
            [f"{k} = ${i+2}" for i, k in enumerate(filters.keys())]
        )
        where_sql = f"WHERE tenant_id = $1 AND {where_clauses}" if where_clauses else "WHERE tenant_id = $1"

        sql = f"SELECT {operation}({field}) AS result FROM {table} {where_sql}"

        async with self._pool.acquire() as conn:
            await conn.execute(f"SET app.tenant_id = '{tenant_id}'")
            row = await conn.fetchrow(sql, tenant_id, *filters.values())
            result = dict(row) if row else {}

        return WorkerResult(
            task_id=task.task_id,
            worker_type=WorkerType.CALCULATE,
            success=True,
            data=result,
        )


class FetchWorker:
    """Recupera datos desde Delta Lake o listas de entidades."""

    def __init__(self, spark_session=None, db_pool: asyncpg.Pool = None):
        self._spark = spark_session
        self._pool = db_pool

    async def execute(self, task: SubTask, tenant_id: str) -> WorkerResult:
        ctx = task.context
        source = ctx.get("source", "delta")
        entity_ids = ctx.get("entity_ids", [])

        if source == "delta" and self._spark:
            table_path = f"s3a://nexus-delta/{tenant_id}/structured/"
            df = self._spark.read.format("delta").load(table_path)
            if entity_ids:
                df = df.filter(df.source_record_id.isin(entity_ids))
            data = df.limit(100).toPandas().to_dict(orient="records")
        else:
            # Fallback: PostgreSQL
            ids_placeholder = ", ".join([f"${i+2}" for i in range(len(entity_ids))])
            sql = f"SELECT * FROM nexus_data.records WHERE tenant_id=$1 AND id IN ({ids_placeholder})"
            async with self._pool.acquire() as conn:
                rows = await conn.fetch(sql, tenant_id, *entity_ids)
                data = [dict(r) for r in rows]

        return WorkerResult(
            task_id=task.task_id,
            worker_type=WorkerType.FETCH,
            success=True,
            data=data,
        )


class WriteWorker:
    """Enriquece o actualiza registros en los AI Stores."""

    def __init__(self, db_pool: asyncpg.Pool):
        self._pool = db_pool

    async def execute(self, task: SubTask, tenant_id: str) -> WorkerResult:
        ctx = task.context
        entity_id = ctx.get("entity_id", "")
        updates = ctx.get("updates", {})

        if not entity_id or not updates:
            return WorkerResult(
                task_id=task.task_id,
                worker_type=WorkerType.WRITE,
                success=False,
                data={},
                error="entity_id or updates missing",
            )

        set_clauses = ", ".join(
            [f"{k} = ${i+3}" for i, k in enumerate(updates.keys())]
        )
        sql = f"UPDATE nexus_data.records SET {set_clauses}, updated_at=NOW() WHERE tenant_id=$1 AND id=$2"

        async with self._pool.acquire() as conn:
            await conn.execute(f"SET app.tenant_id = '{tenant_id}'")
            await conn.execute(sql, tenant_id, entity_id, *updates.values())

        return WorkerResult(
            task_id=task.task_id,
            worker_type=WorkerType.WRITE,
            success=True,
            data={"updated": entity_id, "fields": list(updates.keys())},
        )


def execute_workers_node(
    state: RHMAState,
    workers: Dict[WorkerType, Any],
) -> dict:
    """LangGraph node: Ejecuta todos los workers del plan según dependencias."""
    import asyncio

    plan = state["plan"]
    tenant_id = state["request"].tenant_id
    completed: Dict[str, WorkerResult] = {}
    all_results = []

    async def run_all():
        remaining = list(plan)
        max_iterations = len(plan) * 2  # Protección contra ciclos

        while remaining and max_iterations > 0:
            max_iterations -= 1
            # Tareas listas: dependencias ya completadas
            ready = [
                t for t in remaining
                if all(dep in completed for dep in t.dependencies)
            ]
            if not ready:
                break

            results = await asyncio.gather(*[
                workers[t.worker_type].execute(t, tenant_id)
                for t in ready
            ])

            for r in results:
                completed[r.task_id] = r
                all_results.append(r)

            for t in ready:
                remaining.remove(t)

    asyncio.get_event_loop().run_until_complete(run_all())

    logger.info(
        f"Workers completados: {len(all_results)} results para request={state['request'].request_id}"
    )
    return {
        "worker_results": all_results,
        "messages": [{"role": "executor", "content": f"Completed {len(all_results)} tasks"}],
    }
```

---

## 6. Council of Critics

```python
# m2/rhma/critics.py
"""
Council of Critics — 3 critics evalúan el resultado de los workers.

Node LangGraph: "council_of_critics"
Los 3 critics corren en paralelo.
Si score promedio < 0.75 → replanning (hasta max_retries).

Critics:
  A. Factual Critic — ¿Los datos recuperados son factuales y no alucinados?
  B. Coherence Critic — ¿La respuesta es coherente con el request original?
  C. Policy Critic — ¿La acción respeta las políticas del tenant?
"""
import asyncio
import json
import logging
from typing import List
import anthropic

from nexus_core.schemas import CriticScore, RHMAState

logger = logging.getLogger(__name__)

COUNCIL_PASSING_SCORE = 0.75
INDIVIDUAL_CRITIC_THRESHOLD = 0.70


def _build_critic_prompt(critic_type: str, request_intent: str, worker_results: list) -> str:
    results_summary = json.dumps(
        [{"task_id": r.task_id, "success": r.success, "data": r.data} for r in worker_results],
        indent=2,
        default=str
    )[:2000]  # Limitar a 2000 chars para no exceder tokens

    critic_instructions = {
        "factual": """
Evaluate whether the worker results contain factual, grounded information.
Check for:
- Data that seems fabricated or hallucinated
- Inconsistent IDs or record counts
- Results that contradict each other
Score: 1.0 = fully factual, 0.0 = completely unreliable
""",
        "coherence": """
Evaluate whether the worker results coherently address the user's intent.
Check for:
- Results that don't answer the original intent
- Missing critical data that was requested
- Logical inconsistencies in multi-step results
Score: 1.0 = fully coherent and complete, 0.0 = completely irrelevant
""",
        "policy": """
Evaluate whether the actions taken respect tenant data policies.
Check for:
- Cross-tenant data access (CRITICAL failure if detected)
- PII exposure without authorization
- Write operations that weren't explicitly requested
Score: 1.0 = fully compliant, 0.0 = policy violation detected
""",
    }

    return f"""
## Critic Role: {critic_type.upper()} CRITIC

{critic_instructions[critic_type]}

## Original User Intent
{request_intent}

## Worker Results
```json
{results_summary}
```

## Response Format
```json
{{
  "score": 0.85,
  "passed": true,
  "feedback": "Brief explanation",
  "issues_found": ["specific issue 1", "specific issue 2"]
}}
```
"""


def council_of_critics_node(
    state: RHMAState,
    anthropic_client: anthropic.Anthropic,
) -> dict:
    """LangGraph node: 3 critics evalúan los resultados de workers."""

    request = state["request"]
    worker_results = state.get("worker_results", [])

    async def run_critics():
        tasks = [
            _call_critic(critic_type, request.intent, worker_results, anthropic_client)
            for critic_type in ["factual", "coherence", "policy"]
        ]
        return await asyncio.gather(*tasks)

    scores = asyncio.get_event_loop().run_until_complete(run_critics())

    # Determinar si pasó el council
    avg_score = sum(s.score for s in scores) / len(scores)
    all_passed = all(
        s.score >= INDIVIDUAL_CRITIC_THRESHOLD or s.critic_name == "coherence"
        for s in scores
    )
    # Policy critic tiene veto — si falla, es HARD FAIL
    policy_score = next((s for s in scores if s.critic_name == "policy"), None)
    if policy_score and policy_score.score < 0.50:
        logger.warning(f"HARD FAIL: Policy critic score {policy_score.score}")
        all_passed = False

    critics_passed = (avg_score >= COUNCIL_PASSING_SCORE) and all_passed

    logger.info(
        f"Council result: avg={avg_score:.2f} passed={critics_passed} "
        f"request={request.request_id}"
    )

    return {
        "critic_scores": scores,
        "critics_passed": critics_passed,
        "messages": [{"role": "critics", "content": f"avg_score={avg_score:.2f}"}],
    }


async def _call_critic(
    critic_type: str,
    intent: str,
    worker_results: list,
    client: anthropic.Anthropic,
) -> CriticScore:
    prompt = _build_critic_prompt(critic_type, intent, worker_results)
    response = await asyncio.get_event_loop().run_in_executor(
        None,
        lambda: client.messages.create(
            model="claude-3-5-haiku-20241022",  # Haiku para critics (más rápido + barato)
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}],
        )
    )

    raw = response.content[0].text
    try:
        json_start = raw.find("```json") + 7
        json_end = raw.rfind("```")
        data = json.loads(raw[json_start:json_end].strip())
        return CriticScore(
            critic_name=critic_type,
            score=float(data.get("score", 0.5)),
            passed=bool(data.get("passed", False)),
            feedback=data.get("feedback", ""),
            issues_found=data.get("issues_found", []),
        )
    except Exception as e:
        logger.error(f"Error parsing critic {critic_type} response: {e}")
        return CriticScore(critic_name=critic_type, score=0.5, passed=False, feedback=str(e), issues_found=[])
```

---

## 7. Guard-in-Guard (OPA)

```python
# m2/rhma/guard.py
"""
Guard-in-Guard — autorización final con Open Policy Agent (OPA).

Node LangGraph: "guard"
Solo se ejecuta si Critics passed.
Llama a OPA via HTTP (sidecar en el pod).

OPA evalúa:
  - Tenant está activo (tenant.active == true en OPA data)
  - User tiene permiso para la acción solicitada
  - No hay intentos de cross-tenant access
  - Rate limits del tenant plan no superados
"""
import logging
from typing import Optional
import httpx

from nexus_core.schemas import RHMAState

logger = logging.getLogger(__name__)

OPA_SIDECAR_URL = "http://127.0.0.1:8181/v1/data/nexus/authz/allow"


def guard_node(state: RHMAState) -> dict:
    """LangGraph node: Consulta OPA para autorización final."""
    request = state["request"]
    worker_results = state.get("worker_results", [])

    # Construir input para OPA
    opa_input = {
        "input": {
            "tenant_id": request.tenant_id,
            "user_id": request.user_id,
            "intent": request.intent,
            "actions": [r.worker_type for r in worker_results if r.success],
            "has_write_actions": any(r.worker_type == "write" for r in worker_results),
        }
    }

    authorized = False
    denial_reason = None

    try:
        with httpx.Client(timeout=2.0) as client:
            response = client.post(OPA_SIDECAR_URL, json=opa_input)
            response.raise_for_status()
            result = response.json()
            authorized = result.get("result", False)
            if not authorized:
                denial_reason = result.get("reasons", ["OPA denied request"])[0]
    except httpx.TimeoutException:
        logger.error("OPA timeout — denying for safety")
        authorized = False
        denial_reason = "authorization_timeout"
    except Exception as e:
        logger.error(f"OPA error: {e} — denying for safety")
        authorized = False
        denial_reason = str(e)

    logger.info(
        f"Guard result: authorized={authorized} "
        f"tenant={request.tenant_id} reason={denial_reason}"
    )

    return {
        "opa_authorized": authorized,
        "opa_denial_reason": denial_reason,
        "messages": [{"role": "guard", "content": f"authorized={authorized}"}],
    }


# Rego policy (archivo: opa/nexus/authz.rego)
OPA_POLICY = """
package nexus.authz

default allow = false

allow {
    data.tenants[input.tenant_id].active == true
    not input.has_write_actions
}

allow {
    data.tenants[input.tenant_id].active == true
    input.has_write_actions
    data.user_permissions[input.user_id][_] == "write"
}

deny[reason] {
    input.tenant_id != input.user_id_tenant
    reason := "cross_tenant_access_denied"
}
"""
```

---

## 8. Graph Assembly + Runner

```python
# m2/rhma/graph.py
"""
RHMA Graph Assembly — conecta todos los nodos en el LangGraph StateGraph.
"""
import time
import logging
import json
from langgraph.graph import StateGraph, END
from nexus_core.schemas import RHMAResponse, RHMARequest
from m2.rhma.state import RHMAState

logger = logging.getLogger(__name__)


def should_replan(state: RHMAState) -> str:
    """Conditional edge: ¿Replannear o ir a guard?"""
    if state.get("critics_passed"):
        return "guard"
    if state.get("plan_iteration", 0) >= state["request"].max_retries:
        return "reject"
    return "replan"


def should_finalize(state: RHMAState) -> str:
    """Conditional edge: ¿OPA pasó?"""
    if state.get("opa_authorized"):
        return "finalize"
    return "reject"


def finalize_node(state: RHMAState) -> dict:
    """Construye la RHMAResponse final y determina si necesita workflow."""
    request = state["request"]
    worker_results = state.get("worker_results", [])
    critic_scores = state.get("critic_scores", [])

    avg_score = sum(s.score for s in critic_scores) / len(critic_scores) if critic_scores else 0.0
    latency_ms = (time.perf_counter() * 1000) - state.get("start_time_ms", 0)

    data_retrieved = {}
    for r in worker_results:
        if r.success:
            data_retrieved[r.task_id] = r.data

    # Determinar si necesita workflow M4
    has_writes = any(r.worker_type == "write" for r in worker_results if r.success)
    requires_workflow = has_writes

    response = RHMAResponse(
        request_id=request.request_id,
        tenant_id=request.tenant_id,
        user_id=request.user_id,
        interpretation=_synthesize_interpretation(request.intent, data_retrieved),
        actions_taken=[f"{r.worker_type}:{r.task_id}" for r in worker_results if r.success],
        data_retrieved=data_retrieved,
        critics_score=avg_score,
        requires_workflow=requires_workflow,
        workflow_payload={"request_id": request.request_id, "data": data_retrieved} if requires_workflow else None,
        total_latency_ms=latency_ms,
    )
    return {"response": response}


def reject_node(state: RHMAState) -> dict:
    """Nodo de rechazo: critics fallaron o OPA denegó."""
    reason = state.get("opa_denial_reason") or "critics_failed"
    logger.warning(
        f"RHMA request rechazado: request={state['request'].request_id} reason={reason}"
    )
    return {"error": reason}


def _synthesize_interpretation(intent: str, data: dict) -> str:
    """Síntesis simple de resultados (el LLM final de síntesis no es necesario en MVP)."""
    if not data:
        return "No data found matching the request."
    total_items = sum(
        len(v) if isinstance(v, list) else 1
        for v in data.values()
    )
    return f"Request completed: found {total_items} relevant items for '{intent}'"


def build_rhma_graph(anthropic_client, workers: dict) -> StateGraph:
    """Ensambla el StateGraph completo del RHMA Agent."""
    from m2.rhma.planner import plan_node
    from m2.rhma.workers import execute_workers_node
    from m2.rhma.critics import council_of_critics_node
    from m2.rhma.guard import guard_node

    workflow = StateGraph(RHMAState)

    workflow.add_node("plan", lambda s: plan_node(s, anthropic_client))
    workflow.add_node("execute", lambda s: execute_workers_node(s, workers))
    workflow.add_node("critics", lambda s: council_of_critics_node(s, anthropic_client))
    workflow.add_node("guard", guard_node)
    workflow.add_node("finalize", finalize_node)
    workflow.add_node("reject", reject_node)

    # Flujo principal
    workflow.set_entry_point("plan")
    workflow.add_edge("plan", "execute")
    workflow.add_edge("execute", "critics")
    workflow.add_conditional_edges("critics", should_replan, {
        "guard": "guard",
        "replan": "plan",
        "reject": "reject",
    })
    workflow.add_conditional_edges("guard", should_finalize, {
        "finalize": "finalize",
        "reject": "reject",
    })
    workflow.add_edge("finalize", END)
    workflow.add_edge("reject", END)

    return workflow.compile()
```

---

## 9. Consumer / Producer Wiring

```python
# m2/rhma/runner.py
"""RHMA Agent Runner — consume requests y publica responses."""
import asyncio
import json
import logging
import os
import time
import uuid
from prometheus_client import Counter, Histogram, start_http_server

from nexus_core.messaging import NexusMessage, NexusProducer, NexusConsumer
from nexus_core.tenant import set_tenant, TenantContext
from nexus_core.topics import CrossModuleTopicNamer as T
from nexus_core.schemas import RHMARequest
from m2.rhma.graph import build_rhma_graph

logger = logging.getLogger(__name__)

rhma_requests = Counter("m2_rhma_requests_total", "Requests RHMA", ["tenant_id", "outcome"])
rhma_latency = Histogram("m2_rhma_latency_seconds", "Latencia RHMA", buckets=[1, 5, 15, 30, 60, 120])


class RHMARunner:
    def __init__(self):
        bootstrap = os.environ["KAFKA_BOOTSTRAP_SERVERS"]
        self._consumer = NexusConsumer(
            bootstrap_servers=bootstrap,
            group_id="m2-rhma-agents",
            topics=[T.PER_TENANT.SEMANTIC_INTERPRETATION_REQUESTED],
        )
        self._producer = NexusProducer(bootstrap, source_module="m2-rhma")
        self._graph = None

    async def start(self) -> None:
        import anthropic
        import asyncpg
        from sentence_transformers import SentenceTransformer

        client = anthropic.Anthropic(api_key=self._load_key("/var/run/secrets/platform/anthropic/api_key"))
        db_pool = await asyncpg.create_pool(dsn=os.environ["NEXUS_DB_DSN"])
        embedder = SentenceTransformer("all-MiniLM-L6-v2")  # LOCAL — no OpenAI
        from pinecone import Pinecone
        import neo4j

        pc = Pinecone(api_key=self._load_key("/var/run/secrets/platform/pinecone/api_key"))
        neo4j_driver = neo4j.AsyncGraphDatabase.driver(
            os.environ["NEO4J_URI"],
            auth=(os.environ["NEO4J_USER"], self._load_key("/var/run/secrets/platform/neo4j/password"))
        )

        from m2.rhma.workers import SearchWorker, CalculateWorker, FetchWorker, WriteWorker
        from nexus_core.schemas import WorkerType
        workers = {
            WorkerType.SEARCH: SearchWorker(pc, neo4j_driver, embedder),
            WorkerType.CALCULATE: CalculateWorker(db_pool),
            WorkerType.FETCH: FetchWorker(db_pool=db_pool),
            WorkerType.WRITE: WriteWorker(db_pool),
        }

        self._graph = build_rhma_graph(client, workers)
        start_http_server(9096)
        logger.info("RHMARunner iniciado.")

        while True:
            await self._process_one()

    def _load_key(self, path: str) -> str:
        # Fallback para dev
        if os.path.exists(path):
            with open(path) as f:
                return f.read().strip()
        return ""

    async def _process_one(self) -> None:
        msg = self._consumer.poll(timeout=2.0)
        if msg is None:
            return

        tenant_id = msg.tenant_id
        set_tenant(TenantContext(tenant_id=tenant_id, plan="professional", cdm_version="1.0.0"))
        start_ts = time.perf_counter()

        try:
            payload = msg.payload
            request = RHMARequest(
                request_id=payload.get("request_id", str(uuid.uuid4())),
                tenant_id=tenant_id,
                user_id=payload.get("user_id", ""),
                intent=payload.get("intent", ""),
                context=payload.get("context", {}),
            )

            initial_state = {
                "request": request,
                "plan": [],
                "plan_iteration": 0,
                "worker_results": [],
                "critic_scores": [],
                "critics_passed": None,
                "opa_authorized": None,
                "opa_denial_reason": None,
                "response": None,
                "error": None,
                "start_time_ms": start_ts * 1000,
                "messages": [],
            }

            final_state = self._graph.invoke(initial_state)
            latency = time.perf_counter() - start_ts
            rhma_latency.observe(latency)

            if final_state.get("response"):
                response = final_state["response"]
                response_topic = T.per_tenant(tenant_id, T.PER_TENANT.SEMANTIC_INTERPRETATION_COMPLETE)
                resp_msg = NexusMessage(
                    topic=response_topic,
                    tenant_id=tenant_id,
                    event_type="semantic_interpretation_complete",
                    payload={"request_id": request.request_id, **vars(response)},
                    correlation_id=msg.correlation_id,
                    trace_id=msg.trace_id,
                )
                self._producer.publish(resp_msg, partition_key=tenant_id)

                if response.requires_workflow:
                    wf_msg = NexusMessage(
                        topic=T.per_tenant(tenant_id, T.PER_TENANT.WORKFLOW_TRIGGER),
                        tenant_id=tenant_id,
                        event_type="workflow_trigger",
                        payload=response.workflow_payload,
                        correlation_id=msg.correlation_id,
                        trace_id=msg.trace_id,
                    )
                    self._producer.publish(wf_msg, partition_key=tenant_id)

                rhma_requests.labels(tenant_id=tenant_id, outcome="success").inc()

            elif final_state.get("error"):
                reject_topic = T.per_tenant(tenant_id, T.PER_TENANT.SEMANTIC_INTERPRETATION_COMPLETE)
                self._producer.publish(NexusMessage(
                    topic=reject_topic,
                    tenant_id=tenant_id,
                    event_type="semantic_interpretation_rejected",
                    payload={"request_id": request.request_id, "reason": final_state["error"]},
                    correlation_id=msg.correlation_id,
                    trace_id=msg.trace_id,
                ), partition_key=tenant_id)
                rhma_requests.labels(tenant_id=tenant_id, outcome="rejected").inc()

            self._consumer.commit(msg)

        except Exception as e:
            logger.error(f"RHMA runner error: {e}", exc_info=True)
            rhma_requests.labels(tenant_id=tenant_id, outcome="error").inc()
            self._consumer.commit(msg)
```

---

## 10. K8s Deployment + Prometheus

```yaml
# k8s/m2/rhma-agent-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: m2-rhma-agent
  namespace: nexus-app
  labels:
    app: m2-rhma-agent
spec:
  replicas: 2
  selector:
    matchLabels:
      app: m2-rhma-agent
  template:
    metadata:
      labels:
        app: m2-rhma-agent
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "9096"
    spec:
      containers:
        - name: rhma-agent
          image: nexus-m2-rhma:latest
          ports:
            - containerPort: 9096   # Prometheus metrics
          env:
            - name: KAFKA_BOOTSTRAP_SERVERS
              value: "nexus-kafka-kafka-bootstrap.nexus-data.svc:9092"
            - name: NEXUS_DB_DSN
              valueFrom:
                secretKeyRef:
                  name: nexus-db-credentials
                  key: dsn
            - name: NEO4J_URI
              valueFrom:
                secretKeyRef:
                  name: neo4j-credentials
                  key: uri
            - name: NEO4J_USER
              value: "neo4j"
          resources:
            requests:
              cpu: "500m"
              memory: "2Gi"
            limits:
              cpu: "2"
              memory: "4Gi"
          volumeMounts:
            - name: platform-secrets
              mountPath: /var/run/secrets/platform
              readOnly: true
        # OPA Sidecar
        - name: opa
          image: openpolicyagent/opa:0.61.0
          args:
            - "run"
            - "--server"
            - "--addr=0.0.0.0:8181"
            - "/policies"
          ports:
            - containerPort: 8181
          resources:
            requests:
              cpu: "50m"
              memory: "64Mi"
            limits:
              cpu: "200m"
              memory: "128Mi"
          volumeMounts:
            - name: opa-policies
              mountPath: /policies
      volumes:
        - name: platform-secrets
          projected:
            sources:
              - secret:
                  name: nexus-anthropic-key
              - secret:
                  name: nexus-pinecone-key
              - secret:
                  name: nexus-neo4j-password
        - name: opa-policies
          configMap:
            name: nexus-opa-policies
```

---

## 11. Acceptance Criteria M2

```bash
# Test 1: Happy path — request simple de búsqueda
curl -X POST http://localhost:8080/api/m2/interpret \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: test-alpha" \
  -d '{
    "intent": "Find all customers in Belgium with transactions over 10000 euros",
    "context": {"entity_type": "party", "country_filter": "BE"}
  }'
# Expected: 200, response.critics_score >= 0.75, opa_authorized=true

# Test 2: Cross-tenant attempt → OPA deniega
curl -X POST http://localhost:8080/api/m2/interpret \
  -H "X-Tenant-ID: test-alpha" \
  -d '{"intent": "Get all data for tenant test-beta", "context": {}}'
# Expected: semantic_interpretation_rejected, reason="cross_tenant_access_denied"

# Test 3: Critics fallan por primera vez → replan
# (simular con request mal formado)
# Expected: plan_iteration=2 en estado final (replanneó una vez)

# Test 4: Prometheus metrics
curl http://m2-rhma-agent:9096/metrics | grep m2_rhma_requests_total
# Expected: métricas presentes con labels tenant_id y outcome

# Test 5: Latencia total < 30s para request estándar
# Expected: total_latency_ms < 30000

# Test 6: Anthropic API key NUNCA en logs
kubectl logs -n nexus-app -l app=m2-rhma-agent | grep -i "sk-ant"
# Expected: cero líneas

# Test 7: OPA sidecar activo
kubectl exec -n nexus-app -l app=m2-rhma-agent -c opa -- \
  wget -qO- http://localhost:8181/health
# Expected: {"status":"ok"}
```

---

*NEXUS Build Plan — Archivo 06 · M2 RHMA Executive Agent · Mentis Consulting · Marzo 2026*
