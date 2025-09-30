import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from 'src/environments/environment';
import { PersistanceService } from '../services/persistance.service';

/**
 * Adds "Authorization: Token <jwt>" ONLY for requests to our API base URL.
 * Prevents leaking the header to S3 presigned URLs and any third-party host.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const persistence = inject(PersistanceService);

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

  if (!token) {
    return next(req);
  }

  // RealWorld-style header. Change to Bearer if your API expects it.
  const authReq = req.clone({
    setHeaders: { Authorization: `Token ${token}` },
  });

  return next(authReq);
};
