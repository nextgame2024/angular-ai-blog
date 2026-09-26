import { InjectionToken } from '@angular/core';

import type {
  SophiaAvatarMode,
  SophiaAvatarProvider,
  SophiaRuntimeSessionResponse,
} from '../../types/sophia-runtime.types';
import type { SophiaAvatarAudioBridge } from '../sophia-runtime-config.service';

export interface SophiaBrowserMediaElements {
  remoteAudio: HTMLAudioElement;
  avatarVideo: HTMLVideoElement;
  avatarAudio: HTMLAudioElement;
}

export interface SophiaBrowserToolCall {
  callId: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface SophiaBrowserTransportCallbacks {
  onVoiceStatus(status: string, connected: boolean): void;
  onPresentationStatus(status: string, connected: boolean): void;
  onPresentationUnavailable(message: string): void;
  onEvent(event: unknown): void;
  onUserActivity(): void;
  onAssistantSpeechStarted(): void;
  onAssistantSpeechStopped(): void;
  onAssistantTurnCompleted(): void;
  onAssistantText?(text: string): void;
  onToolCall(
    toolCall: SophiaBrowserToolCall,
    source: 'browser' | 'provider_sideband',
  ): Promise<unknown>;
}

export interface SophiaBrowserTransportConnectRequest {
  response: SophiaRuntimeSessionResponse;
  media: SophiaBrowserMediaElements;
  audioBridge: SophiaAvatarAudioBridge;
  callbacks: SophiaBrowserTransportCallbacks;
}

export interface SophiaBrowserTransportManifest {
  adapterKey: string;
  protocols: readonly string[];
  mediaModes: readonly string[];
  toolDeliveryModes: readonly string[];
}

export interface SophiaBrowserTransportAdapter {
  readonly manifest: SophiaBrowserTransportManifest;
  connect(request: SophiaBrowserTransportConnectRequest): Promise<void>;
  interrupt(): void;
  promptAssistant(text: string): void;
  submitUserText(text: string): void;
  disconnect(): Promise<void>;
}

export const SOPHIA_BROWSER_TRANSPORT_ADAPTERS = new InjectionToken<
  readonly SophiaBrowserTransportAdapter[]
>('SOPHIA_BROWSER_TRANSPORT_ADAPTERS');

export type SophiaAudibleOutput =
  | 'none'
  | 'remote-audio'
  | 'avatar-audio'
  | 'avatar-video'
  | 'web-audio';

export interface SophiaPresentationBootstrap {
  provider: SophiaAvatarProvider;
  sessionToken?: string;
  transportMode?: 'livekit' | 'p2p';
  mode?: SophiaAvatarMode;
  error?: string;
}

export interface SophiaPresentationConnectRequest {
  bootstrap: SophiaPresentationBootstrap;
  media: SophiaBrowserMediaElements;
  audioBridge: SophiaAvatarAudioBridge;
  onStatus(status: string, connected: boolean): void;
  onEvent(event: string): void;
  onSpeakingChange(speaking: boolean): void;
}

export interface SophiaPresentationAdapterManifest {
  adapterKey: string;
  audibleOutput(audioBridge: SophiaAvatarAudioBridge): SophiaAudibleOutput;
}

export interface SophiaPresentationAdapter {
  readonly manifest: SophiaPresentationAdapterManifest;
  connect(request: SophiaPresentationConnectRequest): Promise<void>;
  attachRemoteStream(stream: MediaStream): void;
  appendAudio(audio: Uint8Array): void;
  completeAudio(): void;
  speakText(text: string): void;
  interrupt(): void;
  disconnect(): Promise<void>;
}

export const SOPHIA_PRESENTATION_ADAPTERS = new InjectionToken<
  readonly SophiaPresentationAdapter[]
>('SOPHIA_PRESENTATION_ADAPTERS');
