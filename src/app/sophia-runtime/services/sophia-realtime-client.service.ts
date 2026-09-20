import { Injectable } from '@angular/core';

export interface SophiaRealtimeConnectRequest {
  clientSecret: string;
  microphoneStream?: MediaStream;
  onRemoteStream(stream: MediaStream): void;
  onAudioDelta?(audioData: Uint8Array): void;
  onAudioDone?(): void;
  onOutputAudioStarted?(): void;
  onUserSpeechStarted?(): void;
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
  private turnVersion = 0;
  private activeResponseId: string | null = null;
  private interruptedResponses = new Set<string>();

  async connect(request: SophiaRealtimeConnectRequest): Promise<void> {
    const startedAt = performance.now();
    await this.disconnect();

    request.onStatus(request.microphoneStream ? 'Microphone ready' : 'Requesting microphone');
    this.localStream = request.microphoneStream ?? await requestSophiaMicrophone();

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
    dataChannel.onopen = () => {
      console.info(`[Sophia startup] Realtime connected in ${Math.round(performance.now() - startedAt)} ms`);
      request.onStatus('Realtime connected');
    };
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
    this.turnVersion++;
    this.activeResponseId = null;
    this.interruptedResponses.clear();

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
    this.updateSpeechState(event, request);

    const audioDelta = extractAudioDelta(event);
    if (audioDelta) {
      request.onAudioDelta?.(audioDelta);
    }

    if (isAudioDoneEvent(event)) {
      request.onAudioDone?.();
    }

    const assistantText = this.interruptedResponses.has(String(event['response_id'])) ? null : extractAssistantTextDone(event);
    if (assistantText) {
      request.onAssistantTextDone?.(assistantText);
    }

    const toolCall = extractToolCall(event);
    if (!toolCall) return;
    if (this.handledToolCallIds.has(toolCall.callId)) return;
    this.handledToolCallIds.add(toolCall.callId);

    const channel = this.dataChannel;
    const turnVersion = this.turnVersion;
    try {
      const output = await request.onToolCall(toolCall);
      if (this.dataChannel !== channel) return;
      this.sendEvent({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: toolCall.callId,
          output: JSON.stringify(output),
        },
      });
      if (turnVersion === this.turnVersion) this.sendEvent({ type: 'response.create' });
    } catch (error) {
      if (this.dataChannel !== channel) return;
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
      if (turnVersion === this.turnVersion) this.sendEvent({ type: 'response.create' });
    }
  }

  private sendEvent(event: Record<string, unknown>): void {
    if (this.dataChannel?.readyState !== 'open') return;
    this.dataChannel.send(JSON.stringify(event));
  }

  private updateSpeechState(event: Record<string, unknown>, request: SophiaRealtimeConnectRequest): void {
    const type = event['type'];
    if (type === 'response.created') {
      const response = event['response'] as {id?: string} | undefined;
      this.activeResponseId = response?.id ?? null;
    }
    if (type === 'input_audio_buffer.speech_started') {
      if (this.activeResponseId) this.interruptedResponses.add(this.activeResponseId);
      this.turnVersion++;
      request.onUserSpeechStarted?.();
    }
    // Keep input audio enabled during playback: server VAD needs it for barge-in.
    // Browser echo cancellation handles speaker feedback.
    if (type === 'output_audio_buffer.started') request.onOutputAudioStarted?.();
    if (['output_audio_buffer.stopped', 'output_audio_buffer.cleared', 'response.cancelled', 'error'].includes(String(type))) {
      request.onOutputAudioStopped?.();
    }
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

// Called from Start so browser permission and server provisioning can overlap.
export function requestSophiaMicrophone(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({audio:{
    echoCancellation:true,noiseSuppression:true,autoGainControl:false,channelCount:1,
  }});
}
