import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DataService } from './data.service';
import { ApiService } from './api.service';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-bg-main flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans transition-colors duration-200">

      <!-- Theme Toggle -->
      <div class="absolute top-4 right-4">
        <button (click)="dataService.toggleTheme()"
          class="text-text-secondary hover:text-text-primary transition-colors flex items-center justify-center w-10 h-10 rounded-md hover:bg-bg-hover border border-border-subtle bg-bg-card shadow-sm">
          <span class="material-icons text-[20px]">{{ dataService.theme() === 'dark' ? 'light_mode' : 'dark_mode' }}</span>
        </button>
      </div>

      <div class="sm:mx-auto sm:w-full sm:max-w-sm">
        <!-- Logo -->
        <div class="flex justify-center">
          <div class="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-bold text-4xl shadow-lg shadow-indigo-600/30">
            N
          </div>
        </div>
        <h2 class="mt-6 text-center text-3xl font-extrabold text-text-primary tracking-tight">{{ 'LOGIN.TITLE' | translate }}</h2>
        <p class="mt-2 text-center text-sm text-text-secondary">{{ 'LOGIN.SUBTITLE' | translate }}</p>
      </div>

      <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-sm">
        <div class="bg-bg-card py-10 px-8 shadow-xl shadow-black/5 rounded-2xl border border-border-subtle flex flex-col items-center gap-6">

          @if (error()) {
            <div class="w-full rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-400 flex items-center gap-2">
              <span class="material-icons text-[16px]">error_outline</span>
              {{ error() }}
            </div>
          }

          <button type="button"
            (click)="loginWithOkta()"
            [disabled]="isLoading() || isDemoLoading()"
            class="w-full inline-flex justify-center items-center gap-3 py-3 px-6 rounded-xl border border-blue-500/40 bg-blue-500/10 text-base font-semibold text-blue-700 dark:text-blue-400 hover:bg-blue-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">
            @if (isLoading()) {
              <span class="material-icons text-[20px] animate-spin">autorenew</span>
              {{ 'LOGIN.BTN_OKTA_REDIRECTING' | translate }}
            } @else {
              <svg class="w-6 h-6 flex-shrink-0" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                <circle cx="24" cy="24" r="20" fill="#007dc1"/>
                <circle cx="24" cy="24" r="8" fill="white"/>
              </svg>
              {{ 'LOGIN.BTN_OKTA' | translate }}
            }
          </button>

          <!-- Divider -->
          <div class="w-full flex items-center gap-3">
            <div class="flex-1 h-px bg-border-subtle"></div>
            <span class="text-xs text-text-secondary uppercase tracking-widest">{{ 'LOGIN.TEXT_DIVIDER' | translate }}</span>
            <div class="flex-1 h-px bg-border-subtle"></div>
          </div>

          <!-- Demo Access Button -->
          <button type="button"
            (click)="loginAsDemo()"
            [disabled]="isLoading() || isDemoLoading()"
            class="w-full inline-flex justify-center items-center gap-3 py-3 px-6 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-base font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">
            @if (isDemoLoading()) {
              <span class="material-icons text-[20px] animate-spin">autorenew</span>
              {{ 'LOGIN.BTN_DEMO_ENTERING' | translate }}
            } @else {
              <span class="material-icons text-[20px]">play_circle</span>
              {{ 'LOGIN.BTN_DEMO' | translate }}
            }
          </button>

          <div class="w-full rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-600 dark:text-amber-400">
            <div class="flex items-start gap-2">
              <span class="material-icons text-[14px] mt-0.5">info</span>
              <span><strong>{{ 'LOGIN.DEMO_WARNING_TITLE' | translate }}</strong> — {{ 'LOGIN.DEMO_WARNING_TEXT' | translate }}</span>
            </div>
          </div>

          <p class="text-xs text-text-secondary text-center">
            {{ 'LOGIN.TEXT_OKTA' | translate }}
          </p>
        </div>

        <p class="mt-8 text-center text-xs text-text-secondary">{{ 'LOGIN.COPYRIGHT' | translate }}</p>
      </div>
    </div>
  `
})
export class LoginComponent {
  dataService = inject(DataService);
  private api = inject(ApiService);
  private router = inject(Router);
  isLoading = signal(false);
  isDemoLoading = signal(false);
  error = signal('');

  /**
   * Flujo OIDC gestionado completamente por Kong (nokia/kong-oidc plugin, modo sesión).
   *
   * Arquitectura en el servidor:
   *   1. Browser → http://65.21.132.180:30800/  (Kong proxy)
   *   2. Kong detecta que no hay sesión OIDC
   *   3. Kong redirige al navegador → Okta authorize
   *   4. Usuario se autentica en Okta
   *   5. Okta redirige → http://65.21.132.180:30800/oidc/callback  (Kong callback)
   *   6. Kong hace el code exchange server-side (con client_secret)
   *   7. Kong establece cookie de sesión + inyecta X-UserInfo, X-UserInfo-Email en headers
   *   8. Kong redirige al usuario → Angular SPA servida en http://65.21.132.180:30800/
   *
   * El SPA Angular NO hace PKCE ni gestiona el token directamente.
   * Kong siempre valida la sesión en cada petición a /api/v1/* y /api/v1/m1/*.
   */
  loginWithOkta() {
    this.isLoading.set(true);
    this.error.set('');
    this.api.getOktaAuthorizeUrl().subscribe({
      next: (res) => { window.location.href = res.authorizationUrl; },
      error: () => {
        this.isLoading.set(false);
        this.error.set('Could not reach Okta. Please try again or contact your administrator.');
      },
    });
  }

  loginAsDemo() {
    this.isDemoLoading.set(true);
    this.error.set('');
    this.api.demoLogin().subscribe({
      next: (res) => {
        this.dataService.hydrateFromSessionParam(res.user);
        this.router.navigate(['/']);
      },
      error: () => {
        this.isDemoLoading.set(false);
        this.error.set('Demo access is temporarily unavailable. Please try again.');
      },
    });
  }
}

