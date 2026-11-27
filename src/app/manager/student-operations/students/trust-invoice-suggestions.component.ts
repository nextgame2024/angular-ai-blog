import { TrustMatchHistory } from './trust-match-history.component';
import { Component, DestroyRef, Input, OnChanges, inject, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { StudentOperationsService } from '../student-operations.service';
import type { StagedTrustDeposit, TrustMatchDecision, TrustInvoiceSuggestion, TrustInvoiceSuggestions } from '../student-operations.types';

@Component({
  selector:'app-trust-invoice-suggestions',
  imports:[TrustMatchHistory,FormsModule,DecimalPipe],
  styleUrls:['./student-operations-students.page.css'],
  styles:[`:host {display:block; min-width:0; overflow-wrap:anywhere;} input {max-width:100%;}`],
  template:`
    <button type="button" class="btn small" [attr.aria-expanded]="open" (click)="toggle()">Find possible invoices</button>
    <app-trust-match-history [connection]="connection" [depositId]="deposit.id" [revision]="historyRevision" />
    @if (open) {
      <p>Bank reference · {{ deposit.reference || 'Unavailable' }} · Deposit AUD {{ deposit.amount }}</p>
      <label>Search open invoices by number, reference or contact
        <input type="search" maxlength="150" [(ngModel)]="search" [ngModelOptions]="{standalone:true}"
          (keydown.enter)="$event.preventDefault(); find()">
      </label>
      <button type="button" class="btn small" (click)="find()">Search invoices</button>
      @if (query) { <button type="button" class="btn small" (click)="search=''; find()">Return to suggestions</button> }
      @if (feedback) { <p role="status">{{ feedback }}</p> }
      @if (loading) { <p role="status">Checking imported TRUST invoices…</p> }
      @if (error) {
        <p role="alert">{{ error }}</p><button type="button" class="btn small" (click)="load(page)">Retry invoice lookup</button>
      }
      @if (result; as data) {
        @for (candidate of data.invoices; track candidate.id) {
          <div class="candidate-heading">
            <button type="button" class="invoice-link" (click)="review.emit(candidate.id)">Review {{ candidate.invoiceNumber || 'invoice' }}</button>
            <p>{{ candidate.contact || 'Contact unavailable' }} · AUD {{ candidate.balance }} due · Reference {{ candidate.reference || 'unavailable' }}</p>
            @if (candidate.numberMatch) { <span>Bank reference matches invoice number. </span> }
            @if (candidate.numberInReference) { <span>Bank reference contains the invoice number. </span> }
            @if (candidate.referenceMatch) { <span>Bank reference matches invoice reference. </span> }
            @if (!candidate.numberMatch && !candidate.numberInReference && !candidate.referenceMatch) {
              <span>{{ deposit.reference ? 'Bank reference differs from the invoice identifiers.' : 'Bank reference unavailable.' }} </span>
            }
            @if (candidate.amountMatch) { <span>Deposit equals the open balance.</span> }
            @else if (+candidate.difference < 0) { <span>AUD {{ -candidate.difference | number:'1.2-2' }} would remain due.</span> }
            @else { <span>Deposit exceeds the balance by AUD {{ +candidate.difference | number:'1.2-2' }}.</span> }
            @if (candidate.decision) {
              <p>Last review · {{ candidate.decision }} @if (candidate.evidenceChanged) { · Matching evidence has changed }</p>
            }
            <button type="button" class="btn small" [disabled]="saving" (click)="startDecision(candidate)">Record match decision</button>
            @if (editing === candidate.id) {
              <label>Reason for this decision<textarea maxlength="500" [(ngModel)]="reason" [ngModelOptions]="{standalone:true}" [disabled]="saving"></textarea></label>
              <p>Accepting selects this invoice for review and replaces any earlier accepted match for this deposit. Receipt verification is separate.</p>
              <button class="btn small" type="button" [disabled]="saving || !reason.trim() || (candidate.decision==='accepted' && !candidate.evidenceChanged)" (click)="record(candidate,'accepted')">Accept match</button>
              <button class="btn small" type="button" [disabled]="saving || !reason.trim() || (candidate.decision==='dismissed' && !candidate.evidenceChanged)" (click)="record(candidate,'dismissed')">Dismiss match</button>
            }
            @if (candidate.peers > 1 && candidate.score > 0) { <p>{{ candidate.peers }} invoices have the same matching evidence.</p> }
          </div>
        } @empty {
          <p>{{ query ? 'No open TRUST invoices match this search.' : 'No open TRUST invoice matches the bank reference or amount. Search by invoice or contact to investigate.' }}</p>
        }
        @if (page > 1 || data.hasMore) {
          <button class="btn small" type="button" [disabled]="page === 1" (click)="load(page-1)">Previous invoices</button>
          Page {{ page }}
          <button class="btn small" type="button" [disabled]="!data.hasMore" (click)="load(page+1)">Next invoices</button>
        }
      }
    }
  `,
})
export class TrustInvoiceSuggestionPanel implements OnChanges {
  @Input({required:true}) connection!:string;
  @Input({required:true}) deposit!:StagedTrustDeposit;
  readonly decisionSaved=output<void>();
  readonly review=output<string>();
  open=false;
  loading=false;
  search='';
  query='';
  error='';
  page=1;
  result?:TrustInvoiceSuggestions;
  editing=''; reason=''; feedback=''; saving=false; historyRevision=0;
  private retry?:{signature:string;id:string};
  private write?:Subscription;
  private request?:Subscription;
  private readonly api=inject(StudentOperationsService);
  private readonly destroy=inject(DestroyRef);

  ngOnChanges() {
    this.request?.unsubscribe();
    this.write?.unsubscribe();
    this.saving=false; this.editing=this.reason=this.feedback=''; this.retry=undefined;
    this.open=this.loading=false;
    this.query=this.search=this.error='';
    this.result=undefined;
  }
  startDecision(candidate:TrustInvoiceSuggestion) {
    if (this.saving) return;
    this.editing=candidate.id; this.reason=this.feedback='';
  }
  record(candidate:TrustInvoiceSuggestion,decision:TrustMatchDecision) {
    if (!this.result || this.saving || this.editing!==candidate.id || !this.reason.trim()) return;
    const body={invoiceId:candidate.id,decision,reason:this.reason.trim(),revision:this.result.revision,
      evidenceToken:candidate.evidenceToken,q:this.query,page:this.page};
    const signature=JSON.stringify(body);
    if (this.retry?.signature!==signature) this.retry={signature,id:crypto.randomUUID()};
    this.saving=true; this.feedback='';
    this.write=this.api.recordTrustInvoiceDecision(this.connection,this.deposit.id,{...body,requestId:this.retry.id})
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next:()=>{
          this.saving=false; this.feedback='Match decision recorded.'; this.retry=undefined;
          this.decisionSaved.emit(); this.historyRevision++; this.load(this.page);
        },
        error:err=>{
          this.saving=false;
          if (err.status===409) {
            this.feedback='Review the refreshed invoices and decision history before trying again.';
            this.retry=undefined; this.historyRevision++; this.load(this.page);
          } else this.feedback='Could not confirm the decision. Retry with the same reason.';
        },
      });
  }
  toggle() {
    this.open=!this.open;
    if (this.open) this.load(1);
    else this.request?.unsubscribe();
  }
  find() { this.query=this.search.trim(); this.load(1); }
  load(page:number) {
    this.request?.unsubscribe();
    this.editing=this.reason='';
    this.page=page; this.error=''; this.result=undefined; this.loading=true;
    this.request=this.api.trustInvoiceSuggestions(this.connection,this.deposit.id,this.query,page)
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next:result=>{
          if (page>1 && !result.invoices.length) { this.load(1); return; }
          this.result=result; this.loading=false;
        },
        error:err=>{
          this.loading=false;
          this.error=err.status===409 ? 'A verified receipt already uses this deposit. Refresh the saved deposit list.'
            : 'Could not load possible invoices for this deposit.';
        },
      });
  }
}
