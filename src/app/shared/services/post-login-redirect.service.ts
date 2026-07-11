import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of, type Observable } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { NavigationLinksProjectsService } from 'src/app/manager/services/navigation.links.projects.service';
import { environment } from 'src/environments/environment';

import type { CurrentUserInterface } from '../types/currentUser.interface';

export const LOGIN_REDIRECT_TARGET_QUERY_PARAM = 'target';

export type LoginRedirectTarget = 'business-manager' | 'town-planner' | 'ai-toolkit-checkout';

type RedirectDestination = {
  label: string;
  route: string;
  aliases: string[];
};

const POST_LOGIN_DESTINATIONS: RedirectDestination[] = [
  {
    label: 'Town planner',
    route: '/townplanner',
    aliases: ['town-planner', 'town planner', 'townplanner'],
  },
  {
    label: 'Business manager',
    route: '/manager',
    aliases: ['business-manager', 'business manager', 'manager'],
  },
  {
    label: 'Settings',
    route: '/settings',
    aliases: ['settings'],
  },
  {
    label: 'AI Toolkit checkout',
    route: '/ai-toolkit/checkout',
    aliases: ['ai-toolkit-checkout', 'ai toolkit checkout', 'toolkit-checkout'],
  },
];

const HOME_ROUTE = '/';
const TOOLKIT_DASHBOARD_ROUTE = '/manager/dashboard';

function normalizeToken(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-');
}

@Injectable({ providedIn: 'root' })
export class PostLoginRedirectService {
  constructor(
    private readonly navigationLinksApi: NavigationLinksProjectsService,
    private readonly http: HttpClient,
  ) {}

  getRequestedTargetRoute(target: string | null | undefined): string | null {
    const normalizedTarget = normalizeToken(target);
    if (!normalizedTarget) return null;

    return (
      POST_LOGIN_DESTINATIONS.find((destination) =>
        destination.aliases.some((alias) => normalizeToken(alias) === normalizedTarget),
      )?.route ?? null
    );
  }

  resolvePostLoginRoute(
    currentUser: CurrentUserInterface | null | undefined,
    requestedTarget: string | null | undefined,
  ): Observable<string> {
    const companyId = currentUser?.companyId ?? null;
    const normalizedTarget = normalizeToken(requestedTarget);

    if (normalizedTarget === 'ai-toolkit-checkout') {
      return this.getAiToolkitAccess().pipe(
        map((hasAccess) =>
          hasAccess ? TOOLKIT_DASHBOARD_ROUTE : '/ai-toolkit/checkout',
        ),
        catchError(() => of('/ai-toolkit/checkout')),
      );
    }

    if (!companyId) {
      return of(this.getRequestedTargetRoute(requestedTarget) || HOME_ROUTE);
    }

    return forkJoin({
      links: this.navigationLinksApi
        .listActiveNavigationLinks({ navigationType: 'header' })
        .pipe(catchError(() => of([]))),
      hasToolkitAccess: this.getAiToolkitAccess().pipe(catchError(() => of(false))),
    }).pipe(
      map(({ links, hasToolkitAccess }) => {
        const enabledLabels = new Set(
          (links || [])
            .map((link) => normalizeToken(link.navigationLabel))
            .filter((label) => !!label),
        );
        const requestedRoute = this.getRequestedTargetRoute(requestedTarget);

        if (
          requestedRoute &&
          this.isRouteEnabledForLabels(requestedRoute, enabledLabels, hasToolkitAccess)
        ) {
          return requestedRoute;
        }

        if (hasToolkitAccess && enabledLabels.has('ai-toolkit')) {
          return TOOLKIT_DASHBOARD_ROUTE;
        }

        if (enabledLabels.has('business-manager')) {
          return '/manager';
        }

        return HOME_ROUTE;
      }),
      catchError(() => of(HOME_ROUTE)),
    );
  }

  private getAiToolkitAccess(): Observable<boolean> {
    return this.http
      .get<{ hasAccess: boolean }>(`${environment.apiUrl}/ai-toolkit/access`)
      .pipe(map((res) => !!res?.hasAccess));
  }

  private isRouteEnabledForLabels(
    route: string,
    enabledLabels: Set<string>,
    hasToolkitAccess: boolean,
  ): boolean {
    if (route === HOME_ROUTE) return true;
    if (route === '/manager') return enabledLabels.has('business-manager');
    if (route === TOOLKIT_DASHBOARD_ROUTE) {
      return hasToolkitAccess && enabledLabels.has('ai-toolkit');
    }
    if (route === '/ai-toolkit/checkout') return !hasToolkitAccess;

    const destination = POST_LOGIN_DESTINATIONS.find(
      (item) => item.route === route,
    );
    return destination ? enabledLabels.has(normalizeToken(destination.label)) : false;
  }
}
