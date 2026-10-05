import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { PersistanceService } from '../../shared/services/persistance.service';
import type {
  OpenForAustraliaStudentList,
  OpenForAustraliaWorkspace,
} from './open-for-australia.types';

@Injectable({ providedIn: 'root' })
export class OpenForAustraliaService {
  private readonly http = inject(HttpClient);
  private readonly persistence = inject(PersistanceService);
  private readonly workspaceBase = environment.sophiaRuntimeApiUrl
    .replace(/\/+$/, '')
    .replace(/\/runtime$/, '/business-packs/open-for-australia/v1/workspace');

  workspace(): Observable<OpenForAustraliaWorkspace> {
    return this.http.get<OpenForAustraliaWorkspace>(this.workspaceBase, {
      headers: this.headers(),
    });
  }

  students(input: {
    page: number;
    limit: number;
    q?: string;
    status?: string;
    advisor?: string;
    college?: string;
  }): Observable<OpenForAustraliaStudentList> {
    let params = new HttpParams()
      .set('page', String(input.page))
      .set('limit', String(input.limit));
    if (input.q) params = params.set('q', input.q);
    if (input.status) params = params.set('status', input.status);
    if (input.advisor) params = params.set('advisor', input.advisor);
    if (input.college) params = params.set('college', input.college);
    return this.http.get<OpenForAustraliaStudentList>(`${this.workspaceBase}/students`, {
      headers: this.headers(),
      params,
    });
  }

  private headers(): HttpHeaders {
    const token = this.persistence.get<string>('accessToken')
      ?? this.persistence.get<string>('token');
    return token
      ? new HttpHeaders({ Authorization: `Token ${token}` })
      : new HttpHeaders();
  }
}
