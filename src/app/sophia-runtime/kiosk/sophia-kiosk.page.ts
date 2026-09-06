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
import { SophiaAvatarClientService } from '../services/sophia-avatar-client.service';
import { SophiaTavusClientService } from '../services/sophia-tavus-client.service';
import type {
  SophiaAvatarProvider,
  SophiaExperience,
  SophiaInspectionBooking,
  SophiaInspectionSlot,
  SophiaProperty,
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
  private readonly avatar = inject(SophiaAvatarClientService);
  private readonly tavus = inject(SophiaTavusClientService);
  private remoteOutputStream: MediaStream | null = null;

  @ViewChild('remoteAudio')
  private readonly remoteAudio?: ElementRef<HTMLAudioElement>;
  @ViewChild('avatarVideo')
  private readonly avatarVideo?: ElementRef<HTMLVideoElement>;
  @ViewChild('simliAudio')
  private readonly simliAudio?: ElementRef<HTMLAudioElement>;

  readonly state$$ = signal<RuntimeViewState>('idle');
  readonly error$$ = signal<string | null>(null);
  readonly sessionResponse$$ = signal<SophiaRuntimeSessionResponse | null>(
    null,
  );
  readonly isVoiceConnected$$ = signal(false);
  readonly voiceStatus$$ = signal('Voice disconnected');
  readonly avatarStatus$$ = signal('Avatar disconnected');
  readonly avatarAudioBridge$$ =
    signal<SophiaAvatarAudioBridge>('webrtc-track');
  readonly isAvatarConnected$$ = signal(false);
  readonly isAvatarUnavailable$$ = signal(false);
  readonly realtimeEvents$$ = signal<string[]>([]);
  readonly avatarDiagnostics$$ = signal<string[]>([]);
  readonly activeTask$$ = signal<string | null>(null);
  readonly standbyVideoFailed$$ = signal(false);
  readonly propertyResults$$ = signal<SophiaProperty[]>([]);
  readonly selectedProperty$$ = signal<SophiaProperty | null>(null);
  readonly inspectionSlots$$ = signal<SophiaInspectionSlot[]>([]);
  readonly inspectionBooking$$ = signal<SophiaInspectionBooking | null>(null);
  readonly experience$$ = signal<SophiaExperience>('openai');
  readonly avatarOptions: ReadonlyArray<{
    value: SophiaExperience;
    label: string;
  }> = [
    { value: 'openai', label: 'Essential' },
    { value: 'openai-liveavatar-full', label: 'Professional' },
    { value: 'tavus', label: 'Premium' },
  ];

  readonly standbyImage$$ = computed(() => {
    switch (this.experience$$()) {
      case 'openai-liveavatar-full':
        return 'assets/avatars/ProffesionalBG.jpg';
      case 'tavus':
        return 'assets/avatars/PremiumBG.jpg';
      default:
        return 'assets/avatars/SophiaAvatarSIMIL.jpg';
    }
  });

  readonly session$$ = computed(
    () => this.sessionResponse$$()?.session ?? null,
  );
  readonly canStart$$ = computed(() => {
    const state = this.state$$();
    return (
      (state === 'idle' || state === 'error') &&
      this.session$$()?.status !== 'active'
    );
  });
  readonly canFinish$$ = computed(() => {
    const state = this.state$$();
    return (
      this.session$$()?.status === 'active' &&
      (state === 'active' || state === 'error')
    );
  });
  readonly runtimeStatus$$ = computed(() => {
    const state = this.state$$();
    if (this.activeTask$$()) return this.activeTask$$();
    if (state === 'starting') return 'Starting Sophia';
    if (state === 'closing') return 'Finishing session';
    if (state === 'error') return 'Connection needs attention';
    if (this.isVoiceConnected$$() && this.isAvatarConnected$$()) {
      return 'Sophia is ready';
    }
    if (this.isVoiceConnected$$() && this.activeAvatarProvider() === 'none') {
      return 'Sophia is ready';
    }
    if (this.isVoiceConnected$$() && this.isAvatarUnavailable$$()) {
      return 'Voice ready - avatar unavailable';
    }
    if (state === 'active') return 'Connecting voice';
    return 'Ready to start';
  });
  readonly currentMonthInspectionSlots$$ = computed(() => {
    const now = new Date();
    return this.inspectionSlots$$()
      .filter((slot) => {
        const startsAt = new Date(slot.startsAt);
        return (
          startsAt.getFullYear() === now.getFullYear() &&
          startsAt.getMonth() === now.getMonth()
        );
      })
      .sort(
        (left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt),
      );
  });

  async startSession(): Promise<void> {
    if (!this.canStart$$()) return;

    this.error$$.set(null);
    this.isAvatarUnavailable$$.set(false);
    this.realtimeEvents$$.set([]);
    this.avatarDiagnostics$$.set([]);
    this.clearPropertyExperience();
    this.state$$.set('starting');

    try {
      const experience = experienceConfiguration(this.experience$$());
      const response = await firstValueFrom(
        this.runtime.createSession({
          aiProvider: experience.aiProvider,
          deviceId: '22222222-2222-4222-8222-222222222222',
          storeId: 'demo-store',
          createdByUserId: 'angular-kiosk',
          avatarProvider:
            experience.avatarProvider === 'tavus'
              ? undefined
              : experience.avatarProvider,
          avatarMode: experience.avatarMode,
        }),
      );

      this.sessionResponse$$.set(response);
      if (experience.aiProvider === 'tavus-full') {
        try {
          await this.connectTavus(response);
        } catch (error) {
          await this.tavus.disconnect();
          await firstValueFrom(
            this.runtime.closeSession(response.session.sessionId),
          ).catch(() => undefined);
          this.sessionResponse$$.set(null);
          throw error;
        }
        this.state$$.set('active');
        return;
      }

      this.voiceStatus$$.set(
        response.ai.clientSecret
          ? 'Connecting microphone'
          : 'OpenAI client secret missing',
      );
      this.avatarStatus$$.set(
        response.avatar.provider === 'none'
          ? 'Static image'
          : response.avatar.sessionToken
            ? 'Connecting avatar'
            : response.avatar.error || 'Avatar session token missing',
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

      if (
        avatarConnection.status === 'rejected' ||
        (response.avatar.provider !== 'none' && !response.avatar.sessionToken)
      ) {
        this.isAvatarUnavailable$$.set(true);
        this.avatarStatus$$.set(
          response.avatar.error ||
            (avatarConnection.status === 'rejected'
              ? formatError(avatarConnection.reason)
              : 'Avatar unavailable'),
        );
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

    if (session.aiProvider === 'tavus-full') {
      await this.disconnectTavus();
    } else {
      await Promise.allSettled([
        this.disconnectVoice(),
        this.disconnectAvatar(),
      ]);
    }

    try {
      await firstValueFrom(this.runtime.closeSession(session.sessionId));
      this.sessionResponse$$.set(null);
      this.isAvatarUnavailable$$.set(false);
      this.realtimeEvents$$.set([]);
      this.avatarDiagnostics$$.set([]);
      this.clearPropertyExperience();
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
        onAudioDelta: (audio) => this.avatar.appendOpenAiAudio(audio),
        onAudioDone: () => this.avatar.completeOpenAiAudio(),
        onAssistantTextDone: (text) => this.avatar.speakText(text),
        onEvent: (event) => this.recordRealtimeEvent(event),
        onStatus: (status) => {
          this.voiceStatus$$.set(status);
          if (status === 'connected' || status === 'Realtime connected') {
            this.isVoiceConnected$$.set(true);
          }
        },
        onToolCall: (toolCall) =>
          this.executeRealtimeTool(session.sessionId, toolCall),
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
    const provider = response?.avatar.provider;
    if (provider === 'none') {
      this.avatarStatus$$.set('Static image');
      return;
    }
    if (provider === 'tavus') {
      throw new Error('Tavus Full uses its embedded conversation connection.');
    }

    const videoElement = this.avatarVideo?.nativeElement;
    const audioElement = this.simliAudio?.nativeElement;
    const sessionToken = response?.avatar.sessionToken;
    if (!provider || !sessionToken || !videoElement || !audioElement) {
      throw new Error(
        response?.avatar.error || 'Avatar connection is not configured.',
      );
    }

    try {
      await this.avatar.connect({
        provider,
        sessionToken,
        transportMode: response?.avatar.transportMode,
        audioBridge: this.avatarAudioBridge$$(),
        videoElement,
        audioElement,
        onStatus: (status) => {
          this.avatarStatus$$.set(status);
          const isConnected = status === 'Avatar connected';
          this.isAvatarConnected$$.set(isConnected);
          this.syncAudioPlaybackRoute();
        },
        onEvent: (event) => {
          this.recordRealtimeEvent({ type: event });
          this.recordAvatarDiagnostic(event);
        },
        onSpeakingChange: (speaking) => {
          this.realtime.setMicrophoneSuppressed(speaking);
        },
      });
      if (this.remoteOutputStream) {
        this.avatar.attachRemoteStream(this.remoteOutputStream);
      }
    } catch (error) {
      await this.avatar.disconnect();
      this.isAvatarConnected$$.set(false);
      this.avatarStatus$$.set('Avatar connection failed');
      throw new Error(`Avatar: ${formatError(error)}`);
    }
  }

  private async disconnectAvatar(): Promise<void> {
    await this.avatar.disconnect();
    this.realtime.setMicrophoneSuppressed(false);
    this.isAvatarConnected$$.set(false);
    this.avatarStatus$$.set('Avatar disconnected');
    this.syncAudioPlaybackRoute();
  }

  private async disconnectVoice(): Promise<void> {
    await this.realtime.disconnect();
    this.remoteOutputStream = null;
    this.avatar.clearBuffer();
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
    this.activeTask$$.set(toolActivityLabel(toolCall.name));

    try {
      const response = await firstValueFrom(
        this.runtime.executeTool(sessionId, {
          toolName: toolCall.name,
          input: toolCall.arguments,
        }),
      );

      this.handleToolOutput(toolCall.name, response.output);
      return response.output;
    } finally {
      this.activeTask$$.set(null);
    }
  }

  selectProperty(property: SophiaProperty): void {
    this.selectedProperty$$.set(property);
    this.inspectionSlots$$.set([]);
    this.inspectionBooking$$.set(null);
  }

  closePropertyExperience(): void {
    this.clearPropertyExperience();
  }

  formatInspectionTime(value: string): string {
    return new Intl.DateTimeFormat('en-AU', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  }

  bookingSlot(booking: SophiaInspectionBooking): SophiaInspectionSlot | null {
    return (
      this.inspectionSlots$$().find((slot) => slot.slotId === booking.slotId) ||
      null
    );
  }

  formatInspectionDate(value: string): string {
    return new Intl.DateTimeFormat('en-AU', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(new Date(value));
  }

  formatInspectionClock(value: string): string {
    return new Intl.DateTimeFormat('en-AU', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  }

  bookingTime(booking: SophiaInspectionBooking): string | null {
    return booking.startsAt || this.bookingSlot(booking)?.startsAt || null;
  }

  bookingTimeLabel(booking: SophiaInspectionBooking): string | null {
    return (
      booking.startsAtLabel ||
      this.bookingSlot(booking)?.startsAtLabel ||
      (this.bookingTime(booking)
        ? this.formatInspectionTime(this.bookingTime(booking)!)
        : null)
    );
  }

  ngOnDestroy(): void {
    const session = this.session$$();
    if (session?.status === 'active' && session.aiProvider === 'tavus-full') {
      void this.disconnectTavus();
      void firstValueFrom(this.runtime.closeSession(session.sessionId)).catch(
        () => undefined,
      );
    }
    void this.realtime.disconnect();
    void this.avatar.disconnect();
  }

  ngOnInit(): void {
    void this.runtimeConfig.resolveAvatarAudioBridge().then((bridge) => {
      this.avatarAudioBridge$$.set(bridge);
      this.syncAudioPlaybackRoute();
      if (this.remoteOutputStream && this.isAvatarConnected$$()) {
        this.avatar.attachRemoteStream(this.remoteOutputStream);
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
    this.avatar.attachRemoteStream(stream);
    this.syncAudioPlaybackRoute();
    void audio.play().catch(() => {
      this.voiceStatus$$.set('Tap the page to allow audio playback');
    });
  }

  private syncAudioPlaybackRoute(): void {
    const remoteAudio = this.remoteAudio?.nativeElement;
    const simliAudio = this.simliAudio?.nativeElement;
    const provider = this.activeAvatarProvider();
    const useAvatarAudio =
      this.isAvatarConnected$$() &&
      (provider === 'liveavatar' ||
        (provider === 'simli' &&
          this.avatarAudioBridge$$() === 'webrtc-track'));

    if (remoteAudio) {
      remoteAudio.muted = useAvatarAudio;
    }

    if (simliAudio) {
      const useSimliAudio = useAvatarAudio && provider === 'simli';
      simliAudio.muted = !useSimliAudio;
      if (useSimliAudio) void simliAudio.play().catch(() => undefined);
    }
  }

  private activeAvatarProvider(): SophiaAvatarProvider {
    return (
      this.sessionResponse$$()?.avatar.provider ||
      experienceConfiguration(this.experience$$()).avatarProvider
    );
  }

  private recordRealtimeEvent(event: unknown): void {
    const type =
      typeof event === 'object' && event && 'type' in event
        ? String((event as { type: unknown }).type)
        : 'event';

    const next = [
      `${new Date().toLocaleTimeString()} ${type}`,
      ...this.realtimeEvents$$(),
    ];
    this.realtimeEvents$$.set(next.slice(0, 6));
  }

  private recordAvatarDiagnostic(event: string): void {
    if (!event.startsWith('liveavatar.')) return;
    const next = [
      `${new Date().toLocaleTimeString()} ${event}`,
      ...this.avatarDiagnostics$$(),
    ];
    this.avatarDiagnostics$$.set(next.slice(0, 16));
  }

  private handleToolOutput(toolName: string, output: unknown): void {
    const payload = asRecord(output);
    if (!payload) return;

    if (toolName === 'searchProperties') {
      const properties = Array.isArray(payload['properties'])
        ? payload['properties'].filter(isProperty)
        : [];
      this.propertyResults$$.set(properties);
      this.selectedProperty$$.set(null);
      this.inspectionSlots$$.set([]);
      this.inspectionBooking$$.set(null);
      return;
    }

    if (toolName === 'getPropertyDetails' && isProperty(payload['property'])) {
      this.selectedProperty$$.set(payload['property']);
      this.propertyResults$$.set([]);
      this.inspectionSlots$$.set([]);
      this.inspectionBooking$$.set(null);
      return;
    }

    if (toolName === 'getInspectionSlots') {
      const slots = Array.isArray(payload['slots'])
        ? payload['slots'].filter(isInspectionSlot)
        : [];
      this.inspectionSlots$$.set(slots);
      this.inspectionBooking$$.set(null);
      return;
    }

    if (
      toolName === 'bookInspection' &&
      isInspectionBooking(payload['booking'])
    ) {
      this.inspectionBooking$$.set(payload['booking']);
    }
  }

  private clearPropertyExperience(): void {
    this.propertyResults$$.set([]);
    this.selectedProperty$$.set(null);
    this.inspectionSlots$$.set([]);
    this.inspectionBooking$$.set(null);
  }

  setExperience(value: string): void {
    if (
      value === 'openai' ||
      value === 'tavus' ||
      value === 'openai-simli' ||
      value === 'openai-liveavatar-lite' ||
      value === 'openai-liveavatar-full'
    ) {
      if (value === 'openai') this.standbyVideoFailed$$.set(false);
      this.experience$$.set(value);
    }
  }

  private async connectTavus(
    response: SophiaRuntimeSessionResponse,
  ): Promise<void> {
    const conversationUrl = response.avatar.streamUrl;
    const meetingToken = response.avatar.sessionToken;
    if (!conversationUrl || !meetingToken) {
      throw new Error('Tavus conversation URL or meeting token is missing.');
    }

    const url = new URL(conversationUrl);
    if (
      url.protocol !== 'https:' ||
      (url.hostname !== 'tavus.daily.co' && !url.hostname.endsWith('.daily.co'))
    ) {
      throw new Error('Tavus returned an unexpected conversation URL.');
    }
    this.voiceStatus$$.set('Joining Tavus conversation');
    this.avatarStatus$$.set('Joining Tavus Full');

    const videoElement = this.avatarVideo?.nativeElement;
    const audioElement = this.remoteAudio?.nativeElement;
    if (!videoElement || !audioElement) {
      throw new Error('Tavus media elements are not available.');
    }

    await this.tavus.connect({
      conversationUrl: url.toString(),
      meetingToken,
      videoElement,
      audioElement,
      onStatus: (status) => {
        this.avatarStatus$$.set(status);
        if (status === 'Tavus Full connected') {
          this.isVoiceConnected$$.set(true);
          this.isAvatarConnected$$.set(true);
          this.voiceStatus$$.set('Tavus microphone connected');
        }
      },
      onEvent: (event) => this.recordRealtimeEvent({ type: event }),
      onToolCall: (toolCall) =>
        this.executeRealtimeTool(response.session.sessionId, {
          callId: toolCall.callId,
          name: toolCall.name,
          arguments: toolCall.arguments,
        }),
    });
  }

  private async disconnectTavus(): Promise<void> {
    await this.tavus.disconnect();
    this.isVoiceConnected$$.set(false);
    this.isAvatarConnected$$.set(false);
    this.voiceStatus$$.set('Voice disconnected');
    this.avatarStatus$$.set('Avatar disconnected');
  }
}

function toolActivityLabel(toolName: string): string | null {
  switch (toolName) {
    case 'researchBusiness':
      return 'Researching official sources';
    case 'searchProperties':
      return 'Finding suitable properties';
    case 'getPropertyDetails':
      return 'Loading property details';
    case 'getInspectionSlots':
      return 'Checking inspection times';
    case 'bookInspection':
      return 'Confirming inspection';
    case 'searchAgencyKnowledge':
      return 'Checking agency guidance';
    default:
      return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function isProperty(value: unknown): value is SophiaProperty {
  const property = asRecord(value);
  return (
    !!property &&
    typeof property['propertyId'] === 'string' &&
    typeof property['address'] === 'string' &&
    typeof property['priceDisplay'] === 'string'
  );
}

function isInspectionSlot(value: unknown): value is SophiaInspectionSlot {
  const slot = asRecord(value);
  return (
    !!slot &&
    typeof slot['slotId'] === 'string' &&
    typeof slot['startsAt'] === 'string'
  );
}

function isInspectionBooking(value: unknown): value is SophiaInspectionBooking {
  const booking = asRecord(value);
  return (
    !!booking &&
    typeof booking['bookingId'] === 'string' &&
    typeof booking['customerEmail'] === 'string'
  );
}

function experienceConfiguration(experience: SophiaExperience): {
  aiProvider: 'openai-realtime' | 'tavus-full';
  avatarProvider: SophiaAvatarProvider;
  avatarMode?: 'LITE' | 'FULL';
} {
  switch (experience) {
    case 'tavus':
      return { aiProvider: 'tavus-full', avatarProvider: 'tavus' };
    case 'openai-simli':
      return { aiProvider: 'openai-realtime', avatarProvider: 'simli' };
    case 'openai-liveavatar-lite':
      return {
        aiProvider: 'openai-realtime',
        avatarProvider: 'liveavatar',
        avatarMode: 'LITE',
      };
    case 'openai-liveavatar-full':
      return {
        aiProvider: 'openai-realtime',
        avatarProvider: 'liveavatar',
        avatarMode: 'FULL',
      };
    default:
      return { aiProvider: 'openai-realtime', avatarProvider: 'none' };
  }
}

function formatError(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : 'Unknown connection error.';
}
