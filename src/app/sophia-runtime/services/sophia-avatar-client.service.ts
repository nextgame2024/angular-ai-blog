import { Injectable, inject } from '@angular/core';

import type { SophiaAvatarProvider } from '../types/sophia-runtime.types';
import type { SophiaAvatarAudioBridge } from './sophia-runtime-config.service';
import { SophiaLiveAvatarClientService } from './sophia-liveavatar-client.service';
import { SophiaSimliClientService } from './sophia-simli-client.service';

type ActiveAvatarProvider = Exclude<SophiaAvatarProvider, 'none' | 'tavus'>;

export interface SophiaAvatarConnectRequest {
  provider: ActiveAvatarProvider;
  sessionToken: string;
  transportMode?: 'livekit' | 'p2p';
  audioBridge: SophiaAvatarAudioBridge;
  videoElement: HTMLVideoElement;
  audioElement: HTMLAudioElement;
  onStatus(status: string): void;
  onEvent(event: string): void;
  onSpeakingChange?(speaking: boolean): void;
}

@Injectable()
export class SophiaAvatarClientService {
  private readonly simli = inject(SophiaSimliClientService);
  private readonly liveAvatar = inject(SophiaLiveAvatarClientService);
  private activeProvider: ActiveAvatarProvider | null = null;
  private audioBridge: SophiaAvatarAudioBridge = 'webrtc-track';

  async connect(request: SophiaAvatarConnectRequest): Promise<void> {
    await this.disconnect();
    this.activeProvider = request.provider;
    this.audioBridge = request.audioBridge;

    try {
      if (request.provider === 'simli') {
        await this.simli.connect({
          sessionToken: request.sessionToken,
          transportMode: request.transportMode,
          playAudio: request.audioBridge === 'webrtc-track',
          videoElement: request.videoElement,
          audioElement: request.audioElement,
          onStatus: request.onStatus,
          onEvent: request.onEvent,
          onSpeakingChange: request.onSpeakingChange,
        });
        return;
      }

      await this.liveAvatar.connect({
        sessionToken: request.sessionToken,
        videoElement: request.videoElement,
        onStatus: request.onStatus,
        onEvent: request.onEvent,
        onSpeakingChange: request.onSpeakingChange,
      });
    } catch (error) {
      if (request.provider === 'simli') {
        await this.simli.disconnect();
      } else {
        await this.liveAvatar.disconnect();
      }
      this.activeProvider = null;
      throw error;
    }
  }

  attachRemoteStream(stream: MediaStream): void {
    if (this.activeProvider !== 'simli') return;
    if (this.audioBridge === 'webrtc-track') {
      this.simli.attachAudioStream(stream);
      return;
    }
    void this.simli.attachPcmAudioStream(stream);
  }

  appendOpenAiAudio(audioData: Uint8Array): void {
    if (this.activeProvider === 'liveavatar') {
      this.liveAvatar.appendAudio(audioData);
    }
  }

  completeOpenAiAudio(): void {
    if (this.activeProvider === 'liveavatar') {
      this.liveAvatar.sendBufferedAudio();
    }
  }

  speakText(text: string): void {
    if (this.activeProvider === 'liveavatar') {
      this.liveAvatar.speakText(text);
    }
  }

  clearBuffer(): void {
    this.simli.clearBuffer();
    this.liveAvatar.clearBuffer();
  }

  async disconnect(): Promise<void> {
    const activeProvider = this.activeProvider;
    this.activeProvider = null;
    this.clearBuffer();
    if (activeProvider === 'simli') {
      await this.simli.disconnect();
    } else if (activeProvider === 'liveavatar') {
      await this.liveAvatar.disconnect();
    }
  }
}
