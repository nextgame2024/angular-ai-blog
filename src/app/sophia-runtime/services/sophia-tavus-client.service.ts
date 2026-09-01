import { Injectable } from '@angular/core';
import Daily, {
  type DailyCall,
  type DailyParticipant,
} from '@daily-co/daily-js';

export interface SophiaTavusConnectRequest {
  conversationUrl: string;
  meetingToken: string;
  videoElement: HTMLVideoElement;
  audioElement: HTMLAudioElement;
  onStatus(status: string): void;
  onEvent(event: string): void;
}

@Injectable()
export class SophiaTavusClientService {
  private call: DailyCall | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private onStatus: ((status: string) => void) | null = null;
  private onEvent: ((event: string) => void) | null = null;
  private connected = false;

  async connect(request: SophiaTavusConnectRequest): Promise<void> {
    await this.disconnect();

    this.videoElement = request.videoElement;
    this.audioElement = request.audioElement;
    this.onStatus = request.onStatus;
    this.onEvent = request.onEvent;
    this.connected = false;

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
        const eventType = extractAppMessageType(event.data);
        this.emitEvent(`tavus.${eventType}`);
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

    this.clearMediaElement(this.videoElement);
    this.clearMediaElement(this.audioElement);
    this.videoElement = null;
    this.audioElement = null;
    this.onStatus = null;
    this.onEvent = null;

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
  if (typeof data === 'object' && data && 'type' in data) {
    return String(data.type).replace(/[^a-zA-Z0-9_.-]/g, '_');
  }
  return 'app_message';
}

function formatDailyError(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : 'Could not join the Tavus conversation.';
}
