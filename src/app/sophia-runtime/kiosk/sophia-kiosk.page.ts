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
  SophiaAgencyKnowledge,
  SophiaAvatarProvider,
  SophiaBookingReview,
  SophiaExperience,
  SophiaInspectionBooking,
  SophiaInspectionSlot,
  SophiaProperty,
  SophiaPropertyMedia,
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
  private static readonly ERROR_DISPLAY_MS = 4_000;
  private static readonly INACTIVITY_PROMPT_MS = 20_000;
  private static readonly INACTIVITY_CLOSE_MS = 5_000;
  private readonly runtimeConfig = inject(SophiaRuntimeConfigService);
  private readonly runtime = inject(SophiaRuntimeSessionService);
  private readonly realtime = inject(SophiaRealtimeClientService);
  private readonly avatar = inject(SophiaAvatarClientService);
  private readonly tavus = inject(SophiaTavusClientService);
  private remoteOutputStream: MediaStream | null = null;
  private errorDismissTimer: ReturnType<typeof setTimeout> | null = null;
  private inactivityPromptTimer: ReturnType<typeof setTimeout> | null = null;
  private inactivityCloseTimer: ReturnType<typeof setTimeout> | null = null;
  private awaitingInactivityReply = false;
  private assistantSpeaking = false;
  private bookingReviewConfirmedByNewTurn = false;
  private bookingReviewManuallyEdited = false;
  private readonly failedPhotoUrls = new Set<string>();
  private photoViewerPropertyId: string | null = null;

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
  readonly bookingReview$$ = signal<SophiaBookingReview | null>(null);
  readonly agencyKnowledge$$ = signal<SophiaAgencyKnowledge[]>([]);
  readonly photoViewer$$ = signal<{
    property: SophiaProperty;
    photo: SophiaPropertyMedia;
    photoNumber: number;
  } | null>(null);
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
        return 'assets/avatars/ProffesionalBG.png';
      case 'tavus':
        return 'assets/avatars/PremiumBG.png';
      default:
        return 'assets/avatars/SophiaAvatarSIMIL.jpg';
    }
  });

  readonly standbyMobileImage$$ = computed(() => {
    switch (this.experience$$()) {
      case 'openai-liveavatar-full':
        return 'assets/avatars/ProffesionalBGMobile.jpg';
      case 'tavus':
        return 'assets/avatars/PremiumBGMobile.jpg';
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
    const startupStartedAt = performance.now();

    this.clearErrorDismissTimer();
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
      this.logStartupTiming('runtime session created', startupStartedAt);

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
        this.armInactivityPrompt();
        this.logStartupTiming('Tavus ready', startupStartedAt);
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
      this.armInactivityPrompt();
      this.logStartupTiming(
        `${this.experience$$()} ready`,
        startupStartedAt,
      );
    } catch (error) {
      this.logStartupTiming('failed', startupStartedAt);
      this.handleError(error, 'Could not start Sophia.');
    }
  }

  private logStartupTiming(stage: string, startedAt: number): void {
    console.info(
      `[Sophia startup] ${stage} in ${Math.round(performance.now() - startedAt)} ms`,
    );
  }

  async finishSession(): Promise<void> {
    const session = this.session$$();
    if (!session || !this.canFinish$$()) return;

    this.clearErrorDismissTimer();
    this.clearInactivityTimers();
    this.awaitingInactivityReply = false;
    this.assistantSpeaking = false;
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
        onOutputAudioStarted: () => this.onAssistantSpeechStarted(),
        onOutputAudioStopped: () => this.onAssistantSpeechStopped(),
        onEvent: (event) => {
          this.recordRealtimeEvent(event);
          if (asRecord(event)?.['type'] === 'input_audio_buffer.speech_started') {
            this.onUserActivity();
          }
        },
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
    let toolInput = toolCall.arguments;
    if (
      (toolCall.name === 'bookInspection' ||
        toolCall.name === 'resendInspectionConfirmation')
    ) {
      toolInput = await this.prepareConfirmedBookingInput(
        sessionId,
        toolCall.name,
        toolCall.arguments,
      );
    }
    this.activeTask$$.set(toolActivityLabel(toolCall.name));

    try {
      const response = await firstValueFrom(
        this.runtime.executeTool(sessionId, {
          toolName: toolCall.name,
          input: toolInput,
        }),
      );

      this.handleToolOutput(toolCall.name, response.output);
      if (
        toolCall.name === 'bookInspection' ||
        toolCall.name === 'resendInspectionConfirmation'
      ) {
        this.bookingReviewConfirmedByNewTurn = false;
      }
      return response.output;
    } finally {
      this.activeTask$$.set(null);
    }
  }

  updateBookingReviewField(
    field: 'customerName' | 'customerEmail',
    value: string,
  ): void {
    const review = this.bookingReview$$();
    if (!review) return;
    this.bookingReview$$.set({ ...review, [field]: value });
    this.bookingReviewManuallyEdited = true;
    this.bookingReviewConfirmedByNewTurn = false;
  }

  selectProperty(property: SophiaProperty): void {
    this.selectedProperty$$.set(property);
    this.inspectionSlots$$.set([]);
    this.inspectionBooking$$.set(null);
    this.bookingReview$$.set(null);
    this.agencyKnowledge$$.set([]);
  }

  openPropertyPhoto(
    property: SophiaProperty,
    photo: SophiaPropertyMedia,
    photoNumber: number,
  ): void {
    if (this.photoViewerPropertyId !== property.propertyId) {
      this.failedPhotoUrls.clear();
      this.photoViewerPropertyId = property.propertyId;
    }
    this.photoViewer$$.set({ property, photo, photoNumber });
  }

  handlePhotoLoadError(viewer: {
    property: SophiaProperty;
    photo: SophiaPropertyMedia;
    photoNumber: number;
  }): void {
    this.failedPhotoUrls.add(viewer.photo.url);
    const fallbackIndex = viewer.property.media.findIndex(
      (photo) => photo.url && !this.failedPhotoUrls.has(photo.url),
    );
    if (fallbackIndex < 0) {
      this.closePhotoViewer();
      return;
    }
    this.photoViewer$$.set({
      property: viewer.property,
      photo: viewer.property.media[fallbackIndex],
      photoNumber: fallbackIndex + 1,
    });
  }

  closePhotoViewer(): void {
    this.photoViewer$$.set(null);
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
    this.clearErrorDismissTimer();
    this.clearInactivityTimers();
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
    void firstValueFrom(this.runtime.warmUp()).catch(() => undefined);
    void this.runtimeConfig.resolveAvatarAudioBridge().then((bridge) => {
      this.avatarAudioBridge$$.set(bridge);
      this.syncAudioPlaybackRoute();
      if (this.remoteOutputStream && this.isAvatarConnected$$()) {
        this.avatar.attachRemoteStream(this.remoteOutputStream);
      }
    });
  }

  private handleError(error: unknown, fallback: string): void {
    const message = formatError(error);
    this.error$$.set(
      message === 'Unknown connection error.' ? fallback : message,
    );
    this.state$$.set('error');
    this.clearErrorDismissTimer();
    this.errorDismissTimer = setTimeout(() => {
      this.error$$.set(null);
      this.errorDismissTimer = null;
    }, SophiaKioskPageComponent.ERROR_DISPLAY_MS);
  }

  private clearErrorDismissTimer(): void {
    if (this.errorDismissTimer !== null) {
      clearTimeout(this.errorDismissTimer);
      this.errorDismissTimer = null;
    }
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

    if (toolName !== 'showPropertyPhoto') {
      this.closePhotoViewer();
    }

    if (toolName === 'searchProperties') {
      const properties = Array.isArray(payload['properties'])
        ? payload['properties'].filter(isProperty)
        : [];
      this.propertyResults$$.set(properties);
      this.selectedProperty$$.set(null);
      this.inspectionSlots$$.set([]);
      this.inspectionBooking$$.set(null);
      this.bookingReview$$.set(null);
      this.agencyKnowledge$$.set([]);
      return;
    }

    if (toolName === 'getPropertyDetails' && isProperty(payload['property'])) {
      this.selectedProperty$$.set(payload['property']);
      this.propertyResults$$.set([]);
      this.inspectionSlots$$.set([]);
      this.inspectionBooking$$.set(null);
      this.bookingReview$$.set(null);
      this.agencyKnowledge$$.set([]);
      return;
    }

    if (toolName === 'showPropertyPhoto' && isProperty(payload['property'])) {
      const property = payload['property'];
      const requested = Number(payload['photoNumber']) || 1;
      const index = Math.min(
        Math.max(requested - 1, 0),
        Math.max(property.media.length - 1, 0),
      );
      const photo = property.media[index];
      if (photo) this.openPropertyPhoto(property, photo, index + 1);
      return;
    }

    if (
      toolName === 'closePropertyView' &&
      payload['closePropertyView'] === true
    ) {
      if (this.photoViewer$$()) this.closePhotoViewer();
      else this.clearPropertyExperience();
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
      (toolName === 'reviewInspectionBooking' ||
        toolName === 'reviewInspectionEmailResend') &&
      isBookingReview(payload['bookingReview'])
    ) {
      this.bookingReview$$.set(payload['bookingReview']);
      this.bookingReviewManuallyEdited = false;
      this.bookingReviewConfirmedByNewTurn = false;
      return;
    }

    if (
      toolName === 'bookInspection' &&
      isInspectionBooking(payload['booking'])
    ) {
      this.inspectionBooking$$.set(payload['booking']);
      this.bookingReview$$.set(null);
      return;
    }

    if (toolName === 'resendInspectionConfirmation') {
      const confirmationEmail = asRecord(payload['confirmationEmail']);
      const booking = this.inspectionBooking$$();
      if (booking && confirmationEmail) {
        this.inspectionBooking$$.set({
          ...booking,
          customerEmail:
            typeof confirmationEmail['customerEmail'] === 'string'
              ? confirmationEmail['customerEmail']
              : booking.customerEmail,
          confirmationEmail:
            confirmationEmail as SophiaInspectionBooking['confirmationEmail'],
        });
      }
      this.bookingReview$$.set(null);
      return;
    }

    if (toolName === 'searchAgencyKnowledge') {
      const results = Array.isArray(payload['results'])
        ? payload['results'].filter(isAgencyKnowledge)
        : [];
      this.agencyKnowledge$$.set(results);
      this.propertyResults$$.set([]);
      this.selectedProperty$$.set(null);
      this.inspectionSlots$$.set([]);
      this.inspectionBooking$$.set(null);
      this.bookingReview$$.set(null);
    }
  }

  private clearPropertyExperience(): void {
    this.propertyResults$$.set([]);
    this.selectedProperty$$.set(null);
    this.inspectionSlots$$.set([]);
    this.inspectionBooking$$.set(null);
    this.bookingReview$$.set(null);
    this.agencyKnowledge$$.set([]);
    this.photoViewer$$.set(null);
    this.bookingReviewConfirmedByNewTurn = false;
    this.bookingReviewManuallyEdited = false;
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
      conversationId: response.session.providerSessionId || '',
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
      onUserUtterance: () => this.onUserActivity(),
      onReplicaSpeechStarted: () => this.onAssistantSpeechStarted(),
      onReplicaSpeechStopped: () => this.onAssistantSpeechStopped(),
      onReplicaUtterance: () => this.onAssistantTurnCompleted(),
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

  private onUserActivity(): void {
    if (this.bookingReview$$()) this.bookingReviewConfirmedByNewTurn = true;
    this.awaitingInactivityReply = false;
    this.clearInactivityTimers();
  }

  private async prepareConfirmedBookingInput(
    sessionId: string,
    toolName: 'bookInspection' | 'resendInspectionConfirmation',
    providerInput: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const currentReview = this.bookingReview$$();
    if (!currentReview) {
      throw new Error('Display the booking details before sending.');
    }

    const providerName = stringValue(providerInput['customerName']);
    const providerEmail = stringValue(providerInput['customerEmail']);
    if (!this.bookingReviewManuallyEdited) {
      const updatedReview = {
        ...currentReview,
        customerName: providerName || currentReview.customerName,
        customerEmail: providerEmail || currentReview.customerEmail,
      };
      if (
        updatedReview.customerName !== currentReview.customerName ||
        updatedReview.customerEmail.toLowerCase() !==
          currentReview.customerEmail.toLowerCase()
      ) {
        this.bookingReview$$.set(updatedReview);
        this.bookingReviewConfirmedByNewTurn = false;
        await this.syncBookingReview(sessionId, updatedReview);
        throw new Error(
          'The corrected details are now displayed. Ask the customer to check and confirm them before sending.',
        );
      }
    }

    if (!this.bookingReviewConfirmedByNewTurn) {
      throw new Error(
        'Wait for the customer to confirm the displayed name, email, property and time before sending.',
      );
    }

    const review = this.bookingReview$$()!;
    const customerName = review.customerName.trim();
    const customerEmail = review.customerEmail.trim().toLowerCase();
    if (customerName.length < 2) throw new Error('Enter the customer name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      throw new Error('Enter a valid confirmation email.');
    }

    const normalizedReview = { ...review, customerName, customerEmail };
    this.bookingReview$$.set(normalizedReview);
    await this.syncBookingReview(sessionId, normalizedReview);
    this.bookingReviewManuallyEdited = false;

    return toolName === 'bookInspection'
      ? {
          ...providerInput,
          propertyId: normalizedReview.propertyId,
          slotId: normalizedReview.slotId,
          confirmedStartsAt: normalizedReview.confirmedStartsAt,
          customerName,
          customerEmail,
          confirmed: true,
        }
      : {
          ...providerInput,
          bookingId: normalizedReview.bookingId,
          customerEmail,
          confirmed: true,
        };
  }

  private async syncBookingReview(
    sessionId: string,
    review: SophiaBookingReview,
  ): Promise<void> {
    const toolName =
      review.mode === 'resend'
        ? 'reviewInspectionEmailResend'
        : 'reviewInspectionBooking';
    await firstValueFrom(
      this.runtime.executeTool(sessionId, {
        toolName,
        input: { ...review },
      }),
    );
  }

  private onAssistantSpeechStarted(): void {
    this.assistantSpeaking = true;
    if (this.inactivityCloseTimer !== null) {
      clearTimeout(this.inactivityCloseTimer);
      this.inactivityCloseTimer = null;
    }
    if (!this.awaitingInactivityReply && this.inactivityPromptTimer !== null) {
      clearTimeout(this.inactivityPromptTimer);
      this.inactivityPromptTimer = null;
    }
  }

  private onAssistantSpeechStopped(): void {
    this.assistantSpeaking = false;
    if (this.awaitingInactivityReply) {
      this.scheduleInactivityClose();
      return;
    }
    this.armInactivityPrompt();
  }

  private onAssistantTurnCompleted(): void {
    if (!this.assistantSpeaking) this.onAssistantSpeechStopped();
  }

  private armInactivityPrompt(): void {
    this.clearInactivityTimers();
    if (this.state$$() !== 'active') return;

    this.inactivityPromptTimer = setTimeout(() => {
      this.inactivityPromptTimer = null;
      this.awaitingInactivityReply = true;
      const prompt = 'Hi there, anything else I can help with?';
      if (this.session$$()?.aiProvider === 'tavus-full') {
        this.tavus.speak(prompt);
      } else {
        this.realtime.promptAssistant(
          `Say exactly: "${prompt}" Do not add anything else.`,
        );
      }
      // Covers providers that fail to emit a speech-complete event.
      this.inactivityCloseTimer = setTimeout(
        () => void this.closeInactiveSession(),
        30_000,
      );
    }, SophiaKioskPageComponent.INACTIVITY_PROMPT_MS);
  }

  private scheduleInactivityClose(): void {
    if (this.inactivityCloseTimer !== null) {
      clearTimeout(this.inactivityCloseTimer);
    }
    this.inactivityCloseTimer = setTimeout(
      () => void this.closeInactiveSession(),
      SophiaKioskPageComponent.INACTIVITY_CLOSE_MS,
    );
  }

  private async closeInactiveSession(): Promise<void> {
    if (!this.awaitingInactivityReply || this.assistantSpeaking) return;
    this.clearPropertyExperience();
    await this.finishSession();
  }

  private clearInactivityTimers(): void {
    if (this.inactivityPromptTimer !== null) {
      clearTimeout(this.inactivityPromptTimer);
    }
    if (this.inactivityCloseTimer !== null) {
      clearTimeout(this.inactivityCloseTimer);
    }
    this.inactivityPromptTimer = null;
    this.inactivityCloseTimer = null;
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
    case 'reviewInspectionBooking':
    case 'reviewInspectionEmailResend':
      return 'Reviewing confirmation details';
    case 'resendInspectionConfirmation':
      return 'Resending confirmation email';
    case 'showPropertyPhoto':
      return 'Opening property photo';
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

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
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

function isBookingReview(value: unknown): value is SophiaBookingReview {
  const review = asRecord(value);
  return (
    !!review &&
    (review['mode'] === 'new' || review['mode'] === 'resend') &&
    typeof review['customerName'] === 'string' &&
    typeof review['customerEmail'] === 'string' &&
    typeof review['propertyAddress'] === 'string' &&
    typeof review['startsAtLabel'] === 'string'
  );
}

function isAgencyKnowledge(value: unknown): value is SophiaAgencyKnowledge {
  const knowledge = asRecord(value);
  return (
    !!knowledge &&
    typeof knowledge['knowledgeId'] === 'string' &&
    typeof knowledge['question'] === 'string' &&
    typeof knowledge['answer'] === 'string'
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
  const errorRecord = asRecord(error);
  const responseBody = asRecord(errorRecord?.['error']);
  if (typeof responseBody?.['message'] === 'string') {
    return responseBody['message'];
  }
  return error instanceof Error && error.message
    ? error.message
    : 'Unknown connection error.';
}
