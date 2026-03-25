# NEXUS — Archivo 08: M6 Adaptive User Interface (Next.js 14)
## AI Chat Interface + CDM Governance Console + Prometheus Alerts
### Semanas 10–13 · Equipo Frontend · PARALELO con M4 completion
### Depende de: NEXUS-06 (M2 API activa) + NEXUS-07 (M4 Governance API activa)

---

## Tabla de Contenidos

1. [Stack M6](#1-stack-m6)
2. [next-auth PKCE — Okta OIDC](#2-next-auth-pkce--okta-oidc)
3. [AI Chat Interface](#3-ai-chat-interface)
4. [WebSocket Hook](#4-websocket-hook)
5. [CDM Governance Console](#5-cdm-governance-console)
6. [API Routes (Next.js BFF)](#6-api-routes-nextjs-bff)
7. [Prometheus Alerts — Todos los Módulos](#7-prometheus-alerts--todos-los-módulos)
8. [K8s Deployment M6](#8-k8s-deployment-m6)
9. [Acceptance Criteria M6](#9-acceptance-criteria-m6)

---

## 1. Stack M6

```
Next.js 14 (App Router)
├── next-auth v5 (PKCE con Okta OIDC)
├── TypeScript 5
├── Tailwind CSS 3
├── shadcn/ui (componentes base)
├── WebSocket nativo (para streaming de respuestas AI)
├── SWR (data fetching + cache)
└── Prometheus client (métricas del server-side)

API Routes (BFF — Backend for Frontend):
  /api/auth/[...nextauth] — next-auth handlers
  /api/chat              — POST request → M2 RHMA (via Kafka → awaits response)
  /api/governance/*      — Proxy a M4 Governance FastAPI
  /api/ws                — WebSocket upgrade para chat streaming
```

**Variables de entorno requeridas:**

```bash
# .env.local (K8s Secret en prod)
NEXTAUTH_URL=https://app.nexus.mentis-consulting.be
NEXTAUTH_SECRET=<generated-32-bytes>
OKTA_CLIENT_ID=<del Okta App NEXUS-Web>
OKTA_CLIENT_SECRET=<del Okta App NEXUS-Web>
OKTA_ISSUER=https://mentis-consulting.okta.com/oauth2/default
NEXUS_API_BASE=http://m4-governance-api.nexus-app.svc:8000
NEXUS_M2_API=http://m2-rhma-runner.nexus-app.svc:8080
KAFKA_BOOTSTRAP_SERVERS=nexus-kafka-kafka-bootstrap.nexus-data.svc:9092
```

---

## 2. next-auth PKCE — Okta OIDC

```typescript
// app/api/auth/[...nextauth]/route.ts
import NextAuth, { NextAuthConfig } from "next-auth";
import OktaProvider from "next-auth/providers/okta";

const config: NextAuthConfig = {
  providers: [
    OktaProvider({
      clientId: process.env.OKTA_CLIENT_ID!,
      clientSecret: process.env.OKTA_CLIENT_SECRET!,
      issuer: process.env.OKTA_ISSUER!,
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      // Añadir tenant_id y user claims al session
      if (token.sub) {
        session.user.id = token.sub;
      }
      if (token.tenant_id) {
        session.user.tenantId = token.tenant_id as string;
      }
      if (token.access_token) {
        session.accessToken = token.access_token as string;
      }
      return session;
    },
    async jwt({ token, account, profile }) {
      if (account) {
        token.access_token = account.access_token;
        // El claim tenant_id viene del Okta token (configurado en Phase 0)
        token.tenant_id = (profile as any)?.tenant_id ?? "";
      }
      return token;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 horas
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
};

const handler = NextAuth(config);
export { handler as GET, handler as POST };
```

```typescript
// types/next-auth.d.ts
import "next-auth";
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      tenantId: string;
    };
    accessToken: string;
  }
}
```

---

## 3. AI Chat Interface

```typescript
// app/(dashboard)/chat/page.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { useNexusWebSocket } from "@/hooks/useNexusWebSocket";

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  requestId?: string;
  criticsScore?: number;
  latencyMs?: number;
  error?: string;
}

export default function ChatPage() {
  const { data: session } = useSession({ required: true });
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { sendMessage, lastResponse, isConnected } = useNexusWebSocket(
    session?.user?.tenantId ?? ""
  );

  // Cuando llega nueva respuesta del WebSocket
  useEffect(() => {
    if (!lastResponse) return;
    setIsLoading(false);
    setMessages((prev) => [
      ...prev,
      {
        id: lastResponse.requestId,
        role: "assistant",
        content: lastResponse.interpretation,
        timestamp: new Date(),
        requestId: lastResponse.requestId,
        criticsScore: lastResponse.criticsScore,
        latencyMs: lastResponse.totalLatencyMs,
        error: lastResponse.error,
      },
    ]);
  }, [lastResponse]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    // Enviar via WebSocket al backend
    sendMessage({
      intent: text,
      userId: session?.user?.id ?? "",
      context: {},
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-4xl mx-auto">
      {/* Header con estado de conexión */}
      <div className="flex items-center justify-between p-4 border-b">
        <h1 className="text-xl font-semibold">NEXUS AI Assistant</h1>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
          <span className="text-sm text-muted-foreground">
            {isConnected ? "Connected" : "Reconnecting..."}
          </span>
        </div>
      </div>

      {/* Área de mensajes */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground mt-20">
            <p className="text-lg font-medium">Ask anything about your enterprise data</p>
            <p className="text-sm mt-2">e.g. "Show me customers in Belgium with transactions over €10,000"</p>
          </div>
        )}
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="flex space-x-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 bg-primary rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
            <span className="text-sm">NEXUS is thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t">
        <ChatInput onSend={handleSend} disabled={isLoading || !isConnected} />
      </div>
    </div>
  );
}
```

```typescript
// components/chat/ChatMessage.tsx
import { Message } from "@/app/(dashboard)/chat/page";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-lg px-4 py-3 text-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : message.error
            ? "bg-destructive/10 border border-destructive/20"
            : "bg-muted"
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        {/* Metadata para mensajes del asistente */}
        {!isUser && !message.error && (
          <div className="flex items-center gap-2 mt-2 opacity-60">
            {message.criticsScore !== undefined && (
              <Badge variant="outline" className="text-xs">
                Quality: {(message.criticsScore * 100).toFixed(0)}%
              </Badge>
            )}
            {message.latencyMs !== undefined && (
              <span className="text-xs">{(message.latencyMs / 1000).toFixed(1)}s</span>
            )}
          </div>
        )}
        {message.error && (
          <p className="text-xs text-destructive mt-1">Error: {message.error}</p>
        )}
      </div>
    </div>
  );
}
```

```typescript
// components/chat/ChatInput.tsx
"use client";
import { useState, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [text, setText] = useState("");

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (text.trim()) {
        onSend(text.trim());
        setText("");
      }
    }
  };

  return (
    <div className="flex gap-2">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask about your enterprise data... (Enter to send, Shift+Enter for new line)"
        disabled={disabled}
        rows={2}
        className="resize-none"
      />
      <Button
        onClick={() => { onSend(text.trim()); setText(""); }}
        disabled={disabled || !text.trim()}
        className="self-end"
      >
        Send
      </Button>
    </div>
  );
}
```

---

## 4. WebSocket Hook

```typescript
// hooks/useNexusWebSocket.ts
"use client";
import { useState, useEffect, useCallback, useRef } from "react";

interface ChatRequest {
  intent: string;
  userId: string;
  context: Record<string, unknown>;
}

interface ChatResponse {
  requestId: string;
  interpretation: string;
  criticsScore: number;
  totalLatencyMs: number;
  error?: string;
}

export function useNexusWebSocket(tenantId: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastResponse, setLastResponse] = useState<ChatResponse | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const connect = useCallback(() => {
    if (!tenantId) return;

    const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3000"}/api/ws?tenant=${tenantId}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setIsConnected(true);
      console.log("NEXUS WebSocket connected");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as ChatResponse;
        setLastResponse(data);
      } catch (e) {
        console.error("Error parsing WebSocket message:", e);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      // Reconectar después de 3 segundos
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      ws.close();
    };

    wsRef.current = ws;
  }, [tenantId]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const sendMessage = useCallback((request: ChatRequest) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(request));
    } else {
      console.warn("WebSocket no conectado");
    }
  }, []);

  return { sendMessage, lastResponse, isConnected };
}
```

```typescript
// app/api/ws/route.ts
/**
 * WebSocket API Route — hace de bridge entre el cliente y M2 RHMA.
 * 
 * Flujo:
 * 1. Cliente conecta vía WebSocket
 * 2. Cliente envía { intent, userId, context }
 * 3. API Route publica a Kafka {tid}.m2.semantic_interpretation_requested
 * 4. API Route consume {tid}.m2.semantic_interpretation_complete
 * 5. API Route envía respuesta al cliente por WebSocket
 */
import { NextRequest } from "next/server";
import crypto from "crypto";

// Next.js 14 WebSocket via edge runtime no disponible — usar Node.js custom server
// Este route.ts es un placeholder, el WS real se implementa en server.ts

export async function GET(request: NextRequest) {
  const upgrade = request.headers.get("upgrade");
  if (upgrade !== "websocket") {
    return new Response("Expected WebSocket upgrade", { status: 426 });
  }
  return new Response("WebSocket endpoint — requires custom server", { status: 501 });
}
```

```typescript
// server.ts (custom Next.js server para WebSocket)
import { createServer } from "http";
import { WebSocketServer } from "ws";
import next from "next";
import { Kafka } from "kafkajs";
import crypto from "crypto";

const dev = process.env.NODE_ENV !== "production";
const nextApp = next({ dev });
const handle = nextApp.getRequestHandler();

const kafka = new Kafka({
  clientId: "nexus-m6-ws",
  brokers: (process.env.KAFKA_BOOTSTRAP_SERVERS ?? "").split(","),
});

nextApp.prepare().then(() => {
  const server = createServer((req, res) => handle(req, res));
  const wss = new WebSocketServer({ server, path: "/api/ws" });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const tenantId = url.searchParams.get("tenant") ?? "";

    const consumer = kafka.consumer({ groupId: `m6-ws-${crypto.randomUUID()}` });
    const producer = kafka.producer();

    const setup = async () => {
      await producer.connect();
      await consumer.connect();
      const responseTopic = `${tenantId}.m2.semantic_interpretation_complete`;
      await consumer.subscribe({ topic: responseTopic, fromBeginning: false });

      await consumer.run({
        eachMessage: async ({ message }) => {
          if (ws.readyState === ws.OPEN) {
            ws.send(message.value?.toString() ?? "");
          }
        },
      });
    };

    setup();

    ws.on("message", async (data) => {
      try {
        const payload = JSON.parse(data.toString());
        const requestId = crypto.randomUUID();
        await producer.send({
          topic: `${tenantId}.m2.semantic_interpretation_requested`,
          messages: [{
            key: tenantId,
            value: JSON.stringify({
              request_id: requestId,
              tenant_id: tenantId,
              user_id: payload.userId ?? "",
              intent: payload.intent ?? "",
              context: payload.context ?? {},
            }),
          }],
        });
      } catch (e) {
        ws.send(JSON.stringify({ error: "Failed to process request" }));
      }
    });

    ws.on("close", async () => {
      await consumer.disconnect();
      await producer.disconnect();
    });
  });

  server.listen(3000, () => {
    console.log("> NEXUS M6 ready on http://localhost:3000");
  });
});
```

---

## 5. CDM Governance Console

```typescript
// app/(dashboard)/governance/page.tsx
"use client";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { ProposalCard } from "@/components/governance/ProposalCard";
import { MappingReviewTable } from "@/components/governance/MappingReviewTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const fetcher = async (url: string, token: string, tenantId: string) => {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Tenant-ID": tenantId,
    },
  });
  if (!res.ok) throw new Error("API error");
  return res.json();
};

export default function GovernancePage() {
  const { data: session } = useSession({ required: true });
  const tenantId = session?.user?.tenantId ?? "";
  const token = session?.accessToken ?? "";

  const { data: proposals, mutate: mutateProposals } = useSWR(
    tenantId ? ["/api/governance/proposals", token, tenantId] : null,
    ([url, t, tid]) => fetcher(url, t, tid),
    { refreshInterval: 30_000 }  // Refresh cada 30s
  );

  const { data: mappingReviews, mutate: mutateMappings } = useSWR(
    tenantId ? ["/api/governance/mapping-review", token, tenantId] : null,
    ([url, t, tid]) => fetcher(url, t, tid),
    { refreshInterval: 30_000 }
  );

  const handleApprove = async (proposalId: string) => {
    await fetch(`/api/governance/proposals/${proposalId}/approve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Tenant-ID": tenantId,
      },
      body: JSON.stringify({ approved_by: session?.user?.email }),
    });
    mutateProposals();
  };

  const handleReject = async (proposalId: string, reason: string) => {
    await fetch(`/api/governance/proposals/${proposalId}/reject`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Tenant-ID": tenantId,
      },
      body: JSON.stringify({ rejected_by: session?.user?.email, reason }),
    });
    mutateProposals();
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">CDM Governance Console</h1>

      <Tabs defaultValue="proposals">
        <TabsList>
          <TabsTrigger value="proposals">
            CDM Proposals
            {proposals?.count > 0 && (
              <span className="ml-2 bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs">
                {proposals.count}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="mappings">
            Mapping Review
            {mappingReviews?.count > 0 && (
              <span className="ml-2 bg-amber-500 text-white rounded-full px-2 py-0.5 text-xs">
                {mappingReviews.count}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="proposals" className="space-y-4 mt-4">
          {proposals?.proposals?.length === 0 && (
            <div className="text-center text-muted-foreground py-12">
              No pending CDM proposals
            </div>
          )}
          {proposals?.proposals?.map((p: any) => (
            <ProposalCard
              key={p.proposal_id}
              proposal={p}
              onApprove={() => handleApprove(p.proposal_id)}
              onReject={(reason) => handleReject(p.proposal_id, reason)}
            />
          ))}
        </TabsContent>

        <TabsContent value="mappings" className="mt-4">
          <MappingReviewTable
            items={mappingReviews?.items ?? []}
            token={token}
            tenantId={tenantId}
            onResolved={mutateMappings}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

```typescript
// components/governance/ProposalCard.tsx
"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface FieldMapping {
  source_field: string;
  cdm_entity: string;
  cdm_field: string;
  confidence: number;
  tier: number;
}

interface Proposal {
  proposal_id: string;
  entity_type: string;
  confidence: number;
  payload: {
    proposed_entity_type: string;
    justification: string;
    field_mappings: FieldMapping[];
    requires_cdm_extension: boolean;
  };
}

export function ProposalCard({
  proposal,
  onApprove,
  onReject,
}: {
  proposal: Proposal;
  onApprove: () => void;
  onReject: (reason: string) => void;
}) {
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleApprove = async () => {
    setIsProcessing(true);
    await onApprove();
    setIsProcessing(false);
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setIsProcessing(true);
    await onReject(rejectReason);
    setIsProcessing(false);
  };

  const tierColors: Record<number, string> = {
    1: "bg-green-100 text-green-800 border-green-200",
    2: "bg-amber-100 text-amber-800 border-amber-200",
    3: "bg-red-100 text-red-800 border-red-200",
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            Entity Type: <span className="text-primary">{proposal.payload?.proposed_entity_type}</span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              Confidence: {((proposal.confidence ?? 0) * 100).toFixed(0)}%
            </Badge>
            {proposal.payload?.requires_cdm_extension && (
              <Badge variant="destructive">CDM Extension Required</Badge>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {proposal.payload?.justification}
        </p>
      </CardHeader>

      <CardContent>
        {/* Tabla de mapeos de campos */}
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-2">Source Field</th>
                <th className="text-left p-2">→ CDM Entity.Field</th>
                <th className="text-left p-2">Confidence</th>
                <th className="text-left p-2">Tier</th>
              </tr>
            </thead>
            <tbody>
              {proposal.payload?.field_mappings?.map((m: FieldMapping, i: number) => (
                <tr key={i} className="border-t">
                  <td className="p-2 font-mono text-xs">{m.source_field}</td>
                  <td className="p-2 text-xs">{m.cdm_entity}.{m.cdm_field}</td>
                  <td className="p-2 text-xs">{(m.confidence * 100).toFixed(0)}%</td>
                  <td className="p-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded border ${tierColors[m.tier] ?? ""}`}>
                      T{m.tier}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Acciones */}
        <div className="flex gap-2 mt-4">
          {!showReject ? (
            <>
              <Button onClick={handleApprove} disabled={isProcessing} size="sm">
                Approve
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowReject(true)}
                disabled={isProcessing}
              >
                Reject
              </Button>
            </>
          ) : (
            <div className="flex gap-2 w-full">
              <input
                type="text"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Reason for rejection..."
                className="flex-1 text-sm border rounded px-2 py-1"
              />
              <Button
                variant="destructive"
                size="sm"
                onClick={handleReject}
                disabled={isProcessing || !rejectReason.trim()}
              >
                Confirm Reject
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowReject(false)}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## 6. API Routes (Next.js BFF)

```typescript
// app/api/governance/proposals/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = session.user.tenantId;
  const backendUrl = `${process.env.NEXUS_API_BASE}/api/governance/proposals`;

  const res = await fetch(backendUrl, {
    headers: {
      "X-Tenant-ID": tenantId,
      Authorization: `Bearer ${session.accessToken}`,
    },
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
```

```typescript
// app/api/governance/proposals/[id]/approve/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const backendUrl = `${process.env.NEXUS_API_BASE}/api/governance/proposals/${params.id}/approve`;

  const res = await fetch(backendUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Tenant-ID": session.user.tenantId,
      Authorization: `Bearer ${session.accessToken}`,
    },
    body: JSON.stringify({ ...body, approved_by: session.user.email }),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
```

---

## 7. Prometheus Alerts — Todos los Módulos

```yaml
# k8s/monitoring/nexus-alerts.yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: nexus-alerts
  namespace: nexus-infra
  labels:
    prometheus: kube-prometheus
    role: alert-rules
spec:
  groups:
    # ─── M1 Pipeline ─────────────────────────────────────────────────
    - name: nexus.m1
      rules:
        - alert: M1BackpressureActive
          expr: m1_backpressure_active{job="connector-worker"} == 1
          for: 5m
          labels:
            severity: warning
            team: data-engineering
          annotations:
            summary: "M1 backpressure activo por >5min en tenant {{ $labels.tenant_id }}"
            description: "Lag de m1.int.raw_records supera 50,000. Consumer: {{ $labels.pod }}"

        - alert: M1SyncFailureRate
          expr: rate(m1_sync_failures_total[5m]) > 0.1
          for: 2m
          labels:
            severity: critical
          annotations:
            summary: "Alta tasa de fallos en M1 sync: {{ $value | humanizePercentage }}/s"

        - alert: M1DeltaFlushLatency
          expr: histogram_quantile(0.95, rate(m1_delta_flush_duration_seconds_bucket[5m])) > 60
          annotations:
            summary: "Delta flush P95 > 60s en {{ $labels.tenant_id }}"

        - alert: M1KafkaConsumerLag
          expr: |
            kafka_consumergroup_lag{consumergroup=~"m1-.*"} > 100000
          for: 10m
          labels:
            severity: critical
          annotations:
            summary: "Kafka consumer lag > 100k para grupo {{ $labels.consumergroup }}"

    # ─── M2 RHMA ──────────────────────────────────────────────────────
    - name: nexus.m2
      rules:
        - alert: M2RHMAHighErrorRate
          expr: rate(m2_rhma_requests_total{outcome="error"}[5m]) > 0.05
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "RHMA error rate > 5% para tenant {{ $labels.tenant_id }}"

        - alert: M2RHMAHighLatency
          expr: histogram_quantile(0.95, rate(m2_rhma_latency_seconds_bucket[10m])) > 30
          for: 5m
          annotations:
            summary: "RHMA P95 latencia > 30s (tenant={{ $labels.tenant_id }})"

        - alert: M2StructuralLLMErrors
          expr: rate(m2_structural_llm_calls_total{outcome="error"}[10m]) > 0.2
          annotations:
            summary: "M2 Structural Agent LLM errors > 20%/min"

    # ─── M3 AI Stores ─────────────────────────────────────────────────
    - name: nexus.m3
      rules:
        - alert: M3VectorWriteErrors
          expr: rate(m3_vector_write_errors_total[5m]) > 0
          for: 2m
          labels:
            severity: warning
          annotations:
            summary: "Errores escritura Pinecone para tenant {{ $labels.tenant_id }}"

        - alert: M3GraphWriteLatency
          expr: histogram_quantile(0.95, rate(m3_graph_write_latency_seconds_bucket[5m])) > 10
          annotations:
            summary: "Neo4j write P95 > 10s"

        - alert: M3TimeSeriesWriteErrors
          expr: rate(m3_ts_write_errors_total[5m]) > 0
          for: 3m
          annotations:
            summary: "TimescaleDB write errors > 0 para {{ $labels.tenant_id }}"

    # ─── M4 Governance ───────────────────────────────────────────────
    - name: nexus.m4
      rules:
        - alert: M4GovernanceQueueBacklog
          expr: |
            count(nexus_governance_queue_pending) by (tenant_id) > 50
          for: 30m
          labels:
            severity: warning
          annotations:
            summary: "Governance queue backlog > 50 items para {{ $labels.tenant_id }}"

        - alert: M4APIHighErrorRate
          expr: rate(m4_governance_requests_total{status=~"5.."}[5m]) > 0.1
          annotations:
            summary: "M4 API 5xx rate > 10%"

    # ─── Infraestructura ─────────────────────────────────────────────
    - name: nexus.infra
      rules:
        - alert: KafkaBrokerDown
          expr: up{job="kafka-broker"} == 0
          for: 1m
          labels:
            severity: critical
          annotations:
            summary: "Kafka broker {{ $labels.pod }} caído"

        - alert: PostgreSQLConnectionPoolExhausted
          expr: pg_stat_activity_count > pg_settings_max_connections * 0.85
          for: 5m
          labels:
            severity: critical
          annotations:
            summary: "PostgreSQL connection pool al {{ $value | humanizePercentage }}"

        - alert: MinIODiskUsageHigh
          expr: minio_disk_storage_used_bytes / minio_disk_storage_total_bytes > 0.80
          for: 1h
          labels:
            severity: warning
          annotations:
            summary: "MinIO uso de disco > 80%"

        - alert: ExternalSecretsOperatorError
          expr: rate(external_secrets_sync_calls_error[5m]) > 0
          annotations:
            summary: "External Secrets Operator falló en sincronizar secretos"
```

---

## 8. K8s Deployment M6

```yaml
# k8s/m6/nextjs-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: m6-nexus-ui
  namespace: nexus-app
  labels:
    app: m6-nexus-ui
spec:
  replicas: 2
  selector:
    matchLabels:
      app: m6-nexus-ui
  template:
    metadata:
      labels:
        app: m6-nexus-ui
    spec:
      containers:
        - name: nextjs
          image: nexus-m6-ui:latest
          ports:
            - containerPort: 3000
          command: ["node", "server.js"]  # Custom server para WebSocket
          env:
            - name: NEXTAUTH_URL
              value: "https://app.nexus.mentis-consulting.be"
            - name: NEXUS_API_BASE
              value: "http://m4-governance-api.nexus-app.svc:8000"
            - name: NEXUS_M2_API
              value: "http://m2-rhma-runner.nexus-app.svc:8080"
            - name: KAFKA_BOOTSTRAP_SERVERS
              value: "nexus-kafka-kafka-bootstrap.nexus-data.svc:9092"
          envFrom:
            - secretRef:
                name: nexus-m6-secrets  # NEXTAUTH_SECRET, OKTA_CLIENT_SECRET
          resources:
            requests:
              cpu: "250m"
              memory: "512Mi"
            limits:
              cpu: "1"
              memory: "1Gi"
          readinessProbe:
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 30
---
apiVersion: v1
kind: Service
metadata:
  name: m6-nexus-ui
  namespace: nexus-app
spec:
  selector:
    app: m6-nexus-ui
  ports:
    - port: 3000
      targetPort: 3000
---
# Kong Ingress (solo para M6)
apiVersion: configuration.konghq.com/v1
kind: KongIngress
metadata:
  name: nexus-web-ingress
  namespace: nexus-app
spec:
  proxy:
    connect_timeout: 60000
    read_timeout: 60000
    write_timeout: 60000
  upstream:
    algorithm: "round-robin"
```

---

## 9. Acceptance Criteria M6

```bash
# Test 1: Autenticación Okta OIDC PKCE
# Expected: Acceder a https://app.nexus.mentis-consulting.be redirige a Okta
# Expected: Después de login, session.user.tenantId está populado desde token claim
# Expected: Logout destruye la sesión y redirige a Okta logout

# Test 2: WebSocket conectado
# Abrir DevTools → Network → WS tab
# Expected: ws://app.nexus.mentis-consulting.be/api/ws?tenant=test-alpha está OPEN

# Test 3: Chat request end-to-end
# Input: "Show me all Belgian customers"
# Expected: 
#   - Mensaje aparece en chat
#   - Badge "Quality:" muestra score >= 75%
#   - Latencia shown < 30 segundos
#   - Sin errores en consola del browser

# Test 4: Governance Console — listar propuestas
curl -X GET https://app.nexus.mentis-consulting.be/api/governance/proposals \
  -H "Cookie: <session cookie>"
# Expected: 200, lista de propuestas del tenant autenticado

# Test 5: Governance Console — aprobar propuesta desde UI
# Navegar a /governance
# Click "Approve" en propuesta pending
# Expected:
#   - Badge cambia a "Approved"
#   - Toast de confirmación
#   - nexus.cdm.version_published publicado (verificar con kafka consumer)

# Test 6: Cross-tenant isolation en UI
# Usuario test-alpha NO debe ver propuestas de test-beta
# Expected: X-Tenant-ID = sesión del usuario, no modificable por frontend

# Test 7: Reconexión WebSocket tras desconexión
# Desconectar el pod m6-nexus-ui temporalmente
# Expected: UI muestra "Reconnecting..." y reconecta automáticamente en <5s

# Test 8: Prometheus alert M1BackpressureActive
# Simular lag elevado en m1.int.raw_records
# kubectl exec -n nexus-data nexus-kafka-kafka-0 -- bin/kafka-producer-perf-test.sh ...
# Expected: Alert dispara en Grafana/Alertmanager en <5 minutos

# Test 9: Health endpoint para K8s probes
curl http://m6-nexus-ui.nexus-app.svc:3000/api/health
# Expected: {"status":"ok","version":"1.0.0"}

# Test 10: Sesión expira a las 8 horas
# Expected: Después de 8h, redirige a /auth/signin automáticamente
```

---

*NEXUS Build Plan — Archivo 08 · M6 Next.js 14 UI + Prometheus Alerts · Mentis Consulting · Marzo 2026*
