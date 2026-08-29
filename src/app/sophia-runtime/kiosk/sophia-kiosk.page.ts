import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom, finalize } from 'rxjs';

import {
  SophiaRealtimeClientService,
  type SophiaRealtimeToolCall,
} from '../services/sophia-realtime-client.service';
import { SophiaRuntimeSessionService } from '../services/sophia-runtime-session.service';
import type {
  InventoryToolOutput,
  SophiaRuntimeSessionResponse,
} from '../types/sophia-runtime.types';

type RuntimeViewState = 'idle' | 'starting' | 'active' | 'closing' | 'error';

@Component({
  selector: 'app-sophia-kiosk-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './sophia-kiosk.page.html',
  styleUrls: ['./sophia-kiosk.page.css'],
})
export class SophiaKioskPageComponent implements OnDestroy {
  private readonly runtime = inject(SophiaRuntimeSessionService);
  private readonly realtime = inject(SophiaRealtimeClientService);

  @ViewChild('remoteAudio') private readonly remoteAudio?: ElementRef<HTMLAudioElement>;

  readonly state$$ = signal<RuntimeViewState>('idle');
  readonly error$$ = signal<string | null>(null);
  readonly sessionResponse$$ = signal<SophiaRuntimeSessionResponse | null>(null);
  readonly inventoryResult$$ = signal<InventoryToolOutput | null>(null);
  readonly productId$$ = signal('demo-product');
  readonly colour$$ = signal('black');
  readonly isToolRunning$$ = signal(false);
  readonly isVoiceConnected$$ = signal(false);
  readonly voiceStatus$$ = signal('Voice disconnected');
  readonly realtimeEvents$$ = signal<string[]>([]);

  readonly session$$ = computed(() => this.sessionResponse$$()?.session ?? null);
  readonly providerSummary$$ = computed(() => {
    const response = this.sessionResponse$$();
    if (!response) return 'Runtime not connected';
    return `${response.ai.provider} / ${response.avatar.provider}`;
  });
  readonly canStart$$ = computed(() => this.state$$() === 'idle' || this.state$$() === 'error');
  readonly canUseTools$$ = computed(() => this.session$$()?.status === 'active');
  readonly canConnectVoice$$ = computed(() => {
    const response = this.sessionResponse$$();
    return Boolean(response?.ai.clientSecret && this.canUseTools$$() && !this.isVoiceConnected$$());
  });

  startSession(): void {
    if (!this.canStart$$()) return;

    this.error$$.set(null);
    this.inventoryResult$$.set(null);
    this.state$$.set('starting');

    this.runtime
      .createSession({
        deviceId: '22222222-2222-4222-8222-222222222222',
        storeId: 'demo-store',
        createdByUserId: 'angular-kiosk',
      })
      .subscribe({
        next: (response) => {
          this.sessionResponse$$.set(response);
          this.state$$.set('active');
          this.voiceStatus$$.set(
            response.ai.clientSecret
              ? 'Ready to connect microphone'
              : 'OpenAI client secret missing',
          );
        },
        error: (error) => this.handleError(error, 'Could not start Sophia Runtime session.'),
      });
  }

  async connectVoice(): Promise<void> {
    const response = this.sessionResponse$$();
    const session = response?.session;
    const clientSecret = response?.ai.clientSecret;
    if (!session || !clientSecret || this.isVoiceConnected$$()) return;

    this.error$$.set(null);

    try {
      await this.realtime.connect({
        clientSecret,
        onRemoteStream: (stream) => this.attachRemoteAudio(stream),
        onEvent: (event) => this.recordRealtimeEvent(event),
        onStatus: (status) => {
          this.voiceStatus$$.set(status);
          if (status === 'connected' || status === 'Realtime connected') {
            this.isVoiceConnected$$.set(true);
          }
        },
        onToolCall: (toolCall) => this.executeRealtimeTool(session.sessionId, toolCall),
      });
    } catch (error) {
      await this.realtime.disconnect();
      this.isVoiceConnected$$.set(false);
      this.handleError(error, 'Could not connect microphone to OpenAI Realtime.');
    }
  }

  async disconnectVoice(): Promise<void> {
    await this.realtime.disconnect();
    this.isVoiceConnected$$.set(false);
    this.voiceStatus$$.set('Voice disconnected');
  }

  runInventoryCheck(): void {
    const session = this.session$$();
    if (!session || this.isToolRunning$$()) return;

    this.error$$.set(null);
    this.isToolRunning$$.set(true);

    this.runtime
      .executeTool(session.sessionId, {
        toolName: 'getInventory',
        input: {
          productId: this.productId$$().trim(),
          colour: this.colour$$().trim() || undefined,
        },
      })
      .pipe(finalize(() => this.isToolRunning$$.set(false)))
      .subscribe({
        next: (response) => {
          this.inventoryResult$$.set(response.output as InventoryToolOutput);
        },
        error: (error) => this.handleError(error, 'Inventory tool call failed.'),
      });
  }

  closeSession(): void {
    const session = this.session$$();
    if (!session || this.state$$() === 'closing') return;

    this.error$$.set(null);
    this.state$$.set('closing');

    void this.disconnectVoice();

    this.runtime.closeSession(session.sessionId).subscribe({
      next: ({ session: closedSession }) => {
        const current = this.sessionResponse$$();
        if (current) {
          this.sessionResponse$$.set({ ...current, session: closedSession });
        }
        this.state$$.set('idle');
      },
      error: (error) => this.handleError(error, 'Could not close the runtime session.'),
    });
  }

  ngOnDestroy(): void {
    void this.realtime.disconnect();
  }

  setProductId(value: string): void {
    this.productId$$.set(value);
  }

  setColour(value: string): void {
    this.colour$$.set(value);
  }

  private handleError(error: unknown, fallback: string): void {
    const message =
      typeof error === 'object' && error && 'message' in error
        ? String(error.message)
        : fallback;
    this.error$$.set(message || fallback);
    this.state$$.set('error');
  }

  private attachRemoteAudio(stream: MediaStream): void {
    const audio = this.remoteAudio?.nativeElement;
    if (!audio) return;

    audio.srcObject = stream;
    void audio.play().catch(() => {
      this.voiceStatus$$.set('Tap the page to allow audio playback');
    });
  }

  private recordRealtimeEvent(event: unknown): void {
    const type =
      typeof event === 'object' && event && 'type' in event
        ? String((event as { type: unknown }).type)
        : 'event';

    const next = [`${new Date().toLocaleTimeString()} ${type}`, ...this.realtimeEvents$$()];
    this.realtimeEvents$$.set(next.slice(0, 6));
  }

  private async executeRealtimeTool(
    sessionId: string,
    toolCall: SophiaRealtimeToolCall,
  ): Promise<unknown> {
    const response = await firstValueFrom(
      this.runtime.executeTool(sessionId, {
        toolName: toolCall.name,
        input: toolCall.arguments,
      }),
    );

    if (toolCall.name === 'getInventory') {
      this.inventoryResult$$.set(response.output as InventoryToolOutput);
    }

    return response.output;
  }
}
