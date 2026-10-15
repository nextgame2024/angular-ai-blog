import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface BmCollege {
  collegeId: string;
  collegeName: string;
  ownerName: string | null;
  abn: string | null;
  address: string | null;
  email: string | null;
  cel: string | null;
  tel: string | null;
  notes: string | null;
  status: 'active' | 'archived';
}

export interface BmCollegeContact {
  contactId: string;
  collegeId: string;
  name: string;
  roleTitle: string | null;
  email: string | null;
  cel: string | null;
  tel: string | null;
}

@Injectable()
export class ManagerCollegesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/bm/colleges`;

  list(q = '', page = 1): Observable<{ colleges: BmCollege[]; total: number; page: number; limit: number }> {
    let params = new HttpParams().set('page', page).set('limit', 20);
    if (q) params = params.set('q', q);
    return this.http.get<{ colleges: BmCollege[]; total: number; page: number; limit: number }>(this.base, { params });
  }

  create(value: object) { return this.http.post<{ college: BmCollege }>(this.base, { college: value }); }
  update(id: string, value: object) { return this.http.put<{ college: BmCollege }>(`${this.base}/${id}`, { college: value }); }
  archive(id: string) { return this.http.delete<void>(`${this.base}/${id}`); }
  contacts(id: string) { return this.http.get<{ contacts: BmCollegeContact[] }>(`${this.base}/${id}/contacts`); }
  createContact(id: string, value: object) { return this.http.post<{ contact: BmCollegeContact }>(`${this.base}/${id}/contacts`, { contact: value }); }
  updateContact(id: string, contactId: string, value: object) { return this.http.put<{ contact: BmCollegeContact }>(`${this.base}/${id}/contacts/${contactId}`, { contact: value }); }
  deleteContact(id: string, contactId: string) { return this.http.delete<void>(`${this.base}/${id}/contacts/${contactId}`); }
}
