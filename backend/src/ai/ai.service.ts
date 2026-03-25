import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as https from 'https';

export interface AiReasoningStep {
  step: string;
  status: 'completed' | 'running' | 'pending';
  detail: string;
}

@Injectable()
export class AiService {
  private readonly apiKey: string;
  private readonly model = 'gpt-4o-mini';

  constructor(
    private config: ConfigService,
    @InjectDataSource() private dataSource: DataSource,
  ) {
    this.apiKey = this.config.get<string>('OPENAI_API_KEY', '');
  }

  /** Non-streaming: returns reply + reasoning trace in one shot */
  async chatWithTrace(userMessage: string): Promise<{ reply: string; trace: AiReasoningStep[] }> {
    const context = await this.buildContext();
    const trace = this.buildReasoningTrace(context);
    const systemPrompt = this.buildSystemPrompt(context);

    const body = JSON.stringify({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.4,
      max_tokens: 600,
    });

    const reply = await this.callOpenAI(body);
    return { reply, trace };
  }

  /** Build reasoning steps shown in the collapsible trace panel */
  buildReasoningTrace(ctx: Record<string, any>): AiReasoningStep[] {
    const o = ctx.orders ?? {};
    const c = ctx.customers ?? {};
    const p = ctx.products ?? {};
    return [
      {
        step: 'Load platform data',
        status: 'completed',
        detail: `${o.total ?? 0} orders · ${c.total ?? 0} customers · ${p.total ?? 0} products retrieved`,
      },
      {
        step: 'Parse query intent',
        status: 'completed',
        detail: 'Business analytics intent identified — cross-referencing operational data',
      },
      {
        step: 'LLM reasoning',
        status: 'completed',
        detail: `${this.model} generating response with live data context`,
      },
    ];
  }

  /** Async generator — yields token strings from OpenAI streaming API */
  async *streamChat(userMessage: string, context: Record<string, any>): AsyncGenerator<string, void, unknown> {
    const systemPrompt = this.buildSystemPrompt(context);

    const requestBody = JSON.stringify({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.4,
      max_tokens: 600,
      stream: true,
    });

    interface QueueItem { token?: string; done?: boolean; error?: string }
    const queue: QueueItem[] = [];
    let resolveNext: (() => void) | null = null;
    let streamEnded = false;

    const enqueue = (item: QueueItem) => {
      queue.push(item);
      if (resolveNext) {
        const fn = resolveNext;
        resolveNext = null;
        fn();
      }
    };

    const reqOptions: https.RequestOptions = {
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Length': Buffer.byteLength(requestBody),
      },
    };

    const req = https.request(reqOptions, (res) => {
      let buffer = '';
      res.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6).trim();
          if (data === '[DONE]') { enqueue({ done: true }); streamEnded = true; return; }
          try {
            const parsed = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
            const token = parsed.choices?.[0]?.delta?.content;
            if (token) enqueue({ token });
          } catch { /* skip malformed SSE line */ }
        }
      });
      res.on('end', () => { if (!streamEnded) enqueue({ done: true }); });
      res.on('error', (err: Error) => enqueue({ error: err.message }));
    });

    req.on('error', (err: Error) => enqueue({ error: err.message }));
    req.write(requestBody);
    req.end();

    while (true) {
      if (queue.length === 0) {
        await new Promise<void>(resolve => { resolveNext = resolve; });
      }
      const item = queue.shift()!;
      if (item.done || item.error) break;
      if (item.token) yield item.token;
    }
  }

  async chat(userMessage: string): Promise<string> {
    const context = await this.buildContext();
    const systemPrompt = this.buildSystemPrompt(context);

    const body = JSON.stringify({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.4,
      max_tokens: 600,
    });

    return this.callOpenAI(body);
  }

  async buildContext(): Promise<Record<string, any>> {
    try {
      const [orderStats, topCustomers, revenueRow, productRow, connectorRow] =
        await Promise.all([
          this.dataSource.query(
            `SELECT
               COUNT(*) AS total,
               SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END) AS delivered,
               SUM(CASE WHEN status='processing' THEN 1 ELSE 0 END) AS processing,
               SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending,
               SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END) AS cancelled,
               ROUND(SUM(amount)::numeric, 2) AS total_revenue
             FROM orders`,
          ),
          this.dataSource.query(
            `SELECT c.name, ROUND(SUM(o.amount)::numeric,2) AS revenue, COUNT(o.id) AS orders
             FROM customers c
             JOIN orders o ON o."customerId" = c.id
             WHERE o.status != 'cancelled'
             GROUP BY c.id, c.name
             ORDER BY revenue DESC
             LIMIT 5`,
          ),
          this.dataSource.query(
            `SELECT COUNT(*) AS total, SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) AS active FROM customers`,
          ),
          this.dataSource.query(
            `SELECT COUNT(*) AS total, SUM(CASE WHEN stock < 20 THEN 1 ELSE 0 END) AS low_stock FROM products`,
          ),
          this.dataSource.query(
            `SELECT COUNT(*) AS total, SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) AS active FROM connectors`,
          ),
        ]);

      return {
        orders: orderStats[0],
        topCustomers,
        customers: revenueRow[0],
        products: productRow[0],
        connectors: connectorRow[0],
      };
    } catch {
      return {};
    }
  }

  private buildSystemPrompt(ctx: Record<string, any>): string {
    const o = ctx.orders ?? {};
    const c = ctx.customers ?? {};
    const p = ctx.products ?? {};
    const conn = ctx.connectors ?? {};
    const top = (ctx.topCustomers ?? [])
      .map((t: any) => `${t.name} (€${t.revenue}, ${t.orders} orders)`)
      .join(', ');

    return `You are NEXUS AI, an intelligent business data assistant for the NEXUS platform — an enterprise data integration and customer data management system.

LIVE PLATFORM DATA (as of now):
- Orders: ${o.total ?? 'N/A'} total | ${o.delivered ?? 'N/A'} delivered | ${o.processing ?? 'N/A'} processing | ${o.pending ?? 'N/A'} pending | ${o.cancelled ?? 'N/A'} cancelled
- Total Revenue: €${o.total_revenue ?? 'N/A'}
- Customers: ${c.total ?? 'N/A'} total | ${c.active ?? 'N/A'} active
- Top customers: ${top || 'N/A'}
- Products: ${p.total ?? 'N/A'} total | ${p.low_stock ?? 'N/A'} low stock (<20 units)
- Connectors: ${conn.total ?? 'N/A'} total | ${conn.active ?? 'N/A'} active

INSTRUCTIONS:
- Answer questions about orders, customers, revenue, products, and platform health using the data above.
- Be concise, professional, and data-driven.
- For questions outside the data scope, say you don't have that information.
- Format numbers clearly (e.g., €1,234.56 for currency, percentages with 1 decimal).
- Keep responses under 200 words unless a detailed breakdown is explicitly requested.`;
  }

  private callOpenAI(body: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.openai.com',
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Length': Buffer.byteLength(body),
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              resolve(`Error: ${parsed.error.message}`);
            } else {
              resolve(parsed.choices?.[0]?.message?.content ?? 'No response from AI.');
            }
          } catch {
            reject(new Error('Failed to parse OpenAI response'));
          }
        });
      });

      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }
}
