import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { SophiaAdminService } from './sophia-admin.service';

export const sophiaAdminGuard: CanActivateFn = (_route, state) => {
  const admin = inject(SophiaAdminService);
  const router = inject(Router);
  return admin.context().pipe(
    map(() => true),
    catchError(() => of(router.createUrlTree(['/login'], {
      queryParams: { redirect: state.url },
    }))),
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
    catchError(() => of(router.createUrlTree(['/login']))),
  );
};
