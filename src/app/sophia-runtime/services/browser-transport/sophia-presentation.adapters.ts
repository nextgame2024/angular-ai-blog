import { inject, Injectable } from '@angular/core';

import { SophiaLiveAvatarClientService } from '../sophia-liveavatar-client.service';
import { SophiaSimliClientService } from '../sophia-simli-client.service';
import type {
  SophiaPresentationAdapter,
  SophiaPresentationConnectRequest,
} from './sophia-browser-transport.types';

@Injectable()
export class SophiaStaticPresentationAdapter
  implements SophiaPresentationAdapter
{
  readonly manifest = {
    adapterKey: 'static-presentation-v1',
    audibleOutput: () => 'remote-audio' as const,
  };

  async connect(request: SophiaPresentationConnectRequest): Promise<void> {
    request.onStatus('Static image', false);
  }

  attachRemoteStream(): void {}
  appendAudio(): void {}
  completeAudio(): void {}
  speakText(): void {}
  interrupt(): void {}
  async disconnect(): Promise<void> {}
}

@Injectable()
export class SophiaSimliPresentationAdapter
  implements SophiaPresentationAdapter
{
  private readonly client = inject(SophiaSimliClientService);
  private audioBridge: SophiaPresentationConnectRequest['audioBridge'] =
    'webrtc-track';

  readonly manifest = {
    adapterKey: 'simli-presentation-v1',
    audibleOutput: (audioBridge: SophiaPresentationConnectRequest['audioBridge']) =>
      audioBridge === 'webrtc-track'
        ? ('avatar-audio' as const)
        : ('remote-audio' as const),
  };

  async connect(request: SophiaPresentationConnectRequest): Promise<void> {
    const token = request.bootstrap.sessionToken;
    if (!token) {
      throw new Error(
        request.bootstrap.error || 'Avatar connection is not configured.',
      );
    }
    this.audioBridge = request.audioBridge;
    await this.client.connect({
      sessionToken: token,
      transportMode: request.bootstrap.transportMode,
      playAudio: request.audioBridge === 'webrtc-track',
      videoElement: request.media.avatarVideo,
      audioElement: request.media.avatarAudio,
      onStatus: (status) =>
        request.onStatus(status, status === 'Avatar connected'),
      onEvent: request.onEvent,
      onSpeakingChange: request.onSpeakingChange,
    });
  }

  attachRemoteStream(stream: MediaStream): void {
    if (this.audioBridge === 'webrtc-track') {
      this.client.attachAudioStream(stream);
      return;
    }
    void this.client.attachPcmAudioStream(stream);
  }

  appendAudio(): void {}
  completeAudio(): void {}
  speakText(): void {}
  interrupt(): void {
    this.client.clearBuffer();
  }
  async disconnect(): Promise<void> {
    await this.client.disconnect();
  }
}

@Injectable()
export class SophiaLiveAvatarPresentationAdapter
  implements SophiaPresentationAdapter
{
  private readonly client = inject(SophiaLiveAvatarClientService);
  private mode: SophiaPresentationConnectRequest['bootstrap']['mode'];

  readonly manifest = {
    adapterKey: 'live-avatar-presentation-v1',
    audibleOutput: () => 'avatar-video' as const,
  };

  async connect(request: SophiaPresentationConnectRequest): Promise<void> {
    const token = request.bootstrap.sessionToken;
    if (!token) {
      throw new Error(
        request.bootstrap.error || 'Avatar connection is not configured.',
      );
    }
    this.mode = request.bootstrap.mode;
    await this.client.connect({
      sessionToken: token,
      videoElement: request.media.avatarVideo,
      onStatus: (status) =>
        request.onStatus(status, status === 'Avatar connected'),
      onEvent: request.onEvent,
      onSpeakingChange: request.onSpeakingChange,
    });
  }

  attachRemoteStream(): void {}
  appendAudio(audio: Uint8Array): void {
    if (this.mode === 'LITE') this.client.appendAudio(audio);
  }
  completeAudio(): void {
    if (this.mode === 'LITE') this.client.sendBufferedAudio();
  }
  speakText(text: string): void {
    if (this.mode === 'FULL') this.client.speakText(text);
  }
  interrupt(): void {
    this.client.interrupt();
  }
  async disconnect(): Promise<void> {
    this.mode = undefined;
    await this.client.disconnect();
  }
}
