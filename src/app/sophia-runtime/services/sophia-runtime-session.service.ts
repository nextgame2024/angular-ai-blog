import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from 'src/environments/environment';

import type {
  CreateSophiaRuntimeSessionRequest,
  ExecuteSophiaRuntimeToolRequest,
  ExecuteSophiaRuntimeToolResponse,
  SophiaCurrentActionReviewResponse,
  SophiaRuntimeSessionResponse,
  SophiaRuntimeSessionStatusResponse,
} from '../types/sophia-runtime.types';

@Injectable()
export class SophiaRuntimeSessionService {
  private readonly accessTokens = new Map<string, string>();
  private readonly runtimeBase = environment.sophiaRuntimeApiUrl.replace(
    /\/$/,
    '',
  );

  constructor(private readonly http: HttpClient) {}

  warmUp(): Observable<{ ok: boolean }> {
    return this.http.get<{ ok: boolean }>(`${this.runtimeBase}/healthz`);
  }

  createSession(
    payload: CreateSophiaRuntimeSessionRequest,
  ): Observable<SophiaRuntimeSessionResponse> {
    return this.http.post<SophiaRuntimeSessionResponse>(
      `${this.runtimeBase}/sessions`,
      payload,
    ).pipe(tap((response) => {
      this.accessTokens.set(
        response.session.sessionId,
        response.sessionAccessToken,
      );
    }));
  }

  getSession(sessionId: string): Observable<SophiaRuntimeSessionStatusResponse> {
    return this.http.get<SophiaRuntimeSessionStatusResponse>(
      `${this.runtimeBase}/sessions/${sessionId}`,
      { headers: this.sessionHeaders(sessionId) },
    );
  }

  executeTool(
    sessionId: string,
    payload: ExecuteSophiaRuntimeToolRequest,
  ): Observable<ExecuteSophiaRuntimeToolResponse> {
    return this.http.post<ExecuteSophiaRuntimeToolResponse>(
      `${this.runtimeBase}/sessions/${sessionId}/tools`,
      payload,
      { headers: this.sessionHeaders(sessionId) },
    );
  }

  closeSession(sessionId: string): Observable<SophiaRuntimeSessionStatusResponse> {
    return this.http.post<SophiaRuntimeSessionStatusResponse>(
      `${this.runtimeBase}/sessions/${sessionId}/close`,
      {},
      { headers: this.sessionHeaders(sessionId) },
    ).pipe(tap(() => this.accessTokens.delete(sessionId)));
  }

  heartbeatSession(sessionId: string): Observable<SophiaRuntimeSessionStatusResponse> {
    return this.http.post<SophiaRuntimeSessionStatusResponse>(
      `${this.runtimeBase}/sessions/${sessionId}/heartbeat`,
      {},
      { headers: this.sessionHeaders(sessionId) },
    );
  }

  markDisconnected(sessionId: string): Observable<SophiaRuntimeSessionStatusResponse> {
    return this.http.post<SophiaRuntimeSessionStatusResponse>(
      `${this.runtimeBase}/sessions/${sessionId}/disconnect`,
      {},
      { headers: this.sessionHeaders(sessionId) },
    );
  }

  forgetSession(sessionId: string): void {
    this.accessTokens.delete(sessionId);
  }

  confirmActionReview(
    sessionId: string,
    reviewId: string,
  ): Observable<{ reviewId: string; status: 'confirmed' }> {
    return this.http.post<{ reviewId: string; status: 'confirmed' }>(
      `${this.runtimeBase}/sessions/${sessionId}/action-reviews/${reviewId}/confirm`,
      {},
      { headers: this.sessionHeaders(sessionId) },
    );
  }

  getCurrentActionReview(sessionId: string): Observable<SophiaCurrentActionReviewResponse> {
    return this.http.get<SophiaCurrentActionReviewResponse>(
      `${this.runtimeBase}/sessions/${sessionId}/action-reviews/current`,
      { headers: this.sessionHeaders(sessionId) },
    );
  }

  cancelActionReview(
    sessionId: string,
    reviewId: string,
  ): Observable<{ reviewId: string; status: 'cancelled' }> {
    return this.http.delete<{ reviewId: string; status: 'cancelled' }>(
      `${this.runtimeBase}/sessions/${sessionId}/action-reviews/${reviewId}`,
      { headers: this.sessionHeaders(sessionId) },
    );
  }

  private sessionHeaders(sessionId: string): HttpHeaders {
    const token = this.accessTokens.get(sessionId);
    if (!token) throw new Error('Sophia session access is unavailable.');
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }
}
