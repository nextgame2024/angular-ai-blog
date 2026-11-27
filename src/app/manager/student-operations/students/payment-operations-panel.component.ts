import { Component, DestroyRef, Input, OnChanges, SimpleChanges, inject, output, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { StudentOperationsService } from '../student-operations.service';
import { XeroConnectionSummary, XeroStudentInvoice, XeroStudentInvoiceResult } from '../student-operations.types';
import { ManagerListLoaderComponent } from '../../components/shared/manager-list-loader/manager-list-loader.component';

@Component({
  selector: 'app-payment-operations-panel',
  imports: [DatePipe, DecimalPipe, ManagerListLoaderComponent],
  styleUrls: ['./student-operations-students.page.css'],
  template: `
    <section class="xero-candidates">
      <header class="candidate-header">
        <div class="candidate-heading">
          <h4>{{ connection.organisationRole === 'trust' ? 'TRUST' : 'PTY' }} · {{ connection.tenantName }}</h4>
          <p>Sales invoices awaiting payment · earliest due first</p>
          <small>Last successful sync: {{ (lastSync() | date:'medium') || 'Unknown' }}</small>
        </div>
      </header>
      @if (loading()) {
        <app-manager-list-loader label="Loading outstanding documents…" />
      } @else if (error()) {
        <p role="alert">{{ error() }}</p>
        <button class="btn" type="button" (click)="load(requestedPage)">Retry</button>
      } @else if (result(); as data) {
        @if (data.invoices.length) {
          <div class="invoice-table-scroll"><table class="invoice-table">
            <thead><tr><th>Document</th><th>Recipient</th><th>Due date</th><th>Balance due</th></tr></thead>
            <tbody>@for (row of data.invoices; track row.xeroInvoiceId) {
              <tr><td data-label="Document"><button type="button" class="invoice-link" (click)="review.emit(row)">{{ row.invoiceNumber || 'Review document' }}</button></td>
                <td data-label="Recipient">{{ row.contactName || row.studentName }}</td>
                <td data-label="Due date">{{ (row.dueDate | date:'dd MMM yyyy':'UTC') || 'Unknown' }}</td>
                <td data-label="Balance due">{{ row.currencyCode || 'Currency unknown' }} {{ row.amountDue | number:'1.2-4' }}</td></tr>
            }</tbody>
          </table></div>
          <footer class="invoice-pagination">
            <button class="btn" type="button" [disabled]="data.page <= 1" (click)="load(data.page - 1)">Previous</button>
            <span>Page {{ data.page }} of {{ data.totalPages }} · {{ data.total }} documents</span>
            <button class="btn" type="button" [disabled]="data.page >= data.totalPages" (click)="load(data.page + 1)">Next</button>
          </footer>
        } @else { <p class="candidate-empty">{{ search ? 'No outstanding invoices match this search.' : 'No imported invoices awaiting payment.' }}</p> }
      }
    </section>
  `,
})
export class PaymentOperationsPanel implements OnChanges {
  @Input({ required: true }) connection!: XeroConnectionSummary;
  @Input() search = '';
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
    if (changes['connection']) this.loadFreshness();
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
      page, limit: 25, ...(this.search ? { q: this.search } : {}), queue: 'outstanding_invoices', sort: 'dueDate', direction: 'asc',
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
