import { Injectable } from '@angular/core';
import { of, type Observable } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { NavigationLinksProjectsService } from 'src/app/manager/services/navigation.links.projects.service';
import { environment } from 'src/environments/environment';

import type { CurrentUserInterface } from '../types/currentUser.interface';

export const LOGIN_REDIRECT_TARGET_QUERY_PARAM = 'target';

export type LoginRedirectTarget = 'business-manager' | 'town-planner';

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
];

const DEFAULT_POST_LOGIN_ROUTE = '/manager';

function normalizeToken(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-');
}

@Injectable({ providedIn: 'root' })
export class PostLoginRedirectService {
  private readonly defaultCompanyId = environment.registerCompanyId;

  constructor(
    private readonly navigationLinksApi: NavigationLinksProjectsService,
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

    if (!companyId) {
      return of(this.getRequestedTargetRoute(requestedTarget) || DEFAULT_POST_LOGIN_ROUTE);
    }

    if (companyId === this.defaultCompanyId) {
      return of(this.getRequestedTargetRoute(requestedTarget) || DEFAULT_POST_LOGIN_ROUTE);
    }

    return this.navigationLinksApi.listActiveNavigationLinks({ navigationType: 'header' }).pipe(
      map((links) => {
        const enabledLabels = new Set(
          (links || [])
            .map((link) => normalizeToken(link.navigationLabel))
            .filter((label) => !!label),
        );

        return (
          POST_LOGIN_DESTINATIONS.find((destination) =>
            enabledLabels.has(normalizeToken(destination.label)),
          )?.route ?? DEFAULT_POST_LOGIN_ROUTE
        );
      }),
      catchError(() => of(DEFAULT_POST_LOGIN_ROUTE)),
    );
  }
}
