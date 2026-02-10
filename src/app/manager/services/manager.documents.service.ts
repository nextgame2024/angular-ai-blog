import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { BmDocument, PagedDocumentsResult } from '../types/documents.interface';

@Injectable({ providedIn: 'root' })
export class ManagerDocumentsService {
  private apiBase = environment.apiUrl;

  constructor(private http: HttpClient) {}

  listDocuments(params: {
    q?: string;
    status?: string;
    type?: 'quote' | 'invoice';
    clientId?: string;
    projectId?: string;
    page?: number;
    limit?: number;
  }): Observable<PagedDocumentsResult> {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      httpParams = httpParams.set(key, String(value));
    });
    return this.http.get<PagedDocumentsResult>(
      `${this.apiBase}/bm/documents`,
      { params: httpParams },
    );
  }

  getDocument(documentId: string): Observable<{ document: BmDocument }> {
    return this.http.get<{ document: BmDocument }>(
      `${this.apiBase}/bm/documents/${documentId}`,
    );
  }
}
