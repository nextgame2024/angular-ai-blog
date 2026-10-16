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
  city: string | null;
  category: string | null;
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

export interface BmCollegeSite {
  siteId: string;
  collegeId: string;
  email: string | null;
  address: string | null;
  phone: string | null;
  mobile: string | null;
  city: string | null;
  category: string | null;
  isPrimary: boolean;
}

export type BmCollegeSort = 'name' | 'email' | 'mobile' | 'status';

@Injectable()
export class ManagerCollegesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/bm/colleges`;

  list(q = '', page = 1, limit = 25, sort: BmCollegeSort = 'name', direction: 'asc' | 'desc' = 'asc'): Observable<{ colleges: BmCollege[]; total: number; page: number; limit: number }> {
    let params = new HttpParams().set('page', page).set('limit', limit).set('sort', sort).set('direction', direction);
    if (q) params = params.set('q', q);
    return this.http.get<{ colleges: BmCollege[]; total: number; page: number; limit: number }>(this.base, { params });
  }

  create(value: object) { return this.http.post<{ college: BmCollege }>(this.base, { college: value }); }
  get(id: string) { return this.http.get<{ college: BmCollege }>(`${this.base}/${id}`); }
  update(id: string, value: object) { return this.http.put<{ college: BmCollege }>(`${this.base}/${id}`, { college: value }); }
  archive(id: string) { return this.http.delete<void>(`${this.base}/${id}`); }
  contacts(id: string) { return this.http.get<{ contacts: BmCollegeContact[] }>(`${this.base}/${id}/contacts`); }
  createContact(id: string, value: object) { return this.http.post<{ contact: BmCollegeContact }>(`${this.base}/${id}/contacts`, { contact: value }); }
  updateContact(id: string, contactId: string, value: object) { return this.http.put<{ contact: BmCollegeContact }>(`${this.base}/${id}/contacts/${contactId}`, { contact: value }); }
  deleteContact(id: string, contactId: string) { return this.http.delete<void>(`${this.base}/${id}/contacts/${contactId}`); }
  sites(id: string) { return this.http.get<{ sites: BmCollegeSite[] }>(`${this.base}/${id}/sites`); }
  createSite(id: string, value: object) { return this.http.post<{ site: BmCollegeSite }>(`${this.base}/${id}/sites`, { site: value }); }
  updateSite(id: string, siteId: string, value: object) { return this.http.put<{ site: BmCollegeSite }>(`${this.base}/${id}/sites/${siteId}`, { site: value }); }
  deleteSite(id: string, siteId: string) { return this.http.delete<void>(`${this.base}/${id}/sites/${siteId}`); }
}
