import {
  ApplicationConfig,
  APP_INITIALIZER,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { firstValueFrom } from 'rxjs';

import { routes } from './app.routes';
import { authInterceptor } from './auth.interceptor';
import { errorInterceptor } from './error.interceptor';
import { DataService } from './data.service';

/**
 * Validates the session against the backend before any route guard runs.
 * If the user appears logged-in (localStorage has nexus_user), we call /auth/me
 * to get the real role. This prevents stale localStorage (e.g., platform-admin)
 * from mismatching with the actual JWT cookie and causing 403 errors.
 */
function validateSession(ds: DataService) {
  return () => {
    if (!ds.isLoggedIn()) return Promise.resolve();
    return firstValueFrom(ds.hydrateFromCookie()).catch(() => { /* network error — keep stale state */ });
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor, errorInterceptor])),
    // Validate JWT session before initial navigation so guards always see the real role
    { provide: APP_INITIALIZER, useFactory: validateSession, deps: [DataService], multi: true },
    // #10 i18n — ngx-translate v16 standalone provider API
    provideTranslateService({ fallbackLang: 'en' }),
    provideTranslateHttpLoader({ prefix: './assets/i18n/', suffix: '.json' }),
  ],
};
