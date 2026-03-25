import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Headers, Req,
  UseGuards, Logger, HttpException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Request } from 'express';

// En prod apunta a Kong; en dev local apunta al contenedor m1-api
const M1_BASE = process.env.M1_API_URL ?? 'http://nexus-m1-api:8001/api/v1';
// Modo Kong: true si M1_API_URL contiene el host remoto (no un host docker interno)
const USE_KONG = (process.env.M1_API_URL ?? '').startsWith('http://65.');

/**
 * Proxy NestJS → Kong → M1
 *
 * Resuelve el problema de CORS/preflight de Kong OIDC:
 *   Browser → localhost:3000/api/v1/m1/* (sin preflight cross-origin problemático)
 *   NestJS  → Kong:30800/api/v1/m1/* (server-side, adjunta Bearer token de Okta)
 *   Kong    → valida JWT & enruta al pod M1
 */
@ApiTags('m1-proxy')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('m1')
export class M1ProxyController {
  private readonly logger = new Logger(M1ProxyController.name);

  private async forward(
    method: string,
    path: string,
    tenantId: string,
    oktaToken?: string,
    body?: unknown,
  ): Promise<any> {
    const url = `${M1_BASE}${path}`;
    const reqHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Tenant-ID': tenantId || 'acme-corp',
    };

    // Reenviar el Bearer token de Okta para que Kong pueda validarlo
    if (USE_KONG && oktaToken) {
      reqHeaders['Authorization'] = `Bearer ${oktaToken}`;
    }

    const init: RequestInit = {
      method,
      headers: reqHeaders,
      redirect: 'manual', // No seguir redirects — Kong 302→Okta equivale a token inválido
    };
    if (body && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
      init.body = JSON.stringify(body);
    }

    this.logger.log(`M1 proxy ${method} ${url}`);

    let res: globalThis.Response;
    let text: string;
    try {
      res = await fetch(url, init);
      text = await res.text();
    } catch (err: any) {
      this.logger.error(`M1 proxy network error on ${method} ${url}: ${err?.message}`);
      throw new HttpException({ message: 'M1 service unreachable' }, 502);
    }

    // status 0 = opaqueredirect (302 con redirect:manual) → token ausente o expirado
    if (!res.ok || res.status === 0) {
      this.logger.warn(`M1 proxy ${method} ${url} → ${res.status} (type: ${res.type})`);
      if (res.status === 0 || (res.status >= 300 && res.status < 400)) {
        throw new HttpException(
          { message: 'Kong authentication required — provide a valid Okta Bearer token' },
          401,
        );
      }
      let errBody: any;
      try { errBody = text ? JSON.parse(text) : null; } catch { /* body no es JSON */ }
      throw new HttpException(
        errBody ?? { message: `M1 returned ${res.status}` },
        res.status,
      );
    }

    try {
      return text ? JSON.parse(text) : {};
    } catch {
      this.logger.warn(`M1 proxy ${method} ${url} → non-JSON success body`);
      return { raw: text?.slice(0, 500) };
    }
  }

  // extrae el okta_token del header x-okta-token que Angular envía
  private getOktaToken(req: Request): string | undefined {
    return (req.headers['x-okta-token'] as string) ?? undefined;
  }

  // ── LIST connectors ──────────────────────────────────────────────────────
  @Get('connectors')
  @ApiOperation({ summary: 'Proxy: list M1 connectors' })
  listConnectors(@Headers('x-tenant-id') tenantId: string, @Req() req: Request) {
    return this.forward('GET', '/connectors', tenantId, this.getOktaToken(req));
  }

  // ── GET one connector ────────────────────────────────────────────────────
  @Get('connectors/:id')
  @ApiOperation({ summary: 'Proxy: get M1 connector detail' })
  getConnector(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: Request,
  ) {
    return this.forward('GET', `/connectors/${encodeURIComponent(id)}`, tenantId, this.getOktaToken(req));
  }

  // ── REGISTER connector ──────────────────────────────────────────────────
  @Post('connectors')
  @ApiOperation({ summary: 'Proxy: register connector in M1' })
  registerConnector(
    @Body() body: Record<string, unknown>,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: Request,
  ) {
    return this.forward('POST', '/connectors', tenantId, this.getOktaToken(req), body);
  }

  // ── TRIGGER SYNC ─────────────────────────────────────────────────────────
  @Post('connectors/:id/sync')
  @ApiOperation({ summary: 'Proxy: trigger M1 sync' })
  triggerSync(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: Request,
  ) {
    return this.forward('POST', `/connectors/${encodeURIComponent(id)}/sync`, tenantId, this.getOktaToken(req), body);
  }

  // ── SYNC JOBS ────────────────────────────────────────────────────────────
  @Get('connectors/:id/sync-jobs')
  @ApiOperation({ summary: 'Proxy: get M1 sync jobs' })
  getSyncJobs(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: Request,
  ) {
    return this.forward('GET', `/connectors/${encodeURIComponent(id)}/sync-jobs`, tenantId, this.getOktaToken(req));
  }

  // ── UPDATE connector ─────────────────────────────────────────────────────
  @Patch('connectors/:id')
  @ApiOperation({ summary: 'Proxy: update M1 connector' })
  updateConnector(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: Request,
  ) {
    return this.forward('PATCH', `/connectors/${encodeURIComponent(id)}`, tenantId, this.getOktaToken(req), body);
  }

  // ── DELETE connector ─────────────────────────────────────────────────────
  @Delete('connectors/:id')
  @ApiOperation({ summary: 'Proxy: delete M1 connector' })
  deleteConnector(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: Request,
  ) {
    return this.forward('DELETE', `/connectors/${encodeURIComponent(id)}`, tenantId, this.getOktaToken(req));
  }
}
