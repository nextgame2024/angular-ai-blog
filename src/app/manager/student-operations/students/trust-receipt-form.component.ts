import { Component, DestroyRef, Input, OnInit, inject } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { StudentOperationsService } from '../student-operations.service';
import type { TrustReceiptVerification, XeroStudentInvoiceDetail } from '../student-operations.types';

@Component({
  selector: 'app-trust-receipt-form',
  imports: [FormsModule, DatePipe, DecimalPipe],
  styleUrls: ['./student-operations-students.page.css'],
  template: `
    <section aria-label="TRUST bank verification">
      <h4>Bank verification in Sophia</h4>
      @for (receipt of receipts; track receipt.id) {
        <p>Verified · AUD {{ receipt.amount }} · {{ receipt.receivedOn }} · {{ receipt.account }}
          @if (excess(receipt.amount, receipt.invoiceDue) > 0) {
            · Above invoice balance AUD {{ excess(receipt.amount, receipt.invoiceDue) | number:'1.2-2' }}
          }
          @if (receipt.reference) { · {{ receipt.reference }} }
          <small>Recorded {{ receipt.verifiedAt | date:'medium' }} · Invoice balance at verification AUD {{ receipt.invoiceDue | number:'1.2-2' }}</small>
          @if (receipt.hasEvidence) { <button class="invoice-link" type="button" (click)="download(receipt.id)">Download screenshot</button> }
        </p>
      }
      @if (loadFailed) { <button class="btn" type="button" (click)="load()">Retry loading bank verifications</button> }
      @if (ready && invoice.status === 'AUTHORISED' && invoice.amountDue > 0) {
        <details><summary>Verify a TRUST bank deposit</summary>
          <form #form="ngForm" (ngSubmit)="form.valid && save()" class="student-form">
            <fieldset [disabled]="saving" class="form-grid">
              <label>Payment date<input type="date" name="date" required [(ngModel)]="date"></label>
              <label>Full bank receipt (AUD)<input type="text" inputmode="decimal" name="amount" pattern="(0|[1-9][0-9]{0,11})([.][0-9]{1,2})?" required [(ngModel)]="amount"></label>
              <label>Receiving TRUST account name<input name="account" maxlength="120" required [(ngModel)]="account"></label>
              <label>Bank reference (if shown)<input name="reference" maxlength="150" [(ngModel)]="reference"></label>
              <label>Bank screenshot (optional, PNG or JPEG, up to 5 MB)<input type="file" accept="image/png,image/jpeg" (change)="selectFile($event)"></label>
            </fieldset>
            @if (excess(amount, invoice.amountDue) > 0) {
              <p>Amount above this invoice balance: AUD {{ excess(amount, invoice.amountDue) | number:'1.2-2' }}. Review the difference separately.</p>
            }
            <p>Saving confirms you saw the deposit in online banking. Xero posting and bank reconciliation are separate steps.</p>
            <button class="btn primary" type="submit" [disabled]="saving || form.invalid || !account.trim() || +amount <= 0 || fileError">Save verified receipt</button>
          </form>
        </details>
      }
      @if (message) { <p role="status">{{ message }}</p> }
    </section>
  `,
})
export class TrustReceiptForm implements OnInit {
  @Input({required:true}) connection!: string;
  @Input({required:true}) invoice!: XeroStudentInvoiceDetail;
  private readonly api = inject(StudentOperationsService);
  private readonly destroy = inject(DestroyRef);
  receipts: TrustReceiptVerification[] = [];
  ready = false;
  loadFailed = false;
  saving = false;
  message = '';
  date = '';
  amount = '';
  account = '';
  reference = '';
  file?: File;
  fileError = false;
  private key = crypto.randomUUID();

  ngOnInit() { this.load(); }

  excess(receipt: string, invoiceDue: string | number): number {
    const difference = Math.round(Number(receipt) * 100) - Math.round(Number(invoiceDue) * 100);
    return Number.isSafeInteger(difference) ? Math.max(0, difference) / 100 : 0;
  }

  load() {
    this.ready = this.loadFailed = false;
    this.api.trustReceipts(this.connection,this.invoice.xeroInvoiceId).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: receipts => { this.receipts = receipts; this.ready = true; },
      error: () => { this.loadFailed = true; },
    });
  }

  selectFile(event: Event) {
    this.file = (event.target as HTMLInputElement).files?.[0];
    this.fileError = !!this.file && (this.file.size > 5242880 || !['image/png','image/jpeg'].includes(this.file.type));
    this.message = this.fileError ? 'Select a PNG or JPEG up to 5 MB.' : '';
  }

  save() {
    if (!this.ready || this.saving || this.fileError) return;
    const data = new FormData();
    for (const [name,value] of Object.entries({receivedOn:this.date, amount:this.amount, account:this.account, reference:this.reference})) data.append(name,value);
    if (this.file) data.append('file',this.file);
    this.saving = true;
    this.api.verifyTrustReceipt(this.connection,this.invoice.xeroInvoiceId,data,this.key).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: () => {
        this.saving = false;
        this.amount = this.date = this.reference = '';
        this.file = undefined;
        this.key = crypto.randomUUID();
        this.message = 'Receipt verified in Sophia.';
        this.load();
      },
      error: error => {
        this.saving = false;
        this.message = error.status === 409 ? 'Check existing verifications, the date and invoice status before retrying.' : 'Could not confirm the save. Retry with the same receipt details.';
      },
    });
  }

  download(id: string) {
    this.api.trustReceiptEvidence(this.connection,this.invoice.xeroInvoiceId,id).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = blob.type === 'image/png' ? 'bank-verification.png' : 'bank-verification.jpg';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url),1000);
      },
      error: () => { this.message = 'The screenshot could not be downloaded.'; },
    });
  }
}
