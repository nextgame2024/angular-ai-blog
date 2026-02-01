import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

import type {
  BmPricingProfile,
  ListPricingProfilesResponse,
  PagedResult,
} from '../types/pricing.interface';

@Injectable()
export class ManagerPricingService {
  private readonly apiBase = environment.apiUrl;
  private readonly pricingBase = `${this.apiBase}/bm/pricing-profiles`;

  constructor(private http: HttpClient) {}

  listPricingProfiles(params: {
    page: number;
    limit: number;
    q?: string;
    status?: string;
  }): Observable<PagedResult<BmPricingProfile>> {
    let httpParams = new HttpParams()
      .set('page', String(params.page ?? 1))
      .set('limit', String(params.limit ?? 20));
    if (params.q) httpParams = httpParams.set('q', params.q);
    if (params.status) httpParams = httpParams.set('status', params.status);

    return this.http
      .get<ListPricingProfilesResponse>(this.pricingBase, { params: httpParams })
      .pipe(
        map((res) => ({
          items: res?.pricingProfiles ?? [],
          page: res?.page ?? params.page ?? 1,
          limit: res?.limit ?? params.limit ?? 20,
          total: res?.total ?? 0,
        })),
      );
  }

  getPricingProfile(
    pricingProfileId: string,
  ): Observable<{ pricingProfile: BmPricingProfile }> {
    return this.http.get<{ pricingProfile: BmPricingProfile }>(
      `${this.pricingBase}/${pricingProfileId}`,
    );
  }

  createPricingProfile(payload: any): Observable<{ pricingProfile: BmPricingProfile }> {
    return this.http.post<{ pricingProfile: BmPricingProfile }>(
      this.pricingBase,
      { pricingProfile: payload },
    );
  }

  updatePricingProfile(
    pricingProfileId: string,
    payload: any,
  ): Observable<{ pricingProfile: BmPricingProfile }> {
    return this.http.put<{ pricingProfile: BmPricingProfile }>(
      `${this.pricingBase}/${pricingProfileId}`,
      { pricingProfile: payload },
    );
  }

  archivePricingProfile(pricingProfileId: string): Observable<void> {
    return this.http.delete<void>(`${this.pricingBase}/${pricingProfileId}`);
  }
}
