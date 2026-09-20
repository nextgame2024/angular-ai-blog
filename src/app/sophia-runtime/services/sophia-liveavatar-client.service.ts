import { Injectable } from '@angular/core';
import {
  AgentEventsEnum,
  LiveAvatarSession,
  SessionEvent,
  SessionMode,
  SessionState,
} from '@heygen/liveavatar-web-sdk';

export interface SophiaLiveAvatarConnectRequest {
  sessionToken: string;
  videoElement: HTMLVideoElement;
  onStatus(status: string): void;
  onEvent(event: string): void;
  onSpeakingChange?(speaking: boolean): void;
}

@Injectable()
export class SophiaLiveAvatarClientService {
  private session: LiveAvatarSession | null = null;
  private audioChunks: Uint8Array[] = [];
  private audioByteLength = 0;
  private onEvent: ((event: string) => void) | null = null;
  private speakingTimeout: number | null = null;

  async connect(request: SophiaLiveAvatarConnectRequest): Promise<void> {
    await this.disconnect();

    const session = new LiveAvatarSession(request.sessionToken, {
      voiceChat: false,
    });
    this.session = session;
    this.onEvent = request.onEvent;
    this.emitDiagnostic(
      `session_created.mode_${session.mode}.state_${session.state}`,
    );
    request.videoElement.muted = false;
    request.videoElement.playsInline = true;

    session.on(SessionEvent.SESSION_STREAM_READY, () => {
      if (this.session !== session) return;
      session.attach(request.videoElement);
      void request.videoElement.play().catch(() => undefined);
      request.onStatus('Avatar connected');
      request.onEvent('liveavatar.stream_ready');
      this.emitDiagnostic('stream_ready');
    });
    session.on(SessionEvent.SESSION_STATE_CHANGED, (state) => {
      request.onEvent(`liveavatar.${state.toLowerCase()}`);
      this.emitDiagnostic(`state_${state.toLowerCase()}`);
    });
    session.on(SessionEvent.SESSION_DISCONNECTED, (reason) => {
      request.onSpeakingChange?.(false);
      request.onStatus('Avatar disconnected');
      request.onEvent(`liveavatar.disconnected.${reason.toLowerCase()}`);
    });
    session.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, () => {
      this.clearSpeakingTimeout();
      request.onSpeakingChange?.(true);
      request.onEvent('liveavatar.speaking');
      this.emitDiagnostic('speaking_acknowledged');
    });
    session.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, () => {
      request.onSpeakingChange?.(false);
      request.onEvent('liveavatar.silent');
    });

    request.onStatus('Connecting avatar');
    try {
      await session.start();
    } catch (error) {
      request.onSpeakingChange?.(false);
      if (this.session === session) this.session = null;
      session.removeAllListeners();
      throw error;
    }
  }

  appendAudio(audioData: Uint8Array): void {
    if (
      !this.session ||
      this.session.mode !== SessionMode.LITE ||
      !audioData.byteLength
    ) {
      return;
    }
    if (this.audioByteLength === 0) {
      this.onEvent?.('liveavatar.audio_capture_started');
      this.emitDiagnostic('direct_pcm_capture_started.rate_24000');
    }
    const copy = audioData.slice();
    this.audioChunks.push(copy);
    this.audioByteLength += copy.byteLength;
  }

  speakText(text: string): void {
    const session = this.session;
    const message = text.trim();
    if (!session || session.mode !== SessionMode.FULL || !message) return;

    try {
      const eventId = session.repeat(message);
      this.onEvent?.(`liveavatar.text_sent.${message.length}`);
      this.emitDiagnostic(
        `text_submitted.chars_${message.length}.event_${eventId.slice(0, 8)}.sdk_state_${session.state}`,
      );
      this.armSpeakingTimeout(session);
    } catch (error) {
      this.onEvent?.(`liveavatar.text_failed.${formatError(error)}`);
      throw error;
    }
  }

  sendBufferedAudio(): void {
    const session = this.session;
    if (!session || session.mode !== SessionMode.LITE) return;
    if (!this.audioByteLength) {
      this.onEvent?.('liveavatar.audio_empty');
      return;
    }

    const audio = new Uint8Array(this.audioByteLength);
    let offset = 0;
    for (const chunk of this.audioChunks) {
      audio.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const byteLength = audio.byteLength;
    const stats = analyzePcm16(audio);
    this.emitDiagnostic(
      `pcm.bytes_${byteLength}.duration_ms_${stats.durationMs}.rms_${stats.rms}.peak_${stats.peak}.zero_pct_${stats.zeroPercent}`,
    );
    this.clearBuffer();
    try {
      const eventId = session.repeatAudio(pcmBytesToBinaryString(audio));
      this.onEvent?.(`liveavatar.audio_sent.${byteLength}`);
      this.emitDiagnostic(
        `audio_submitted.event_${eventId.slice(0, 8)}.sdk_state_${session.state}`,
      );
      this.armSpeakingTimeout(session);
    } catch (error) {
      this.onEvent?.(`liveavatar.audio_failed.${formatError(error)}`);
      throw error;
    }
  }

  clearBuffer(): void {
    this.audioChunks = [];
    this.audioByteLength = 0;
  }

  async disconnect(): Promise<void> {
    this.clearSpeakingTimeout();
    this.clearBuffer();
    const session = this.session;
    this.session = null;
    this.onEvent = null;
    if (!session) return;

    try {
      if (
        session.state !== SessionState.INACTIVE &&
        session.state !== SessionState.DISCONNECTED
      ) {
        await session.stop();
      }
    } finally {
      session.removeAllListeners();
    }
  }

  private emitDiagnostic(
    detail: string,
    level: 'info' | 'warn' = 'info',
  ): void {
    this.onEvent?.(`liveavatar.diag.${detail}`);
    console[level]('[Sophia LiveAvatar]', detail);
  }

  private armSpeakingTimeout(session: LiveAvatarSession): void {
    this.clearSpeakingTimeout();
    this.speakingTimeout = window.setTimeout(() => {
      this.speakingTimeout = null;
      this.emitDiagnostic(
        `speaking_timeout_6000ms.sdk_state_${session.state}`,
        'warn',
      );
    }, 6_000);
  }

  private clearSpeakingTimeout(): void {
    if (this.speakingTimeout === null) return;
    window.clearTimeout(this.speakingTimeout);
    this.speakingTimeout = null;
  }
}

function formatError(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message.replaceAll(/\s+/g, '_')
    : 'unknown_error';
}

export function pcmBytesToBinaryString(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return binary;
}

function analyzePcm16(bytes: Uint8Array): {
  durationMs: number;
  rms: string;
  peak: string;
  zeroPercent: string;
} {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const sampleCount = Math.floor(bytes.byteLength / 2);
  let squaredSum = 0;
  let peak = 0;
  let zeroCount = 0;

  for (let index = 0; index < sampleCount; index += 1) {
    const sample = view.getInt16(index * 2, true);
    const normalized = sample / 32_768;
    squaredSum += normalized * normalized;
    peak = Math.max(peak, Math.abs(normalized));
    if (sample === 0) zeroCount += 1;
  }

  return {
    durationMs: Math.round((sampleCount / 24_000) * 1_000),
    rms: Math.sqrt(squaredSum / Math.max(sampleCount, 1)).toFixed(4),
    peak: peak.toFixed(4),
    zeroPercent: ((zeroCount / Math.max(sampleCount, 1)) * 100).toFixed(1),
  };
}
