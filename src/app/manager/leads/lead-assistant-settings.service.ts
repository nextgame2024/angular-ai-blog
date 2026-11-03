import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
export interface CoverageWindow {
  day: number;
  start: string;
  end: string;
}
export interface AssistantSettings {
  businessName: string;
  contactName: string;
  supportContact: string;
  enquiryOwnerId: string | null;
  contentOwnerId: string | null;
  fallbackOwnerId: string | null;
  advisorIds: string[];
  timezone: string;
  coverage: CoverageWindow[];
  closedDates: string[];
  afterHoursMessage: string;
  greeting: string;
  defaultLanguage: string;
  languages: string[];
}
export interface StaffOption {
  id: string;
  name: string;
}
export interface SettingsState {
  revision: number;
  configuration: AssistantSettings;
  updatedAt: string | null;
  published: {
    release_id: string;
    source_revision: number;
    published_at: string;
  } | null;
  staff?: StaffOption[];
  hasMoreStaff?: boolean;
  publicationIssues?: string[];
  canManage: boolean;
  connection: {
    status: 'not_connected';
    numberUsage: 'business_app';
    coexistenceVerified: false;
  };
}
@Injectable({ providedIn: 'root' })
export class LeadAssistantSettingsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/bm/lead-assistant`;
  load() {
    return this.http.get<SettingsState>(`${this.base}/settings`);
  }
  staff(q: string) {
    return this.http.get<{ staff: StaffOption[]; hasMore: boolean }>(
      `${this.base}/staff`,
      { params: { q } },
    );
  }
  save(expectedRevision: number, configuration: AssistantSettings) {
    return this.http.put<SettingsState>(`${this.base}/settings`, {
      expectedRevision,
      configuration,
    });
  }
  publish(expectedRevision: number) {
    return this.http.post<SettingsState>(`${this.base}/settings/publish`, {
      expectedRevision,
    });
  }
}
