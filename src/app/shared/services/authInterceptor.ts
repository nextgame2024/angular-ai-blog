import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from 'src/environments/environment';
import { PersistanceService } from '../services/persistance.service';

/**
 * Adds "Authorization: Token <jwt>" ONLY for requests to our API base URL.
 * Prevents leaking the header to S3 presigned URLs and any third-party host.
 */
let isHandlingUnauthorized = false;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const persistence = inject(PersistanceService);
  const router = inject(Router);

  // Normalize api base (strip trailing slashes)
  const apiBase = (environment.apiUrl || '').replace(/\/+$/, '');
  const reqUrl = req.url;

  // If the request is not going to our API, pass through untouched
  if (!apiBase || !reqUrl.startsWith(apiBase)) {
    return next(req);
  }

  // Pull token from your persistence service
  const token =
    persistence.get<string>('accessToken') ??
    persistence.get<string>('token') ??
    null;

  const isAuthEndpoint =
    reqUrl.startsWith(`${apiBase}/users/login`) ||
    reqUrl === `${apiBase}/users` ||
    reqUrl.startsWith(`${apiBase}/users?`);

  const requestToSend = token
    ? req.clone({
        // RealWorld-style header. Change to Bearer if your API expects it.
        setHeaders: { Authorization: `Token ${token}` },
      })
    : req;

  return next(requestToSend).pipe(
    catchError((error: any) => {
      const status = Number(error?.status ?? 0);

      if (
        status === 401 &&
        !isAuthEndpoint &&
        !router.url.startsWith('/login')
      ) {
        persistence.set('accessToken', '');
        persistence.set('token', '');

        if (!isHandlingUnauthorized) {
          isHandlingUnauthorized = true;
          router
            .navigateByUrl('/login')
            .finally(() => {
              isHandlingUnauthorized = false;
            });
        }
      }

      return throwError(() => error);
    }),
  );
};
