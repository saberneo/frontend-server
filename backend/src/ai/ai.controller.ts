import { Controller, Post, Body, UseGuards, Req, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Request, Response } from 'express';

@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  /**
   * POST /ai/chat
   *
   * Two modes:
   *   - body.stream = false/absent → returns { reply, reasoning_trace, model }
   *   - body.stream = true         → Server-Sent Events stream:
   *       data: {"type":"trace","trace":[...]}
   *       data: {"type":"token","token":"Hello"}
   *       ...
   *       data: {"type":"done","model":"gpt-4o-mini"}
   */
  @Post('chat')
  @ApiOperation({ summary: 'Chat with NEXUS AI — supports SSE streaming (body.stream=true)' })
  async chat(
    @Body() dto: { message: string; stream?: boolean },
    @Req() _req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const message = (dto.message ?? '').trim();

    if (dto.stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
      res.flushHeaders();

      const context = await this.aiService.buildContext();
      const trace = this.aiService.buildReasoningTrace(context);
      res.write(`data: ${JSON.stringify({ type: 'trace', trace })}\n\n`);

      try {
        for await (const token of this.aiService.streamChat(message, context)) {
          if (!res.writableEnded) {
            res.write(`data: ${JSON.stringify({ type: 'token', token })}\n\n`);
          }
        }
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({ type: 'done', model: 'gpt-4o-mini' })}\n\n`);
        }
      } catch {
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({ type: 'error', message: 'AI service unavailable' })}\n\n`);
        }
      }

      if (!res.writableEnded) res.end();
      return;
    }

    // Non-streaming — returns full reply with reasoning trace
    const { reply, trace } = await this.aiService.chatWithTrace(message);
    res.json({ reply, reasoning_trace: trace, model: 'gpt-4o-mini', usage: {} });
  }
}
