import { Component, DestroyRef, Input, OnChanges, SimpleChanges, inject, output, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ManagerSelectComponent } from '../../components/shared/manager-select/manager-select.component';
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
    description: 'Linked invoice payments awaiting confirmation of bank reconciliation in Xero · oldest link first',
    empty: 'No linked invoice payments require reconciliation review.',
  },
};

@Component({
  selector: 'app-payment-operations-panel',
  imports: [DatePipe, DecimalPipe, FormsModule, ManagerSelectComponent, ManagerListLoaderComponent],
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
          @if (queue === 'receipts_awaiting_link') {
            <app-manager-select ariaLabel="Possible Xero payments" [options]="candidateOptions" [ngModel]="candidateStatus"
              (ngModelChange)="candidateStatus = $event; load(1)" />
          }
          @if (queue === 'excess_receipts') {
            <app-manager-select ariaLabel="Overpayment link status" [options]="excessOptions" [ngModel]="excessStatus"
              (ngModelChange)="excessStatus = $event; load(1)" />
          }
          @if (queue === 'reconciliation_review') {
            <app-manager-select ariaLabel="Follow-up owner" [options]="ownerOptions" [ngModel]="owner"
              (ngModelChange)="setOwner($event)" />
            <app-manager-select ariaLabel="Reconciliation status" [options]="statusOptions" [ngModel]="status"
              (ngModelChange)="status = $event; load(1)" />
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
            <thead><tr><th>Document</th><th>Recipient</th>@if (queue === 'reconciliation_review') {
              <th>Oldest pending link</th><th>Awaiting confirmation</th><th>Xero payment status</th><th>Manager checks</th><th>Unassigned follow-ups</th>
            } @else { <th>Due date</th><th>{{ queue === 'excess_receipts' ? 'Receipt excess' : 'Balance due' }}</th>
              @if (queue === 'receipts_awaiting_link') { <th>Verified receipts awaiting a link</th> }
              @if (queue === 'excess_receipts') { <th>Excess without a Xero link</th> }
            }</tr></thead>
            <tbody>@for (row of data.invoices; track row.xeroInvoiceId) {
              <tr><td data-label="Document"><button type="button" class="invoice-link" (click)="review.emit(row)">{{ row.invoiceNumber || 'Review document' }}</button></td>
                <td data-label="Recipient">{{ row.contactName || row.studentName }}</td>
                @if (queue === 'reconciliation_review') {
                  <td data-label="Oldest pending link">
                    {{ (row.reconciliation?.oldestLinkedAt | date:'mediumDate':'+1000') || 'Unknown' }}
                    @let days = row.reconciliation?.pendingDays;
                    @if (days != null) {
                      <div>{{ days === 0 ? 'Linked today' : days === 1 ? '1 day ago' : days + ' days ago' }}</div>
                    }
                  </td>
                  <td data-label="Awaiting confirmation">{{ row.currencyCode }} {{ row.reconciliation?.amount | number:'1.2-2' }}</td>
                  <td data-label="Xero payment status">
                    @if (row.reconciliation; as summary) {
                      @if (summary.linkMismatch) { <div>{{ summary.linkMismatch }} · Link no longer matches</div> }
                      @if (summary.statusUnknown) { <div>{{ summary.statusUnknown }} · Status unavailable</div> }
                      @if (summary.xeroPending) { <div>{{ summary.xeroPending }} · Pending reconciliation</div> }
                      @if (summary.xeroPending == null) { <span>Open invoice for details</span> }
                    } @else { <span>Open invoice for details</span> }
                  </td>
                  <td data-label="Manager checks">
                    {{ row.reconciliation?.managerChecks }} of {{ row.reconciliation?.payments }}
                    @if (row.reconciliation?.latestReportedReconciledOn; as reportedDate) {
                      <small>Latest reported reconciliation date · {{ reportedDate | date:'dd MMM yyyy' }}</small>
                    }
                  </td>
                  <td data-label="Unassigned follow-ups">{{ row.reconciliation?.unassigned ?? '—' }}</td>
                } @else {
                <td data-label="Due date">{{ (row.dueDate | date:'dd MMM yyyy':'UTC') || 'Unknown' }}</td>
                @if (queue === 'excess_receipts') {
                  <td data-label="Receipt excess">AUD {{ row.receiptExcess | number:'1.2-2' }}</td>
                  <td data-label="Excess without a Xero link">
                    @if (row.unlinkedExcess != null) { AUD {{ row.unlinkedExcess | number:'1.2-2' }} }
                    @else { Unknown }
                    @let age = row.unlinkedExcessDays;
                    @if (age != null) {
                      <div>Oldest receipt · {{ age === 0 ? 'Today' : age === 1 ? '1 day ago' : age + ' days ago' }}</div>
                    }
                  </td>
                } @else {
                  <td data-label="Balance due">{{ row.currencyCode || 'Currency unknown' }} {{ row.amountDue | number:'1.2-4' }}</td>
                }
                @if (queue === 'receipts_awaiting_link') {
                  <td data-label="Verified receipts awaiting a link">
                    @if (row.unlinkedReceipts; as receipts) {
                      AUD {{ receipts.amount | number:'1.2-2' }} · {{ receipts.count }} {{ receipts.count === 1 ? 'receipt' : 'receipts' }}
                      @if (receipts.withCandidates != null) {
                        <div>{{ receipts.withCandidates }} of {{ receipts.count }} with a possible Xero payment</div>
                        @if (receipts.withMultipleCandidates) {
                          <div>{{ receipts.withMultipleCandidates }} with multiple possible payments</div>
                        }
                      }
                    } @else { Unknown }
                  </td>
                } }</tr>
            }</tbody>
          </table></div>
          <footer class="invoice-pagination">
            <button class="btn" type="button" [disabled]="data.page <= 1" (click)="load(data.page - 1)">Previous</button>
            <span>Page {{ data.page }} of {{ data.totalPages }} · {{ data.total }} documents</span>
            <button class="btn" type="button" [disabled]="data.page >= data.totalPages" (click)="load(data.page + 1)">Next</button>
          </footer>
        } @else { <p class="candidate-empty">{{ search ? 'No invoices match this search.' : queue === 'receipts_awaiting_link' && candidateStatus !== 'all' ? 'No invoices match this payment filter.' : queue === 'excess_receipts' && excessStatus !== 'all' ? 'No invoices match this overpayment link status.' : queue === 'reconciliation_review' && status !== 'all' ? 'No follow-ups match these filters.' : queue === 'reconciliation_review' && owner !== 'all' ? 'No follow-ups match this owner filter.' : queueText[queue].empty }}</p> }
      }
    </section>
  `,
})
export class PaymentOperationsPanel implements OnChanges {
  @Input({ required: true }) connection!: XeroConnectionSummary;
  @Input() search = '';
  @Input() receiptRevision = 0;
  readonly queueText = queueText;
  status: 'all' | NonNullable<XeroStudentInvoiceQuery['reconciliationStatus']> = 'all';
  excessStatus: 'all' | NonNullable<XeroStudentInvoiceQuery['excessLinkStatus']> = 'all';
  candidateStatus: 'all' | NonNullable<XeroStudentInvoiceQuery['paymentCandidateStatus']> = 'all';
  readonly candidateOptions = [
    {value:'all', label:'All unlinked receipts'},
    {value:'available', label:'Has a possible Xero payment'},
    {value:'multiple', label:'Receipt with multiple possible payments'},
    {value:'partial', label:'Only some receipts have a possible payment'},
    {value:'none', label:'No possible Xero payments'},
  ];
  readonly excessOptions = [
    {value:'all', label:'All excess receipts'},
    {value:'needs_link', label:'Needs an overpayment link'},
    {value:'fully_linked', label:'Fully linked'},
    {value:'link_mismatch', label:'Overpayment link no longer matches'},
  ];
  readonly statusOptions = [
    {value:'all', label:'All reconciliation statuses'},
    {value:'link_mismatch', label:'Link no longer matches'},
    {value:'checked_pending', label:'Manager reported reconciled · Xero pending'},
    {value:'checked_unknown', label:'Manager reported reconciled · Xero status unavailable'},
  ];
  owner: 'all' | NonNullable<XeroStudentInvoiceQuery['followUpOwner']> = 'all';
  readonly ownerOptions = [
    {value:'all',label:'All follow-ups'}, {value:'mine',label:'My follow-ups'}, {value:'unassigned',label:'Unassigned'},
  ];
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
      this.owner = 'all';
      this.status = 'all';
      this.excessStatus = 'all';
      this.candidateStatus = 'all';
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

  setOwner(owner: PaymentOperationsPanel['owner']): void {
    this.owner = owner;
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
      page, limit: 25, ...(this.search ? { q: this.search } : {}), queue: this.queue,
      ...(this.queue === 'receipts_awaiting_link' && this.candidateStatus !== 'all' ? {paymentCandidateStatus:this.candidateStatus} : {}),
      ...(this.queue === 'excess_receipts' && this.excessStatus !== 'all' ? {excessLinkStatus: this.excessStatus} : {}),
      ...(this.queue === 'reconciliation_review' && this.status !== 'all' ? {reconciliationStatus: this.status} : {}),
      ...(this.queue === 'reconciliation_review' && this.owner !== 'all' ? {followUpOwner: this.owner} : {}),
      ...(this.queue === 'reconciliation_review' || (this.queue === 'excess_receipts' && this.excessStatus === 'needs_link') ? {} : {sort: 'dueDate' as const, direction: 'asc' as const}),
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
