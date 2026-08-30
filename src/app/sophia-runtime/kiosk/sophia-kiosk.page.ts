import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';

import {
  SophiaRealtimeClientService,
  type SophiaRealtimeToolCall,
} from '../services/sophia-realtime-client.service';
import {
  SophiaRuntimeConfigService,
  type SophiaAvatarAudioBridge,
} from '../services/sophia-runtime-config.service';
import { SophiaRuntimeSessionService } from '../services/sophia-runtime-session.service';
import { SophiaSimliClientService } from '../services/sophia-simli-client.service';
import type { SophiaRuntimeSessionResponse } from '../types/sophia-runtime.types';

type RuntimeViewState = 'idle' | 'starting' | 'active' | 'closing' | 'error';

@Component({
  selector: 'app-sophia-kiosk-page',
  imports: [CommonModule],
  templateUrl: './sophia-kiosk.page.html',
  styleUrls: ['./sophia-kiosk.page.css'],
})
export class SophiaKioskPageComponent implements OnInit, OnDestroy {
  private readonly runtimeConfig = inject(SophiaRuntimeConfigService);
  private readonly runtime = inject(SophiaRuntimeSessionService);
  private readonly realtime = inject(SophiaRealtimeClientService);
  private readonly simli = inject(SophiaSimliClientService);
  private remoteOutputStream: MediaStream | null = null;

  @ViewChild('remoteAudio') private readonly remoteAudio?: ElementRef<HTMLAudioElement>;
  @ViewChild('simliVideo') private readonly simliVideo?: ElementRef<HTMLVideoElement>;
  @ViewChild('simliAudio') private readonly simliAudio?: ElementRef<HTMLAudioElement>;

  readonly state$$ = signal<RuntimeViewState>('idle');
  readonly error$$ = signal<string | null>(null);
  readonly sessionResponse$$ = signal<SophiaRuntimeSessionResponse | null>(null);
  readonly isVoiceConnected$$ = signal(false);
  readonly voiceStatus$$ = signal('Voice disconnected');
  readonly avatarStatus$$ = signal('Avatar disconnected');
  readonly avatarAudioBridge$$ = signal<SophiaAvatarAudioBridge>('webrtc-track');
  readonly isAvatarConnected$$ = signal(false);
  readonly isAvatarUnavailable$$ = signal(false);
  readonly realtimeEvents$$ = signal<string[]>([]);

  readonly session$$ = computed(() => this.sessionResponse$$()?.session ?? null);
  readonly canStart$$ = computed(() => {
    const state = this.state$$();
    return (state === 'idle' || state === 'error') && this.session$$()?.status !== 'active';
  });
  readonly canFinish$$ = computed(() => {
    const state = this.state$$();
    return this.session$$()?.status === 'active' && (state === 'active' || state === 'error');
  });
  readonly runtimeStatus$$ = computed(() => {
    const state = this.state$$();
    if (state === 'starting') return 'Starting Sophia';
    if (state === 'closing') return 'Finishing session';
    if (state === 'error') return 'Connection needs attention';
    if (this.isVoiceConnected$$() && this.isAvatarConnected$$()) {
      return 'Sophia is ready';
    }
    if (this.isVoiceConnected$$() && this.isAvatarUnavailable$$()) {
      return 'Voice ready - avatar unavailable';
    }
    if (state === 'active') return 'Connecting voice';
    return 'Ready to start';
  });

  async startSession(): Promise<void> {
    if (!this.canStart$$()) return;

    this.error$$.set(null);
    this.isAvatarUnavailable$$.set(false);
    this.realtimeEvents$$.set([]);
    this.state$$.set('starting');

    try {
      const response = await firstValueFrom(
        this.runtime.createSession({
          deviceId: '22222222-2222-4222-8222-222222222222',
          storeId: 'demo-store',
          createdByUserId: 'angular-kiosk',
        }),
      );

      this.sessionResponse$$.set(response);
      this.voiceStatus$$.set(
        response.ai.clientSecret
          ? 'Connecting microphone'
          : 'OpenAI client secret missing',
      );
      this.avatarStatus$$.set(
        response.avatar.sessionToken
          ? 'Connecting avatar'
          : 'Simli session token missing',
      );

      const [voiceConnection, avatarConnection] = await Promise.allSettled([
        this.connectVoice(),
        this.connectAvatar(),
      ]);

      if (voiceConnection.status === 'rejected') {
        if (avatarConnection.status === 'fulfilled') {
          await this.disconnectAvatar();
        }
        throw new Error(formatError(voiceConnection.reason));
      }

      if (avatarConnection.status === 'rejected') {
        this.isAvatarUnavailable$$.set(true);
        this.avatarStatus$$.set('Avatar unavailable');
      }

      this.state$$.set('active');
    } catch (error) {
      this.handleError(error, 'Could not start Sophia.');
    }
  }

  async finishSession(): Promise<void> {
    const session = this.session$$();
    if (!session || !this.canFinish$$()) return;

    this.error$$.set(null);
    this.state$$.set('closing');

    await Promise.allSettled([
      this.disconnectVoice(),
      this.disconnectAvatar(),
    ]);

    try {
      await firstValueFrom(this.runtime.closeSession(session.sessionId));
      this.sessionResponse$$.set(null);
      this.isAvatarUnavailable$$.set(false);
      this.realtimeEvents$$.set([]);
      this.state$$.set('idle');
    } catch (error) {
      this.handleError(error, 'Could not finish the runtime session.');
    }
  }

  private async connectVoice(): Promise<void> {
    const response = this.sessionResponse$$();
    const session = response?.session;
    const clientSecret = response?.ai.clientSecret;
    if (!session || !clientSecret) {
      throw new Error('OpenAI voice connection is not configured.');
    }

    try {
      await this.realtime.connect({
        clientSecret,
        onRemoteStream: (stream) => this.attachRemoteAudio(stream),
        onEvent: (event) => this.recordRealtimeEvent(event),
        onStatus: (status) => {
          this.voiceStatus$$.set(status);
          if (status === 'connected' || status === 'Realtime connected') {
            this.isVoiceConnected$$.set(true);
          }
        },
        onToolCall: (toolCall) => this.executeRealtimeTool(session.sessionId, toolCall),
      });
    } catch (error) {
      await this.realtime.disconnect();
      this.isVoiceConnected$$.set(false);
      this.voiceStatus$$.set('Voice connection failed');
      throw new Error(`Voice: ${formatError(error)}`);
    }
  }

  private async connectAvatar(): Promise<void> {
    const response = this.sessionResponse$$();
    const videoElement = this.simliVideo?.nativeElement;
    const audioElement = this.simliAudio?.nativeElement;
    const sessionToken = response?.avatar.sessionToken;
    if (!sessionToken || !videoElement || !audioElement) {
      throw new Error('Simli avatar connection is not configured.');
    }

    try {
      await this.simli.connect({
        sessionToken,
        transportMode: response?.avatar.transportMode,
        playAudio: this.avatarAudioBridge$$() === 'webrtc-track',
        videoElement,
        audioElement,
        onStatus: (status) => {
          this.avatarStatus$$.set(status);
          const isConnected = status === 'Avatar connected';
          this.isAvatarConnected$$.set(isConnected);
          this.syncAudioPlaybackRoute();
        },
        onEvent: (event) => this.recordRealtimeEvent({ type: event }),
      });
      if (this.remoteOutputStream) {
        this.attachRemoteStreamToAvatar(this.remoteOutputStream);
      }
    } catch (error) {
      await this.simli.disconnect();
      this.isAvatarConnected$$.set(false);
      this.avatarStatus$$.set('Avatar connection failed');
      throw new Error(`Avatar: ${formatError(error)}`);
    }
  }

  private async disconnectAvatar(): Promise<void> {
    await this.simli.disconnect();
    this.isAvatarConnected$$.set(false);
    this.avatarStatus$$.set('Avatar disconnected');
    this.syncAudioPlaybackRoute();
  }

  private async disconnectVoice(): Promise<void> {
    await this.realtime.disconnect();
    this.remoteOutputStream = null;
    this.simli.clearBuffer();
    this.isVoiceConnected$$.set(false);
    this.voiceStatus$$.set('Voice disconnected');
  }

  /*
    Runtime tool calls remain available to OpenAI even though the scanner controls
    are intentionally hidden from the kiosk UI.
  */
  private async executeRealtimeTool(
    sessionId: string,
    toolCall: SophiaRealtimeToolCall,
  ): Promise<unknown> {
    const response = await firstValueFrom(
      this.runtime.executeTool(sessionId, {
        toolName: toolCall.name,
        input: toolCall.arguments,
      }),
    );

    return response.output;
  }

  ngOnDestroy(): void {
    void this.realtime.disconnect();
    void this.simli.disconnect();
  }

  ngOnInit(): void {
    void this.runtimeConfig.resolveAvatarAudioBridge().then((bridge) => {
      this.avatarAudioBridge$$.set(bridge);
      this.syncAudioPlaybackRoute();
      if (this.remoteOutputStream && this.isAvatarConnected$$()) {
        this.attachRemoteStreamToAvatar(this.remoteOutputStream);
      }
    });
  }

  private handleError(error: unknown, fallback: string): void {
    const message =
      typeof error === 'object' && error && 'message' in error
        ? String(error.message)
        : fallback;
    this.error$$.set(message || fallback);
    this.state$$.set('error');
  }

  private attachRemoteAudio(stream: MediaStream): void {
    const audio = this.remoteAudio?.nativeElement;
    if (!audio) return;

    this.remoteOutputStream = stream;
    audio.srcObject = stream;
    this.attachRemoteStreamToAvatar(stream);
    this.syncAudioPlaybackRoute();
    void audio.play().catch(() => {
      this.voiceStatus$$.set('Tap the page to allow audio playback');
    });
  }

  private attachRemoteStreamToAvatar(stream: MediaStream): void {
    if (this.avatarAudioBridge$$() === 'webrtc-track') {
      this.simli.attachAudioStream(stream);
      return;
    }

    void this.simli.attachPcmAudioStream(stream).catch((error: unknown) => {
      const message =
        error instanceof Error ? error.message : 'Unknown audio bridge error';
      this.avatarStatus$$.set(`Avatar audio bridge failed: ${message}`);
    });
  }

  private syncAudioPlaybackRoute(): void {
    const remoteAudio = this.remoteAudio?.nativeElement;
    const simliAudio = this.simliAudio?.nativeElement;
    const useAvatarAudio =
      this.isAvatarConnected$$() && this.avatarAudioBridge$$() === 'webrtc-track';

    if (remoteAudio) {
      remoteAudio.muted = useAvatarAudio;
    }

    if (simliAudio) {
      simliAudio.muted = !useAvatarAudio;
      if (useAvatarAudio) void simliAudio.play().catch(() => undefined);
    }
  }

  private recordRealtimeEvent(event: unknown): void {
    const type =
      typeof event === 'object' && event && 'type' in event
        ? String((event as { type: unknown }).type)
        : 'event';

    const next = [`${new Date().toLocaleTimeString()} ${type}`, ...this.realtimeEvents$$()];
    this.realtimeEvents$$.set(next.slice(0, 6));
  }

}

function formatError(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : 'Unknown connection error.';
}
