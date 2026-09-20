import { Injectable } from '@angular/core';
import Daily, {
  type DailyCall,
  type DailyParticipant,
} from '@daily-co/daily-js';

export interface SophiaTavusConnectRequest {
  microphoneStream?: MediaStream;
  conversationId: string;
  conversationUrl: string;
  meetingToken: string;
  videoElement: HTMLVideoElement;
  audioElement: HTMLAudioElement;
  onStatus(status: string): void;
  onEvent(event: string): void;
  onUserUtterance?(): void;
  onUserSpeechStopped?(): void;
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
  private onUserSpeechStopped: (() => void) | null = null;
  private onUserUtterance: (() => void) | null = null;
  private onReplicaSpeechStarted: (() => void) | null = null;
  private onReplicaSpeechStopped: (() => void) | null = null;
  private onReplicaUtterance: (() => void) | null = null;

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
    this.onUserSpeechStopped = request.onUserSpeechStopped || null;
    this.onReplicaSpeechStarted = request.onReplicaSpeechStarted || null;
    this.onReplicaSpeechStopped = request.onReplicaSpeechStopped || null;
    this.onReplicaUtterance = request.onReplicaUtterance || null;

    const call = Daily.createCallObject({
      subscribeToTracksAutomatically: true,
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
      .on('participant-updated', () => this.attachRemoteTracks())
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
        ...(request.microphoneStream ? {audioSource:request.microphoneStream.getAudioTracks()[0]} : {}),
        url: request.conversationUrl,
        token: request.meetingToken,
        userName: 'Sophia customer',
        startAudioOff: false,
        startVideoOff: true,
      });
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
    this.onUserSpeechStopped = null;
    this.onReplicaSpeechStarted = null;
    this.onReplicaSpeechStopped = null;
    this.onReplicaUtterance = null;

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

    if (videoTrack && audioTrack && !this.connected) {
      this.connected = true;
      this.updateStatus('Tavus Full connected');
      this.emitEvent('tavus.remote_media_connected');
    }
  }

  private async handleAppMessage(data: unknown): Promise<void> {
    const message = normalizeAppMessage(data);
    if (message?.['conversation_id'] && message['conversation_id'] !== this.conversationId) return;
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
      if (role === 'user') this.onUserSpeechStopped?.();
      if (role === 'pal' || role === 'replica') this.onReplicaUtterance?.();
    }
    if ((eventType === 'conversation.stopped_speaking' && role === 'user') || eventType === 'user.stopped_speaking') this.onUserSpeechStopped?.();
    if (!message || eventType !== 'conversation.tool_call' || !this.call || !this.onToolCall) return;

    const properties = asRecord(message['properties']);
    const conversationId = message['conversation_id'];
    const callId = properties?.['tool_call_id'];
    const name = properties?.['name'];
    if (typeof conversationId !== 'string' || typeof callId !== 'string' || typeof name !== 'string') {
      this.emitEvent('tavus.tool_call.invalid');
      return;
    }
    if (conversationId !== this.conversationId || this.handledToolCallIds.has(callId)) return;
    const activeCall = this.call;
    this.handledToolCallIds.add(callId);

    try {
      const output = await this.onToolCall({
        callId,
        name,
        arguments: parseToolArguments(properties?.['arguments']),
        conversationId,
      });
      if (this.call !== activeCall || this.conversationId !== conversationId) return;
      this.sendToolResult(
        conversationId,
        callId,
        compactTavusToolOutput(name, output),
        'success',
      );
      this.emitEvent(`tavus.tool_result.${name}.success`);
    } catch (error) {
      if (this.call !== activeCall || this.conversationId !== conversationId) return;
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

const TAVUS_RESULT_BUDGET_BYTES = 3_200;

/**
 * Tavus app messages have a hard 4 KB limit. The kiosk has already consumed the
 * full output to render its panel, so the PAL only needs the concise fields it
 * must speak or use in the next turn.
 */
export function compactTavusToolOutput(
  toolName: string,
  output: unknown,
): unknown {
  if (jsonBytes(output) <= TAVUS_RESULT_BUDGET_BYTES) return output;
  const payload = asRecord(output);
  if (!payload) return { result: 'The requested information is displayed on screen.' };

  const answer = textValue(payload['answer'], 2_200);
  if (answer) {
    return compactWithinBudget({
      status: payload['status'],
      answer,
      guidance: textValue(payload['guidance'], 500),
      panelDisplayed: true,
    });
  }

  const arrayKey = ['consultationSlots', 'slots', 'properties', 'results'].find(
    (key) => Array.isArray(payload[key]),
  );
  if (arrayKey) {
    return compactWithinBudget({
      status: payload['status'],
      [arrayKey]: (payload[arrayKey] as unknown[])
        .slice(0, toolName === 'getStudentConsultationSlots' ? 4 : 3)
        .map((value) => compactRecord(value)),
      guidance: textValue(payload['guidance'], 450),
      panelDisplayed: true,
    });
  }

  const objectKey = [
    'consultationReview',
    'bookingReview',
    'consultationBooking',
    'booking',
    'confirmationEmail',
    'property',
  ].find((key) => asRecord(payload[key]));
  if (objectKey) {
    return compactWithinBudget({
      status: payload['status'],
      [objectKey]: compactRecord(payload[objectKey]),
      confirmationEmail:
        objectKey === 'confirmationEmail'
          ? undefined
          : compactRecord(payload['confirmationEmail']),
      guidance: textValue(payload['guidance'], 600),
      panelDisplayed: true,
    });
  }

  return compactWithinBudget({
    status: payload['status'],
    guidance: textValue(payload['guidance'], 1_400),
    result: 'The full result is displayed on screen.',
  });
}

function compactRecord(value: unknown): unknown {
  const record = asRecord(value);
  if (!record) return value;
  const preferredKeys = [
    'slotId', 'startsAt', 'startsAtLabel', 'serviceName', 'adviserName',
    'isDemo', 'bookingId', 'customerName', 'customerEmail', 'includeSummary',
    'propertyId', 'address', 'propertyAddress', 'listingType', 'propertyType',
    'bedrooms', 'priceDisplay', 'status', 'mode', 'confirmedStartsAt',
  ];
  const result: Record<string, unknown> = {};
  for (const key of preferredKeys) {
    const item = record[key];
    if (item !== undefined && item !== null) {
      result[key] = typeof item === 'string' ? textValue(item, 320) : item;
    }
  }
  return Object.keys(result).length ? result : { summary: textValue(JSON.stringify(record), 700) };
}

function compactWithinBudget(value: Record<string, unknown>): unknown {
  const cleaned = Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined && item !== ''),
  );
  if (jsonBytes(cleaned) <= TAVUS_RESULT_BUDGET_BYTES) return cleaned;
  return {
    status: cleaned['status'],
    answer: textValue(cleaned['answer'], 2_400),
    guidance: textValue(cleaned['guidance'], 450),
    result: 'The full result is displayed on screen.',
  };
}

function jsonBytes(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function textValue(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;
}

function formatDailyError(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : 'Could not join the Tavus conversation.';
}
