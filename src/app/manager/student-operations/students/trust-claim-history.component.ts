import { Component, DestroyRef, Input, OnChanges, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { StudentOperationsService } from '../student-operations.service';
import type { TrustClaimHistoryEntry } from '../student-operations.types';

@Component({
  selector: 'app-trust-claim-history',
  imports: [DatePipe],
  styleUrls: ['./student-operations-students.page.css'],
  template: `
    <button class="invoice-link" type="button" [attr.aria-expanded]="open()" (click)="toggle()">Follow-up history</button>
    @if (open()) {
      <ul aria-label="Follow-up history">
        @for (entry of entries(); track entry.id) {
          <li>{{ entry.ownerName || 'Staff member unavailable' }} · Claimed {{ entry.claimedAt | date:'medium' }}
            @if (entry.releasedAt) { · Released {{ entry.releasedAt | date:'medium' }} }
            @else { · Current owner }
          </li>
        }
      </ul>
      @if (loading()) { <small role="status">Loading follow-up history…</small> }
      @else if (failed()) { <button class="btn small" type="button" (click)="load()">Retry loading history</button> }
      @else if (cursor()) { <button class="btn small" type="button" (click)="load()">Show older claims</button> }
      @else if (!entries().length) { <small>No follow-up claims recorded.</small> }
    }
  `,
})
export class TrustClaimHistory implements OnChanges {
  @Input({required:true}) connection!: string;
  @Input({required:true}) invoiceId!: string;
  @Input({required:true}) receiptId!: string;
  @Input({required:true}) paymentId!: string;
  @Input() claimId?: string | null;
  readonly open = signal(false);
  readonly loading = signal(false);
  readonly failed = signal(false);
  readonly entries = signal<TrustClaimHistoryEntry[]>([]);
  readonly cursor = signal<string | null>(null);
  private readonly api = inject(StudentOperationsService);
  private readonly destroy = inject(DestroyRef);
  private request?: Subscription;

  ngOnChanges() { this.reset(); }

  toggle() {
    this.open.update(value => !value);
    this.reset();
  }

  private reset() {
    this.request?.unsubscribe();
    this.entries.set([]);
    this.cursor.set(null);
    this.failed.set(false);
    this.loading.set(false);
    if (this.open()) this.load();
  }

  load() {
    if (!this.open() || this.loading()) return;
    this.loading.set(true);
    this.failed.set(false);
    this.request = this.api.trustClaimHistory(this.connection,this.invoiceId,this.receiptId,this.paymentId,this.cursor() ?? undefined)
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: page => {
          this.entries.update(entries => [...entries,...page.entries]);
          this.cursor.set(page.nextCursor);
          this.loading.set(false);
        },
        error: () => { this.failed.set(true); this.loading.set(false); },
      });
  }
}
