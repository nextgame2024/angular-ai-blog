import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

import type {
  BmPalletMovement,
  ListPalletMovementsResponse,
  ListPalletSitesResponse,
  PagedPalletMovements,
  PagedPalletSites,
  PalletsContext,
} from '../types/pallets.interface';

@Injectable()
export class ManagerPalletsService {
  private readonly apiBase = environment.apiUrl;
  private readonly palletsBase = `${this.apiBase}/bm/pallets`;

  constructor(private http: HttpClient) {}

  getContext(): Observable<PalletsContext> {
    return this.http.get<PalletsContext>(`${this.palletsBase}/context`);
  }

  listOnSite(params: {
    page: number;
    limit: number;
    q?: string;
  }): Observable<PagedPalletSites> {
    let httpParams = new HttpParams()
      .set('page', String(params.page ?? 1))
      .set('limit', String(params.limit ?? 20));
    if (params.q) httpParams = httpParams.set('q', params.q);

    return this.http
      .get<ListPalletSitesResponse>(`${this.palletsBase}/on-site`, {
        params: httpParams,
      })
      .pipe(
        map((res) => ({
          items: res?.sites ?? [],
          page: res?.page ?? params.page ?? 1,
          limit: res?.limit ?? params.limit ?? 20,
          total: res?.total ?? 0,
        })),
      );
  }

  listSent(params: {
    page: number;
    limit: number;
  }): Observable<PagedPalletMovements> {
    const httpParams = new HttpParams()
      .set('page', String(params.page ?? 1))
      .set('limit', String(params.limit ?? 20));
    return this.http
      .get<ListPalletMovementsResponse>(`${this.palletsBase}/sent`, {
        params: httpParams,
      })
      .pipe(
        map((res) => ({
          items: res?.movements ?? [],
          page: res?.page ?? params.page ?? 1,
          limit: res?.limit ?? params.limit ?? 20,
          total: res?.total ?? 0,
        })),
      );
  }

  listIncoming(params: {
    page: number;
    limit: number;
  }): Observable<PagedPalletMovements> {
    const httpParams = new HttpParams()
      .set('page', String(params.page ?? 1))
      .set('limit', String(params.limit ?? 20));
    return this.http
      .get<ListPalletMovementsResponse>(`${this.palletsBase}/incoming`, {
        params: httpParams,
      })
      .pipe(
        map((res) => ({
          items: res?.movements ?? [],
          page: res?.page ?? params.page ?? 1,
          limit: res?.limit ?? params.limit ?? 20,
          total: res?.total ?? 0,
        })),
      );
  }

  movePallets(payload: any): Observable<{ movement: BmPalletMovement }> {
    return this.http.post<{ movement: BmPalletMovement }>(
      `${this.palletsBase}/move`,
      { movement: payload },
    );
  }

  deleteMovement(
    palletId: string,
  ): Observable<{ palletId: string; action: 'cancelled' }> {
    return this.http.delete<{ palletId: string; action: 'cancelled' }>(
      `${this.palletsBase}/${palletId}`,
    );
  }

  receiveMovement(palletId: string): Observable<{ palletId: string }> {
    return this.http.post<{ palletId: string }>(
      `${this.palletsBase}/${palletId}/receive`,
      {},
    );
  }
}
