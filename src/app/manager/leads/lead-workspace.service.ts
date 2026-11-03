import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { StaffOption } from './lead-assistant-settings.service';
export type LeadStage = 'new' | 'qualifying' | 'qualified' | 'closed';
export interface LeadContext {
  actorId: string;
  canManageSettings: boolean;
  canManageLeads: boolean;
  canCreate: boolean;
  settingsPublished: boolean;
  defaultLanguage: string;
  languages: string[];
  defaultAssigneeId: string | null;
  staff: StaffOption[];
  transportReady: false;
}
export interface LeadInput {
  displayName: string;
  email: string;
  phone: string;
  language: string;
  interest: string;
  location: string;
  timeframe: string;
  stage: LeadStage;
  stageReason: string;
  assignedTo: string | null;
}
export interface LeadRow {
  leadId: string;
  displayName: string;
  language: string;
  interest: string;
  stage: LeadStage;
  assignedTo: string | null;
  version: number;
  source: 'manual' | 'whatsapp';
  updatedAt: string;
  conversationId: string;
  ownership: 'paused' | 'human' | 'human_requested' | 'bot';
  humanOwner: string | null;
}
export interface LeadDetail extends LeadRow {
  email: string;
  phone: string;
  location: string;
  timeframe: string;
  stageReason: string;
  createdAt: string;
  ownershipVersion: number;
}
export interface LeadEvent {
  id: string;
  kind: string;
  body: string;
  actorId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}
export interface ReplyState {
  canSend: boolean;
  canResume?: boolean;
  blockedReason: string | null;
  windowEndsAt: string | null;
  optedOut: boolean;
  jobs: {
    id: string;
    state: string;
    answer: string | null;
    sources: string[];
    createdAt: string;
  }[];
  voiceJobs?: {
    id: string;
    kind: string;
    state: string;
    failureCode: string | null;
    createdAt: string;
    canRetry: boolean;
  }[];
  messages: {
    format?: string;
    id: string;
    state: string;
    safeCode: string | null;
    createdAt: string;
  }[];
}
export interface LeadConversation {
  reply?: ReplyState | null;
  lead: LeadDetail;
  events: LeadEvent[];
  hasOlder: boolean;
}
export interface LeadList {
  items: LeadRow[];
  total: number;
  page: number;
  limit: number;
}
@Injectable({ providedIn: 'root' })
export class LeadWorkspaceService {
  retryVoice(id: string, jobId: string) {
    return this.http.post<LeadConversation>(
      `${this.base}/leads/${id}/voice/${jobId}/retry`,
      {},
    );
  }
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/bm/lead-assistant`;
  context() {
    return this.http.get<LeadContext>(`${this.base}/inbox/context`);
  }
  list(params: {
    page: number;
    limit: number;
    q: string;
    stage: string;
    ownership: string;
    sort: string;
    direction: string;
    assignedTo: string;
  }) {
    return this.http.get<LeadList>(`${this.base}/leads`, { params });
  }
  detail(id: string) {
    return this.http.get<LeadConversation>(`${this.base}/leads/${id}`);
  }
  create(requestKey: string, lead: LeadInput) {
    return this.http.post<LeadConversation>(`${this.base}/leads`, {
      requestKey,
      lead,
    });
  }
  update(id: string, expectedVersion: number, lead: LeadInput) {
    return this.http.put<LeadConversation>(`${this.base}/leads/${id}`, {
      expectedVersion,
      lead,
    });
  }
  note(id: string, requestKey: string, body: string) {
    return this.http.post<LeadConversation>(`${this.base}/leads/${id}/notes`, {
      requestKey,
      body,
    });
  }
  reply(id: string, requestKey: string, expectedVersion: number, body: string) {
    return this.http.post<LeadConversation>(
      `${this.base}/leads/${id}/replies`,
      { requestKey, expectedVersion, body },
    );
  }
  draft(id: string, expectedVersion: number) {
    return this.http.post<LeadConversation>(`${this.base}/leads/${id}/draft`, {
      expectedVersion,
    });
  }
  ownership(
    id: string,
    expectedVersion: number,
    ownership: 'human' | 'paused' | 'bot',
  ) {
    return this.http.post<LeadConversation>(
      `${this.base}/leads/${id}/ownership`,
      { expectedVersion, ownership },
    );
  }
  events(id: string, before: string) {
    return this.http.get<{ events: LeadEvent[]; hasOlder: boolean }>(
      `${this.base}/leads/${id}/events`,
      { params: { before } },
    );
  }
}
