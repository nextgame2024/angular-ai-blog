import { Injectable } from '@angular/core';

export interface SophiaRealtimeConnectRequest {
  clientSecret: string;
  onRemoteStream(stream: MediaStream): void;
  onAudioDelta?(audioData: Uint8Array): void;
  onAudioDone?(): void;
  onOutputAudioStarted?(): void;
  onOutputAudioStopped?(): void;
  onAssistantTextDone?(text: string): void;
  onEvent(event: unknown): void;
  onToolCall(toolCall: SophiaRealtimeToolCall): Promise<unknown>;
  onStatus(status: string): void;
}

export interface SophiaRealtimeToolCall {
  callId: string;
  name: string;
  arguments: Record<string, unknown>;
}

@Injectable()
export class SophiaRealtimeClientService {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private localStream: MediaStream | null = null;
  private handledToolCallIds = new Set<string>();
  private microphoneResumeTimer: number | null = null;
  private microphoneSuppressed = false;
  private assistantAudioPlaying = false;

  async connect(request: SophiaRealtimeConnectRequest): Promise<void> {
    await this.disconnect();

    request.onStatus('Requesting microphone');
    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: false,
        channelCount: 1,
      },
    });

    const peerConnection = new RTCPeerConnection();
    this.peerConnection = peerConnection;

    for (const track of this.localStream.getTracks()) {
      peerConnection.addTrack(track, this.localStream);
    }

    peerConnection.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) request.onRemoteStream(stream);
    };

    peerConnection.onconnectionstatechange = () => {
      request.onStatus(peerConnection.connectionState);
    };

    const dataChannel = peerConnection.createDataChannel('oai-events');
    this.dataChannel = dataChannel;
    dataChannel.onopen = () => request.onStatus('Realtime connected');
    dataChannel.onmessage = (message) => {
      void this.handleServerEvent(message.data, request);
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    const form = new FormData();
    form.set('sdp', offer.sdp || '');

    request.onStatus('Connecting to OpenAI Realtime');
    const response = await fetch('https://api.openai.com/v1/realtime/calls', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${request.clientSecret}`,
      },
      signal: AbortSignal.timeout(15_000),
      body: form,
    });

    if (!response.ok) {
      throw new Error(`OpenAI Realtime connection failed: ${response.status}`);
    }

    const answerSdp = await response.text();
    await peerConnection.setRemoteDescription({
      type: 'answer',
      sdp: answerSdp,
    });
  }

  async disconnect(): Promise<void> {
    this.handledToolCallIds.clear();
    this.clearMicrophoneResumeTimer();
    this.microphoneSuppressed = false;
    this.assistantAudioPlaying = false;

    this.dataChannel?.close();
    this.dataChannel = null;

    this.localStream?.getTracks().forEach((track) => track.stop());
    this.localStream = null;

    this.peerConnection?.close();
    this.peerConnection = null;
  }

  private async handleServerEvent(
    rawData: string,
    request: SophiaRealtimeConnectRequest,
  ): Promise<void> {
    const event = parseRealtimeEvent(rawData);
    if (!event) return;

    request.onEvent(event);
    this.updateMicrophoneState(event, request);

    const audioDelta = extractAudioDelta(event);
    if (audioDelta) {
      request.onAudioDelta?.(audioDelta);
    }

    if (isAudioDoneEvent(event)) {
      request.onAudioDone?.();
    }

    const assistantText = extractAssistantTextDone(event);
    if (assistantText) {
      request.onAssistantTextDone?.(assistantText);
    }

    const toolCall = extractToolCall(event);
    if (!toolCall) return;
    if (this.handledToolCallIds.has(toolCall.callId)) return;
    this.handledToolCallIds.add(toolCall.callId);

    try {
      const output = await request.onToolCall(toolCall);
      this.sendEvent({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: toolCall.callId,
          output: JSON.stringify(output),
        },
      });
      this.sendEvent({ type: 'response.create' });
    } catch (error) {
      this.sendEvent({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: toolCall.callId,
          output: JSON.stringify({
            error:
              error instanceof Error
                ? error.message
                : 'Runtime tool execution failed.',
          }),
        },
      });
      this.sendEvent({ type: 'response.create' });
    }
  }

  private sendEvent(event: Record<string, unknown>): void {
    if (this.dataChannel?.readyState !== 'open') return;
    this.dataChannel.send(JSON.stringify(event));
  }

  private updateMicrophoneState(
    event: Record<string, unknown>,
    request: SophiaRealtimeConnectRequest,
  ): void {
    const type = event['type'];
    if (type === 'output_audio_buffer.started') {
      this.assistantAudioPlaying = true;
      this.clearMicrophoneResumeTimer();
      this.setMicrophoneEnabled(false);
      request.onOutputAudioStarted?.();
      return;
    }

    if (type === 'output_audio_buffer.stopped') {
      this.assistantAudioPlaying = false;
      request.onOutputAudioStopped?.();
      this.scheduleMicrophoneResume();
      return;
    }

    if (
      type === 'response.cancelled' ||
      type === 'output_audio_buffer.cleared' ||
      type === 'error'
    ) {
      this.assistantAudioPlaying = false;
      request.onOutputAudioStopped?.();
      this.scheduleMicrophoneResume();
    }
  }

  private scheduleMicrophoneResume(): void {
    this.clearMicrophoneResumeTimer();
    this.microphoneResumeTimer = window.setTimeout(() => {
      this.microphoneResumeTimer = null;
      if (!this.microphoneSuppressed && !this.assistantAudioPlaying) {
        this.setMicrophoneEnabled(true);
      }
    }, 500);
  }

  private clearMicrophoneResumeTimer(): void {
    if (this.microphoneResumeTimer === null) return;
    window.clearTimeout(this.microphoneResumeTimer);
    this.microphoneResumeTimer = null;
  }

  private setMicrophoneEnabled(enabled: boolean): void {
    this.localStream?.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
    });
  }

  setMicrophoneSuppressed(suppressed: boolean): void {
    this.microphoneSuppressed = suppressed;
    this.clearMicrophoneResumeTimer();
    this.setMicrophoneEnabled(!suppressed && !this.assistantAudioPlaying);
  }

  promptAssistant(instructions: string): void {
    this.sendEvent({
      type: 'response.create',
      response: { instructions },
    });
  }
}

export function extractAudioDelta(
  event: Record<string, unknown>,
): Uint8Array | null {
  const type = event['type'];
  const delta = event['delta'];
  if (
    (type !== 'response.output_audio.delta' &&
      type !== 'response.audio.delta') ||
    typeof delta !== 'string'
  ) {
    return null;
  }

  return decodeBase64(delta);
}

export function isAudioDoneEvent(event: Record<string, unknown>): boolean {
  const type = event['type'];
  return type === 'response.output_audio.done' || type === 'response.audio.done';
}

export function extractAssistantTextDone(
  event: Record<string, unknown>,
): string | null {
  const type = event['type'];
  const value =
    type === 'response.output_text.done'
      ? event['text']
      : type === 'response.output_audio_transcript.done'
        ? event['transcript']
        : null;
  if (typeof value !== 'string') return null;
  return value.trim() || null;
}

function decodeBase64(value: string): Uint8Array | null {
  try {
    const binary = window.atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
}

function parseRealtimeEvent(rawData: string): Record<string, unknown> | null {
  try {
    return JSON.parse(rawData) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractToolCall(
  event: Record<string, unknown>,
): SophiaRealtimeToolCall | null {
  if (event['type'] === 'response.output_item.done') {
    const item = event['item'] as Record<string, unknown> | undefined;
    if (item?.['type'] === 'function_call') {
      return normalizeToolCall(item);
    }
  }

  if (event['type'] === 'response.function_call_arguments.done') {
    return normalizeToolCall(event);
  }

  return null;
}

function normalizeToolCall(
  item: Record<string, unknown>,
): SophiaRealtimeToolCall | null {
  const callId = item['call_id'];
  const name = item['name'];
  const args = item['arguments'];

  if (typeof callId !== 'string' || typeof name !== 'string') return null;

  return {
    callId,
    name,
    arguments: parseToolArguments(args),
  };
}

function parseToolArguments(value: unknown): Record<string, unknown> {
  if (typeof value !== 'string' || !value.trim()) return {};

  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
