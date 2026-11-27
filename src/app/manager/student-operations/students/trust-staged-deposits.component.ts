import { TrustInvoiceSuggestionPanel } from './trust-invoice-suggestions.component';
import { Component, DestroyRef, Input, OnChanges, SimpleChanges, inject, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ManagerSelectComponent, ManagerSelectOption } from '../../components/shared/manager-select/manager-select.component';
import { StudentOperationsService } from '../student-operations.service';
import type { StagedTrustDeposit } from '../student-operations.types';
import { TrustStatementPreview } from './trust-statement-preview.component';

@Component({
  selector:'app-trust-staged-deposits',
  imports:[TrustInvoiceSuggestionPanel,FormsModule,ManagerSelectComponent,TrustStatementPreview],
  styleUrls:['./student-operations-students.page.css'],
  styles:[`:host {display:block; min-width:0; grid-column:1/-1; overflow-wrap:anywhere;} input {max-width:100%;}`],
  template:`
    <button class="btn small" type="button" [disabled]="disabled" [attr.aria-expanded]="open" (click)="toggle()">
      {{ picker ? 'Choose a saved deposit' : 'Deposits awaiting an invoice' }}
    </button>
    @if (open) {
      @if (!picker) {
        <label>Receiving TRUST account name<input maxlength="120" [disabled]="saving" [(ngModel)]="account" (ngModelChange)="draft = undefined"></label>
        <app-trust-statement-preview [account]="account" [today]="today" [disabled]="saving"
          applyLabel="Review deposit for staging" (useDeposit)="draft = $event" />
        @if (draft; as row) {
          <p>{{ row.date }} · AUD {{ row.amount }} · {{ account }} · {{ row.transactionId }} · {{ row.reference }}</p>
          <button class="btn small" type="button" [disabled]="saving" (click)="save()">Save deposit without an invoice</button>
        }
      }
      <label>Find a saved deposit<input type="search" maxlength="150" [(ngModel)]="search" [ngModelOptions]="{standalone:true}"
        (keydown.enter)="$event.preventDefault(); find()"></label>
      <button type="button" class="btn small" (click)="find()">Search deposits</button>
      @if (message) { <p role="status">{{ message }}</p> }
      @if (loading) { <p role="status">Loading deposits…</p> }
      @if (error) { <p role="alert">{{ error }}</p><button type="button" class="btn small" (click)="load(page)">Retry list</button> }
      @if (loaded && !loading && !error) {
        @if (rows.length) {
          <app-manager-select ariaLabel="Saved TRUST deposit" placeholder="Select a saved deposit" [options]="options"
            [ngModel]="selected" (ngModelChange)="selected = $event" [ngModelOptions]="{standalone:true}" />
          @if (current(); as row) {
            <p>{{ row.account }} · {{ row.source.name }} · Record {{ row.source.record }}</p>
            @if (!picker) {
              <app-trust-invoice-suggestions [connection]="connection" [deposit]="row"
                (decisionSaved)="outcomesChanged.emit()" (review)="review.emit({invoice:$event,deposit:row})" />
            }
            @if (picker) {
              <button class="btn small" type="button" [disabled]="disabled" (click)="use(row)">Replace receipt draft with this deposit</button>
            }
          }
        } @else { <p>No deposits awaiting an invoice match this search.</p> }
        @if (page > 1 || hasMore) {
          <button type="button" class="btn small" [disabled]="page <= 1" (click)="load(page-1)">Previous deposits</button>
          <span>Page {{ page }}</span>
          <button type="button" class="btn small" [disabled]="!hasMore" (click)="load(page+1)">Next deposits</button>
        }
      }
    }
  `,
})
export class TrustStagedDeposits implements OnChanges {
  @Input({required:true}) connection = '';
  @Input() revision = 0;
  @Input() picker = false;
  @Input() disabled = false;
  readonly outcomesChanged=output<void>();
  readonly review = output<{invoice:string;deposit:StagedTrustDeposit}>();
  readonly picked = output<StagedTrustDeposit>();
  readonly today = new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Brisbane',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  open=false; loaded=false; loading=false; saving=false; hasMore=false;
  account=''; search=''; selected=''; message=''; error='';
  page=1;
  rows:StagedTrustDeposit[]=[];
  options:ManagerSelectOption[]=[];
  draft?:Omit<StagedTrustDeposit,'id'|'account'>;
  private appliedSearch='';
  private readonly api=inject(StudentOperationsService);
  private readonly destroy=inject(DestroyRef);
  private listRequest?:Subscription;
  private saveRequest?:Subscription;

  ngOnChanges(changes:SimpleChanges) {
    if (changes['connection']) {
      this.listRequest?.unsubscribe();
      this.saveRequest?.unsubscribe();
      this.open=this.saving=this.loaded=this.loading=false;
      this.account=this.search=this.appliedSearch=this.selected=this.message=this.error='';
      this.rows=[]; this.options=[]; this.draft=undefined;
    } else if (changes['revision'] && this.open) this.load(this.page);
  }
  toggle() {
    this.open=!this.open;
    if (this.open) this.load(1);
  }
  find() { this.appliedSearch=this.search.trim(); this.load(1); }
  load(page:number) {
    this.listRequest?.unsubscribe();
    this.page=page;
    this.loading=true; this.error=''; this.selected='';
    this.listRequest=this.api.stagedTrustDeposits(this.connection,this.appliedSearch,page).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next:result=>{
        if (!result.deposits.length && page>1) { this.load(1); return; }
        this.rows=result.deposits; this.hasMore=result.hasMore;
        this.options=this.rows.map(d=>({value:d.id,label:`${d.date} · AUD ${d.amount} · ${d.transactionId} · ${d.reference}`}));
        this.loaded=true; this.loading=false;
      },
      error:()=>{this.error='Saved deposits could not be loaded.'; this.loading=false;},
    });
  }
  current() { return this.rows.find(row=>row.id===this.selected); }
  use(row:StagedTrustDeposit) {
    if (this.disabled || !this.picker) return;
    this.picked.emit(row);
    this.open=false;
  }
  save() {
    if (!this.draft || this.saving || this.picker) return;
    this.saving=true; this.message='';
    this.saveRequest=this.api.stageTrustDeposit(this.connection,{...this.draft,account:this.account.trim()})
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next:result=>{
          this.saving=false; this.draft=undefined;
          this.outcomesChanged.emit();
          this.message=result.created?'Deposit saved for invoice review.':'This deposit was already saved.';
          this.search=this.appliedSearch=''; this.load(1);
        },
        error:err=>{this.saving=false; this.message=err.status===409?'Review existing receipts and saved deposits for a conflicting transaction.':'Could not save the deposit. You can retry.';},
      });
  }
}
