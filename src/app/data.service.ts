import { Injectable, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class DataService {
  router = inject(Router);
  private api = inject(ApiService);
  private platformId = inject(PLATFORM_ID);

  isLoggedIn = signal(false);
  theme = signal<'dark' | 'light'>('dark');
  /** True only when logged in via the real backend. Used by errorInterceptor. */
  isRealAuth = signal(false);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      // #2 Restore saved theme from localStorage
      const savedTheme = localStorage.getItem('nexus_theme') as 'dark' | 'light' | null;
      if (savedTheme === 'dark' || savedTheme === 'light') {
        this.theme.set(savedTheme);
        if (savedTheme === 'light') {
          document.documentElement.classList.remove('dark');
        } else {
          document.documentElement.classList.add('dark');
        }
      }

      // Restore session from stored user info (NOT the token — it lives in httpOnly cookie)
      const saved = localStorage.getItem('nexus_user');
      if (saved) {
        try {
          const userInfo = JSON.parse(saved);
          const roleMap: Record<string, string> = {
            'platform-admin': 'Platform Admin',
            'data-steward': 'Data Steward',
            'business-analyst': 'Business User',
            'read-only': 'Business User',
          };
          this.currentRole.set(roleMap[userInfo.role] ?? userInfo.displayRole ?? 'Business User');
          this.isLoggedIn.set(true);
          this.isRealAuth.set(true);
        } catch {
          localStorage.removeItem('nexus_user');
        }
      }
    }
  }

  /**
   * Called by AuthCallbackComponent after a BFF Okta redirect.
   * Hydrates the Angular session state from the display-only user info passed
   * in the ?s= URL param (base64 JSON). The actual JWT lives in the httpOnly cookie.
   */
  hydrateFromSessionParam(user: any): void {
    const roleMap: Record<string, string> = {
      'platform-admin': 'Platform Admin',
      'data-steward': 'Data Steward',
      'business-analyst': 'Business User',
      'read-only': 'Business User',
    };
    const displayRole = roleMap[user.role] ?? user.displayRole ?? 'Business User';
    const initials = (user.name ?? 'U')
      .split(' ')
      .map((w: string) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    this._currentUser.set({
      initials,
      name: user.name ?? displayRole,
      title: user.displayRole ?? displayRole,
      email: user.email,
    });
    this.currentRole.set(displayRole);
    this.isRealAuth.set(true);
    this.isLoggedIn.set(true);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('nexus_user', JSON.stringify({
        role: user.role, email: user.email, name: user.name,
      }));
      // Store Okta access_token for Kong API Gateway authentication (RS256)
      const oktaToken =
        user?.okta_token ??
        user?.oktaToken ??
        user?.access_token ??
        user?.accessToken ??
        null;
      if (oktaToken) localStorage.setItem('okta_token', oktaToken);
    }
  }

  /** Returns the Okta access_token for Kong Bearer auth, or null. */
  getOktaToken(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem('okta_token');
    }
    return null;
  }

  /**
   * Called by AuthCallbackComponent after the BFF Okta redirect sets the httpOnly cookie.
   * Calls /me to validate the cookie and hydrate all auth state.
   */
  hydrateFromCookie(): Observable<boolean> {
    const roleMap: Record<string, string> = {
      'platform-admin': 'Platform Admin',
      'data-steward': 'Data Steward',
      'business-analyst': 'Business User',
      'read-only': 'Business User',
    };
    return this.api.me().pipe(
      map(({ user }: any) => {
        if (!user) return false;
        const displayRole = roleMap[user.role] ?? user.displayRole ?? 'Business User';
        const initials = (user.name ?? 'U')
          .split(' ')
          .map((w: string) => w[0])
          .join('')
          .slice(0, 2)
          .toUpperCase();
        this._currentUser.set({
          initials,
          name: user.name ?? displayRole,
          title: user.displayRole ?? displayRole,
          email: user.email,
        });
        this.currentRole.set(displayRole);
        this.isRealAuth.set(true);
        this.isLoggedIn.set(true);
        if (isPlatformBrowser(this.platformId)) {
          localStorage.setItem('nexus_user', JSON.stringify({
            role: user.role, email: user.email, name: user.name,
          }));
        }
        return true;
      }),
      catchError(() => of(false))
    );
  }

  logout() {
    this.isLoggedIn.set(false);
    this.isRealAuth.set(false);
    this.api.logout().subscribe();
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('nexus_user');
      localStorage.removeItem('okta_token');
    }
    this.router.navigate(['/login']);
  }

  toggleTheme() {
    this.theme.update(t => t === 'dark' ? 'light' : 'dark');
    if (typeof document !== 'undefined') {
      if (this.theme() === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
    // #2 Persist theme choice
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('nexus_theme', this.theme());
    }
  }

  currentRole = signal('Platform Admin');

  /** Backing signal for the real current user (populated from /auth/me or login response). */
  private _currentUser = signal<{ initials: string; name: string; title: string; email?: string }>({
    initials: 'NA',
    name: 'NEXUS Admin',
    title: 'Platform Admin',
  });

  /** Computed alias kept for backward compat; use _currentUser for writes. */
  currentUser = this._currentUser.asReadonly();
  
  connectors = signal<any[]>([]);

  loadConnectors() {
    this.api.getConnectors().subscribe(data => {
      this.connectors.set((data ?? []).map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        host: c.host + (c.port ? `:${c.port}` : ''),
        secretPath: c.secretPath,
        status: c.status,
        lastSync: c.lastSync ? new Date(c.lastSync).toLocaleTimeString() : 'never',
        records: c.records?.toLocaleString() ?? '0',
      })));
    });
  }

  schemas = signal<any[]>([]);

  loadSchemas() {
    this.api.getSchemas().subscribe(data => {
      this.schemas.set((data ?? []).map(s => ({
        id: s.connectorId,
        realId: s.id,
        tables: `${s.tables} tables`,
        columns: `${s.columns} columns`,
        snapshot: s.snapshot ? new Date(s.snapshot).toLocaleString() : 'never',
        drift: s.drift === 'none' ? 'none' : `${s.drift} drift`,
        status: s.status,
      })));
    });
  }

  proposals = signal<any[]>([]);

  /** Load governance proposals from the API and update the proposals signal. */
  loadProposals() {
    this.api.getProposals().subscribe(data => {
      this.proposals.set((data ?? []).map((p: any) => ({
        id: p.id,
        sourceField: `${p.sourceSystem}.${p.sourceTable}.${p.sourceField}`,
        entity: p.cdmEntity,
        cdmField: `cdm.${p.cdmField}`,
        confidence: Math.round(p.confidence * 100),
        source: p.sourceSystem.charAt(0).toUpperCase() + p.sourceSystem.slice(1),
        submitted: new Date(p.submittedAt).toLocaleString('en-GB', {
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        }),
      })));
    });
  }

  mappings = signal<any[]>([]);

  /** Load mapping review queue from API and update the mappings signal. */
  loadMappings() {
    this.api.getMappingReviews().subscribe(data => {
      this.mappings.set((data ?? []).map((m: any) => ({
        id: m.id,
        sourceField: `${m.sourceSystem}.${m.sourceTable}.${m.sourceField}`,
        suggestedCdmField: m.suggestedCdmField ? `cdm.${m.suggestedCdmField}` : '—',
        tier: `Tier-${m.tier}`,
        confidence: Math.round(m.confidence * 100),
        status: m.status,
      })));
    });
  }

  versions = signal<any[]>([]);

  loadCdmVersions() {
    this.api.getCdmVersions().subscribe(data => {
      this.versions.set((data ?? []).map((v: any) => ({
        version: v.version,
        status: v.status,
        changes: v.changes ?? '—',
        publishedBy: v.publishedBy ?? 'system',
        publishedAt: v.publishedAt ? new Date(v.publishedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—',
      })));
    });
  }

  tenants = signal<any[]>([]);

  loadTenants() {
    this.api.getTenants().subscribe(data => {
      this.tenants.set((data ?? []).map((t: any) => ({
        id: t.id,
        name: t.name,
        plan: t.plan,
        status: t.status,
        connectors: t.connectors ?? 0,
        cdmVersion: t.cdmVersion ?? '1.0',
        activated: t.activatedAt ? new Date(t.activatedAt).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' }) : '—',
      })));
    });
  }

  // Empty by default — populated by API call in UsersRolesComponent.ngOnInit()
  // (Okta users appear here after their first login through the platform)
  users = signal<any[]>([]);

  loadUsers() {
    this.api.getUsers().subscribe(data => {
      if (data.length) {
        this.users.set(data.map(u => ({
          name: u.name,
          email: u.email,
          role: u.role,
          lastLogin: u.lastLogin ? new Date(u.lastLogin).toLocaleString() : 'Never',
          status: u.status,
        })));
      }
    });
  }

  auditLogs = signal<any[]>([]);

  loadAuditLogs() {
    this.api.getAuditLogs(50).subscribe(res => {
      this.auditLogs.set((res.data ?? []).map((l: any) => ({
        timestamp: new Date(l.timestamp).toLocaleString(),
        actor: l.actor,
        action: l.action,
        entity: l.entity + (l.entityId ? ` #${l.entityId}` : ''),
        result: l.severity,
      })));
    });
  }

  approveProposal(index: number) {
    this.proposals.update(p => p.filter((_, i) => i !== index));
  }
  
  rejectProposal(index: number) {
    this.proposals.update(p => p.filter((_, i) => i !== index));
  }

  approveMapping(index: number) {
    this.mappings.update(m => m.filter((_, i) => i !== index));
  }

  rejectMapping(index: number) {
    this.mappings.update(m => m.filter((_, i) => i !== index));
  }

  addConnector(connector: { id: string, name: string, type: string, host: string, secretPath: string, status: string, lastSync: string, records: string }) {
    this.connectors.update(c => [...c, connector]);
  }
}
