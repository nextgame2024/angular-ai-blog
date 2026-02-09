import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

import type {
  BmMaterial,
  ListMaterialsResponse,
  PagedResult,
} from '../types/materials.interface';

@Injectable()
export class ManagerMaterialsService {
  private readonly apiBase = environment.apiUrl;
  private readonly materialsBase = `${this.apiBase}/bm/materials`;

  constructor(private http: HttpClient) {}

  listMaterials(params: {
    page: number;
    limit: number;
    q?: string;
    status?: string;
  }): Observable<PagedResult<BmMaterial>> {
    let httpParams = new HttpParams()
      .set('page', String(params.page ?? 1))
      .set('limit', String(params.limit ?? 20));
    if (params.q) httpParams = httpParams.set('q', params.q);
    if (params.status) httpParams = httpParams.set('status', params.status);

    return this.http
      .get<ListMaterialsResponse>(this.materialsBase, { params: httpParams })
      .pipe(
        map((res) => ({
          items: res?.materials ?? [],
          page: res?.page ?? params.page ?? 1,
          limit: res?.limit ?? params.limit ?? 20,
          total: res?.total ?? 0,
        })),
      );
  }

  getMaterial(materialId: string): Observable<{ material: BmMaterial }> {
    return this.http.get<{ material: BmMaterial }>(
      `${this.materialsBase}/${materialId}`,
    );
  }

  createMaterial(payload: any): Observable<{ material: BmMaterial }> {
    return this.http.post<{ material: BmMaterial }>(this.materialsBase, {
      material: payload,
    });
  }

  updateMaterial(
    materialId: string,
    payload: any,
  ): Observable<{ material: BmMaterial }> {
    return this.http.put<{ material: BmMaterial }>(
      `${this.materialsBase}/${materialId}`,
      { material: payload },
    );
  }

  removeMaterial(
    materialId: string,
  ): Observable<{ materialId: string; action: 'archived' | 'deleted' }> {
    return this.http.delete<{
      materialId: string;
      action: 'archived' | 'deleted';
    }>(`${this.materialsBase}/${materialId}`);
  }
}
