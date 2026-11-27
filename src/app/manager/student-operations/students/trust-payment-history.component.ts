import { Component, ChangeDetectorRef, DestroyRef, Input, OnChanges, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { StudentOperationsService } from '../student-operations.service';
import type { TrustReceiptVerification, TrustPaymentObservation } from '../student-operations.types';

@Component({
  selector: 'app-trust-payment-history',
  imports: [DatePipe],
  styleUrls: ['./student-operations-students.page.css'],
  template: `
    <details>
      <summary>Imported payment history</summary>
      @if (observations.length) {
        <p>Distinct payment records, newest first by the time Sophia first saw them.</p>
        <ul>
          @for (entry of observations; track entry.id) {
            <li>First seen {{ entry.firstSeenAt | date:'medium' }} · {{ entry.currency || 'Currency unknown' }} {{ entry.amount }}
              · Payment date {{ entry.paymentDate || 'unavailable' }}
              · {{ entry.isReconciled === true ? 'Reconciled' : entry.isReconciled === false ? 'Pending reconciliation' : 'Reconciliation status unavailable' }}</li>
          }
        </ul>
      } @else { <p>No payment history has been recorded for this link yet.</p> }
      @if (cursor) {
        <button type="button" class="btn small" [disabled]="loading" (click)="load()">
          {{ loading ? 'Loading older records…' : failed ? 'Retry loading older records' : 'Show older records' }}
        </button>
      }
    </details>
  `,
})
export class TrustPaymentHistory implements OnChanges {
  @Input({required:true}) connection!: string;
  @Input({required:true}) invoiceId!: string;
  @Input({required:true}) receipt!: TrustReceiptVerification;
  observations: TrustPaymentObservation[] = [];
  cursor: string | null = null;
  loading = false;
  failed = false;
  private readonly api = inject(StudentOperationsService);
  private readonly destroy = inject(DestroyRef);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private request?: Subscription;

  ngOnChanges() {
    this.request?.unsubscribe();
    this.observations = this.receipt.paymentObservations ?? [];
    this.cursor = this.receipt.observationCursor ?? null;
    this.loading = this.failed = false;
  }

  load() {
    if (!this.cursor || this.loading || !this.receipt.linkedPaymentId) return;
    this.loading = true;
    this.failed = false;
    this.request = this.api.olderPaymentObservations(this.connection,this.invoiceId,this.receipt.id,this.receipt.linkedPaymentId,this.cursor)
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: page => {
          this.observations = [...this.observations,...page.entries];
          this.cursor = page.nextCursor;
          this.loading = false;
          this.changeDetector.markForCheck();
        },
        error: () => { this.loading = false; this.failed = true; this.changeDetector.markForCheck(); },
      });
  }
}
