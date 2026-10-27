import { Injectable } from '@angular/core';
import Daily, {
  type DailyCall,
  type DailyParticipant,
} from '@daily-co/daily-js';

export interface SophiaTavusConnectRequest {
  conversationId: string;
  conversationUrl: string;
  meetingToken: string;
  videoElement: HTMLVideoElement;
  audioElement: HTMLAudioElement;
  onStatus(status: string): void;
  onEvent(event: string): void;
  onUserUtterance?(): void;
  onReplicaSpeechStarted?(): void;
  onReplicaSpeechStopped?(): void;
  onReplicaUtterance?(): void;
  onToolCall(toolCall: SophiaTavusToolCall): Promise<unknown>;
}

export interface SophiaTavusToolCall {
  callId: string;
  name: string;
  arguments: Record<string, unknown>;
  conversationId: string;
}

@Injectable()
export class SophiaTavusClientService {
  private call: DailyCall | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private onStatus: ((status: string) => void) | null = null;
  private onEvent: ((event: string) => void) | null = null;
  private onToolCall: ((toolCall: SophiaTavusToolCall) => Promise<unknown>) | null = null;
  private handledToolCallIds = new Set<string>();
  private connected = false;
  private conversationId: string | null = null;
  private onUserUtterance: (() => void) | null = null;
  private onReplicaSpeechStarted: (() => void) | null = null;
  private onReplicaSpeechStopped: (() => void) | null = null;
  private onReplicaUtterance: (() => void) | null = null;
  private lastLocalAudioDiagnostic: string | null = null;

  async connect(request: SophiaTavusConnectRequest): Promise<void> {
    await this.disconnect();

    this.videoElement = request.videoElement;
    this.audioElement = request.audioElement;
    this.onStatus = request.onStatus;
    this.onEvent = request.onEvent;
    this.onToolCall = request.onToolCall;
    this.handledToolCallIds.clear();
    this.connected = false;
    this.conversationId = request.conversationId;
    this.onUserUtterance = request.onUserUtterance || null;
    this.onReplicaSpeechStarted = request.onReplicaSpeechStarted || null;
    this.onReplicaSpeechStopped = request.onReplicaSpeechStopped || null;
    this.onReplicaUtterance = request.onReplicaUtterance || null;
    this.lastLocalAudioDiagnostic = null;

    const call = Daily.createCallObject({
      subscribeToTracksAutomatically: true,
      audioSource: true,
      startAudioOff: false,
      startVideoOff: true,
    });
    this.call = call;

    call
      .on('joining-meeting', () => this.updateStatus('Joining Tavus conversation'))
      .on('joined-meeting', () => {
        this.emitEvent('tavus.joined');
        this.attachRemoteTracks();
      })
      .on('participant-joined', () => this.attachRemoteTracks())
      .on('participant-updated', () => this.refreshMediaState())
      .on('track-started', () => this.attachRemoteTracks())
      .on('participant-left', () => this.attachRemoteTracks())
      .on('app-message', (event) => {
        void this.handleAppMessage(event.data);
      })
      .on('camera-error', (event) => {
        this.emitEvent(`tavus.media_error.${event.errorMsg.errorMsg}`);
      })
      .on('error', (event) => {
        this.updateStatus('Tavus connection failed');
        this.emitEvent(`tavus.error.${event.errorMsg}`);
      })
      .on('left-meeting', () => {
        this.connected = false;
        this.emitEvent('tavus.left');
      });

    try {
      await call.join({
        url: request.conversationUrl,
        token: request.meetingToken,
        userName: 'Sophia customer',
        startAudioOff: false,
        startVideoOff: true,
      });
      call.setLocalAudio(true);
      await waitForPublishedMicrophone(call);
      this.emitLocalAudioDiagnostic(call);
      this.attachRemoteTracks();
    } catch (error) {
      await this.disconnect();
      throw new Error(`Tavus: ${formatDailyError(error)}`);
    }
  }

  async disconnect(): Promise<void> {
    const call = this.call;
    this.call = null;
    this.connected = false;
    this.conversationId = null;
    this.onUserUtterance = null;
    this.onReplicaSpeechStarted = null;
    this.onReplicaSpeechStopped = null;
    this.onReplicaUtterance = null;
    this.lastLocalAudioDiagnostic = null;

    this.clearMediaElement(this.videoElement);
    this.clearMediaElement(this.audioElement);
    this.videoElement = null;
    this.audioElement = null;
    this.onStatus = null;
    this.onEvent = null;
    this.onToolCall = null;
    this.handledToolCallIds.clear();

    if (!call || call.isDestroyed()) return;

    if (call.meetingState() !== 'left-meeting') {
      await call.leave().catch(() => undefined);
    }
    if (!call.isDestroyed()) await call.destroy();
  }

  private attachRemoteTracks(): void {
    const call = this.call;
    if (!call) return;

    const participants = Object.values(call.participants()).filter(
      (participant) => !participant.local,
    );
    const videoParticipant = participants.find((participant) =>
      getTrack(participant, 'video'),
    );
    const audioParticipant = participants.find((participant) =>
      getTrack(participant, 'audio'),
    );
    const videoTrack = videoParticipant
      ? getTrack(videoParticipant, 'video')
      : null;
    const audioTrack = audioParticipant
      ? getTrack(audioParticipant, 'audio')
      : null;

    if (videoTrack && this.videoElement) {
      this.attachTrack(this.videoElement, videoTrack);
    }
    if (audioTrack && this.audioElement) {
      this.audioElement.muted = false;
      this.attachTrack(this.audioElement, audioTrack);
    }

    if (videoTrack && audioTrack && microphoneIsPublished(call) && !this.connected) {
      this.connected = true;
      this.updateStatus('Tavus Full connected');
      this.emitEvent('tavus.remote_media_connected');
    }
  }

  private refreshMediaState(): void {
    const call = this.call;
    if (!call) return;
    this.emitLocalAudioDiagnostic(call);
    if (this.connected && !microphoneIsPublished(call)) {
      this.connected = false;
      this.updateStatus(localAudioFailureMessage(call));
    }
    this.attachRemoteTracks();
  }

  private emitLocalAudioDiagnostic(call: DailyCall): void {
    const diagnostic = localAudioDiagnostic(call);
    if (diagnostic === this.lastLocalAudioDiagnostic) return;
    this.lastLocalAudioDiagnostic = diagnostic;
    this.emitEvent(`tavus.local_audio.${diagnostic}`);
  }

  private async handleAppMessage(data: unknown): Promise<void> {
    const message = normalizeAppMessage(data);
    const eventType = message?.['event_type'];
    this.emitEvent(`tavus.${extractAppMessageType(message || data)}`);
    const role = asRecord(message?.['properties'])?.['role'];
    if (
      (eventType === 'conversation.started_speaking' && role === 'user') ||
      eventType === 'user.started_speaking'
    ) {
      this.onUserUtterance?.();
    }
    if (
      (eventType === 'conversation.started_speaking' &&
        (role === 'pal' || role === 'replica')) ||
      eventType === 'replica.started_speaking'
    ) {
      this.onReplicaSpeechStarted?.();
    }
    if (
      (eventType === 'conversation.stopped_speaking' &&
        (role === 'pal' || role === 'replica')) ||
      eventType === 'replica.stopped_speaking'
    ) {
      this.onReplicaSpeechStopped?.();
    }
    if (message && eventType === 'conversation.utterance') {
      if (role === 'user') this.onUserUtterance?.();
      if (role === 'pal' || role === 'replica') this.onReplicaUtterance?.();
    }
    if (!message || eventType !== 'conversation.tool_call' || !this.call || !this.onToolCall) return;

    const properties = asRecord(message['properties']);
    const conversationId = message['conversation_id'];
    const callId = properties?.['tool_call_id'];
    const name = properties?.['name'];
    if (typeof conversationId !== 'string' || typeof callId !== 'string' || typeof name !== 'string') {
      this.emitEvent('tavus.tool_call.invalid');
      return;
    }
    if (this.handledToolCallIds.has(callId)) return;
    this.handledToolCallIds.add(callId);

    try {
      const output = await this.onToolCall({
        callId,
        name,
        arguments: parseToolArguments(properties?.['arguments']),
        conversationId,
      });
      this.sendToolResult(conversationId, callId, output, 'success');
      this.emitEvent(`tavus.tool_result.${name}.success`);
    } catch (error) {
      this.sendToolResult(
        conversationId,
        callId,
        { error: error instanceof Error ? error.message : 'Runtime tool execution failed.' },
        'error',
      );
      this.emitEvent(`tavus.tool_result.${name}.error`);
    }
  }

  private sendToolResult(
    conversationId: string,
    callId: string,
    output: unknown,
    status: 'success' | 'error',
  ): void {
    this.call?.sendAppMessage({
      message_type: 'conversation',
      event_type: 'conversation.tool_result',
      conversation_id: conversationId,
      properties: { tool_call_id: callId, output, status },
    }, '*');
  }

  speak(text: string): void {
    if (!this.call || !this.conversationId) return;
    this.call.sendAppMessage({
      message_type: 'conversation',
      event_type: 'conversation.echo',
      conversation_id: this.conversationId,
      properties: { modality: 'text', text, done: true },
    }, '*');
  }

  respond(text: string): void {
    if (!this.call || !this.conversationId) return;
    this.call.sendAppMessage({
      message_type: 'conversation',
      event_type: 'conversation.respond',
      conversation_id: this.conversationId,
      properties: { text },
    }, '*');
  }

  interrupt(): void {
    if (!this.call || !this.conversationId) return;
    this.call.sendAppMessage({
      message_type: 'conversation',
      event_type: 'conversation.interrupt',
      conversation_id: this.conversationId,
    }, '*');
  }

  private attachTrack(
    element: HTMLMediaElement,
    track: MediaStreamTrack,
  ): void {
    const currentTrack = (element.srcObject as MediaStream | null)
      ?.getTracks()
      .at(0);
    if (currentTrack?.id === track.id) return;

    element.srcObject = new MediaStream([track]);
    void element.play().catch(() => {
      this.updateStatus('Tap Start again to allow Tavus audio playback');
      this.emitEvent('tavus.autoplay_blocked');
    });
  }

  private clearMediaElement(element: HTMLMediaElement | null): void {
    if (!element) return;
    element.pause();
    element.srcObject = null;
  }

  private updateStatus(status: string): void {
    this.onStatus?.(status);
  }

  private emitEvent(event: string): void {
    this.onEvent?.(event);
  }
}

function getTrack(
  participant: DailyParticipant,
  kind: 'audio' | 'video',
): MediaStreamTrack | null {
  const trackState = participant.tracks[kind];
  return trackState.track || trackState.persistentTrack || null;
}

function extractAppMessageType(data: unknown): string {
  if (typeof data === 'object' && data) {
    const record = data as Record<string, unknown>;
    const type = record['event_type'] || record['type'];
    if (type) return String(type).replace(/[^a-zA-Z0-9_.-]/g, '_');
  }
  return 'app_message';
}

function normalizeAppMessage(data: unknown): Record<string, unknown> | null {
  if (typeof data === 'string') {
    try { return asRecord(JSON.parse(data)); } catch { return null; }
  }
  return asRecord(data);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? value as Record<string, unknown>
    : null;
}

function parseToolArguments(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    try { return asRecord(JSON.parse(value)) || {}; } catch { return {}; }
  }
  return asRecord(value) || {};
}

function formatDailyError(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : 'Could not join the Tavus conversation.';
}

async function waitForPublishedMicrophone(call: DailyCall): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (!microphoneIsPublished(call) && Date.now() < deadline) {
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
  }
  if (!microphoneIsPublished(call)) {
    throw new Error(localAudioFailureMessage(call));
  }
}

function microphoneIsPublished(call: DailyCall): boolean {
  const audio = call.participants().local?.tracks.audio;
  const track = audio?.track || audio?.persistentTrack;
  return call.localAudio() && Boolean(
    track && track.enabled && track.readyState === 'live' &&
    audio && audio.state !== 'blocked' && audio.state !== 'off' && audio.state !== 'interrupted',
  );
}

function localAudioFailureMessage(call: DailyCall): string {
  const audio = call.participants().local?.tracks.audio;
  if (audio?.state === 'blocked' && audio.blocked?.byPermissions) {
    return 'Microphone permission is blocked. Allow microphone access and start Sophia again.';
  }
  if (audio?.state === 'blocked' && audio.blocked?.byDeviceMissing) {
    return 'No microphone is available. Connect a microphone and start Sophia again.';
  }
  if (audio?.state === 'blocked' && audio.blocked?.byDeviceInUse) {
    return 'The microphone is being used by another application. Close it and start Sophia again.';
  }
  if (audio?.state === 'off' && audio.off?.byCanSendPermission) {
    return 'This Tavus room does not allow microphone audio.';
  }
  return 'The microphone could not publish audio to Tavus. Check the selected microphone and start Sophia again.';
}

function localAudioDiagnostic(call: DailyCall): string {
  const audio = call.participants().local?.tracks.audio;
  if (microphoneIsPublished(call)) return 'published';
  if (audio?.state === 'blocked' && audio.blocked?.byPermissions) return 'blocked_permissions';
  if (audio?.state === 'blocked' && audio.blocked?.byDeviceMissing) return 'blocked_missing_device';
  if (audio?.state === 'blocked' && audio.blocked?.byDeviceInUse) return 'blocked_device_in_use';
  if (audio?.state === 'off' && audio.off?.byCanSendPermission) return 'send_not_permitted';
  return String(audio?.state || 'unavailable').replace(/[^a-z0-9_-]/gi, '_');
}
