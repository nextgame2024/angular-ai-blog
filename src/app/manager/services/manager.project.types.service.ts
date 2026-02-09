import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

import type {
  BmProjectType,
  BmProjectTypeLabor,
  BmProjectTypeMaterial,
  ListProjectTypesResponse,
  PagedResult,
} from '../types/project.types.interface';

@Injectable()
export class ManagerProjectTypesService {
  private readonly apiBase = environment.apiUrl;
  private readonly projectTypesBase = `${this.apiBase}/bm/project-types`;

  constructor(private http: HttpClient) {}

  listProjectTypes(params: {
    page: number;
    limit: number;
    q?: string;
    status?: string;
  }): Observable<PagedResult<BmProjectType>> {
    let httpParams = new HttpParams()
      .set('page', String(params.page ?? 1))
      .set('limit', String(params.limit ?? 20));
    if (params.q) httpParams = httpParams.set('q', params.q);
    if (params.status) httpParams = httpParams.set('status', params.status);

    return this.http
      .get<ListProjectTypesResponse>(this.projectTypesBase, {
        params: httpParams,
      })
      .pipe(
        map((res) => ({
          items: res?.projectTypes ?? [],
          page: res?.page ?? params.page ?? 1,
          limit: res?.limit ?? params.limit ?? 20,
          total: res?.total ?? 0,
        })),
      );
  }

  getProjectType(
    projectTypeId: string,
  ): Observable<{ projectType: BmProjectType }> {
    return this.http.get<{ projectType: BmProjectType }>(
      `${this.projectTypesBase}/${projectTypeId}`,
    );
  }

  createProjectType(payload: any): Observable<{ projectType: BmProjectType }> {
    return this.http.post<{ projectType: BmProjectType }>(
      this.projectTypesBase,
      {
        projectType: payload,
      },
    );
  }

  updateProjectType(
    projectTypeId: string,
    payload: any,
  ): Observable<{ projectType: BmProjectType }> {
    return this.http.put<{ projectType: BmProjectType }>(
      `${this.projectTypesBase}/${projectTypeId}`,
      { projectType: payload },
    );
  }

  removeProjectType(
    projectTypeId: string,
  ): Observable<{ projectTypeId: string; action: 'archived' | 'deleted' }> {
    return this.http.delete<{
      projectTypeId: string;
      action: 'archived' | 'deleted';
    }>(`${this.projectTypesBase}/${projectTypeId}`);
  }

  listProjectTypeMaterials(
    projectTypeId: string,
  ): Observable<{ materials: BmProjectTypeMaterial[] }> {
    return this.http.get<{ materials: BmProjectTypeMaterial[] }>(
      `${this.projectTypesBase}/${projectTypeId}/materials`,
    );
  }

  addProjectTypeMaterial(
    projectTypeId: string,
    payload: any,
  ): Observable<{ projectTypeMaterial: BmProjectTypeMaterial }> {
    return this.http.post<{ projectTypeMaterial: BmProjectTypeMaterial }>(
      `${this.projectTypesBase}/${projectTypeId}/materials`,
      { projectTypeMaterial: payload },
    );
  }

  upsertProjectTypeMaterial(
    projectTypeId: string,
    materialId: string,
    payload: any,
  ): Observable<{ projectTypeMaterial: BmProjectTypeMaterial }> {
    return this.http.put<{ projectTypeMaterial: BmProjectTypeMaterial }>(
      `${this.projectTypesBase}/${projectTypeId}/materials/${materialId}`,
      { projectTypeMaterial: payload },
    );
  }

  removeProjectTypeMaterial(
    projectTypeId: string,
    materialId: string,
  ): Observable<void> {
    return this.http.delete<void>(
      `${this.projectTypesBase}/${projectTypeId}/materials/${materialId}`,
    );
  }

  listProjectTypeLabor(
    projectTypeId: string,
  ): Observable<{ labor: BmProjectTypeLabor[] }> {
    return this.http.get<{ labor: BmProjectTypeLabor[] }>(
      `${this.projectTypesBase}/${projectTypeId}/labor`,
    );
  }

  addProjectTypeLabor(
    projectTypeId: string,
    payload: any,
  ): Observable<{ projectTypeLabor: BmProjectTypeLabor }> {
    return this.http.post<{ projectTypeLabor: BmProjectTypeLabor }>(
      `${this.projectTypesBase}/${projectTypeId}/labor`,
      { projectTypeLabor: payload },
    );
  }

  upsertProjectTypeLabor(
    projectTypeId: string,
    laborId: string,
    payload: any,
  ): Observable<{ projectTypeLabor: BmProjectTypeLabor }> {
    return this.http.put<{ projectTypeLabor: BmProjectTypeLabor }>(
      `${this.projectTypesBase}/${projectTypeId}/labor/${laborId}`,
      { projectTypeLabor: payload },
    );
  }

  removeProjectTypeLabor(
    projectTypeId: string,
    laborId: string,
  ): Observable<void> {
    return this.http.delete<void>(
      `${this.projectTypesBase}/${projectTypeId}/labor/${laborId}`,
    );
  }
}
