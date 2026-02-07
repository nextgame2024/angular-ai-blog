import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

import type {
  BmProject,
  BmProjectLabor,
  BmProjectMaterial,
  ListProjectsResponse,
  PagedResult,
} from '../types/projects.interface';

@Injectable()
export class ManagerProjectsService {
  private readonly apiBase = environment.apiUrl;
  private readonly projectsBase = `${this.apiBase}/bm/projects`;

  constructor(private http: HttpClient) {}

  listProjects(params: {
    page: number;
    limit: number;
    q?: string;
    status?: string;
    clientId?: string;
  }): Observable<PagedResult<BmProject>> {
    let httpParams = new HttpParams()
      .set('page', String(params.page ?? 1))
      .set('limit', String(params.limit ?? 20));
    if (params.q) httpParams = httpParams.set('q', params.q);
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.clientId)
      httpParams = httpParams.set('clientId', params.clientId);

    return this.http
      .get<ListProjectsResponse>(this.projectsBase, { params: httpParams })
      .pipe(
        map((res) => ({
          items: res?.projects ?? [],
          page: res?.page ?? params.page ?? 1,
          limit: res?.limit ?? params.limit ?? 20,
          total: res?.total ?? 0,
        })),
      );
  }

  getProject(projectId: string): Observable<{ project: BmProject }> {
    return this.http.get<{ project: BmProject }>(
      `${this.projectsBase}/${projectId}`,
    );
  }

  createProject(payload: any): Observable<{ project: BmProject }> {
    return this.http.post<{ project: BmProject }>(this.projectsBase, {
      project: payload,
    });
  }

  updateProject(
    projectId: string,
    payload: any,
  ): Observable<{ project: BmProject }> {
    return this.http.put<{ project: BmProject }>(
      `${this.projectsBase}/${projectId}`,
      { project: payload },
    );
  }

  archiveProject(projectId: string): Observable<void> {
    return this.http.delete<void>(`${this.projectsBase}/${projectId}`);
  }

  // Project materials
  listProjectMaterials(
    projectId: string,
  ): Observable<{ materials: BmProjectMaterial[] }> {
    return this.http.get<{ materials: BmProjectMaterial[] }>(
      `${this.projectsBase}/${projectId}/materials`,
    );
  }

  upsertProjectMaterial(
    projectId: string,
    materialId: string,
    payload: any,
  ): Observable<{ projectMaterial: BmProjectMaterial }> {
    return this.http.put<{ projectMaterial: BmProjectMaterial }>(
      `${this.projectsBase}/${projectId}/materials/${materialId}`,
      { projectMaterial: payload },
    );
  }

  addProjectMaterial(
    projectId: string,
    payload: any,
  ): Observable<{ projectMaterial: BmProjectMaterial }> {
    return this.http.post<{ projectMaterial: BmProjectMaterial }>(
      `${this.projectsBase}/${projectId}/materials`,
      { projectMaterial: payload },
    );
  }

  removeProjectMaterial(projectId: string, materialId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.projectsBase}/${projectId}/materials/${materialId}`,
    );
  }

  // Project labor
  listProjectLabor(
    projectId: string,
  ): Observable<{ labor: BmProjectLabor[] }> {
    return this.http.get<{ labor: BmProjectLabor[] }>(
      `${this.projectsBase}/${projectId}/labor`,
    );
  }

  upsertProjectLabor(
    projectId: string,
    laborId: string,
    payload: any,
  ): Observable<{ projectLabor: BmProjectLabor }> {
    return this.http.put<{ projectLabor: BmProjectLabor }>(
      `${this.projectsBase}/${projectId}/labor/${laborId}`,
      { projectLabor: payload },
    );
  }

  addProjectLabor(
    projectId: string,
    payload: any,
  ): Observable<{ projectLabor: BmProjectLabor }> {
    return this.http.post<{ projectLabor: BmProjectLabor }>(
      `${this.projectsBase}/${projectId}/labor`,
      { projectLabor: payload },
    );
  }

  removeProjectLabor(projectId: string, laborId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.projectsBase}/${projectId}/labor/${laborId}`,
    );
  }

  createDocumentFromProject(
    projectId: string,
    payload: any,
  ): Observable<any> {
    return this.http.post<any>(
      `${this.projectsBase}/${projectId}/create-document`,
      { document: payload },
    );
  }

  updateDocument(documentId: string, payload: any): Observable<any> {
    return this.http.put<any>(`${this.apiBase}/bm/documents/${documentId}`, {
      document: payload,
    });
  }
}
