import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

import type {
  BmNavigationLink,
  ListNavigationLinksResponse,
  NavigationLinksSyncResult,
  NavigationType,
  PagedResult,
} from '../types/navigation.links.interface';

@Injectable({ providedIn: 'root' })
export class NavigationLinksProjectsService {
  private readonly apiBase = environment.apiUrl;
  private readonly navigationLinksBase = `${this.apiBase}/bm/navigation-links`;

  constructor(private http: HttpClient) {}

  listNavigationLinks(params: {
    page: number;
    limit: number;
    q?: string;
    navigationType?: NavigationType;
    active?: boolean;
    companyId?: string;
  }): Observable<PagedResult<BmNavigationLink>> {
    let httpParams = new HttpParams()
      .set('page', String(params.page ?? 1))
      .set('limit', String(params.limit ?? 20));

    if (params.q) httpParams = httpParams.set('q', params.q);
    if (params.navigationType) {
      httpParams = httpParams.set('navigationType', params.navigationType);
    }
    if (params.active !== undefined) {
      httpParams = httpParams.set('active', String(params.active));
    }
    if (params.companyId) {
      httpParams = httpParams.set('companyId', params.companyId);
    }

    return this.http
      .get<ListNavigationLinksResponse>(this.navigationLinksBase, {
        params: httpParams,
      })
      .pipe(
        map((res) => ({
          items: res?.navigationLinks ?? [],
          page: res?.page ?? params.page ?? 1,
          limit: res?.limit ?? params.limit ?? 20,
          total: res?.total ?? 0,
        })),
      );
  }

  getNavigationLink(
    navigationLinkId: string,
  ): Observable<{ navigationLink: BmNavigationLink }> {
    return this.http.get<{ navigationLink: BmNavigationLink }>(
      `${this.navigationLinksBase}/${navigationLinkId}`,
    );
  }

  createNavigationLink(payload: any): Observable<{ navigationLink: BmNavigationLink }> {
    return this.http.post<{ navigationLink: BmNavigationLink }>(
      this.navigationLinksBase,
      {
        navigationLink: payload,
      },
    );
  }

  updateNavigationLink(
    navigationLinkId: string,
    payload: any,
  ): Observable<{ navigationLink: BmNavigationLink }> {
    return this.http.put<{ navigationLink: BmNavigationLink }>(
      `${this.navigationLinksBase}/${navigationLinkId}`,
      {
        navigationLink: payload,
      },
    );
  }

  removeNavigationLink(navigationLinkId: string): Observable<void> {
    return this.http.delete<void>(`${this.navigationLinksBase}/${navigationLinkId}`);
  }

  listActiveNavigationLinks(params: {
    navigationType?: NavigationType;
    companyId?: string;
  } = {}): Observable<BmNavigationLink[]> {
    let httpParams = new HttpParams();

    if (params.navigationType) {
      httpParams = httpParams.set('navigationType', params.navigationType);
    }
    if (params.companyId) {
      httpParams = httpParams.set('companyId', params.companyId);
    }

    return this.http
      .get<{ navigationLinks: BmNavigationLink[] }>(
        `${this.navigationLinksBase}/active`,
        { params: httpParams },
      )
      .pipe(map((res) => res?.navigationLinks ?? []));
  }

  syncNavigationLabels(payload: {
    company_id?: string;
    navigation_type: NavigationType;
    navigation_labels: string[];
  }): Observable<NavigationLinksSyncResult> {
    return this.http.post<NavigationLinksSyncResult>(
      `${this.navigationLinksBase}/sync`,
      {
        navigationLinksSync: payload,
      },
    );
  }
}
