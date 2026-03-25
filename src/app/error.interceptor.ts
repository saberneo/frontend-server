import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { DataService } from './data.service';
import { environment } from '../environments/environment';

/**
 * Intercepts HTTP errors and redirects to /login only on genuine session
 * expiry (401 on the /auth/me endpoint).
 *
 * Rules:
 *  - 401 on any non-auth endpoint  → session likely expired → logout
 *  - 403                           → permission denied (do NOT logout, let
 *                                    the component show an error message)
 *  - Skips /auth/ to avoid redirect loops on login / logout
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const ds = inject(DataService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (
        err.status === 401 &&
        !req.url.includes('/auth/') &&
        !req.url.includes('/kong-m1') &&   // Kong/M1 API 401 = token issue, NOT session expiry
        !req.url.startsWith(environment.kongUrl) &&
        !req.url.startsWith(environment.m1Url) &&  // M1 API (Kong) 401 = token issue, NOT session expiry
        ds.isRealAuth()
      ) {
        ds.logout();
        router.navigate(['/login']);
      }
      // 403 = authenticated but not authorized — never auto-logout
      // Kong 401 = M1 API token rejected — never auto-logout (handle at component level)
      return throwError(() => err);
    }),
  );
};
