import { Component, Input, OnChanges, OnDestroy, SimpleChanges, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ManagerSelectComponent, ManagerSelectOption } from '../../components/shared/manager-select/manager-select.component';
import type { TrustReceiptVerification, TrustStatementSource } from '../student-operations.types';
import { previewStatement, StatementDeposit, readStatementFile, statementHeaders } from './trust-statement-preview';

@Component({
  selector: 'app-trust-statement-preview',
  imports: [FormsModule, ManagerSelectComponent],
  styleUrls: ['./student-operations-students.page.css'],
  styles: [`
    :host { display:block; min-width:0; grid-column:1/-1; overflow-wrap:anywhere; }
    input { display:block; max-width:100%; }
    summary { cursor:pointer; }
  `],
  template: `
    <details><summary>Use a bank statement CSV</summary>
      <p>Enter the receiving TRUST account name to match the statement. Use YYYY-MM-DD dates and signed decimal amounts. Eligible rows are booked or posted AUD deposits.</p>
      <p>CSV columns · {{ headers }}. <a class="invoice-link" href="/assets/trust-statement-template.csv" download>Download CSV header</a></p>
      <label>Statement CSV (up to 512 KB and 1,000 rows)
        <input type="file" accept=".csv,text/csv" [disabled]="!account.trim() || disabled" (change)="read($event)">
      </label>
      @if (loading) { <p role="status">Reading statement…</p> }
      @if (error) { <p role="alert">{{error}}</p> }
      @if (preview; as result) {
        <p role="status">{{ result.deposits.length }} eligible deposits · {{ fileName }}</p>
        @for (reason of result.reasons; track reason.label) { <p>{{ reason.label }} · {{ reason.count }}</p> }
        @if (options.length) {
          <app-manager-select ariaLabel="Statement deposit" placeholder="Choose a deposit" [options]="options" [searchable]="true"
            [disabled]="disabled" [ngModelOptions]="{standalone:true}" [ngModel]="selected" (ngModelChange)="selected = $event" />
          @if (hasDraft) { <p>Using a row replaces the current receipt draft, including its payment selection, purpose and screenshot.</p> }
          <button class="btn small" type="button" [disabled]="!selected || disabled" (click)="apply()">{{ applyLabel }}</button>
        }
        <button class="btn small" type="button" (click)="clear()">Close statement preview</button>
      }
    </details>
  `,
})
export class TrustStatementPreview implements OnChanges, OnDestroy {
  @Input() account = '';
  @Input() today = '';
  @Input() disabled = false;
  @Input() receipts: readonly TrustReceiptVerification[] = [];
  @Input() applyLabel = 'Use selected row in receipt form';
  @Input() hasDraft = false;
  readonly useDeposit = output<StatementDeposit & {source:TrustStatementSource}>();
  readonly headers = statementHeaders.join(', ');
  selected = '';
  options: ManagerSelectOption[] = [];
  preview?: ReturnType<typeof previewStatement>;
  fileName = '';
  loading = false;
  error = '';
  private sha256 = '';
  private revision = 0;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['account'] || changes['today'] || changes['receipts']) this.clear();
  }
  ngOnDestroy() { this.revision++; }

  clear() {
    this.revision++;
    this.preview = undefined;
    this.options = [];
    this.selected = this.fileName = this.sha256 = this.error = '';
    this.loading = false;
  }

  async read(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    this.clear();
    if (!file || !this.account.trim() || this.disabled) return;
    const revision = this.revision;
    this.loading = true;
    try {
      const {text,sha256,name} = await readStatementFile(file);
      if (revision !== this.revision) return;
      const preview = previewStatement(text, this.account, this.today);
      const account = this.account.trim().toLowerCase();
      const verified = new Set(this.receipts.filter(r => r.account?.trim().toLowerCase() === account)
        .map(r => r.bankTransactionId).filter(Boolean));
      const eligible = preview.deposits.filter(d => !verified.has(d.transactionId));
      const linkedCount = preview.deposits.length - eligible.length;
      if (linkedCount) preview.reasons.push({label:'Already verified on this invoice',count:linkedCount});
      preview.deposits = eligible;
      this.options = eligible.map(d => ({value:String(d.row),
        label:`Row ${d.row} · ${d.date} · AUD ${d.amount} · ${d.transactionId}${d.reference ? ' · ' + d.reference : ''}`}));
      this.preview = preview;
      this.fileName = name;
      this.sha256 = sha256;
    } catch (error) {
      if (revision === this.revision) this.error = error instanceof Error ? error.message : 'Could not read the CSV.';
    } finally {
      if (revision === this.revision) this.loading = false;
    }
  }

  apply() {
    const row = this.preview?.deposits.find(d => String(d.row) === this.selected);
    if (!row || this.disabled) return;
    this.useDeposit.emit({...row,source:{name:this.fileName,sha256:this.sha256,record:row.row}});
    this.clear();
  }
}
