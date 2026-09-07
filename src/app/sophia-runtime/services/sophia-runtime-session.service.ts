import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

import type {
  CreateSophiaRuntimeSessionRequest,
  ExecuteSophiaRuntimeToolRequest,
  ExecuteSophiaRuntimeToolResponse,
  SophiaRuntimeSessionResponse,
  SophiaRuntimeSessionStatusResponse,
} from '../types/sophia-runtime.types';

@Injectable()
export class SophiaRuntimeSessionService {
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
    );
  }

  getSession(sessionId: string): Observable<SophiaRuntimeSessionStatusResponse> {
    return this.http.get<SophiaRuntimeSessionStatusResponse>(
      `${this.runtimeBase}/sessions/${sessionId}`,
    );
  }

  executeTool(
    sessionId: string,
    payload: ExecuteSophiaRuntimeToolRequest,
  ): Observable<ExecuteSophiaRuntimeToolResponse> {
    return this.http.post<ExecuteSophiaRuntimeToolResponse>(
      `${this.runtimeBase}/sessions/${sessionId}/tools`,
      payload,
    );
  }

  closeSession(sessionId: string): Observable<SophiaRuntimeSessionStatusResponse> {
    return this.http.post<SophiaRuntimeSessionStatusResponse>(
      `${this.runtimeBase}/sessions/${sessionId}/close`,
      {},
    );
  }
}
