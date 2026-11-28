import { TrustPayerRelationships } from './trust-payer-relationships.component';
import { TrustLinePurposes } from './trust-line-purposes.component';
import { TrustMatchHistory } from './trust-match-history.component';
import { Component, DestroyRef, Input, OnChanges, inject, output } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { StudentOperationsService } from '../student-operations.service';
import type { TrustSplitPreview, TrustSplitInput, StagedTrustDeposit, TrustMatchDecision, TrustInvoiceSuggestion, TrustInvoiceSuggestions } from '../student-operations.types';

@Component({
  selector:'app-trust-invoice-suggestions',
  imports:[TrustPayerRelationships,TrustLinePurposes,TrustMatchHistory,FormsModule,DatePipe,DecimalPipe],
  styleUrls:['./student-operations-students.page.css'],
  styles:[`:host {display:block; min-width:0; overflow-wrap:anywhere;} fieldset {min-inline-size:0; max-width:100%; box-sizing:border-box;} input {max-width:100%; box-sizing:border-box;}`],
  template:`
    <button type="button" class="btn small" [attr.aria-expanded]="open" (click)="toggle()">Find possible invoices</button>
    <app-trust-match-history [connection]="connection" [depositId]="deposit.id" [revision]="historyRevision" />
    @if (open) {
      <p>Bank reference · {{ deposit.reference || 'Unavailable' }} · Deposit AUD {{ deposit.amount }}</p>
      <label>Search open invoices by number, reference, contact or confirmed payer
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
      @if (result?.reservation; as saved) {
        <p>Split {{saved.action==='reserve' ? 'reserved' : 'released'}} · {{saved.recordedAt | date:'medium'}} · {{saved.actor}} · {{saved.reason}}</p>
        @if (saved.plan; as plan) {
          @for (row of plan.allocations; track row.invoiceId) {
            <p>{{row.invoiceNumber || row.invoiceId}} · AUD {{row.amount}} reserved</p>
              @for (line of row.lines; track line.lineId) { <p>{{line.label}} · AUD {{line.amount}}</p> }
              <p>AUD {{row.purposeUnassigned ?? row.amount}} without a line purpose</p>
          }
          <p>AUD {{plan.allocated}} reserved · AUD {{plan.unassigned}} unassigned</p>
        }
      }
      @if (split.length && result?.reservation?.action!=='reserve') {
        <fieldset [disabled]="changing"><legend>Preview a receipt split</legend>
          <p>Use the payer’s remittance to enter each invoice amount. Check up to 20 invoices against imported balances. The preview expires when you leave the deposit.</p>
          @for (row of split; track row.invoiceId) {
            <label>{{row.label}} · {{row.contact || 'Contact unavailable'}} · AUD {{row.expectedBalance}} due
              <input inputmode="decimal" maxlength="15" placeholder="Amount in AUD" [ngModel]="row.amount"
                [ngModelOptions]="{standalone:true}" (ngModelChange)="clearPreview(); row.amount=$event">
            </label>
            <app-trust-line-purposes [connection]="connection" [deposit]="deposit.id" [invoice]="row.invoiceId" [choices]="row.lines"
              (changed)="clearPreview(); row.lines=$event" />
            <button class="btn small" type="button" (click)="removeSplit(row.invoiceId)">Remove {{row.label}}</button>
          }
          <button class="btn small" type="button" [disabled]="checkingSplit" (click)="checkSplit()">Check split against imported balances</button>
          @if (checkingSplit) { <p role="status">Checking split…</p> }
          @if (splitError) { <p role="alert">{{splitError}}</p> }
          @if (preview; as plan) {
            <div role="status">
              @for (allocation of plan.allocations; track allocation.invoiceId) {
                <p>{{allocation.invoiceNumber || allocation.invoiceId}} · AUD {{allocation.amount}} allocated · AUD {{allocation.remainingDue}} remaining due</p>
              @for (line of allocation.lines; track line.lineId) { <p>{{line.label}} · AUD {{line.amount}}</p> }
              <p>AUD {{allocation.purposeUnassigned ?? allocation.amount}} without a line purpose</p>
              }
              <p>AUD {{plan.allocated}} allocated · AUD {{plan.unassigned}} unassigned from this deposit</p>
            </div>
          }
        </fieldset>
      }
      @if (result && (result.reservation?.action==='reserve' || preview)) {
        <label>Reason for {{result.reservation?.action==='reserve' ? 'release' : 'reservation'}}
          <textarea maxlength="500" [(ngModel)]="reservationReason" [ngModelOptions]="{standalone:true}" [disabled]="changing"></textarea>
        </label>
        <button type="button" class="btn small" [disabled]="changing || !reservationReason.trim()" (click)="changeReservation()">
          {{result.reservation?.action==='reserve' ? 'Release split reservation' : 'Reserve split in Sophia'}}
        </button>
      }
      @if (result; as data) {
        @for (candidate of data.invoices; track candidate.id) {
          <div class="candidate-heading">
            <button type="button" class="invoice-link" (click)="review.emit(candidate.id)">Review {{ candidate.invoiceNumber || 'invoice' }}</button>
            <p>{{ candidate.contact || 'Contact unavailable' }} · AUD {{ candidate.balance }} due · Reference {{ candidate.reference || 'unavailable' }}</p>
            @if (candidate.contactId) {
              <app-trust-payer-relationships [connection]="connection" [contact]="candidate.contactId" (changed)="load(page)" />
            }
            @if (candidate.contactMatch) { <p>The bank description names the invoice contact.</p> }
            @for (payer of candidate.payerMatches; track payer.name) {
              <p>The bank description names {{payer.name}}, a confirmed {{payer.relationship}} for this contact.</p>
            }
            @if (candidate.contactConflict) { <p role="status">The bank details point to more than one invoice contact. Check the remittance before accepting a match.</p> }
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
            <button type="button" class="btn small" [disabled]="changing || data.reservation?.action==='reserve' || split.length>=20 || selectedForSplit.has(candidate.id)"
              (click)="addSplit(candidate)">Add to split</button>
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
          <p>{{ query ? 'No open TRUST invoices match this search.' : 'No open TRUST invoice matches the bank description or amount. Search by invoice or contact to investigate.' }}</p>
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
  split:(TrustSplitInput & {label:string;contact:string|null})[]=[];
  selectedForSplit=new Set<string>();
  preview?:TrustSplitPreview;
  checkingSplit=false;
  splitError='';
  private splitRequest?:Subscription;

  clearPreview() {
    this.splitRequest?.unsubscribe();
    this.preview=undefined; this.splitError=''; this.checkingSplit=false;
  }
  addSplit(candidate:TrustInvoiceSuggestion) {
    if (this.split.length>=20 || this.selectedForSplit.has(candidate.id)) return;
    this.clearPreview();
    this.selectedForSplit.add(candidate.id);
    this.split.push({invoiceId:candidate.id,expectedBalance:candidate.balance,
      amount:'',label:candidate.invoiceNumber || candidate.id,contact:candidate.contact});
  }
  removeSplit(id:string) {
    this.clearPreview();
    this.selectedForSplit.delete(id);
    this.split=this.split.filter(row=>row.invoiceId!==id);
  }
  private splitInputs():TrustSplitInput[] {
    return this.split.map(({invoiceId,expectedBalance,amount,lines})=>({
      invoiceId,expectedBalance,amount,...(lines?.length ? {lines} : {}),
    }));
  }
  checkSplit() {
    if (!this.split.length || this.checkingSplit) return;
    this.clearPreview();
    this.checkingSplit=true;
    const inputs=this.splitInputs();
    this.splitRequest=this.api.previewTrustSplit(this.connection,this.deposit.id,inputs)
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next:result=>{this.checkingSplit=false; this.preview=result;},
        error:err=>{
          this.checkingSplit=false;
          if (err.status===409 || err.status===404) {
            this.splitError='Refresh the invoice lines and look up the deposit and invoices again. The deposit or an invoice may have changed.';
          } else if (err.status===400) {
            this.splitError='Check each amount is positive, has at most two decimal places and fits its invoice and deposit. Line amounts must also fit the invoice allocation.';
          } else this.splitError='Could not check the split. Try again.';
        },
      });
  }

  reservationReason='';
  changing=false;
  private reservationRetry?:{signature:string;id:string};
  private reservationRequest?:Subscription;

  changeReservation() {
    const result=this.result, reason=this.reservationReason.trim();
    if (!result || this.changing || !reason) return;
    const release=result.reservation?.action==='reserve';
    if (!release && !this.preview) return;
    const revision=result.reservation?.revision ?? 0;
    const command=release ? {action:'release' as const,revision,reason} : {
      action:'reserve' as const,revision,reason,allocations:this.splitInputs(),
    };
    const signature=JSON.stringify(command);
    if (this.reservationRetry?.signature!==signature) this.reservationRetry={signature,id:crypto.randomUUID()};
    this.changing=true; this.feedback='';
    this.reservationRequest=this.api.changeTrustSplit(this.connection,this.deposit.id,{...command,requestId:this.reservationRetry.id})
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next:()=>{
          this.changing=false; this.reservationReason=''; this.reservationRetry=undefined;
          this.clearPreview(); this.split=[]; this.selectedForSplit.clear();
          this.feedback=release?'Split reservation released.':'Split reserved in Sophia.';
          this.decisionSaved.emit();
          this.load(this.page);
        },
        error:err=>{
          this.changing=false;
          if (err.status===409) {
            this.clearPreview(); this.reservationRetry=undefined; this.reservationReason='';
            this.feedback='Review the refreshed reservation, invoice balances and outstanding receipts before trying again.';
            this.load(this.page);
          } else this.feedback='Could not confirm the reservation change. Retry with the same details.';
        },
      });
  }

  private retry?:{signature:string;id:string};
  private write?:Subscription;
  private request?:Subscription;
  private readonly api=inject(StudentOperationsService);
  private readonly destroy=inject(DestroyRef);

  ngOnChanges() {
    this.reservationRequest?.unsubscribe(); this.reservationRetry=undefined; this.reservationReason=''; this.changing=false;
    this.clearPreview(); this.split=[]; this.selectedForSplit.clear();
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
