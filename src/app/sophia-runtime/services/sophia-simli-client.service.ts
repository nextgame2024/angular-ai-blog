import { Injectable } from '@angular/core';

type SimliTransportMode = 'livekit' | 'p2p';

interface SimliRuntimeModule {
  SimliClient: new (
    sessionToken: string,
    videoElement: HTMLVideoElement,
    audioElement: HTMLAudioElement,
    iceServers: RTCIceServer[] | null,
    logLevel?: number,
    transportMode?: SimliTransportMode,
  ) => SimliClientInstance;
  LogLevel: {
    DEBUG: number;
    INFO: number;
    ERROR: number;
    CRITICAL: number;
  };
}

interface SimliClientInstance {
  start(): Promise<void>;
  stop(): Promise<void>;
  listenToMediastreamTrack(track: MediaStreamTrack): void;
  ClearBuffer(): void;
  sendAudioDataImmediate(audioData: Uint8Array): void;
  on(event: string, callback: (...args: unknown[]) => void): void;
}

export interface SophiaSimliConnectRequest {
  sessionToken: string;
  transportMode?: SimliTransportMode;
  videoElement: HTMLVideoElement;
  audioElement: HTMLAudioElement;
  onStatus(status: string): void;
  onEvent(event: string): void;
}

@Injectable()
export class SophiaSimliClientService {
  private client: SimliClientInstance | null = null;
  private connectedTrackId: string | null = null;

  async connect(request: SophiaSimliConnectRequest): Promise<void> {
    await this.disconnect();

    const { SimliClient, LogLevel } = await import('simli-client/dist/client');
    const transportMode = request.transportMode || 'livekit';

    request.audioElement.muted = false;
    request.videoElement.muted = true;
    request.videoElement.playsInline = true;

    const client = new (SimliClient as SimliRuntimeModule['SimliClient'])(
      request.sessionToken,
      request.videoElement,
      request.audioElement,
      null,
      LogLevel.INFO,
      transportMode,
    );

    this.bindEvents(client, request);
    this.client = client;

    request.onStatus('Connecting avatar');
    await client.start();
  }

  attachAudioStream(stream: MediaStream): void {
    const audioTrack = stream.getAudioTracks()[0];
    if (!this.client || !audioTrack) return;
    if (this.connectedTrackId === audioTrack.id) return;

    this.connectedTrackId = audioTrack.id;
    this.client.listenToMediastreamTrack(audioTrack);
  }

  clearBuffer(): void {
    this.client?.ClearBuffer();
  }

  sendAudioDataImmediate(audioData: Uint8Array): void {
    if (!this.client || !audioData.byteLength) return;
    this.client.sendAudioDataImmediate(audioData);
  }

  async disconnect(): Promise<void> {
    this.connectedTrackId = null;
    const client = this.client;
    this.client = null;

    if (client) {
      await client.stop();
    }
  }

  private bindEvents(
    client: SimliClientInstance,
    request: SophiaSimliConnectRequest,
  ): void {
    const events = [
      'start',
      'stop',
      'error',
      'speaking',
      'silent',
      'ack',
      'startup_error',
      'video_info',
    ];

    for (const event of events) {
      client.on(event, (...args: unknown[]) => {
        request.onEvent(`simli.${event}`);
        if (event === 'start') request.onStatus('Avatar connected');
        if (event === 'stop') request.onStatus('Avatar disconnected');
        if (event === 'error' || event === 'startup_error') {
          request.onStatus(formatSimliError(args));
        }
      });
    }
  }
}

function formatSimliError(args: unknown[]): string {
  const [first] = args;
  return typeof first === 'string' && first.trim()
    ? `Avatar error: ${first}`
    : 'Avatar error';
}
