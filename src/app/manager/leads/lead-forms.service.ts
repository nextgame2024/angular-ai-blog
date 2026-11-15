import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
export type BlockKind =
  | 'title'
  | 'subtitle'
  | 'question'
  | 'description'
  | 'checkboxes'
  | 'list'
  | 'input'
  | 'calendar';
export interface FormCalendar {
  advisorId: string;
  timezone: string;
  weeklyHours: { day: number; start: string; end: string }[];
}
export interface FormBlock {
  id: string;
  kind: BlockKind;
  text: string;
  required: boolean;
  options: string[];
  calendar?: FormCalendar;
}
export interface LeadForm {
  id: string;
  name: string;
  typeId: string;
  blocks: FormBlock[];
  version: number;
}
export interface FormRow {
  id: string;
  name: string;
  typeId: string;
  typeName: string;
  version: number;
  updatedAt: string;
}
export interface FormType {
  id: string;
  name: string;
  formCount: number;
}
@Injectable({ providedIn: 'root' })
export class LeadFormsService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/bm/lead-assistant`;
  types() {
    return this.http.get<{ items: FormType[] }>(`${this.base}/form-types`);
  }
  createType(name: string) {
    return this.http.post<FormType>(`${this.base}/form-types`, { name });
  }
  deleteType(id: string) {
    return this.http.delete(`${this.base}/form-types/${id}`);
  }
  list(params: {
    page: number;
    limit: number;
    q: string;
    typeId: string;
    sort: string;
    direction: string;
  }) {
    return this.http.get<{ items: FormRow[]; total: number }>(
      `${this.base}/forms`,
      { params },
    );
  }
  detail(id: string) {
    return this.http.get<LeadForm>(`${this.base}/forms/${id}`);
  }
  save(value: LeadForm) {
    const { id, version, ...form } = value;
    return this.http.put<LeadForm>(`${this.base}/forms/${id}`, {
      expectedVersion: version,
      form,
    });
  }
  publish(form: LeadForm) {
    return this.http.post<{ token: string }>(
      `${this.base}/forms/${form.id}/publish`,
      { expectedVersion: form.version },
    );
  }
  publication(id: string) {
    return this.http.get<{ token: string | null; version: number | null }>(
      `${this.base}/forms/${id}/publication`,
    );
  }
  unpublish(id: string) {
    return this.http.delete(`${this.base}/forms/${id}/publication`);
  }
  delete(row: FormRow) {
    return this.http.delete(`${this.base}/forms/${row.id}`, {
      body: { expectedVersion: row.version },
    });
  }
}
