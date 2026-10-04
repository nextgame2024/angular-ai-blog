import { inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { SophiaAdminService } from './sophia-admin.service';

export const sophiaAdminGuard: CanActivateFn = (_route, state) => {
  const admin = inject(SophiaAdminService);
  const router = inject(Router);
  return admin.context().pipe(
    map(() => true),
    catchError((error) => of(adminContextErrorRoute(router, state.url, error))),
  );
};

export const sophiaAdminPermissionGuard: CanActivateFn = (route) => {
  const admin = inject(SophiaAdminService);
  const router = inject(Router);
  const permission = route.data['permission'];
  if (typeof permission !== 'string' || !permission) {
    return router.createUrlTree(['/sophia-admin/forbidden']);
  }
  return admin.context().pipe(
    map(({ principal }) => principal.permissions.includes(permission)
      ? true
      : router.createUrlTree(['/sophia-admin/forbidden'], {
          queryParams: { permission },
        })),
    catchError((error) => of(adminContextErrorRoute(router, '/sophia-admin/overview', error))),
  );
};

function adminContextErrorRoute(router: Router, redirect: string, error: unknown) {
  const status = error instanceof HttpErrorResponse
    ? error.status
    : Number((error as { status?: unknown } | null)?.status ?? 0);
  if (status === 401) {
    return router.createUrlTree(['/login'], { queryParams: { redirect } });
  }
  return router.createUrlTree(['/sophia-admin/forbidden'], {
    queryParams: {
      reason: status === 403 ? 'access_denied' : 'context_unavailable',
    },
  });
}
