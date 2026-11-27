import { TrustClaimHistory } from './trust-claim-history.component';
import { XeroReviewUrlPipe } from './xero-review-url.pipe';
import { forkJoin, map, type Observable } from 'rxjs';
import { Component, DestroyRef, ElementRef, Input, OnChanges, OnInit, Pipe, PipeTransform, SimpleChanges, inject, output, viewChild } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { StudentOperationsService } from '../student-operations.service';
import type { TrustReceiptVerification, XeroStudentInvoiceDetail } from '../student-operations.types';

type ImportedPayment = NonNullable<XeroStudentInvoiceDetail['settlement']>['entries'][number];

@Pipe({name: 'receiptPaymentCandidates'})
class ReceiptPaymentCandidatesPipe implements PipeTransform {
  transform(ids: string[], bankReference: string, payments: ReadonlyMap<string, ImportedPayment>) {
    const reference = bankReference?.trim().toLowerCase();
    const candidates = ids.map(id => {
      const importedReference = payments.get(id)?.reference?.trim();
      const comparable = !!reference && !!importedReference;
      const matchesReference = comparable && reference === importedReference.toLowerCase();
      return {id, importedReference, matchesReference, differsFromReference: comparable && !matchesReference};
    });
    return candidates.sort((a, b) => Number(b.matchesReference) - Number(a.matchesReference));
  }
}

@Component({
  selector: 'app-trust-receipt-form',
  host: {'(document:visibilitychange)': 'onVisibilityChange()'},
  imports: [FormsModule, DatePipe, DecimalPipe, XeroReviewUrlPipe, TrustClaimHistory, ReceiptPaymentCandidatesPipe],
  styleUrls: ['./student-operations-students.page.css'],
  template: `
    <section aria-label="TRUST bank verification">
      <h4>Bank verification in Sophia</h4>
      @if (invoice.xeroInvoiceId | xeroReviewUrl:'invoice':shortCode; as invoiceUrl) {
        <a class="invoice-link" [href]="invoiceUrl" target="_blank" rel="noopener noreferrer">View TRUST invoice in Xero</a>
      }
      @for (receipt of receipts; track receipt.id) {
        @let difference = balanceAfterReceipt(receipt.amount, receipt.invoiceDue);
        <p>Verified · AUD {{ receipt.amount }} · {{ receipt.receivedOn }} · {{ receipt.account }}
          @if (difference !== null && difference < 0) {
            · Above invoice balance AUD {{ -difference | number:'1.2-2' }}
          }
          @if (difference !== null && difference > 0) {
            · Partial payment · Expected balance after this receipt at verification AUD {{ difference | number:'1.2-2' }}
          }
          @if (receipt.reference) { · Bank reference · {{ receipt.reference }} }
          @if (receipt.paymentPurpose) { <small>Payment purpose · {{ receipt.paymentPurpose }}</small> }
          <small>Verified by {{ receipt.verifiedByName || 'Staff member unavailable' }} · {{ receipt.verifiedAt | date:'medium' }} · Invoice balance at verification AUD {{ receipt.invoiceDue | number:'1.2-2' }}</small>
          @if (receipt.hasEvidence) { <button class="invoice-link" type="button" (click)="download(receipt.id)">Download screenshot</button> }
        </p>
        @if (difference !== null && difference < 0 && receipt.possibleOverpaymentIds; as credits) {
          @if (receipt.linkedOverpaymentId; as linked) {
            <p>Linked Xero overpayment · {{ linked }} · Linked by {{ receipt.overpaymentLinkedByName || 'Staff member unavailable' }} · {{ receipt.overpaymentLinkedAt | date:'medium' }}</p>
            @if (receipt.overpaymentLinkNote) { <p>Overpayment link note · {{ receipt.overpaymentLinkNote }}</p> }
            @if (!credits.includes(linked)) { <p role="status">Review required. The linked overpayment no longer matches the imported records.</p> }
          } @else if (credits.length) {
            <details><summary>Possible Xero overpayments ({{ credits.length }})</summary>
              <p>Check these records in Xero. Each matches the contact, receipt date and excess amount.</p>
              <label>Reason for this overpayment link (optional)<textarea #creditNote maxlength="500" rows="2" [disabled]="saving"></textarea></label>
              @for (id of credits; track id) {
                <button class="btn" type="button" [disabled]="saving || !ready" (click)="link(receipt.id, id, 'overpayment', creditNote.value)">Confirm overpayment link · {{ id }}</button>
              }
            </details>
          } @else { <p>No imported Xero overpayment matches this contact, date and excess amount.</p> }
        }
        @if (receipt.linkedPaymentId) {
          <p>Linked Xero invoice payment · AUD {{ receipt.linkedAmount }} · {{ receipt.linkedPaymentId }}
            @if (receipt.paymentLinkedAt) { <small>Linked by {{ receipt.paymentLinkedByName || 'Staff member unavailable' }} · {{ receipt.paymentLinkedAt | date:'medium' }}</small> }
          </p>
          @if (receipt.paymentLinkNote) { <p>Payment link note · {{ receipt.paymentLinkNote }}</p> }
          @if (receipt.linkedPaymentId | xeroReviewUrl:'payment':shortCode; as paymentUrl) {
            <a class="invoice-link" [href]="paymentUrl" target="_blank" rel="noopener noreferrer">View linked payment in Xero</a>
          }
          @if (!receipt.candidateIds?.includes(receipt.linkedPaymentId)) {
            <p role="status">Review required. The linked payment no longer matches the imported invoice details.</p>
            @if (importedPayments.get(receipt.linkedPaymentId); as payment) {
              <p>Imported payment · {{ invoice.currencyCode || 'Currency unknown' }} {{ payment.amount | number:'1.2-4' }}
                · {{ payment.date || 'Date unavailable' }}</p>
              <p>At linking · AUD {{ receipt.linkedAmount | number:'1.2-2' }} · {{ receipt.receivedOn }}</p>
            } @else if (invoice.settlement) {
              <p>The imported invoice has no payment with this ID.</p>
            } @else {
              <p>Imported settlement details are unavailable for this invoice.</p>
            }
          } @else if (receipt.linkedPaymentReconciled === true) {
            <p>Bank reconciliation confirmed in the latest imported Xero payment.</p>
          } @else if (receipt.reconciliationCheckedAt) {
            <p>{{ receipt.linkedPaymentReconciled === false ? 'Latest Xero import shows this payment pending reconciliation. Review the discrepancy in Xero.' : 'Awaiting reconciliation confirmation from the Xero import.' }}</p>
          } @else if (receipt.linkedPaymentReconciled === false) {
            <p>Latest Xero import shows this payment pending reconciliation. In the TRUST account in Xero, use Find &amp; Match to select the existing payment for the statement line.</p>
          } @else {
            <p>Bank reconciliation status unknown. Check the existing payment in the TRUST account in Xero.</p>
          }
          @if (receipt.linkedPaymentReconciled !== true) {
            @if (receipt.reviewClaimId; as claim) {
              <p>Follow-up owner · {{ receipt.reviewOwnedByMe ? 'You' : receipt.reviewOwnerName || 'Staff member unavailable' }}</p>
              @if (receipt.reviewOwnedByMe) {
                <button class="btn" type="button" [disabled]="saving || !ready" (click)="changeClaim(receipt.id, receipt.linkedPaymentId, claim)">Release follow-up</button>
              }
            } @else {
              <button class="btn" type="button" [disabled]="saving || !ready" (click)="changeClaim(receipt.id, receipt.linkedPaymentId)">Claim follow-up</button>
            }
          }
          @if (receipt.reconciliationCheckedAt; as checkedAt) {
            <p>Reported reconciled in Xero by {{ receipt.reconciliationCheckedByName || 'Staff member unavailable' }} · {{ checkedAt | date:'medium' }}</p>
            @if (receipt.reportedReconciledOn) { <p>Reconciliation date reported by manager · {{ receipt.reportedReconciledOn }}</p> }
          } @else if (receipt.candidateIds?.includes(receipt.linkedPaymentId) && receipt.linkedPaymentReconciled !== true) {
            <details><summary>Record a manual reconciliation check</summary>
              <p>Confirm after you have seen this payment marked Reconciled in the TRUST account in Xero.</p>
              <label>Reconciliation date shown in Xero (optional)<input type="date" #reconciledOn [disabled]="saving"></label>
              <button class="btn" type="button" [disabled]="saving || !ready || !reconciledOn.validity.valid" (click)="attest(receipt.id, receipt.linkedPaymentId, reconciledOn.value)">I saw this payment reconciled in Xero</button>
            </details>
          }
          <app-trust-claim-history [connection]="connection" [invoiceId]="invoice.xeroInvoiceId"
            [receiptId]="receipt.id" [paymentId]="receipt.linkedPaymentId" [claimId]="receipt.reviewClaimId" />
        } @else if (receipt.candidateIds; as candidates) {
          @if (candidates.length) {
            <details><summary>Review matching invoice payments ({{ candidates.length }})</summary>
              <p>Same TRUST invoice, payment date and invoice payment amount. Check the payment ID against your evidence before linking.</p>
              <label>Reason for this link (optional)<textarea #decisionNote maxlength="500" rows="2" [disabled]="saving"></textarea></label>
              @let ranked = candidates | receiptPaymentCandidates:receipt.reference:importedPayments;
              @if (ranked.length > 1 && ranked[1].matchesReference) {
                <p>Multiple payments match the bank reference. Compare their payment IDs in Xero before choosing one.</p>
              }
              <ul>
                @for (payment of ranked; track payment.id) {
                  <li>
                    <p>Xero payment reference · {{ payment.importedReference || 'Unavailable' }}</p>
                    @if (payment.matchesReference) { <small>Matches bank reference</small> }
                    @else if (payment.differsFromReference) { <small>Differs from bank reference</small> }
                    @if (payment.id | xeroReviewUrl:'payment':shortCode; as paymentUrl) {
                      <a class="invoice-link" [href]="paymentUrl" target="_blank" rel="noopener noreferrer">Review payment {{ payment.id }} in Xero</a>
                    }
                    <button class="btn" type="button" [disabled]="saving || !ready" (click)="link(receipt.id, payment.id, 'payment', decisionNote.value)">Confirm link · {{ payment.id }}</button>
                  </li>
                }
              </ul>
            </details>
          } @else {
            <small>Awaiting a matching imported Xero invoice payment.</small>
          }
        }
      }
      @if (loadFailed) {
        <p role="alert">The latest imported details could not be loaded.</p>
      }
      <button class="btn" type="button" (click)="load(true)" [disabled]="loading || saving">
        {{ loading ? 'Loading imported details…' : loadFailed ? 'Retry loading imported details' : 'Refresh imported details' }}
      </button>
      @if (hasLoaded && invoice.status === 'AUTHORISED' && invoice.amountDue > 0) {
        <details><summary>Verify a TRUST bank deposit</summary>
          <form #form="ngForm" (ngSubmit)="form.valid && save()" class="student-form">
            <fieldset [disabled]="saving" class="form-grid">
              <label>Payment date<input type="date" name="date" required [(ngModel)]="date"></label>
              <label>Full bank receipt (AUD)<input type="text" inputmode="decimal" name="amount" pattern="(0|[1-9][0-9]{0,11})([.][0-9]{1,2})?" required [(ngModel)]="amount"></label>
              <label>Receiving TRUST account name<input name="account" maxlength="120" required [(ngModel)]="account"></label>
              <label>Bank reference (if shown)<input name="reference" maxlength="150" [(ngModel)]="reference"></label>
              <label>Payment purpose (optional)<input name="paymentPurpose" maxlength="240" placeholder="e.g. Tuition instalment" [(ngModel)]="paymentPurpose"></label>
              <label>Bank screenshot (optional, PNG or JPEG, up to 5 MB)<input #screenshotInput type="file" accept="image/png,image/jpeg" (change)="selectFile($event)"></label>
              @if (file) {
                <button class="btn small" type="button" (click)="clearScreenshot()">Remove screenshot</button>
              }
            </fieldset>
            @let difference = balanceAfterReceipt(amount, invoice.amountDue);
            @if (difference !== null && difference > 0) {
              <p>Partial payment · Expected invoice balance after this receipt AUD {{ difference | number:'1.2-2' }}</p>
            } @else if (difference !== null && difference < 0) {
              <p>Amount above this invoice balance: AUD {{ -difference | number:'1.2-2' }}. Review the difference separately.</p>
            }
            <p>Saving confirms you saw the deposit in online banking. Xero posting and bank reconciliation are separate steps.</p>
            <button class="btn primary" type="submit" [disabled]="!ready || saving || form.invalid || !account.trim() || +amount <= 0 || fileError">Save verified receipt</button>
          </form>
        </details>
      }
      @if (message) { <p role="status">{{ message }}</p> }
    </section>
  `,
})
export class TrustReceiptForm implements OnInit, OnChanges {
  @Input() shortCode: string | null = null;
  @Input({required:true}) connection!: string;
  @Input({required:true}) invoice!: XeroStudentInvoiceDetail;
  readonly invoiceRefreshed = output<XeroStudentInvoiceDetail>();
  readonly receiptsChanged = output<void>();
  private readonly api = inject(StudentOperationsService);
  private readonly destroy = inject(DestroyRef);
  receipts: TrustReceiptVerification[] = [];
  hasLoaded = false;
  loading = false;
  ready = false;
  loadFailed = false;
  saving = false;
  message = '';
  date = '';
  amount = '';
  account = '';
  reference = '';
  paymentPurpose = '';
  private readonly screenshotInput = viewChild<ElementRef<HTMLInputElement>>('screenshotInput');
  file?: File;
  fileError = false;
  private key = crypto.randomUUID();

  importedPayments = new Map<string, ImportedPayment>();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['invoice']) {
      this.importedPayments = new Map<string, ImportedPayment>();
      for (const entry of this.invoice.settlement?.entries ?? []) {
        if (entry.kind === 'payment') this.importedPayments.set(entry.id, entry);
      }
    }
  }

  ngOnInit() { this.load(); }

  balanceAfterReceipt(receipt: string, invoiceDue: string | number): number | null {
    if (!/^(0|[1-9][0-9]{0,11})([.][0-9]{1,2})?$/.test(receipt)) return null;
    const due = /^(\d+)(?:\.(\d{1,4}))?$/.exec(String(invoiceDue));
    if (!due) return null;

    const fraction = (due[2] ?? '').padEnd(3, '0');
    const dueCents = Number(due[1]) * 100 + Number(fraction.slice(0, 2)) + Number(fraction[2] >= '5');
    const receiptCents = Math.round(Number(receipt) * 100);
    if (!Number.isSafeInteger(dueCents) || receiptCents === 0) return null;
    return (dueCents - receiptCents) / 100;
  }

  onVisibilityChange(): void {
    if (document.visibilityState === 'visible') this.load(true);
  }

  load(refreshInvoice = false): void {
    if (this.loading || this.saving) return;
    this.loading = true;
    this.ready = this.loadFailed = false;
    const id = this.invoice.xeroInvoiceId;
    const receipts = this.api.trustReceipts(this.connection, id);
    const request: Observable<{receipts: TrustReceiptVerification[]; invoice: XeroStudentInvoiceDetail | null}> = refreshInvoice
      ? forkJoin({receipts, invoice: this.api.xeroStudentInvoice(this.connection, id)})
      : receipts.pipe(map(rows => ({receipts: rows, invoice: null})));
    request.pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: result => {
        this.receipts = result.receipts;
        this.ready = this.hasLoaded = true;
        this.loading = false;
        if (result.invoice) {
          this.invoiceRefreshed.emit(result.invoice);
          this.receiptsChanged.emit();
        }
      },
      error: () => {
        this.loading = false;
        this.loadFailed = true;
      },
    });
  }

  selectFile(event: Event) {
    this.file = (event.target as HTMLInputElement).files?.[0];
    this.fileError = !!this.file && (this.file.size > 5242880 || !['image/png','image/jpeg'].includes(this.file.type));
    this.message = this.fileError ? 'Select a PNG or JPEG up to 5 MB.' : '';
  }

  clearScreenshot(): void {
    const input = this.screenshotInput()?.nativeElement;
    if (input) input.value = '';
    this.file = undefined;
    this.fileError = false;
    this.message = '';
  }

  save() {
    if (!this.ready || this.saving || this.fileError) return;
    const data = new FormData();
    for (const [name,value] of Object.entries({receivedOn:this.date, amount:this.amount, account:this.account, reference:this.reference})) data.append(name,value);
    if (this.paymentPurpose.trim()) data.append('paymentPurpose',this.paymentPurpose.trim());
    if (this.file) data.append('file',this.file);
    this.saving = true;
    this.api.verifyTrustReceipt(this.connection,this.invoice.xeroInvoiceId,data,this.key).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: () => {
        this.saving = false;
        this.amount = this.date = this.reference = this.paymentPurpose = '';
        this.clearScreenshot();
        this.key = crypto.randomUUID();
        this.receiptsChanged.emit();
        this.message = 'Receipt verified in Sophia.';
        this.load();
      },
      error: error => {
        this.saving = false;
        this.message = error.status === 409 ? 'Check existing verifications, the date and invoice status before retrying.' : 'Could not confirm the save. Retry with the same receipt details.';
      },
    });
  }

  changeClaim(receipt: string, payment: string, releaseClaim?: string) {
    if (this.saving || !this.ready) return;
    this.saving = true;
    this.api.changeTrustReviewClaim(this.connection,this.invoice.xeroInvoiceId,receipt,payment,releaseClaim)
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: () => { this.saving = false; this.message = releaseClaim ? 'Follow-up released.' : 'Follow-up assigned to you.'; this.receiptsChanged.emit(); this.load(); },
        error: () => { this.saving = false; this.message = 'Ownership could not be confirmed. Check the refreshed follow-up.'; this.load(); },
      });
  }

  attest(receipt: string, payment: string, date?: string) {
    if (this.saving || !this.ready) return;
    this.saving = true;
    this.api.attestTrustReconciliation(this.connection, this.invoice.xeroInvoiceId, receipt, payment, date || undefined)
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: () => { this.saving = false; this.message = 'Manual reconciliation check recorded in Sophia.'; this.receiptsChanged.emit(); this.load(); },
        error: error => {
          this.saving = false;
          this.message = error.status === 400 ? 'Enter a valid reconciliation date on or before today in Brisbane.' : 'Could not confirm the check. Review the refreshed payment details.';
          this.load();
        },
      });
  }

  link(receipt: string, id: string, kind: 'payment' | 'overpayment' = 'payment', decisionNote?: string) {
    if (this.saving || !this.ready) return;
    this.saving = true;
    const args = [this.connection, this.invoice.xeroInvoiceId, receipt, id, decisionNote?.trim() || undefined] as const;
    const request: Observable<unknown> = kind === 'payment' ? this.api.linkTrustPayment(...args) : this.api.linkTrustOverpayment(...args);
    request
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: () => { this.saving = false; this.receiptsChanged.emit(); this.message = kind === 'payment' ? 'Xero invoice payment linked in Sophia.' : 'Xero overpayment linked in Sophia.'; this.load(); },
        error: () => { this.saving = false; this.message = 'Could not confirm the link. Review the refreshed payment details.'; this.load(); },
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
