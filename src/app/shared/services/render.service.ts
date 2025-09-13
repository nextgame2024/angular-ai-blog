import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { Observable } from 'rxjs';

export interface CreateSessionResponse {
  jobId: string;
  uploadUrl: string;
  sessionUrl: string;
}

@Injectable({ providedIn: 'root' })
export class RenderService {
  constructor(private http: HttpClient) {}

  createSession(
    filename: string,
    contentType: string
  ): Observable<CreateSessionResponse> {
    return this.http.post<CreateSessionResponse>(
      `${environment.apiUrl}/renders/create-session`,
      { filename, contentType }
    );
  }

  async uploadToS3(uploadUrl: string, file: File): Promise<void> {
    const resp = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });
    if (!resp.ok)
      throw new Error(`Upload failed: ${resp.status} ${resp.statusText}`);
  }
}
