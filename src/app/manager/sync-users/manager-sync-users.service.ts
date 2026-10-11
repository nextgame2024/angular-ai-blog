import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';

export interface SyncCandidate {
  id: string;
  display_name: string;
  source_names: string[];
  emails: string[];
  record_count: number;
  status: string;
  reason: string | null;
  student_id: string | null;
  resolution_name: string | null;
  resolution_email: string | null;
}
export interface SyncRun {
  id: string;
  mode: string;
  status: string;
  phase: string;
  created_count: number;
  processed_count: number;
  error: string | null;
  created_at: string;
}
export interface SyncOverview {
  records: SyncCandidate[];
  counts: Record<string, number>;
  runs: SyncRun[];
  page: number;
  total: number;
  automatic: boolean;
}
@Injectable({ providedIn: 'root' })
export class ManagerSyncUsersService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/bm/sync-users`;
  list(page: number, status: string, q: string) {
    return this.http.get<SyncOverview>(this.base, {
      params: { page, status, q },
    });
  }
  run(mode: 'preview' | 'apply') {
    return this.http.post(this.base + '/runs', { mode });
  }
  resolve(
    id: string,
    data: { action: string; name?: string; email?: string; studentId?: string },
  ) {
    return this.http.put(`${this.base}/records/${id}`, data);
  }
}
