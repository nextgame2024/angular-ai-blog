import { Component, Input, OnChanges, OnDestroy } from '@angular/core';
import type { TrustReceiptVerification } from '../student-operations.types';
import { previewStatement, readStatementFile } from './trust-statement-preview';

@Component({
  selector: 'app-trust-statement-source-check',
  styles: [`
    :host { display:block; min-width:0; overflow-wrap:anywhere; }
    input { display:block; max-width:100%; }
  `],
  template: `
    @if (receipt.statementSource; as source) {
      <details><summary>Statement source · {{ source.name }} · Record {{ source.record }}</summary>
        <p>SHA-256 · {{ source.sha256 }}</p>
        <label>Compare with the original CSV on this device
          <input type="file" accept=".csv,text/csv" (change)="compare($event)">
        </label>
        @if (message) { <p role="status">{{ message }}</p> }
      </details>
    }
  `,
})
export class TrustStatementSourceCheck implements OnChanges, OnDestroy {
  @Input({required:true}) receipt!: TrustReceiptVerification;
  message = '';
  private revision = 0;
  ngOnChanges() { this.revision++; this.message = ''; }
  ngOnDestroy() { this.revision++; }

  async compare(event: Event) {
    const revision = ++this.revision;
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    const receipt = this.receipt;
    const source = receipt.statementSource;
    this.message = '';
    if (!file || !source) return;
    this.message = 'Checking statement…';
    try {
      const {sha256,text} = await readStatementFile(file);
      if (revision !== this.revision) return;
      if (sha256 !== source.sha256) {
        this.message = 'The file contents differ from the statement used at verification.';
        return;
      }
      const {deposits} = previewStatement(text,receipt.account,receipt.receivedOn);
      const row = deposits.find(deposit => deposit.row === source.record);
      const matches = row && row.date === receipt.receivedOn && row.amount === receipt.amount &&
        row.transactionId === receipt.bankTransactionId && row.reference === receipt.reference;
      this.message = matches ? 'The file and deposit details match the verified receipt.'
        : 'The file matches, but the recorded deposit details differ. Review this receipt.';
    } catch (error) {
      if (revision === this.revision) this.message = error instanceof Error ? error.message : 'Could not check the CSV.';
    }
  }
}
