import { Injectable } from '@angular/core';

export interface SophiaRealtimeConnectRequest {
  clientSecret: string;
  onRemoteStream(stream: MediaStream): void;
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

  async connect(request: SophiaRealtimeConnectRequest): Promise<void> {
    await this.disconnect();

    request.onStatus('Requesting microphone');
    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
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

    const toolCall = extractToolCall(event);
    if (!toolCall) return;

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
