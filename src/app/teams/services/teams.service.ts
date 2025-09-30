/**
 * TeamsService
 * ------------
 * Purpose:
 * - All HTTP calls for teams feature (list/create/update/delete/reorder/members).
 *
 * Notes:
 * - HttpClient already has an auth interceptor that adds Authorization header.
 * - Endpoints mirror the server routes we added earlier.
 */

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment.development';
import { Observable } from 'rxjs';
import { TeamInterface } from '../types/team.interface';

@Injectable({ providedIn: 'root' })
export class TeamsService {
  private base = `${environment.apiUrl}/teams`;
  constructor(private http: HttpClient) {}

  /** GET /teams → { teams } */
  list(): Observable<{ teams: TeamInterface[] }> {
    return this.http.get<{ teams: TeamInterface[] }>(this.base);
  }

  /** POST /teams → { team } */
  create(name: string): Observable<{ team: TeamInterface }> {
    return this.http.post<{ team: TeamInterface }>(this.base, { name });
  }

  /** PUT /teams/:id → { team } */
  update(id: string, name: string): Observable<{ team: TeamInterface }> {
    return this.http.put<{ team: TeamInterface }>(`${this.base}/${id}`, {
      name,
    });
  }

  /** DELETE /teams/:id → 204 */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  /** PATCH /teams/reorder → { teams } (persist drag order) */
  reorder(ids: string[]): Observable<{ teams: TeamInterface[] }> {
    return this.http.patch<{ teams: TeamInterface[] }>(`${this.base}/reorder`, {
      ids,
    });
  }

  /** GET /teams/:id/members → { members } */
  getMembers(teamId: string): Observable<{ members: any[] }> {
    return this.http.get<{ members: any[] }>(`${this.base}/${teamId}/members`);
  }

  /** PUT /teams/:id/members → { members } */
  setMembers(
    teamId: string,
    employeeIds: string[]
  ): Observable<{ members: any[] }> {
    return this.http.put<{ members: any[] }>(`${this.base}/${teamId}/members`, {
      employeeIds,
    });
  }
}
