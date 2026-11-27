import { Component, DestroyRef, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { StudentOperationsService } from '../student-operations.service';
import type { TrustReceiptProposal, TrustProposalAction, TrustReceiptVerification } from '../student-operations.types';

@Component({
  selector:'app-trust-receipt-proposal',imports:[FormsModule,DatePipe],styleUrls:['./student-operations-students.page.css'],
  styles:[':host {display:block;min-width:0;overflow-wrap:anywhere} textarea {max-width:100%;box-sizing:border-box}'],
  template:`
    <button type="button" class="btn small" [attr.aria-expanded]="open" [disabled]="saving" (click)="toggle()">Payment proposal</button>
    @if (open) {
      <button type="button" class="btn small" [disabled]="saving || loading" (click)="load()">Refresh proposal</button>
      @if (loading) { <p role="status">Checking verified receipt and imported invoice…</p> }
      @if (message) { <p role="status">{{message}}</p> }
      @if (detail; as d) {
        <p>Local payment proposal · {{labels[d.state]}}</p>
        <p>{{d.snapshot.invoiceNumber || d.snapshot.invoice}} · {{d.snapshot.contactName || d.snapshot.contactId || 'Contact unavailable'}}
          · Receipt AUD {{d.snapshot.amount}} · Imported balance {{d.snapshot.currency}} {{d.snapshot.due}}</p>
        <p>{{d.snapshot.organisation}} · {{d.snapshot.account}} · {{d.snapshot.date}} · {{d.snapshot.bankId}} {{d.snapshot.reference}}</p>
        @if (d.blocked) { <p>{{d.blocked}}</p> }
        @if (canPrepare || canApprove || canWithdraw) {
          <p>Review records the decision in Sophia. Posting to Xero is a separate step.</p>
          <label>Reason for decision<textarea maxlength="500" [disabled]="saving" [(ngModel)]="reason" [ngModelOptions]="{standalone:true}"></textarea></label>
          @if (canPrepare) { <button class="btn small" type="button" [disabled]="saving || !reason.trim()" (click)="record('prepare')">Prepare payment proposal</button> }
          @if (canApprove) { <button class="btn small" type="button" [disabled]="saving || !reason.trim()" (click)="record('approve')">Approve proposal in Sophia</button> }
          @if (canWithdraw) { <button class="btn small" type="button" [disabled]="saving || !reason.trim()" (click)="record('withdraw')">Withdraw proposal</button> }
        }
        @if (d.history.length) {
          <p>Proposal expires {{d.history[0].expiresAt | date:'medium'}}</p>
          <details><summary>Recent proposal history</summary>
            @for (e of d.history; track e.revision) {
              <p>{{actions[e.action]}} · {{e.recordedAt | date:'medium'}} · {{e.actor}} · {{e.reason}}</p>
              <p>{{e.snapshot.invoiceNumber || e.snapshot.invoice}} · {{e.snapshot.contactName || e.snapshot.contactId}}
                · AUD {{e.snapshot.amount}} · {{e.snapshot.organisation}} · {{e.snapshot.account}} · {{e.snapshot.date}} · {{e.snapshot.bankId}}</p>
            }
          </details>
        }
      }
    }
  `,
})
export class TrustReceiptProposalPanel implements OnChanges {
  @Input({required:true}) connection!:string;
  @Input({required:true}) invoice!:string;
  @Input({required:true}) receipt!:TrustReceiptVerification;
  readonly labels={new:'Awaiting preparation',prepared:'Awaiting approval',approved:'Approved in Sophia',stale:'Evidence changed',
    expired:'Expired',withdrawn:'Withdrawn'};
  readonly actions={prepare:'Prepared',approve:'Approved',withdraw:'Withdrawn'};
  open=false;loading=false;saving=false;reason='';message='';
  detail?:TrustReceiptProposal;
  canPrepare=false;canApprove=false;canWithdraw=false;
  private read?:Subscription;private write?:Subscription;
  private retry?:{key:string;id:string};
  private readonly api=inject(StudentOperationsService);
  private readonly destroy=inject(DestroyRef);
  ngOnChanges(changes:SimpleChanges) {
    const same=changes['receipt']?.previousValue?.id===this.receipt.id && !changes['connection'] && !changes['invoice'];
    if (same) { if (this.open && !this.saving) this.load(); return; }
    this.read?.unsubscribe();this.write?.unsubscribe();this.retry=undefined;this.detail=undefined;
    this.open=this.loading=this.saving=false;this.reason=this.message='';
  }
  toggle() {this.open=!this.open;if (this.open) this.load();else this.read?.unsubscribe();}
  load() {
    this.read?.unsubscribe();this.detail=undefined;this.loading=true;this.reason='';
    this.read=this.api.trustReceiptProposal(this.connection,this.invoice,this.receipt.id).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next:d=>{
        this.detail=d;this.loading=false;
        this.canPrepare=!d.blocked && !['prepared','approved'].includes(d.state);
        this.canApprove=!d.blocked && d.state==='prepared';
        this.canWithdraw=!!d.revision && d.state!=='withdrawn';
      },
      error:()=>{this.loading=false;this.message='Could not load the proposal. Refresh to retry.';},
    });
  }
  record(action:TrustProposalAction) {
    const d=this.detail,reason=this.reason.trim();
    if (!d || !reason || this.saving || !({prepare:this.canPrepare,approve:this.canApprove,withdraw:this.canWithdraw}[action])) return;
    const token=action==='withdraw'?d.history[0].token:d.token;
    const body={action,reason,revision:d.revision,token},key=JSON.stringify(body);
    if (this.retry?.key!==key) this.retry={key,id:crypto.randomUUID()};
    this.saving=true;
    this.write=this.api.changeTrustProposal(this.connection,this.invoice,this.receipt.id,{...body,requestId:this.retry.id})
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next:()=>{this.saving=false;this.retry=undefined;this.message='Decision recorded in Sophia.';this.load();},
        error:err=>{
          this.saving=false;
          if (err.status===409) {this.message='The proposal changed. Review the refreshed details.';this.load();}
          else this.message='Could not confirm the decision. Retry with the same details.';
        },
      });
  }
}
