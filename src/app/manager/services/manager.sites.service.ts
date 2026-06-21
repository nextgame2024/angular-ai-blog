import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

import type {
  BmSite,
  ListSitesResponse,
  PagedResult,
} from '../types/sites.interface';

@Injectable()
export class ManagerSitesService {
  private readonly apiBase = environment.apiUrl;
  private readonly sitesBase = `${this.apiBase}/bm/sites`;

  constructor(private http: HttpClient) {}

  listSites(params: {
    page: number;
    limit: number;
    q?: string;
    status?: string;
    companyId?: string;
  }): Observable<PagedResult<BmSite>> {
    let httpParams = new HttpParams()
      .set('page', String(params.page ?? 1))
      .set('limit', String(params.limit ?? 20));
    if (params.q) httpParams = httpParams.set('q', params.q);
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.companyId) {
      httpParams = httpParams.set('companyId', params.companyId);
    }

    return this.http
      .get<ListSitesResponse>(this.sitesBase, { params: httpParams })
      .pipe(
        map((res) => ({
          items: res?.sites ?? [],
          page: res?.page ?? params.page ?? 1,
          limit: res?.limit ?? params.limit ?? 20,
          total: res?.total ?? 0,
        })),
      );
  }

  createSite(payload: any): Observable<{ site: BmSite }> {
    return this.http.post<{ site: BmSite }>(this.sitesBase, { site: payload });
  }

  updateSite(siteId: string, payload: any): Observable<{ site: BmSite }> {
    return this.http.put<{ site: BmSite }>(`${this.sitesBase}/${siteId}`, {
      site: payload,
    });
  }

  removeSite(siteId: string): Observable<void> {
    return this.http.delete<void>(`${this.sitesBase}/${siteId}`);
  }
}
