import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

import type {
  BmCompany,
  ListCompaniesResponse,
  PagedResult,
} from '../types/company.interface';

@Injectable()
export class ManagerCompanyService {
  private readonly apiBase = environment.apiUrl;
  private readonly companyBase = `${this.apiBase}/bm/company`;

  constructor(private http: HttpClient) {}

  listCompanies(params: {
    page: number;
    limit: number;
    q?: string;
    status?: string;
  }): Observable<PagedResult<BmCompany>> {
    let httpParams = new HttpParams()
      .set('page', String(params.page ?? 1))
      .set('limit', String(params.limit ?? 20));
    if (params.q) httpParams = httpParams.set('q', params.q);
    if (params.status) httpParams = httpParams.set('status', params.status);

    return this.http
      .get<ListCompaniesResponse>(this.companyBase, { params: httpParams })
      .pipe(
        map((res) => ({
          items: res?.companies ?? [],
          page: res?.page ?? params.page ?? 1,
          limit: res?.limit ?? params.limit ?? 20,
          total: res?.total ?? 0,
        })),
      );
  }

  getCompany(companyId: string): Observable<{ company: BmCompany }> {
    return this.http.get<{ company: BmCompany }>(
      `${this.companyBase}/${companyId}`,
    );
  }

  createCompany(payload: any): Observable<{ company: BmCompany }> {
    return this.http.post<{ company: BmCompany }>(this.companyBase, {
      company: payload,
    });
  }

  updateCompany(
    companyId: string,
    payload: any,
  ): Observable<{ company: BmCompany }> {
    return this.http.put<{ company: BmCompany }>(
      `${this.companyBase}/${companyId}`,
      { company: payload },
    );
  }

  archiveCompany(companyId: string): Observable<void> {
    return this.http.delete<void>(`${this.companyBase}/${companyId}`);
  }
}
