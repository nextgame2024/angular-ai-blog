import { Injectable } from '@angular/core';

export interface SophiaGeminiLiveConnectRequest {
  clientSecret: string;
  bootstrap: Record<string, unknown>;
  onStatus(status: string): void;
  onEvent(event: unknown): void;
  onUserActivity(): void;
  onAssistantSpeechStarted(): void;
  onAssistantSpeechStopped(): void;
  onAssistantTurnCompleted(): void;
  onAssistantText(text: string): void;
  onToolCall(call: { callId: string; name: string; arguments: Record<string, unknown> }): Promise<unknown>;
}

@Injectable()
export class SophiaGeminiLiveClientService {
  private socket: WebSocket | null = null;
  private inputStream: MediaStream | null = null;
  private inputContext: AudioContext | null = null;
  private inputSource: MediaStreamAudioSourceNode | null = null;
  private inputProcessor: ScriptProcessorNode | null = null;
  private inputSilencer: GainNode | null = null;
  private outputContext: AudioContext | null = null;
  private outputSources = new Set<AudioBufferSourceNode>();
  private nextOutputTime = 0;
  private outputStopTimer: number | null = null;
  private handledToolCalls = new Set<string>();
  private cancelledToolCalls = new Set<string>();
  private aliases: Record<string, string> = {};

  async connect(request: SophiaGeminiLiveConnectRequest): Promise<void> {
    await this.disconnect();
    const bootstrap = validateBootstrap(request.bootstrap);
    this.aliases = bootstrap.toolAliases;
    const url = new URL(bootstrap.endpoint);
    url.searchParams.set('access_token', request.clientSecret);
    request.onStatus('Connecting to Gemini Live');
    const socket = new WebSocket(url.toString());
    this.socket = socket;

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      socket.onopen = () => socket.send(JSON.stringify({ setup: bootstrap.setup }));
      socket.onerror = () => {
        if (!settled) { settled = true; reject(new Error('Gemini Live WebSocket connection failed.')); }
        request.onStatus('Voice connection failed');
      };
      socket.onclose = () => {
        request.onStatus('Voice disconnected');
        if (!settled) { settled = true; reject(new Error('Gemini Live closed before setup completed.')); }
      };
      socket.onmessage = (message) => {
        const event = parseObject(message.data);
        if (!event) return;
        request.onEvent(event);
        if (event['setupComplete'] && !settled) {
          settled = true;
          void this.startInput(socket, request).catch(() => {
            request.onStatus('Microphone unavailable - text input ready');
          }).finally(() => {
            request.onStatus('Gemini Live connected');
            resolve();
          });
        }
        void this.handleEvent(event, request);
      };
    });
  }

  interrupt(): void {
    this.clearOutput();
  }

  promptAssistant(text: string): void {
    this.sendClientText(`Say exactly: "${text.slice(0, 2_000)}" Do not add anything else.`);
  }

  submitUserText(text: string): void {
    const bounded = text.trim().slice(0, 2_000);
    if (!bounded) return;
    this.sendClientText(bounded);
  }

  async disconnect(): Promise<void> {
    this.clearOutput();
    this.handledToolCalls.clear();
    this.cancelledToolCalls.clear();
    this.aliases = {};
    this.inputProcessor?.disconnect(); this.inputProcessor = null;
    this.inputSource?.disconnect(); this.inputSource = null;
    this.inputSilencer?.disconnect(); this.inputSilencer = null;
    this.inputStream?.getTracks().forEach((track) => track.stop()); this.inputStream = null;
    await this.inputContext?.close().catch(() => undefined); this.inputContext = null;
    await this.outputContext?.close().catch(() => undefined); this.outputContext = null;
    this.socket?.close(); this.socket = null;
  }

  private async startInput(socket: WebSocket, request: SophiaGeminiLiveConnectRequest): Promise<void> {
    request.onStatus('Requesting microphone');
    try {
      this.inputStream = await navigator.mediaDevices.getUserMedia({ audio: {
        echoCancellation: true, noiseSuppression: true, autoGainControl: false, channelCount: 1,
      } });
    } catch {
      request.onStatus('Microphone unavailable - text input ready');
      return;
    }
    const context = new AudioContext();
    const source = context.createMediaStreamSource(this.inputStream);
    const processor = context.createScriptProcessor(2_048, 1, 1);
    const silencer = context.createGain(); silencer.gain.value = 0;
    this.inputContext = context; this.inputSource = source; this.inputProcessor = processor; this.inputSilencer = silencer;
    processor.onaudioprocess = (event) => {
      if (socket.readyState !== WebSocket.OPEN) return;
      const samples = resample(event.inputBuffer.getChannelData(0), context.sampleRate, 16_000);
      socket.send(JSON.stringify({ realtimeInput: { audio: {
        data: pcmBase64(samples), mimeType: 'audio/pcm;rate=16000',
      } } }));
    };
    source.connect(processor); processor.connect(silencer); silencer.connect(context.destination);
  }

  private async handleEvent(event: Record<string, unknown>, request: SophiaGeminiLiveConnectRequest): Promise<void> {
    const normalized = normalizeGeminiLiveEvent(event, this.aliases);
    if (normalized.interrupted) {
        this.clearOutput(); request.onAssistantSpeechStopped(); request.onUserActivity();
    }
    if (normalized.outputText) request.onAssistantText(normalized.outputText);
    for (const audio of normalized.audio) this.playPcm(decodeBase64(audio), request.onAssistantSpeechStarted);
    if (normalized.turnComplete) this.finishOutput(request.onAssistantSpeechStopped, request.onAssistantTurnCompleted);
    for (const id of normalized.cancelledToolCallIds) this.cancelledToolCalls.add(id);
    for (const call of normalized.toolCalls) await this.handleToolCall(call, request);
  }

  private async handleToolCall(call: Record<string, unknown> | null, request: SophiaGeminiLiveConnectRequest): Promise<void> {
    const id = call?.['id']; const providerName = call?.['providerName']; const args = call?.['args'];
    if (typeof id !== 'string' || typeof providerName !== 'string' || this.handledToolCalls.has(id)) return;
    const name = call?.['name'];
    if (typeof name !== 'string' || !name) return;
    this.handledToolCalls.add(id);
    let response: Record<string, unknown>;
    try {
      const result = await request.onToolCall({ callId: id, name, arguments: record(args) ?? {} });
      response = record(result) ?? { result };
    } catch (error) {
      response = { error: error instanceof Error ? error.message.slice(0, 1_000) : 'Runtime tool execution failed.' };
    }
    if (this.cancelledToolCalls.has(id)) return;
    this.send({ toolResponse: { functionResponses: [{ id, name: providerName, response }] } });
  }

  private sendClientText(text: string): void {
    this.send({ clientContent: { turns: [{ role: 'user', parts: [{ text }] }], turnComplete: true } });
  }

  private send(message: Record<string, unknown>): void {
    if (this.socket?.readyState !== WebSocket.OPEN) throw new Error('Gemini Live is not connected.');
    this.socket.send(JSON.stringify(message));
  }

  private playPcm(bytes: Uint8Array | null, onStarted: () => void): void {
    if (!bytes?.byteLength || bytes.byteLength % 2) return;
    const context = this.outputContext ?? new AudioContext(); this.outputContext = context;
    const buffer = context.createBuffer(1, bytes.byteLength / 2, 24_000);
    const samples = buffer.getChannelData(0); const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let index = 0; index < samples.length; index += 1) samples[index] = view.getInt16(index * 2, true) / 32_768;
    const source = context.createBufferSource(); source.buffer = buffer; source.connect(context.destination);
    const start = Math.max(context.currentTime, this.nextOutputTime); source.start(start);
    this.nextOutputTime = start + buffer.duration; this.outputSources.add(source); onStarted();
    source.onended = () => this.outputSources.delete(source);
  }

  private finishOutput(onStopped: () => void, onCompleted: () => void): void {
    if (this.outputStopTimer !== null) window.clearTimeout(this.outputStopTimer);
    const remaining = Math.max(0, this.nextOutputTime - (this.outputContext?.currentTime ?? 0));
    this.outputStopTimer = window.setTimeout(() => {
      this.outputStopTimer = null; onStopped(); onCompleted();
    }, Math.ceil(remaining * 1_000));
  }

  private clearOutput(): void {
    if (this.outputStopTimer !== null) window.clearTimeout(this.outputStopTimer);
    this.outputStopTimer = null;
    for (const source of this.outputSources) { try { source.stop(); } catch { /* already stopped */ } }
    this.outputSources.clear(); this.nextOutputTime = 0;
  }
}

function validateBootstrap(value: Record<string, unknown>) {
  const endpoint = value['endpoint']; const setup = record(value['setup']); const toolAliases = record(value['toolAliases']);
  if (value['protocol'] !== 'gemini-live-websocket' || typeof endpoint !== 'string' || !setup || !toolAliases) {
    throw new Error('Gemini Live bootstrap is invalid.');
  }
  const url = new URL(endpoint);
  if (url.protocol !== 'wss:' || url.hostname !== 'generativelanguage.googleapis.com'
    || !url.pathname.endsWith('BidiGenerateContentConstrained')) throw new Error('Gemini Live endpoint is not trusted.');
  return { endpoint: url.toString(), setup, toolAliases: Object.fromEntries(Object.entries(toolAliases).filter((entry): entry is [string, string] => typeof entry[1] === 'string')) };
}

function resample(input: Float32Array, sourceRate: number, targetRate: number): Float32Array {
  if (sourceRate === targetRate) return input;
  const length = Math.max(1, Math.round(input.length * targetRate / sourceRate)); const output = new Float32Array(length);
  for (let index = 0; index < length; index += 1) output[index] = input[Math.min(input.length - 1, Math.floor(index * sourceRate / targetRate))];
  return output;
}

function pcmBase64(samples: Float32Array): string {
  const bytes = new Uint8Array(samples.length * 2); const view = new DataView(bytes.buffer);
  samples.forEach((sample, index) => view.setInt16(index * 2, Math.round(Math.max(-1, Math.min(1, sample)) * 32_767), true));
  let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte); return window.btoa(binary);
}

function decodeBase64(value: string): Uint8Array | null {
  try { const binary = window.atob(value); return Uint8Array.from(binary, (character) => character.charCodeAt(0)); } catch { return null; }
}
function parseObject(value: unknown): Record<string, unknown> | null { if (typeof value !== 'string') return null; try { return record(JSON.parse(value)); } catch { return null; } }
function record(value: unknown): Record<string, unknown> | null { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function array(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }

export function normalizeGeminiLiveEvent(event: Record<string, unknown>, aliases: Record<string, string>) {
  const serverContent = record(event['serverContent']);
  const transcript = record(serverContent?.['outputTranscription'])?.['text'];
  const audio: string[] = [];
  for (const part of array(record(serverContent?.['modelTurn'])?.['parts'])) {
    const inline = record(record(part)?.['inlineData']);
    if (inline?.['mimeType'] === 'audio/pcm;rate=24000' && typeof inline['data'] === 'string') audio.push(inline['data']);
  }
  const toolCalls = array(record(event['toolCall'])?.['functionCalls']).flatMap((raw) => {
    const call = record(raw); const id = call?.['id']; const providerName = call?.['name'];
    const name = typeof providerName === 'string' ? aliases[providerName] : undefined;
    return typeof id === 'string' && typeof providerName === 'string' && name
      ? [{ id, providerName, name, args: record(call?.['args']) ?? {} }] : [];
  });
  const cancelledToolCallIds = array(record(event['toolCallCancellation'])?.['ids'])
    .filter((id): id is string => typeof id === 'string');
  return { interrupted: serverContent?.['interrupted'] === true, turnComplete: serverContent?.['turnComplete'] === true,
    outputText: typeof transcript === 'string' && transcript.trim() ? transcript : undefined,
    audio, toolCalls, cancelledToolCallIds };
}
