import { Component, DestroyRef, Input, OnChanges, SimpleChanges, inject, output, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { StudentOperationsService } from '../student-operations.service';
import { XeroConnectionSummary, XeroStudentInvoice, XeroStudentInvoiceResult, XeroStudentInvoiceQuery } from '../student-operations.types';
import { ManagerListLoaderComponent } from '../../components/shared/manager-list-loader/manager-list-loader.component';

type PaymentQueue = NonNullable<XeroStudentInvoiceQuery['queue']>;

const queueText: Record<PaymentQueue, {description: string; empty: string}> = {
  outstanding_invoices: {
    description: 'Sales invoices awaiting payment · earliest due first',
    empty: 'No imported invoices awaiting payment.',
  },
  receipts_awaiting_link: {
    description: 'Invoices with verified receipts awaiting a Xero payment link',
    empty: 'No verified receipts awaiting a payment link.',
  },
  excess_receipts: {
    description: 'Verified receipts above the invoice balance at verification',
    empty: 'No verified receipts exceeded the invoice balance.',
  },
  reconciliation_review: {
    description: 'Linked invoice payments awaiting confirmation of bank reconciliation in Xero',
    empty: 'No linked invoice payments require reconciliation review.',
  },
};

@Component({
  selector: 'app-payment-operations-panel',
  imports: [DatePipe, DecimalPipe, ManagerListLoaderComponent],
  styleUrls: ['./student-operations-students.page.css'],
  template: `
    <section class="xero-candidates">
      <header class="candidate-header">
        <div class="candidate-heading">
          <h4>{{ connection.organisationRole === 'trust' ? 'TRUST' : 'PTY' }} · {{ connection.tenantName }}</h4>
          <p>{{ queueText[queue].description }}</p>
          @if (connection.organisationRole === 'trust') {
            <button type="button" class="btn small" (click)="toggleQueue('receipts_awaiting_link')">
              {{ queue === 'receipts_awaiting_link' ? 'Show outstanding invoices' : 'Review unlinked receipts' }}
            </button>
            <button type="button" class="btn small" (click)="toggleQueue('excess_receipts')">
              {{ queue === 'excess_receipts' ? 'Show outstanding invoices' : 'Review excess receipts' }}
            </button>
            <button type="button" class="btn small" (click)="toggleQueue('reconciliation_review')">
              {{ queue === 'reconciliation_review' ? 'Show outstanding invoices' : 'Review bank reconciliation' }}
            </button>
          }
          <small>Last successful sync: {{ (lastSync() | date:'medium') || 'Unknown' }}</small>
        </div>
      </header>
      @if (loading()) {
        <app-manager-list-loader label="Loading documents…" />
      } @else if (error()) {
        <p role="alert">{{ error() }}</p>
        <button class="btn" type="button" (click)="load(requestedPage)">Retry</button>
      } @else if (result(); as data) {
        @if (data.invoices.length) {
          <div class="invoice-table-scroll"><table class="invoice-table">
            <thead><tr><th>Document</th><th>Recipient</th><th>Due date</th><th>{{ queue === 'excess_receipts' ? 'Receipt excess' : 'Balance due' }}</th></tr></thead>
            <tbody>@for (row of data.invoices; track row.xeroInvoiceId) {
              <tr><td data-label="Document"><button type="button" class="invoice-link" (click)="review.emit(row)">{{ row.invoiceNumber || 'Review document' }}</button></td>
                <td data-label="Recipient">{{ row.contactName || row.studentName }}</td>
                <td data-label="Due date">{{ (row.dueDate | date:'dd MMM yyyy':'UTC') || 'Unknown' }}</td>
                <td [attr.data-label]="queue === 'excess_receipts' ? 'Receipt excess' : 'Balance due'">{{ row.currencyCode || 'Currency unknown' }} {{ (queue === 'excess_receipts' ? row.receiptExcess : row.amountDue) | number:'1.2-4' }}</td></tr>
            }</tbody>
          </table></div>
          <footer class="invoice-pagination">
            <button class="btn" type="button" [disabled]="data.page <= 1" (click)="load(data.page - 1)">Previous</button>
            <span>Page {{ data.page }} of {{ data.totalPages }} · {{ data.total }} documents</span>
            <button class="btn" type="button" [disabled]="data.page >= data.totalPages" (click)="load(data.page + 1)">Next</button>
          </footer>
        } @else { <p class="candidate-empty">{{ search ? 'No invoices match this search.' : queueText[queue].empty }}</p> }
      }
    </section>
  `,
})
export class PaymentOperationsPanel implements OnChanges {
  @Input({ required: true }) connection!: XeroConnectionSummary;
  @Input() search = '';
  @Input() receiptRevision = 0;
  readonly queueText = queueText;
  queue: PaymentQueue = 'outstanding_invoices';
  readonly review = output<XeroStudentInvoice>();
  readonly result = signal<XeroStudentInvoiceResult | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  requestedPage = 1;
  private readonly api = inject(StudentOperationsService);
  private readonly destroyRef = inject(DestroyRef);
  readonly lastSync = signal<string | null>(null);
  private freshness?: Subscription;
  private request?: Subscription;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['connection']) {
      this.queue = 'outstanding_invoices';
      this.loadFreshness();
    }
    if (Object.keys(changes).length === 1 && changes['receiptRevision']) {
      if (this.queue !== 'outstanding_invoices') this.load(this.requestedPage);
      return;
    }
    this.load(1);
  }

  toggleQueue(queue: PaymentQueue): void {
    this.queue = this.queue === queue ? 'outstanding_invoices' : queue;
    this.load(1);
  }

  private loadFreshness(): void {
    this.lastSync.set(null);
    this.freshness?.unsubscribe();
    this.freshness = this.api.xeroStudentSyncStatus(this.connection.connectionId)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: status => this.lastSync.set(status.lastSuccessfulSyncAt),
        error: () => this.lastSync.set(null),
      });
  }

  load(page: number): void {
    this.request?.unsubscribe();
    this.requestedPage = page;
    this.loading.set(true);
    this.error.set('');
    this.result.set(null);
    this.request = this.api.xeroStudentInvoices(this.connection.connectionId, {
      page, limit: 25, ...(this.search ? { q: this.search } : {}), queue: this.queue, sort: 'dueDate', direction: 'asc',
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => {
        if (page > Math.max(1, result.totalPages)) {
          this.load(Math.max(1, result.totalPages));
          return;
        }
        this.result.set(result);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Stored accounting documents could not be loaded for this organisation.');
        this.loading.set(false);
      },
    });
  }
}
