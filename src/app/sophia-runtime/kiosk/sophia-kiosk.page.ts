import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

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
export class SophiaKioskPageComponent {
  private readonly runtime = inject(SophiaRuntimeSessionService);

  readonly state$$ = signal<RuntimeViewState>('idle');
  readonly error$$ = signal<string | null>(null);
  readonly sessionResponse$$ = signal<SophiaRuntimeSessionResponse | null>(null);
  readonly inventoryResult$$ = signal<InventoryToolOutput | null>(null);
  readonly productId$$ = signal('demo-product');
  readonly colour$$ = signal('black');
  readonly isToolRunning$$ = signal(false);

  readonly session$$ = computed(() => this.sessionResponse$$()?.session ?? null);
  readonly providerSummary$$ = computed(() => {
    const response = this.sessionResponse$$();
    if (!response) return 'Runtime not connected';
    return `${response.ai.provider} / ${response.avatar.provider}`;
  });
  readonly canStart$$ = computed(() => this.state$$() === 'idle' || this.state$$() === 'error');
  readonly canUseTools$$ = computed(() => this.session$$()?.status === 'active');

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
        },
        error: (error) => this.handleError(error, 'Could not start Sophia Runtime session.'),
      });
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
}
