import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { switchMap, map } from 'rxjs';
import { environment } from 'src/environments/environment';

type PresignResponse =
  | {
      method: 'POST';
      postUrl: string;
      fields: Record<string, string>;
      objectKey: string;
      publicUrl?: string;
    }
  | {
      method: 'PUT';
      uploadUrl: string;
      objectKey: string;
      publicUrl?: string;
    };

@Injectable({ providedIn: 'root' })
export class AvatarUploadService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl;

  uploadViaPresigned(file: File, folder = 'public/avatars') {
    const contentType = file.type || 'application/octet-stream';

    return this.http
      .post<PresignResponse>(`${this.baseUrl}/uploads/presign`, {
        filename: file.name,
        contentType,
        folder,
        strategy: 'post',
      })
      .pipe(
        switchMap((resp) => {
          const publicUrl = String(resp.publicUrl || '').trim();
          if (!publicUrl) {
            throw new Error('Upload response did not include a public image URL');
          }

          if (resp.method === 'POST') {
            // Build Presigned POST form and send directly to S3.
            // The interceptor will NOT attach Authorization because the URL is S3, not environment.apiUrl.
            const form = new FormData();
            Object.entries(resp.fields).forEach(([k, v]) => form.append(k, v));
            form.append('file', file);
            return this.http
              .post(resp.postUrl, form, { responseType: 'text' as const })
              .pipe(map(() => ({ url: publicUrl })));
          } else {
            // Fallback if you opt into strategy: 'put'
            const headers = new HttpHeaders({ 'Content-Type': contentType });
            return this.http
              .put(resp.uploadUrl, file, {
                headers,
                responseType: 'text' as const,
              })
              .pipe(map(() => ({ url: publicUrl })));
          }
        })
      );
  }
}
