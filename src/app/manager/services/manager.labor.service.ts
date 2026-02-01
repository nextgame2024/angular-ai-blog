import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

import type { BmLabor, ListLaborResponse, PagedResult } from '../types/labor.interface';

@Injectable()
export class ManagerLaborService {
  private readonly apiBase = environment.apiUrl;
  private readonly laborBase = `${this.apiBase}/bm/labor`;

  constructor(private http: HttpClient) {}

  listLabor(params: {
    page: number;
    limit: number;
    q?: string;
    status?: string;
  }): Observable<PagedResult<BmLabor>> {
    let httpParams = new HttpParams()
      .set('page', String(params.page ?? 1))
      .set('limit', String(params.limit ?? 20));
    if (params.q) httpParams = httpParams.set('q', params.q);
    if (params.status) httpParams = httpParams.set('status', params.status);

    return this.http.get<ListLaborResponse>(this.laborBase, { params: httpParams }).pipe(
      map((res) => ({
        items: res?.labor ?? [],
        page: res?.page ?? params.page ?? 1,
        limit: res?.limit ?? params.limit ?? 20,
        total: res?.total ?? 0,
      })),
    );
  }

  getLabor(laborId: string): Observable<{ labor: BmLabor }> {
    return this.http.get<{ labor: BmLabor }>(`${this.laborBase}/${laborId}`);
  }

  createLabor(payload: any): Observable<{ labor: BmLabor }> {
    return this.http.post<{ labor: BmLabor }>(this.laborBase, { labor: payload });
  }

  updateLabor(laborId: string, payload: any): Observable<{ labor: BmLabor }> {
    return this.http.put<{ labor: BmLabor }>(`${this.laborBase}/${laborId}`, {
      labor: payload,
    });
  }

  archiveLabor(laborId: string): Observable<void> {
    return this.http.delete<void>(`${this.laborBase}/${laborId}`);
  }
}
