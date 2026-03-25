import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '../environments/environment';
import { DataService } from './data.service';

/**
 * Adds withCredentials: true to backend requests so the browser sends
 * the httpOnly nexus_token cookie automatically.
 *
 * Kong/M1 routes: send Okta Bearer token via Authorization header (no cookie).
 * NestJS backend routes: send httpOnly cookie.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const ds = inject(DataService);

  // Rutas directas a Kong/M1 (incluye m1Url que apunta a Kong directamente)
  const isKongRoute = req.url.includes('/kong-m1')
    || req.url.startsWith(environment.kongUrl)
    || req.url.startsWith(environment.m1Url);

  const oktaToken = ds.getOktaToken();

  if (oktaToken && isKongRoute) {
    return next(req.clone({
      withCredentials: false,
      setHeaders: { Authorization: `Bearer ${oktaToken}` },
    }));
  }

  if (isKongRoute) {
    return next(req.clone({ withCredentials: false }));
  }

  // Backend NestJS: send httpOnly cookie
  return next(req.clone({ withCredentials: true }));
};
