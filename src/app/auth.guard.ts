import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { DataService } from './data.service';

/** Requires any authenticated user. Redirects to /login if not logged in. */
export const authGuard: CanActivateFn = () => {
  const ds = inject(DataService);
  const router = inject(Router);
  if (!ds.isLoggedIn()) {
    router.navigate(['/login']);
    return false;
  }
  return true;
};

/** Prevents logged-in users from accessing /login — redirects to /overview. */
export const loginGuard: CanActivateFn = () => {
  const ds = inject(DataService);
  const router = inject(Router);
  if (ds.isLoggedIn()) {
    router.navigate(['/overview']);
    return false;
  }
  return true;
};

/**
 * Requires Platform Admin role.
 * Redirects to /login if not authenticated, /overview if authenticated but not admin.
 */
export const adminGuard: CanActivateFn = () => {
  const ds = inject(DataService);
  const router = inject(Router);
  if (!ds.isLoggedIn()) {
    router.navigate(['/login']);
    return false;
  }
  if (ds.currentRole() !== 'Platform Admin') {
    router.navigate(['/overview']);
    return false;
  }
  return true;
};
