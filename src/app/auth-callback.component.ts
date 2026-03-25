/**
 * AuthCallbackComponent — handles post-Okta redirect scenarios.
 *
 * The primary Okta PKCE callback is handled by the BFF at:
 *   GET /api/v1/auth/okta/callback
 * The BFF exchanges the code, issues the NEXUS session cookie, then
 * redirects the browser to /overview (Angular handles from there).
 *
 * This component handles two edge cases:
 *   1. Okta returns an error param → show friendly error page
 *   2. User lands on /auth/callback directly → redirect to login
 *
 * Route: /auth/callback
 */
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DataService } from './data.service';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-bg-main flex items-center justify-center p-4">
      <div class="bg-bg-card border border-border-subtle rounded-xl p-8 max-w-md w-full text-center shadow-2xl">
        @if (error()) {
          <!-- Okta returned an error -->
          <span class="material-icons text-rose-400 text-5xl mb-4 block">error_outline</span>
          <h1 class="text-xl font-semibold text-text-primary mb-2">Authentication Error</h1>
          <p class="text-sm text-text-secondary mb-1">{{ error() }}</p>
          @if (errorDescription()) {
            <p class="text-xs text-text-secondary/70 mb-6">{{ errorDescription() }}</p>
          }
          <button (click)="goToLogin()"
            class="inline-flex items-center gap-2 px-6 py-2.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors">
            <span class="material-icons text-[18px]">arrow_back</span>
            Back to Login
          </button>
        } @else if (isAuthenticated()) {
          <!-- Already logged in — redirect happened -->
          <span class="material-icons text-green-400 text-5xl mb-4 block">check_circle</span>
          <h1 class="text-xl font-semibold text-text-primary mb-2">Authenticated</h1>
          <p class="text-sm text-text-secondary mb-4">Redirecting to dashboard…</p>
          <div class="flex justify-center">
            <span class="material-icons text-indigo-400 text-[28px] animate-spin">autorenew</span>
          </div>
        } @else {
          <!-- Processing — BFF is handling the callback -->
          <span class="material-icons text-indigo-400 text-5xl mb-4 block animate-pulse">lock_open</span>
          <h1 class="text-xl font-semibold text-text-primary mb-2">Completing sign-in…</h1>
          <p class="text-sm text-text-secondary mb-4">Please wait while we verify your identity.</p>
          <div class="flex justify-center">
            <span class="material-icons text-indigo-400 text-[28px] animate-spin">autorenew</span>
          </div>
        }
      </div>
    </div>
  `,
})
export class AuthCallbackComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private dataService = inject(DataService);

  error = signal('');
  errorDescription = signal('');
  isAuthenticated = signal(false);

  private decodeBase64UrlJson(input: string): any {
    const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    const padded = pad ? (base64 + '='.repeat(4 - pad)) : base64;
    return JSON.parse(atob(padded));
  }

  ngOnInit() {
    const params = this.route.snapshot.queryParams;

    // Okta passes error in query params when auth fails
    if (params['error']) {
      this.error.set(params['error']);
      this.errorDescription.set(params['error_description'] || '');
      return;
    }

    // BFF passes display-only user info in the ?s= param (base64 JSON, no token).
    // The actual session JWT is in the httpOnly cookie set by the BFF redirect.
    // IMPORTANT: always process ?s= FIRST — even if already logged in — so that
    // a fresh Okta login always updates okta_token in localStorage (needed for Kong).
    const sessionParam = params['s'];
    if (sessionParam) {
      try {
        const user = this.decodeBase64UrlJson(sessionParam);
        this.dataService.hydrateFromSessionParam(user);
        // Defensive: ensure okta_token is persisted for Kong calls even if
        // the session object shape changes or storage is temporarily blocked elsewhere.
        try {
          const t = user?.okta_token ?? user?.oktaToken ?? user?.access_token ?? user?.accessToken ?? null;
          if (t) localStorage.setItem('okta_token', t);
        } catch {
          // Ignore storage errors (private mode / quota) — UI will still work without Kong calls.
        }
        this.isAuthenticated.set(true);
        const dest = user.role === 'platform-admin' ? '/source-connectors' : '/overview';
        setTimeout(() => this.router.navigate([dest]), 300);
        return;
      } catch {
        // Corrupted param — fall through
      }
    }

    // If already hydrated (e.g. second visit or token already in localStorage)
    if (this.dataService.isLoggedIn()) {
      this.isAuthenticated.set(true);
      const dest = this.dataService.currentRole() === 'Platform Admin' ? '/source-connectors' : '/overview';
      setTimeout(() => this.router.navigate([dest]), 300);
      return;
    }

    // Fallback: call /me to hydrate from cookie
    this.dataService.hydrateFromCookie().subscribe(ok => {
      if (ok) {
        this.isAuthenticated.set(true);
        const dest = this.dataService.currentRole() === 'Platform Admin' ? '/source-connectors' : '/overview';
        setTimeout(() => this.router.navigate([dest]), 500);
      } else {
        setTimeout(() => this.router.navigate(['/login']), 1500);
      }
    });
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }
}
