import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
export interface WhatsAppChannelState {
  mode: 'receive_only' | 'replies_available';
  profiles: { id: string; label: string; ready: boolean }[];
  channels: {
    channelId: string;
    profileId: string;
    enabled: boolean;
    revision: number;
    lastReceivedAt: string | null;
  }[];
  health: { queued: number; failed: number; oldestQueuedAt: string | null };
}
@Injectable({ providedIn: 'root' })
export class WhatsAppConnectionService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/bm/lead-assistant/channel`;
  responses() {
    return this.http.get<{
      releases: { id: string; label: string; version: number }[];
      bindings: {
        profileId: string;
        releaseId: string;
        mode: string;
        revision: number;
      }[];
    }>(`${environment.apiUrl}/bm/lead-assistant/responses`);
  }
  bindResponse(
    profileId: string,
    releaseId: string,
    mode: string,
    expectedRevision: number,
  ) {
    return this.http.put<{ revision: number }>(
      `${environment.apiUrl}/bm/lead-assistant/responses`,
      { profileId, releaseId, mode, expectedRevision },
    );
  }
  load() {
    return this.http.get<WhatsAppChannelState>(this.base);
  }
  save(profileId: string, expectedRevision: number, enabled: boolean) {
    return this.http.put<{ revision: number; enabled: boolean }>(this.base, {
      profileId,
      expectedRevision,
      enabled,
    });
  }
}
