import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from 'src/environments/environment';

export type SophiaAvatarAudioBridge = 'webrtc-track' | 'direct-simli';

type SophiaBrowserRuntimeConfig = {
  sophiaAvatarAudioBridge?: string;
};

@Injectable()
export class SophiaRuntimeConfigService {
  constructor(private readonly http: HttpClient) {}

  async resolveAvatarAudioBridge(): Promise<SophiaAvatarAudioBridge> {
    const fromRuntime = await this.readRuntimeConfig();
    return normalizeAvatarAudioBridge(
      fromRuntime?.sophiaAvatarAudioBridge ||
        (environment as { sophiaAvatarAudioBridge?: string })
          .sophiaAvatarAudioBridge,
    );
  }

  private async readRuntimeConfig(): Promise<SophiaBrowserRuntimeConfig | null> {
    try {
      return await firstValueFrom(
        this.http.get<SophiaBrowserRuntimeConfig>('assets/runtime-config.json', {
          headers: new HttpHeaders({
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache',
          }),
          params: new HttpParams().set('v', String(Date.now())),
        }),
      );
    } catch {
      return null;
    }
  }
}

function normalizeAvatarAudioBridge(
  value: string | null | undefined,
): SophiaAvatarAudioBridge {
  return value === 'direct-simli' ? 'direct-simli' : 'webrtc-track';
}
