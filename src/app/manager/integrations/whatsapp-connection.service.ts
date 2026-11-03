import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
export interface WhatsAppChannelState {
  mode: 'receive_only';
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
