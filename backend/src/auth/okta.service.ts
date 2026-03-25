import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';

interface StateEntry {
  verifier: string;
  createdAt: number;
}

@Injectable()
export class OktaService {
  private readonly issuer: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly postLoginRedirect: string;

  // In-memory PKCE state store — entries expire after 10 minutes
  private readonly stateStore = new Map<string, StateEntry>();

  constructor(private readonly config: ConfigService) {
    this.issuer = config.get<string>('OKTA_ISSUER', '');
    this.clientId = config.get<string>('OKTA_CLIENT_ID', '');
    this.clientSecret = config.get<string>('OKTA_CLIENT_SECRET', '');
    this.redirectUri = config.get<string>(
      'OKTA_REDIRECT_URI',
      'http://localhost:3000/api/v1/auth/okta/callback',
    );
    this.postLoginRedirect = config.get<string>(
      'OKTA_POST_LOGIN_REDIRECT',
      'http://localhost:4200/auth/callback',
    );
  }

  isConfigured(): boolean {
    return !!(this.issuer && this.clientId);
  }

  getConfig() {
    return {
      configured: this.isConfigured(),
      issuer: this.issuer,
      clientId: this.clientId,
      redirectUri: this.redirectUri,
    };
  }

  /** Build a PKCE authorize URL. Stores the code_verifier for later exchange. */
  getAuthorizeUrl(): { authorizationUrl: string; state: string } {
    const state = randomBytes(32).toString('hex');
    const verifier = randomBytes(64).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');

    this.stateStore.set(state, { verifier, createdAt: Date.now() });
    this.pruneExpiredStates();

    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      scope: 'openid profile email',
      redirect_uri: this.redirectUri,
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });

    return {
      authorizationUrl: `${this.issuer}/v1/authorize?${params}`,
      state,
    };
  }

  /**
   * Exchange the authorization code for an Okta user profile.
   * Uses PKCE (no client_secret needed for public/SPA clients).
   */
  async exchangeCode(code: string, state: string): Promise<{ sub: string; email: string; name: string; accessToken: string }> {
    const entry = this.stateStore.get(state);
    if (!entry || Date.now() - entry.createdAt > 10 * 60 * 1000) {
      this.stateStore.delete(state);
      throw new Error('Invalid or expired state parameter');
    }
    this.stateStore.delete(state);

    // Exchange code → tokens
    // Okta supports multiple client authentication methods at the token endpoint.
    // In practice, environments may be configured to require either:
    //  - client_secret_basic (Authorization: Basic ...)
    //  - client_secret_post  (client_id + client_secret in body)
    // To avoid "invalid_client" surprises across tenants, we try Basic first (when secret present),
    // then automatically fall back to POST if Okta rejects the client credentials.
    const tokenUrl = `${this.issuer}/v1/token`;

    const baseBody: Record<string, string> = {
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri,
      code_verifier: entry.verifier,
    };

    const postToken = async (headers: Record<string, string>, body: Record<string, string>) => {
      const res = await fetch(tokenUrl, {
        method: 'POST',
        headers,
        body: new URLSearchParams(body).toString(),
      });
      const text = await res.text();
      return { ok: res.ok, status: res.status, text };
    };

    const baseHeaders: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' };

    let tokenAttempt:
      | { ok: true; status: number; text: string }
      | { ok: false; status: number; text: string };

    if (!this.clientSecret) {
      // Public/SPA client: send client_id in the body (no secret)
      tokenAttempt = await postToken(baseHeaders, { ...baseBody, client_id: this.clientId });
    } else {
      // 1) client_secret_basic (no client_id in body)
      const basicHeaders = { ...baseHeaders };
      const creds = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      basicHeaders['Authorization'] = `Basic ${creds}`;
      tokenAttempt = await postToken(basicHeaders, { ...baseBody });

      // 2) Fallback: client_secret_post (some Okta apps are configured this way)
      if (!tokenAttempt.ok && tokenAttempt.status === 401 && /invalid_client/i.test(tokenAttempt.text)) {
        tokenAttempt = await postToken(baseHeaders, {
          ...baseBody,
          client_id: this.clientId,
          client_secret: this.clientSecret,
        });
      }
    }

    if (!tokenAttempt.ok) {
      throw new Error(`Okta token exchange failed (${tokenAttempt.status}): ${tokenAttempt.text}`);
    }

    const tokens = JSON.parse(tokenAttempt.text) as { access_token: string };

    // Fetch user profile from Okta userinfo endpoint
    const userRes = await fetch(`${this.issuer}/v1/userinfo`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userRes.ok) {
      throw new Error(`Okta userinfo request failed (${userRes.status})`);
    }

    const ui = await userRes.json() as {
      sub: string;
      email: string;
      name?: string;
      given_name?: string;
      family_name?: string;
    };

    const name =
      ui.name ||
      `${ui.given_name ?? ''} ${ui.family_name ?? ''}`.trim() ||
      ui.email;

    return { sub: ui.sub, email: ui.email, name, accessToken: tokens.access_token };
  }

  getPostLoginRedirect(): string {
    return this.postLoginRedirect;
  }

  private pruneExpiredStates(): void {
    const cutoff = Date.now() - 10 * 60 * 1000;
    for (const [key, val] of this.stateStore.entries()) {
      if (val.createdAt < cutoff) this.stateStore.delete(key);
    }
  }
}
