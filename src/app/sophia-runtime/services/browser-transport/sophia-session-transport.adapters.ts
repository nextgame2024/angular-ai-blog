import { inject, Injectable } from '@angular/core';

import { SophiaRealtimeClientService } from '../sophia-realtime-client.service';
import { SophiaGeminiLiveClientService } from '../sophia-gemini-live-client.service';
import { SophiaTavusClientService } from '../sophia-tavus-client.service';
import { SophiaPresentationAdapterRegistry } from './sophia-browser-transport.registry';
import type {
  SophiaBrowserToolCall,
  SophiaBrowserTransportAdapter,
  SophiaBrowserTransportConnectRequest,
  SophiaPresentationAdapter,
} from './sophia-browser-transport.types';
import { SophiaMediaOwner } from './sophia-media-owner';

@Injectable()
export class SophiaNativeRealtimeBrowserAdapter
  implements SophiaBrowserTransportAdapter
{
  private readonly realtime = inject(SophiaRealtimeClientService);
  private readonly presentations = inject(SophiaPresentationAdapterRegistry);
  private presentation: SophiaPresentationAdapter | null = null;
  private mediaOwner: SophiaMediaOwner | null = null;
  private toolExecutions = new Map<string, Promise<unknown>>();

  readonly manifest = {
    adapterKey: 'native-realtime-browser-v1',
    protocols: ['webrtc-data-channel'],
    mediaModes: ['native-realtime', 'orchestrated-voice', 'orchestrated-text'],
    toolDeliveryModes: ['browser'],
  } as const;

  async connect(request: SophiaBrowserTransportConnectRequest): Promise<void> {
    await this.disconnect();
    const clientSecret = request.response.ai.clientSecret;
    if (!clientSecret) throw new Error('Voice connection is not configured.');

    const presentation = this.presentations.resolve(request.response);
    const mediaOwner = new SophiaMediaOwner(request.media);
    this.presentation = presentation;
    this.mediaOwner = mediaOwner;
    this.toolExecutions.clear();
    mediaOwner.select('remote-audio');

    request.callbacks.onVoiceStatus('Connecting voice', false);
    const presentationConnection = presentation.connect({
      bootstrap: request.response.avatar,
      media: request.media,
      audioBridge: request.audioBridge,
      onStatus: (status, connected) => {
        request.callbacks.onPresentationStatus(status, connected);
        mediaOwner.select(
          connected
            ? presentation.manifest.audibleOutput(request.audioBridge)
            : 'remote-audio',
        );
      },
      onEvent: (event) => request.callbacks.onEvent({ type: event }),
      onSpeakingChange: (speaking) => {
        this.realtime.setMicrophoneSuppressed(speaking);
      },
    });

    const voiceConnection = this.realtime.connect({
      clientSecret,
      onRemoteStream: (stream) => {
        request.media.remoteAudio.srcObject = stream;
        presentation.attachRemoteStream(stream);
        void request.media.remoteAudio.play().catch(() => {
          request.callbacks.onVoiceStatus(
            'Tap the page to allow audio playback',
            true,
          );
        });
      },
      onAudioDelta: (audio) => presentation.appendAudio(audio),
      onAudioDone: () => presentation.completeAudio(),
      onAssistantTextDone: (text) => {
        request.callbacks.onAssistantText?.(text);
        presentation.speakText(text);
      },
      onOutputAudioStarted: request.callbacks.onAssistantSpeechStarted,
      onOutputAudioStopped: request.callbacks.onAssistantSpeechStopped,
      onEvent: (event) => {
        request.callbacks.onEvent(event);
        if (asRecord(event)?.['type'] === 'input_audio_buffer.speech_started') {
          this.interrupt();
          request.callbacks.onUserActivity();
        }
      },
      onStatus: (status) =>
        request.callbacks.onVoiceStatus(
          normalizeVoiceStatus(status),
          status === 'connected' || status === 'Realtime connected',
        ),
      onToolCall: (toolCall) =>
        this.executeToolOnce(
          toolCall,
          'browser',
          request.callbacks.onToolCall,
        ),
    });

    const [voiceResult, presentationResult] = await Promise.allSettled([
      voiceConnection,
      presentationConnection,
    ]);
    if (voiceResult.status === 'rejected') {
      throw new Error(`Voice: ${formatError(voiceResult.reason)}`);
    }
    if (presentationResult.status === 'rejected') {
      await presentation.disconnect().catch(() => undefined);
      mediaOwner.select('remote-audio');
      request.callbacks.onPresentationUnavailable(
        request.response.avatar.error || formatError(presentationResult.reason),
      );
    }
  }

  interrupt(): void {
    this.realtime.interrupt();
    this.presentation?.interrupt();
  }

  promptAssistant(text: string): void {
    this.realtime.promptAssistant(
      `Say exactly: "${text}" Do not add anything else.`,
    );
  }

  submitUserText(text: string): void {
    this.realtime.submitUserText(text);
  }

  async disconnect(): Promise<void> {
    const presentation = this.presentation;
    const mediaOwner = this.mediaOwner;
    this.presentation = null;
    this.mediaOwner = null;
    this.toolExecutions.clear();
    this.realtime.setMicrophoneSuppressed(false);
    await Promise.allSettled([
      this.realtime.disconnect(),
      presentation?.disconnect() ?? Promise.resolve(),
    ]);
    mediaOwner?.clear();
  }

  private executeToolOnce(
    toolCall: SophiaBrowserToolCall,
    source: 'browser' | 'provider_sideband',
    execute: (
      call: SophiaBrowserToolCall,
      source: 'browser' | 'provider_sideband',
    ) => Promise<unknown>,
  ): Promise<unknown> {
    const key = `${source}:${toolCall.callId}`;
    const existing = this.toolExecutions.get(key);
    if (existing) return existing;
    const pending = execute(toolCall, source);
    this.toolExecutions.set(key, pending);
    return pending;
  }
}

@Injectable()
export class SophiaGeminiLiveBrowserAdapter
  implements SophiaBrowserTransportAdapter
{
  private readonly live = inject(SophiaGeminiLiveClientService);
  private mediaOwner: SophiaMediaOwner | null = null;
  private toolExecutions = new Map<string, Promise<unknown>>();

  readonly manifest = {
    adapterKey: 'gemini-live-browser-v1',
    protocols: ['gemini-live-websocket'],
    mediaModes: ['native-realtime'],
    toolDeliveryModes: ['browser'],
  } as const;

  async connect(request: SophiaBrowserTransportConnectRequest): Promise<void> {
    await this.disconnect();
    const clientSecret = request.response.ai.clientSecret;
    const bootstrap = request.response.ai.transportBootstrap;
    if (!clientSecret || !bootstrap) throw new Error('Gemini Live connection is not configured.');
    this.mediaOwner = new SophiaMediaOwner(request.media);
    this.mediaOwner.select('web-audio');
    this.toolExecutions.clear();
    request.callbacks.onPresentationStatus('Avatar unavailable', false);
    await this.live.connect({
      clientSecret, bootstrap,
      onStatus: (status) => request.callbacks.onVoiceStatus(status, status === 'Gemini Live connected'),
      onEvent: request.callbacks.onEvent,
      onUserActivity: request.callbacks.onUserActivity,
      onAssistantSpeechStarted: request.callbacks.onAssistantSpeechStarted,
      onAssistantSpeechStopped: request.callbacks.onAssistantSpeechStopped,
      onAssistantTurnCompleted: request.callbacks.onAssistantTurnCompleted,
      onAssistantText: (text) => request.callbacks.onAssistantText?.(text),
      onToolCall: (call) => this.executeToolOnce(call, request.callbacks.onToolCall),
    });
  }

  interrupt(): void { this.live.interrupt(); }
  promptAssistant(text: string): void { this.live.promptAssistant(text); }
  submitUserText(text: string): void { this.live.submitUserText(text); }

  async disconnect(): Promise<void> {
    const owner = this.mediaOwner; this.mediaOwner = null; this.toolExecutions.clear();
    try { await this.live.disconnect(); } finally { owner?.clear(); }
  }

  private executeToolOnce(toolCall: SophiaBrowserToolCall, execute: SophiaBrowserTransportConnectRequest['callbacks']['onToolCall']): Promise<unknown> {
    const key = `browser:${toolCall.callId}`; const existing = this.toolExecutions.get(key);
    if (existing) return existing;
    const pending = execute(toolCall, 'browser'); this.toolExecutions.set(key, pending); return pending;
  }
}

@Injectable()
export class SophiaDailyConversationBrowserAdapter
  implements SophiaBrowserTransportAdapter
{
  private readonly tavus = inject(SophiaTavusClientService);
  private mediaOwner: SophiaMediaOwner | null = null;
  private toolExecutions = new Map<string, Promise<unknown>>();

  readonly manifest = {
    adapterKey: 'daily-conversation-browser-v1',
    protocols: ['daily-webrtc'],
    mediaModes: ['composite-realtime'],
    toolDeliveryModes: ['provider-sideband'],
  } as const;

  async connect(request: SophiaBrowserTransportConnectRequest): Promise<void> {
    await this.disconnect();
    const conversationUrl = request.response.avatar.streamUrl;
    const meetingToken = request.response.avatar.sessionToken;
    if (!conversationUrl || !meetingToken) {
      throw new Error('Conversation connection details are missing.');
    }
    const url = new URL(conversationUrl);
    if (
      url.protocol !== 'https:' ||
      (url.hostname !== 'tavus.daily.co' && !url.hostname.endsWith('.daily.co'))
    ) {
      throw new Error('The conversation service returned an unexpected URL.');
    }

    this.mediaOwner = new SophiaMediaOwner(request.media);
    this.mediaOwner.select('remote-audio');
    this.toolExecutions.clear();
    request.callbacks.onVoiceStatus('Joining conversation', false);
    request.callbacks.onPresentationStatus('Joining avatar', false);

    await this.tavus.connect({
      conversationId: request.response.session.providerSessionId || '',
      conversationUrl: url.toString(),
      meetingToken,
      videoElement: request.media.avatarVideo,
      audioElement: request.media.remoteAudio,
      onStatus: (status) => {
        const connected = status === 'Tavus Full connected';
        request.callbacks.onPresentationStatus(
          normalizePresentationStatus(status),
          connected,
        );
        request.callbacks.onVoiceStatus(
          connected ? 'Voice connected' : normalizeVoiceStatus(status),
          connected,
        );
      },
      onEvent: (event) => request.callbacks.onEvent({ type: event }),
      onUserUtterance: () => {
        this.interrupt();
        request.callbacks.onUserActivity();
      },
      onReplicaSpeechStarted: request.callbacks.onAssistantSpeechStarted,
      onReplicaSpeechStopped: request.callbacks.onAssistantSpeechStopped,
      onReplicaUtterance: request.callbacks.onAssistantTurnCompleted,
      onToolCall: (toolCall) =>
        this.executeToolOnce(
          {
            callId: toolCall.callId,
            name: toolCall.name,
            arguments: toolCall.arguments,
          },
          request.callbacks.onToolCall,
        ),
    });
  }

  interrupt(): void {
    this.tavus.interrupt();
  }

  promptAssistant(text: string): void {
    this.tavus.speak(text);
  }

  submitUserText(_text: string): void {
    throw new Error('Typed conversation is unavailable for this experience. Use Essential or Professional mode.');
  }

  async disconnect(): Promise<void> {
    const mediaOwner = this.mediaOwner;
    this.mediaOwner = null;
    this.toolExecutions.clear();
    try {
      await this.tavus.disconnect();
    } finally {
      mediaOwner?.clear();
    }
  }

  private executeToolOnce(
    toolCall: SophiaBrowserToolCall,
    execute: (
      call: SophiaBrowserToolCall,
      source: 'provider_sideband',
    ) => Promise<unknown>,
  ): Promise<unknown> {
    const key = `provider_sideband:${toolCall.callId}`;
    const existing = this.toolExecutions.get(key);
    if (existing) return existing;
    const pending = execute(toolCall, 'provider_sideband');
    this.toolExecutions.set(key, pending);
    return pending;
  }
}

function normalizeVoiceStatus(status: string): string {
  if (status === 'Realtime connected' || status === 'connected') {
    return 'Voice connected';
  }
  if (status === 'Requesting microphone') return 'Requesting microphone';
  if (status.startsWith('Connecting')) return 'Connecting voice';
  if (status === 'Joining Tavus conversation') return 'Joining conversation';
  if (status === 'Tavus connection failed') return 'Voice connection failed';
  return status.replace(/Tavus(?: Full)?/gi, 'conversation');
}

function normalizePresentationStatus(status: string): string {
  if (status === 'Tavus Full connected') return 'Avatar connected';
  if (status === 'Joining Tavus conversation') return 'Joining avatar';
  if (status === 'Tavus connection failed') return 'Avatar connection failed';
  if (status === 'Tap Start again to allow Tavus audio playback') {
    return 'Tap Start again to allow audio playback';
  }
  return status.replace(/Tavus(?: Full)?/gi, 'Avatar');
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function formatError(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : 'Unknown connection error.';
}
