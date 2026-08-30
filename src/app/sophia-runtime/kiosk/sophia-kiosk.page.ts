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
import { FormsModule } from '@angular/forms';
import { firstValueFrom, finalize } from 'rxjs';

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
import type {
  InventoryToolOutput,
  SophiaRuntimeSessionResponse,
} from '../types/sophia-runtime.types';

type RuntimeViewState = 'idle' | 'starting' | 'active' | 'closing' | 'error';

@Component({
  selector: 'app-sophia-kiosk-page',
  imports: [CommonModule, FormsModule],
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
  readonly inventoryResult$$ = signal<InventoryToolOutput | null>(null);
  readonly productId$$ = signal('demo-product');
  readonly colour$$ = signal('black');
  readonly isToolRunning$$ = signal(false);
  readonly isVoiceConnected$$ = signal(false);
  readonly voiceStatus$$ = signal('Voice disconnected');
  readonly avatarStatus$$ = signal('Avatar disconnected');
  readonly avatarAudioBridge$$ = signal<SophiaAvatarAudioBridge>('webrtc-track');
  readonly isAvatarConnected$$ = signal(false);
  readonly realtimeEvents$$ = signal<string[]>([]);

  readonly session$$ = computed(() => this.sessionResponse$$()?.session ?? null);
  readonly providerSummary$$ = computed(() => {
    const response = this.sessionResponse$$();
    if (!response) return 'Runtime not connected';
    return `${response.ai.provider} / ${response.avatar.provider}`;
  });
  readonly canStart$$ = computed(() => this.state$$() === 'idle' || this.state$$() === 'error');
  readonly canUseTools$$ = computed(() => this.session$$()?.status === 'active');
  readonly canConnectVoice$$ = computed(() => {
    const response = this.sessionResponse$$();
    return Boolean(response?.ai.clientSecret && this.canUseTools$$() && !this.isVoiceConnected$$());
  });
  readonly canConnectAvatar$$ = computed(() => {
    const response = this.sessionResponse$$();
    return Boolean(response?.avatar.sessionToken && this.canUseTools$$() && !this.isAvatarConnected$$());
  });

  startSession(): void {
    if (!this.canStart$$()) return;

    this.error$$.set(null);
    this.inventoryResult$$.set(null);
    this.state$$.set('starting');

    this.runtime
      .createSession({
        deviceId: '22222222-2222-4222-8222-222222222222',
        storeId: 'demo-store',
        createdByUserId: 'angular-kiosk',
      })
      .subscribe({
        next: (response) => {
          this.sessionResponse$$.set(response);
          this.state$$.set('active');
          this.voiceStatus$$.set(
            response.ai.clientSecret
              ? 'Ready to connect microphone'
              : 'OpenAI client secret missing',
          );
          this.avatarStatus$$.set(
            response.avatar.sessionToken
              ? 'Ready to connect avatar'
              : 'Simli session token missing',
          );
        },
        error: (error) => this.handleError(error, 'Could not start Sophia Runtime session.'),
      });
  }

  async connectVoice(): Promise<void> {
    const response = this.sessionResponse$$();
    const session = response?.session;
    const clientSecret = response?.ai.clientSecret;
    if (!session || !clientSecret || this.isVoiceConnected$$()) return;

    this.error$$.set(null);

    try {
      await this.realtime.connect({
        clientSecret,
        onRemoteStream: (stream) => this.attachRemoteAudio(stream),
        onAudioDelta: (audioData) => this.forwardRealtimeAudioToAvatar(audioData),
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
      this.handleError(error, 'Could not connect microphone to OpenAI Realtime.');
    }
  }

  async connectAvatar(): Promise<void> {
    const response = this.sessionResponse$$();
    const videoElement = this.simliVideo?.nativeElement;
    const audioElement = this.simliAudio?.nativeElement;
    const sessionToken = response?.avatar.sessionToken;
    if (!sessionToken || !videoElement || !audioElement || this.isAvatarConnected$$()) {
      return;
    }

    this.error$$.set(null);

    try {
      await this.simli.connect({
        sessionToken,
        transportMode: response?.avatar.transportMode,
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
      this.handleError(error, 'Could not connect Simli avatar.');
    }
  }

  async disconnectAvatar(): Promise<void> {
    await this.simli.disconnect();
    this.isAvatarConnected$$.set(false);
    this.avatarStatus$$.set('Avatar disconnected');
    this.syncAudioPlaybackRoute();
  }

  async disconnectVoice(): Promise<void> {
    await this.realtime.disconnect();
    this.remoteOutputStream = null;
    this.simli.clearBuffer();
    this.isVoiceConnected$$.set(false);
    this.voiceStatus$$.set('Voice disconnected');
  }

  runInventoryCheck(): void {
    const session = this.session$$();
    if (!session || this.isToolRunning$$()) return;

    this.error$$.set(null);
    this.isToolRunning$$.set(true);

    this.runtime
      .executeTool(session.sessionId, {
        toolName: 'getInventory',
        input: {
          productId: this.productId$$().trim(),
          colour: this.colour$$().trim() || undefined,
        },
      })
      .pipe(finalize(() => this.isToolRunning$$.set(false)))
      .subscribe({
        next: (response) => {
          this.inventoryResult$$.set(response.output as InventoryToolOutput);
        },
        error: (error) => this.handleError(error, 'Inventory tool call failed.'),
      });
  }

  closeSession(): void {
    const session = this.session$$();
    if (!session || this.state$$() === 'closing') return;

    this.error$$.set(null);
    this.state$$.set('closing');

    void this.disconnectVoice();
    void this.disconnectAvatar();

    this.runtime.closeSession(session.sessionId).subscribe({
      next: ({ session: closedSession }) => {
        const current = this.sessionResponse$$();
        if (current) {
          this.sessionResponse$$.set({ ...current, session: closedSession });
        }
        this.state$$.set('idle');
      },
      error: (error) => this.handleError(error, 'Could not close the runtime session.'),
    });
  }

  ngOnDestroy(): void {
    void this.realtime.disconnect();
    void this.simli.disconnect();
  }

  ngOnInit(): void {
    void this.runtimeConfig.resolveAvatarAudioBridge().then((bridge) => {
      this.avatarAudioBridge$$.set(bridge);
    });
  }

  setProductId(value: string): void {
    this.productId$$.set(value);
  }

  setColour(value: string): void {
    this.colour$$.set(value);
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
    if (this.avatarAudioBridge$$() !== 'webrtc-track') return;
    this.simli.attachAudioStream(stream);
  }

  private forwardRealtimeAudioToAvatar(audioData: Uint8Array): void {
    if (this.avatarAudioBridge$$() !== 'direct-simli') return;
    this.simli.sendOpenAiPcm16AudioDataImmediate(audioData);
  }

  private syncAudioPlaybackRoute(): void {
    const remoteAudio = this.remoteAudio?.nativeElement;
    const simliAudio = this.simliAudio?.nativeElement;
    const useAvatarAudio = this.isAvatarConnected$$();

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

    if (toolCall.name === 'getInventory') {
      this.inventoryResult$$.set(response.output as InventoryToolOutput);
    }

    return response.output;
  }
}
