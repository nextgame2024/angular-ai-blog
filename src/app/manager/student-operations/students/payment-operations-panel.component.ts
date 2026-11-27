import { TrustDispatchRegister } from './trust-dispatch-register.component';
import { TrustReceiptAccountPanel } from './trust-receipt-account.component';
import { TrustResidualsPanel } from './trust-residuals.component';
import { TrustMatchOutcomesPanel } from './trust-match-outcomes.component';
import { TrustStagedDeposits } from './trust-staged-deposits.component';
import { Component, DestroyRef, Input, OnChanges, SimpleChanges, inject, output, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ManagerSelectComponent } from '../../components/shared/manager-select/manager-select.component';
import { Subscription } from 'rxjs';
import { StudentOperationsService } from '../student-operations.service';
import { StagedTrustDeposit, XeroConnectionSummary, XeroStudentInvoice, XeroStudentInvoiceResult, XeroStudentInvoiceQuery } from '../student-operations.types';
import { ManagerListLoaderComponent } from '../../components/shared/manager-list-loader/manager-list-loader.component';

import { PageJumpComponent } from '../../../shared/components/page-jump/page-jump.component';
import { RECEIPT_EXCEPTION_LABELS, XERO_PAGE_SIZE_OPTIONS } from '../xero-invoice-display';

type PaymentQueue = NonNullable<XeroStudentInvoiceQuery['queue']>;

const queueText: Record<PaymentQueue, {description: string; empty: string}> = {
  payments_without_receipts: {
    description: 'Imported Xero payments without a Sophia receipt link · latest payment first',
    empty: 'No imported payments match the current receipt-link filters.',
  },
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
  receipt_exceptions: {
    description: 'Verified TRUST receipts on invoices that are voided, deleted or missing from the current import',
    empty: 'No verified receipts need invoice exception review.',
  },
  reconciled_payments: {
    description: 'Linked TRUST payments confirmed as reconciled in the latest Xero import',
    empty: 'No linked payments are confirmed as reconciled in the current import.',
  },
  reconciliation_review: {
    description: 'Linked invoice payments awaiting confirmation of bank reconciliation in Xero · oldest link first',
    empty: 'No linked invoice payments require reconciliation review.',
  },
};

@Component({
  selector: 'app-payment-operations-panel',
  imports: [TrustDispatchRegister,TrustReceiptAccountPanel,TrustResidualsPanel, TrustMatchOutcomesPanel, TrustStagedDeposits, DatePipe, DecimalPipe, FormsModule, ManagerSelectComponent, ManagerListLoaderComponent, PageJumpComponent],
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
            <button type="button" class="btn small" (click)="toggleQueue('reconciled_payments')">
              {{ queue === 'reconciled_payments' ? 'Show outstanding invoices' : 'View reconciled payments' }}
            </button>
            <button type="button" class="btn small" (click)="toggleQueue('receipt_exceptions')">
              {{ queue === 'receipt_exceptions' ? 'Show outstanding invoices' : 'Review invoice exceptions' }}
            </button>
            <button type="button" class="btn small" (click)="toggleQueue('payments_without_receipts')">
              {{ queue === 'payments_without_receipts' ? 'Show outstanding invoices' : 'Review payments without receipt links' }}
            </button>
          }
          @if (queue === 'payments_without_receipts') {
            <form #filters="ngForm" class="student-form" (ngSubmit)="filters.valid && applyPaymentFilters()">
              <div class="form-grid">
                <label>Xero payment date<input name="paymentDate" type="date" [(ngModel)]="paymentDate"></label>
                <label>Xero payment amount (AUD)<input name="paymentAmount" inputmode="decimal"
                  pattern="(0|[1-9][0-9]{0,11})([.][0-9]{1,2})?" [(ngModel)]="paymentAmount"></label>
              </div>
              <button type="submit" class="btn small" [disabled]="filters.invalid || (paymentAmount && +paymentAmount <= 0)">Apply filters</button>
              <button type="button" class="btn small" (click)="clearPaymentFilters()">Clear filters</button>
            </form>
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
            <app-manager-select ariaLabel="Follow-up age" [options]="ageOptions" [ngModel]="age"
              (ngModelChange)="age = $event; load(1)" />
            <app-manager-select ariaLabel="Follow-up owner" [options]="ownerOptions" [ngModel]="owner"
              (ngModelChange)="setOwner($event)" />
            <app-manager-select ariaLabel="Reconciliation status" [options]="statusOptions" [ngModel]="status"
              (ngModelChange)="status = $event; load(1)" />
          }
          <small>Last successful sync: {{ (lastSync() | date:'medium') || 'Unknown' }}</small>
        </div>
      </header>
      @if (connection.organisationRole === 'trust') {
        <app-trust-dispatch-register [connection]="connection.connectionId" (review)="reviewDispatch.emit($event)" />
        <app-trust-receipt-account [connection]="connection.connectionId" />
        <app-trust-residuals [connection]="connection.connectionId" [revision]="receiptRevision + outcomeRevision" />
        <app-trust-match-outcomes [connection]="connection.connectionId" [revision]="receiptRevision + outcomeRevision" />
        <app-trust-staged-deposits (outcomesChanged)="outcomeRevision=outcomeRevision+1" [connection]="connection.connectionId" [revision]="receiptRevision" (review)="reviewSuggested.emit($event)" />
      }
      @if (loading() && !result()) {
        <app-manager-list-loader label="Loading documents…" />
      }
      @if (error()) {
        <p role="alert">{{ error() }}</p>
        <button class="btn" type="button" (click)="load(requestedPage, !!result())">Retry</button>
      }
      @if (result(); as data) {
        @if (data.invoices.length) {
          <div class="invoice-table-scroll"><table class="invoice-table">
            <thead><tr><th>Document</th><th>Recipient</th>@if (queue === 'reconciliation_review') {
              <th>Oldest pending link</th><th>Awaiting confirmation</th><th>Xero payment status</th><th>Manager checks</th><th>Unassigned follow-ups</th>
            } @else if (queue === 'payments_without_receipts') { <th>Unlinked payments</th><th>Payment total</th><th>Latest payment date</th>
            } @else if (queue === 'receipt_exceptions') { <th>Invoice exception</th><th>Verified receipts</th><th>Latest receipt date</th>
            } @else if (queue === 'reconciled_payments') { <th>Confirmed payments</th><th>Confirmed amount</th>
            } @else { <th>Due date</th><th>{{ queue === 'excess_receipts' ? 'Receipt excess' : 'Balance due' }}</th>
              @if (queue === 'receipts_awaiting_link') { <th>Verified receipts awaiting a link</th> }
              @if (queue === 'excess_receipts') { <th>Excess without a Xero link</th> }
            }</tr></thead>
            <tbody>@for (row of data.invoices; track row.xeroInvoiceId) {
              <tr><td data-label="Document"><button type="button" class="invoice-link" (click)="review.emit(row)">{{ row.invoiceNumber || 'Review document' }}</button></td>
                <td data-label="Recipient">{{ row.contactName || row.studentName || 'Contact unavailable' }}</td>
                @if (queue === 'reconciliation_review') {
                  <td data-label="Oldest pending link">
                    {{ (row.reconciliation?.oldestLinkedAt | date:'mediumDate':'+1000') || 'Unknown' }}
                    @let days = row.reconciliation?.pendingDays;
                    @if (days != null) {
                      <div>{{ days === 0 ? 'Linked today' : days === 1 ? '1 day ago' : days + ' days ago' }}</div>
                    }
                  </td>
                  <td data-label="Awaiting confirmation">AUD {{ row.reconciliation?.amount | number:'1.2-2' }}</td>
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
                } @else if (queue === 'payments_without_receipts') {
                  <td data-label="Unlinked payments">{{ row.availablePayments?.count }}</td>
                  <td data-label="Payment total">AUD {{ row.availablePayments?.amount | number:'1.2-2' }}</td>
                  <td data-label="Latest payment date">{{ row.availablePayments?.latestDate | date:'mediumDate':'UTC' }}</td>
                } @else if (queue === 'receipt_exceptions') {
                  @if (row.receiptException; as evidence) {
                    <td data-label="Invoice exception">{{ exceptionLabels[evidence.reason] }}</td>
                    <td data-label="Verified receipts">{{ evidence.count }} · AUD {{ evidence.amount | number:'1.2-2' }}</td>
                    <td data-label="Latest receipt date">{{ evidence.latestReceiptOn | date:'mediumDate':'UTC' }}</td>
                  }
                } @else if (queue === 'reconciled_payments') {
                  <td data-label="Confirmed payments">{{ row.confirmedPayments?.count }}</td>
                  <td data-label="Confirmed amount">AUD {{ row.confirmedPayments?.amount | number:'1.2-2' }}</td>
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
          </table>
          @if (loading()) { <app-manager-list-loader label="Updating documents…" [overlay]="true" /> }
          </div>
          <footer class="invoice-pagination" [attr.aria-label]="connection.tenantName + ' document pages'">
            <span>{{ data.total }} documents</span>
            <div class="page-buttons">
              <app-manager-select panelDirection="up" class="page-size" ariaLabel="Documents per page"
                [ngModel]="pageSize" [options]="pageSizeOptions" (ngModelChange)="pageSize = $event; load(1)" />
              <button type="button" [disabled]="loading() || data.page <= 1" (click)="load(1)" aria-label="First page">«</button>
              <button type="button" [disabled]="loading() || data.page <= 1" (click)="load(data.page - 1)" aria-label="Previous page">‹</button>
              <app-page-jump [page]="data.page" [totalPages]="data.totalPages" [disabled]="loading()" label="Document page number" (pageChange)="load($event)" />
              <button type="button" [disabled]="loading() || data.page >= data.totalPages" (click)="load(data.page + 1)" aria-label="Next page">›</button>
              <button type="button" [disabled]="loading() || data.page >= data.totalPages" (click)="load(data.totalPages)" aria-label="Last page">»</button>
            </div>
          </footer>
        } @else { <p class="candidate-empty">{{ search ? 'No invoices match this search.' : queue === 'receipts_awaiting_link' && candidateStatus !== 'all' ? 'No invoices match this payment filter.' : queue === 'excess_receipts' && excessStatus !== 'all' ? 'No invoices match this overpayment link status.' : queue === 'reconciliation_review' && (status !== 'all' || age !== 'all') ? 'No follow-ups match these filters.' : queue === 'reconciliation_review' && owner !== 'all' ? 'No follow-ups match this owner filter.' : queueText[queue].empty }}</p> }
      }
    </section>
  `,
})
export class PaymentOperationsPanel implements OnChanges {
  @Input({ required: true }) connection!: XeroConnectionSummary;
  @Input() search = '';
  @Input() receiptRevision = 0;
  @Input() importTimestamp?: string;
  readonly pageSizeOptions = XERO_PAGE_SIZE_OPTIONS;
  pageSize = '25';
  readonly queueText = queueText;
  readonly exceptionLabels = RECEIPT_EXCEPTION_LABELS;
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
    {value:'unchecked_pending', label:'No manager check · Xero pending'},
    {value:'unchecked_unknown', label:'No manager check · Xero status unavailable'},
    {value:'checked_pending', label:'Manager reported reconciled · Xero pending'},
    {value:'checked_unknown', label:'Manager reported reconciled · Xero status unavailable'},
  ];
  owner: 'all' | NonNullable<XeroStudentInvoiceQuery['followUpOwner']> = 'all';
  age = 'all';
  readonly ageOptions = [
    {value:'all',label:'Any follow-up age'}, {value:'1',label:'At least 1 day'},
    {value:'7',label:'At least 7 days'}, {value:'30',label:'At least 30 days'},
  ];
  readonly ownerOptions = [
    {value:'all',label:'All follow-ups'}, {value:'mine',label:'My follow-ups'}, {value:'unassigned',label:'Unassigned'},
  ];
  queue: PaymentQueue = 'outstanding_invoices';
  outcomeRevision=0;
  readonly reviewDispatch=output<string>();
  readonly reviewSuggested=output<{invoice:string;deposit:StagedTrustDeposit}>();
  readonly review = output<XeroStudentInvoice>();
  readonly result = signal<XeroStudentInvoiceResult | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  paymentDate = '';
  paymentAmount = '';
  private paymentFilters: Pick<XeroStudentInvoiceQuery, 'importedPaymentDate' | 'importedPaymentAmount'> = {};
  requestedPage = 1;
  private readonly api = inject(StudentOperationsService);
  private readonly destroyRef = inject(DestroyRef);
  readonly lastSync = signal<string | null>(null);
  private freshness?: Subscription;
  private request?: Subscription;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['connection']) {
      this.queue = 'outstanding_invoices';
      this.age = 'all';
      this.owner = 'all';
      this.status = 'all';
      this.excessStatus = 'all';
      this.candidateStatus = 'all';
      this.paymentDate = this.paymentAmount = '';
      this.paymentFilters = {};
      this.pageSize = '25';
      if (!this.importTimestamp) this.loadFreshness();
    }
    if (this.importTimestamp && (changes['importTimestamp'] || changes['connection'])) {
      this.freshness?.unsubscribe();
      this.lastSync.set(this.importTimestamp);
    }
    if (!changes['connection'] && !changes['search']) {
      if (changes['importTimestamp'] || this.queue !== 'outstanding_invoices') this.load(this.requestedPage, true);
      return;
    }
    this.load(1);
  }

  toggleQueue(queue: PaymentQueue): void {
    this.queue = this.queue === queue ? 'outstanding_invoices' : queue;
    this.load(1);
  }

  applyPaymentFilters(): void {
    if (this.paymentAmount && Number(this.paymentAmount) <= 0) return;
    this.paymentFilters = {
      ...(this.paymentDate ? { importedPaymentDate: this.paymentDate } : {}),
      ...(this.paymentAmount ? { importedPaymentAmount: this.paymentAmount } : {}),
    };
    this.load(1);
  }

  clearPaymentFilters(): void {
    this.paymentDate = this.paymentAmount = '';
    this.applyPaymentFilters();
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

  load(page: number, retainRows = false): void {
    this.request?.unsubscribe();
    this.requestedPage = page;
    this.loading.set(true);
    this.error.set('');
    if (!retainRows) this.result.set(null);
    this.request = this.api.xeroStudentInvoices(this.connection.connectionId, {
      page, limit: Number(this.pageSize), ...(this.search ? { q: this.search } : {}), queue: this.queue,
      ...(this.queue === 'payments_without_receipts' ? this.paymentFilters : {}),
      ...(this.queue === 'receipts_awaiting_link' && this.candidateStatus !== 'all' ? {paymentCandidateStatus:this.candidateStatus} : {}),
      ...(this.queue === 'excess_receipts' && this.excessStatus !== 'all' ? {excessLinkStatus: this.excessStatus} : {}),
      ...(this.queue === 'reconciliation_review' && this.status !== 'all' ? {reconciliationStatus: this.status} : {}),
      ...(this.queue === 'reconciliation_review' && this.age !== 'all' ? {minFollowUpDays:Number(this.age)} : {}),
      ...(this.queue === 'reconciliation_review' && this.owner !== 'all' ? {followUpOwner: this.owner} : {}),
      ...(this.queue === 'payments_without_receipts' || this.queue === 'reconciliation_review' || this.queue === 'reconciled_payments' || this.queue === 'receipt_exceptions' || (this.queue === 'excess_receipts' && this.excessStatus === 'needs_link') ? {} : {sort: 'dueDate' as const, direction: 'asc' as const}),
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
