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

type SimliRuntimeImport = SimliRuntimeModule & {
  default?: Partial<SimliRuntimeModule>;
};

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

    const simliModule = (await import(
      'simli-client/dist/client'
    )) as SimliRuntimeImport;
    const SimliClient = simliModule.SimliClient || simliModule.default?.SimliClient;
    const logLevel = simliModule.LogLevel || simliModule.default?.LogLevel;
    const transportMode = request.transportMode || 'livekit';

    if (!SimliClient) {
      throw new Error('Simli client module did not expose SimliClient.');
    }

    request.audioElement.muted = false;
    request.videoElement.muted = true;
    request.videoElement.playsInline = true;

    const client = new SimliClient(
      request.sessionToken,
      request.videoElement,
      request.audioElement,
      null,
      logLevel?.INFO ?? logLevel?.ERROR ?? 2,
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

  sendOpenAiPcm16AudioDataImmediate(audioData: Uint8Array): void {
    this.sendAudioDataImmediate(downsamplePcm16(audioData, 24_000, 16_000));
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

function downsamplePcm16(
  audioData: Uint8Array,
  inputRate: number,
  outputRate: number,
): Uint8Array {
  if (inputRate === outputRate || audioData.byteLength < 4) return audioData;

  const inputSamples = new Int16Array(
    audioData.buffer,
    audioData.byteOffset,
    Math.floor(audioData.byteLength / 2),
  );
  const ratio = inputRate / outputRate;
  const outputLength = Math.max(1, Math.floor(inputSamples.length / ratio));
  const output = new Int16Array(outputLength);

  for (let index = 0; index < outputLength; index += 1) {
    const sourceIndex = index * ratio;
    const leftIndex = Math.floor(sourceIndex);
    const rightIndex = Math.min(leftIndex + 1, inputSamples.length - 1);
    const weight = sourceIndex - leftIndex;
    output[index] = Math.round(
      inputSamples[leftIndex] * (1 - weight) + inputSamples[rightIndex] * weight,
    );
  }

  return new Uint8Array(output.buffer);
}

function formatSimliError(args: unknown[]): string {
  const [first] = args;
  return typeof first === 'string' && first.trim()
    ? `Avatar error: ${first}`
    : 'Avatar error';
}
