import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type {
  SophiaExperience,
  SophiaRuntimeSession,
} from '../types/sophia-runtime.types';
import { SophiaBrowserTransportRegistry } from './browser-transport/sophia-browser-transport.registry';
import type { SophiaBrowserToolCall } from './browser-transport/sophia-browser-transport.types';
import { SOPHIA_TOOL_ACTIVITY_LABELS } from '../presentation/sophia-tool-presentation.types';
import {
  SophiaRuntimeConfigService,
  type SophiaAvatarAudioBridge,
} from './sophia-runtime-config.service';
import { SophiaRuntimeSessionService } from './sophia-runtime-session.service';

export type SophiaSessionState =
  | 'idle'
  | 'starting'
  | 'active'
  | 'closing'
  | 'error';

export type SophiaSessionToolCall = SophiaBrowserToolCall;

export interface SophiaSessionConnectOptions {
  remoteAudio: HTMLAudioElement;
  avatarVideo: HTMLVideoElement;
  avatarAudio: HTMLAudioElement;
  prepareToolInput?(
    sessionId: string,
    toolCall: SophiaSessionToolCall,
  ): Promise<Record<string, unknown>>;
  onToolOutput?(toolName: string, output: unknown): void;
  onClosed?(): void;
}

/** Provider-neutral lifecycle and state boundary consumed by the kiosk page. */
@Injectable()
export class SophiaSessionFacade {
  private static readonly ERROR_DISPLAY_MS = 4_000;
  private static readonly INACTIVITY_PROMPT_MS = 20_000;
  private static readonly INACTIVITY_CLOSE_MS = 5_000;
  private readonly runtimeConfig = inject(SophiaRuntimeConfigService);
  private readonly runtime = inject(SophiaRuntimeSessionService);
  private readonly transports = inject(SophiaBrowserTransportRegistry);
  private readonly activityLabels = inject(SOPHIA_TOOL_ACTIVITY_LABELS, {
    optional: true,
  }) ?? [];
  private connectOptions: SophiaSessionConnectOptions | null = null;
  private audioBridge: SophiaAvatarAudioBridge = 'webrtc-track';
  private errorDismissTimer: ReturnType<typeof setTimeout> | null = null;
  private inactivityPromptTimer: ReturnType<typeof setTimeout> | null = null;
  private inactivityCloseTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private sessionExpiryTimer: ReturnType<typeof setTimeout> | null = null;
  private awaitingInactivityReply = false;
  private assistantSpeaking = false;

  readonly state = signal<SophiaSessionState>('idle');
  readonly error = signal<string | null>(null);
  readonly session = signal<SophiaRuntimeSession | null>(null);
  readonly isVoiceConnected = signal(false);
  readonly voiceStatus = signal('Voice disconnected');
  readonly avatarStatus = signal('Avatar disconnected');
  readonly isAvatarConnected = signal(false);
  readonly isAvatarUnavailable = signal(false);
  readonly events = signal<string[]>([]);
  readonly avatarDiagnostics = signal<string[]>([]);
  readonly activeTask = signal<string | null>(null);
  readonly assistantText = signal<string | null>(null);
  readonly experience = signal<SophiaExperience>('essential');

  readonly canStart = computed(() => {
    const state = this.state();
    return (
      (state === 'idle' || state === 'error') &&
      this.session()?.status !== 'active'
    );
  });
  readonly canFinish = computed(() => {
    const state = this.state();
    return (
      this.session()?.status === 'active' &&
      (state === 'active' || state === 'error')
    );
  });
  readonly isFullStage = computed(() => this.experience() !== 'essential');
  readonly usesVideoStandby = computed(() => this.experience() === 'essential');
  readonly isPremiumExperience = computed(
    () => this.experience() === 'premium',
  );
  readonly runtimeStatus = computed(() => {
    const state = this.state();
    if (this.activeTask()) return this.activeTask();
    if (state === 'starting') return 'Starting Sophia';
    if (state === 'closing') return 'Finishing session';
    if (state === 'error') return 'Connection needs attention';
    if (
      this.isVoiceConnected() &&
      (this.isAvatarConnected() || this.experience() === 'essential')
    ) {
      return 'Sophia is ready';
    }
    if (this.isVoiceConnected() && this.isAvatarUnavailable()) {
      return 'Voice ready - avatar unavailable';
    }
    if (state === 'active') return 'Connecting voice';
    return 'Ready to start';
  });

  initialize(): void {
    void firstValueFrom(this.runtime.warmUp()).catch(() => undefined);
    void this.runtimeConfig.resolveAvatarAudioBridge().then((bridge) => {
      this.audioBridge = bridge;
    });
  }

  selectExperience(value: string): value is SophiaExperience {
    if (
      value !== 'essential' &&
      value !== 'professional' &&
      value !== 'premium'
    ) {
      return false;
    }
    this.experience.set(value);
    return true;
  }

  async connect(options: SophiaSessionConnectOptions): Promise<void> {
    if (!this.canStart()) return;
    const startupStartedAt = performance.now();
    let createdSessionId: string | null = null;
    this.connectOptions = options;
    this.clearErrorDismissTimer();
    this.clearSessionExpiryTimer();
    this.error.set(null);
    this.resetConnectionState();
    this.state.set('starting');

    try {
      const response = await firstValueFrom(
        this.runtime.createSession({ experience: this.experience() }),
      );
      createdSessionId = response.session.sessionId;
      this.session.set(response.session);
      this.logStartupTiming('runtime session created', startupStartedAt);

      await this.transports.connect({
        response,
        media: {
          remoteAudio: options.remoteAudio,
          avatarVideo: options.avatarVideo,
          avatarAudio: options.avatarAudio,
        },
        audioBridge: this.audioBridge,
        callbacks: {
          onVoiceStatus: (status, connected) => {
            this.voiceStatus.set(status);
            this.isVoiceConnected.set(connected);
          },
          onPresentationStatus: (status, connected) => {
            this.avatarStatus.set(status);
            this.isAvatarConnected.set(connected);
          },
          onPresentationUnavailable: (message) => {
            this.isAvatarUnavailable.set(true);
            this.isAvatarConnected.set(false);
            this.avatarStatus.set(message || 'Avatar unavailable');
          },
          onEvent: (event) => this.recordEvent(event),
          onUserActivity: () => this.onUserActivity(),
          onAssistantSpeechStarted: () => this.onAssistantSpeechStarted(),
          onAssistantSpeechStopped: () => this.onAssistantSpeechStopped(),
          onAssistantTurnCompleted: () => this.onAssistantTurnCompleted(),
          onAssistantText: (text) => this.assistantText.set(text),
          onToolCall: (toolCall, source) =>
            this.executeTool(toolCall, source),
        },
      });

      this.armSessionExpiry(
        response.session.sessionId,
        response.sessionAccessExpiresAt,
      );
      this.state.set('active');
      this.startHeartbeat();
      this.armInactivityPrompt();
      this.logStartupTiming('Sophia ready', startupStartedAt);
    } catch (error) {
      await this.transports.disconnect().catch(() => undefined);
      if (createdSessionId) {
        await firstValueFrom(
          this.runtime.closeSession(createdSessionId),
        ).catch(() => undefined);
        this.runtime.forgetSession(createdSessionId);
      }
      this.session.set(null);
      this.clearSessionExpiryTimer();
      this.resetConnectionState();
      this.logStartupTiming('failed', startupStartedAt);
      this.showError(error, 'Could not start Sophia.');
    }
  }

  interrupt(): void {
    this.transports.interrupt();
    this.onUserActivity();
  }

  async close(): Promise<void> {
    const session = this.session();
    if (!session || !this.canFinish()) return;

    this.clearErrorDismissTimer();
    this.clearSessionExpiryTimer();
    this.clearInactivityTimers();
    this.stopHeartbeat();
    this.awaitingInactivityReply = false;
    this.assistantSpeaking = false;
    this.error.set(null);
    this.state.set('closing');
    await this.transports.disconnect().catch(() => undefined);
    this.resetConnectionState();

    let closeError: unknown;
    try {
      await firstValueFrom(this.runtime.closeSession(session.sessionId));
    } catch (error) {
      closeError = error;
    } finally {
      this.runtime.forgetSession(session.sessionId);
      this.session.set(null);
      this.connectOptions?.onClosed?.();
      this.state.set('idle');
    }
    if (closeError) this.showError(closeError, 'Could not finish the runtime session.');
  }

  destroy(): void {
    this.clearErrorDismissTimer();
    this.clearSessionExpiryTimer();
    this.clearInactivityTimers();
    this.stopHeartbeat();
    const session = this.session();
    if (session?.status === 'active') {
      void firstValueFrom(
        this.runtime.markDisconnected(session.sessionId),
      ).catch(() => undefined);
      this.runtime.forgetSession(session.sessionId);
    }
    void this.transports.disconnect().catch(() => undefined);
    this.session.set(null);
    this.resetConnectionState();
    this.connectOptions = null;
  }

  showError(error: unknown, fallback: string): void {
    const message = formatError(error);
    this.error.set(message === 'Unknown connection error.' ? fallback : message);
    this.state.set('error');
    this.clearErrorDismissTimer();
    this.errorDismissTimer = setTimeout(() => {
      this.error.set(null);
      this.errorDismissTimer = null;
    }, SophiaSessionFacade.ERROR_DISPLAY_MS);
  }

  async executeTool(
    toolCall: SophiaSessionToolCall,
    eventSource: 'browser' | 'provider_sideband' = 'browser',
  ): Promise<unknown> {
    const session = this.session();
    if (!session) throw new Error('Sophia session is unavailable.');
    const input = this.connectOptions?.prepareToolInput
      ? await this.connectOptions.prepareToolInput(session.sessionId, toolCall)
      : toolCall.arguments;
    this.activeTask.set(this.toolActivityLabel(toolCall.name));
    try {
      const output = await this.executeRuntimeTool(
        session.sessionId,
        toolCall.name,
        input,
        {
          ...(eventSource === 'provider_sideband'
            ? { providerEventId: toolCall.callId }
            : { providerCallId: toolCall.callId }),
          eventSource,
        },
      );
      this.connectOptions?.onToolOutput?.(toolCall.name, output);
      return output;
    } finally {
      this.activeTask.set(null);
    }
  }

  async executeRuntimeTool(
    sessionId: string,
    toolName: string,
    input: Record<string, unknown>,
    metadata: {
      providerCallId?: string;
      providerEventId?: string;
      eventSource?: 'browser' | 'provider_sideband';
    } = {},
  ): Promise<unknown> {
    const response = await firstValueFrom(
      this.runtime.executeTool(sessionId, { toolName, input, ...metadata }),
    );
    return response.output;
  }

  async confirmActionReview(sessionId: string, reviewId: string): Promise<void> {
    await firstValueFrom(this.runtime.confirmActionReview(sessionId, reviewId));
  }

  async cancelActionReview(sessionId: string, reviewId: string): Promise<void> {
    await firstValueFrom(this.runtime.cancelActionReview(sessionId, reviewId));
  }

  submitText(text: string): void {
    const message = text.trim().slice(0, 2_000);
    if (!message || this.state() !== 'active') return;
    this.transports.submitUserText(message);
    this.onUserActivity();
  }

  private recordEvent(event: unknown): void {
    const type =
      typeof event === 'object' && event && 'type' in event
        ? String((event as { type: unknown }).type)
        : 'event';
    this.events.set(
      [`${new Date().toLocaleTimeString()} ${type}`, ...this.events()].slice(
        0,
        6,
      ),
    );
    if (type.startsWith('liveavatar.')) {
      this.avatarDiagnostics.set(
        [
          `${new Date().toLocaleTimeString()} ${type}`,
          ...this.avatarDiagnostics(),
        ].slice(0, 16),
      );
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      const session = this.session();
      if (!session || this.state() !== 'active') return;
      void firstValueFrom(
        this.runtime.heartbeatSession(session.sessionId),
      ).catch(() => undefined);
    }, 30_000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  private onUserActivity(): void {
    this.awaitingInactivityReply = false;
    this.clearInactivityTimers();
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
    if (this.state() !== 'active') return;
    this.inactivityPromptTimer = setTimeout(() => {
      this.inactivityPromptTimer = null;
      this.awaitingInactivityReply = true;
      this.transports.promptAssistant('Hi there, anything else I can help with?');
      this.inactivityCloseTimer = setTimeout(
        () => void this.closeInactiveSession(),
        30_000,
      );
    }, SophiaSessionFacade.INACTIVITY_PROMPT_MS);
  }

  private scheduleInactivityClose(): void {
    if (this.inactivityCloseTimer !== null) {
      clearTimeout(this.inactivityCloseTimer);
    }
    this.inactivityCloseTimer = setTimeout(
      () => void this.closeInactiveSession(),
      SophiaSessionFacade.INACTIVITY_CLOSE_MS,
    );
  }

  private async closeInactiveSession(): Promise<void> {
    if (!this.awaitingInactivityReply || this.assistantSpeaking) return;
    await this.close();
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

  private clearErrorDismissTimer(): void {
    if (this.errorDismissTimer !== null) {
      clearTimeout(this.errorDismissTimer);
      this.errorDismissTimer = null;
    }
  }

  private armSessionExpiry(sessionId: string, expiresAt: string): void {
    this.clearSessionExpiryTimer();
    const delay = Math.max(0, Date.parse(expiresAt) - Date.now());
    this.sessionExpiryTimer = setTimeout(
      () => void this.expireLocalSession(sessionId),
      Math.min(delay, 2_147_483_647),
    );
  }

  private async expireLocalSession(sessionId: string): Promise<void> {
    if (this.session()?.sessionId !== sessionId) return;
    this.sessionExpiryTimer = null;
    this.clearInactivityTimers();
    this.stopHeartbeat();
    await this.transports.disconnect().catch(() => undefined);
    this.runtime.forgetSession(sessionId);
    this.session.set(null);
    this.resetConnectionState();
    this.connectOptions?.onClosed?.();
    this.showError(
      new Error('Sophia session expired. Start a new session to continue.'),
      'Sophia session expired.',
    );
  }

  private clearSessionExpiryTimer(): void {
    if (this.sessionExpiryTimer !== null) {
      clearTimeout(this.sessionExpiryTimer);
      this.sessionExpiryTimer = null;
    }
  }

  private resetConnectionState(): void {
    this.isVoiceConnected.set(false);
    this.voiceStatus.set('Voice disconnected');
    this.isAvatarConnected.set(false);
    this.isAvatarUnavailable.set(false);
    this.avatarStatus.set('Avatar disconnected');
    this.events.set([]);
    this.avatarDiagnostics.set([]);
    this.assistantText.set(null);
  }

  private logStartupTiming(stage: string, startedAt: number): void {
    console.info(
      `[Sophia startup] ${stage} in ${Math.round(performance.now() - startedAt)} ms`,
    );
  }

  private toolActivityLabel(toolName: string): string | null {
    const matches = this.activityLabels
      .map((registration) => registration.labels[toolName])
      .filter((label): label is string => typeof label === 'string');
    return matches.length === 1 ? matches[0] : null;
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

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}
