import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { switchMap, map } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class AvatarUploadService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl;

  uploadViaPresigned(file: File) {
    const contentType = file.type || 'application/octet-stream';
    return this.http
      .post<{ uploadUrl: string; objectKey: string; publicUrl: string }>(
        `${this.baseUrl}/uploads/presign`,
        { filename: file.name, contentType }
      )
      .pipe(
        switchMap(({ uploadUrl, publicUrl }) =>
          this.http
            .put(uploadUrl, file, {
              headers: new HttpHeaders({ 'Content-Type': contentType }),
              responseType: 'text' as const,
            })
            .pipe(map(() => ({ url: publicUrl })))
        )
      );
  }
}
