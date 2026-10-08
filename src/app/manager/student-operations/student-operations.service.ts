import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { finalize, of, shareReplay, tap } from 'rxjs';
import type { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { PersistanceService } from '../../shared/services/persistance.service';
import type {
  StudentOperationsStudentList,
  StudentOperationsDashboard,
  StudentOperationsWorkspace,
} from './student-operations.types';

@Injectable({ providedIn: 'root' })
export class StudentOperationsService {
  private readonly http = inject(HttpClient);
  private readonly persistence = inject(PersistanceService);
  private readonly workspaceBase = environment.sophiaRuntimeApiUrl
    .replace(/\/+$/, '')
    .replace(/\/runtime$/, '/business-packs/student-operations/v1/workspace');
  private dashboardCache: StudentOperationsDashboard | null = null;
  private dashboardCacheCredential: string | null = null;
  private dashboardCacheTimestamp: number | null = null;
  private dashboardRequest$: Observable<StudentOperationsDashboard> | null = null;
  private dashboardRequestCredential: string | null = null;

  workspace(): Observable<StudentOperationsWorkspace> {
    return this.http.get<StudentOperationsWorkspace>(this.workspaceBase, {
      headers: this.headers(),
    });
  }

  dashboard(options: { refresh?: boolean } = {}): Observable<StudentOperationsDashboard> {
    const credential = this.accessToken();
    this.clearDashboardForChangedCredential(credential);

    if (!options.refresh && this.dashboardCache) {
      return of(this.dashboardCache);
    }

    if (this.dashboardRequest$ && this.dashboardRequestCredential === credential) {
      return this.dashboardRequest$;
    }

    const request$ = this.http.get<StudentOperationsDashboard>(
      `${this.workspaceBase}/dashboard`,
      { headers: this.headers(credential) },
    ).pipe(
      tap((dashboard) => {
        if (this.accessToken() === credential) {
          this.dashboardCache = dashboard;
          this.dashboardCacheCredential = credential;
          this.dashboardCacheTimestamp = Date.now();
        }
      }),
      finalize(() => {
        if (this.dashboardRequestCredential === credential) {
          this.dashboardRequest$ = null;
          this.dashboardRequestCredential = null;
        }
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    this.dashboardRequestCredential = credential;
    this.dashboardRequest$ = request$;
    return request$;
  }

  hasDashboardCache(): boolean {
    const credential = this.accessToken();
    this.clearDashboardForChangedCredential(credential);
    return this.dashboardCache !== null;
  }

  dashboardCachedAt(): number | null {
    return this.hasDashboardCache() ? this.dashboardCacheTimestamp : null;
  }

  invalidateDashboard(): void {
    this.dashboardCache = null;
    this.dashboardCacheCredential = null;
    this.dashboardCacheTimestamp = null;
  }

  students(input: {
    page: number;
    limit: number;
    q?: string;
    status?: string;
    advisor?: string;
    college?: string;
  }): Observable<StudentOperationsStudentList> {
    let params = new HttpParams()
      .set('page', String(input.page))
      .set('limit', String(input.limit));
    if (input.q) params = params.set('q', input.q);
    if (input.status) params = params.set('status', input.status);
    if (input.advisor) params = params.set('advisor', input.advisor);
    if (input.college) params = params.set('college', input.college);
    return this.http.get<StudentOperationsStudentList>(`${this.workspaceBase}/students`, {
      headers: this.headers(),
      params,
    });
  }

  private accessToken(): string | null {
    return this.persistence.get<string>('accessToken')
      ?? this.persistence.get<string>('token')
      ?? null;
  }

  private headers(token = this.accessToken()): HttpHeaders {
    return token
      ? new HttpHeaders({ Authorization: `Token ${token}` })
      : new HttpHeaders();
  }

  private clearDashboardForChangedCredential(credential: string | null): void {
    const cacheBelongsToAnotherCredential = this.dashboardCache
      && this.dashboardCacheCredential !== credential;
    if (cacheBelongsToAnotherCredential) {
      this.invalidateDashboard();
    }
  }
}
