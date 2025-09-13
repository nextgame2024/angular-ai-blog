import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { Observable } from 'rxjs';

export interface CreateSessionResponse {
  jobId: string;
  uploadUrl: string;
  sessionUrl: string;
}

export type RenderJobStatus =
  | 'pending-upload'
  | 'awaiting_payment'
  | 'paid'
  | 'processing'
  | 'done'
  | 'failed';

export interface RenderStatusResponse {
  id: string;
  status: RenderJobStatus;
  signedUrl?: string; // present when status === 'done'
  expiresAt?: string; // ISO date string when available
  articleId?: string;
}

@Injectable({ providedIn: 'root' })
export class RenderService {
  constructor(private http: HttpClient) {}

  // add explicit return type for clarity
  createSession(
    filename: string,
    contentType: string,
    articleSlug: string,
    guestEmail?: string
  ): Observable<CreateSessionResponse> {
    return this.http.post<CreateSessionResponse>(
      `${environment.apiUrl}/renders/create-session`,
      { filename, contentType, articleSlug, guestEmail }
    );
  }

  // ✅ NEW: used by the success page poller
  getStatus(jobId: string): Observable<RenderStatusResponse> {
    return this.http.get<RenderStatusResponse>(
      `${environment.apiUrl}/renders/${jobId}`
    );
  }

  async uploadToS3(uploadUrl: string, file: File): Promise<void> {
    const resp = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });
    if (!resp.ok) {
      throw new Error(`Upload failed: ${resp.status} ${resp.statusText}`);
    }
  }
}
