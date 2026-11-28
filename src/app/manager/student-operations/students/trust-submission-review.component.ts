import {Component,DestroyRef,Input,OnChanges,inject,output} from '@angular/core';
import {DatePipe} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {Subscription} from 'rxjs';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import type {TrustDispatchRow,SubmissionReview} from '../student-operations.types';
import {StudentOperationsService} from '../student-operations.service';

@Component({
  selector:'app-trust-submission-review',imports:[FormsModule,DatePipe],styleUrls:['./student-operations-students.page.css'],
  styles:[':host{display:block;height:auto} textarea{display:block;max-width:100%;box-sizing:border-box}'],
  template:`
    <button type="button" class="btn small" [attr.aria-expanded]="open" [disabled]="busy" (click)="toggle()">Submission review</button>
    @if(open){
      <p>Reserved {{row.submittedAt | date:'medium'}} · Xero reference Sophia {{row.id}}</p>
      @if(row.acknowledgedId){<p>Acknowledged Xero payment ID · {{row.acknowledgedId}}</p>}
      @if(row.status!=='confirmed'){
        <button type="button" class="btn small" [disabled]="busy" (click)="check()">Check for the existing Xero payment</button>
        <label>Evidence checked and outcome<textarea maxlength="1000" [disabled]="busy" [(ngModel)]="evidence" [ngModelOptions]="{standalone:true}"></textarea></label>
        <button type="button" class="btn small" [disabled]="busy || stale || !evidence.trim()" (click)="save('investigate')">
          {{row.status==='review_closed'?'Reopen investigation':'Record investigation'}}</button>
        @if(row.status!=='review_closed'){
          <button type="button" class="btn small" [disabled]="busy || stale || !evidence.trim()" (click)="save('close')">Close review and retain reservation</button>
        }
        @if(stale){<button type="button" class="btn small" (click)="changed.emit()">Refresh dispatch</button>}
      }
      @if(message){<p role="status">{{message}}</p>}
      @for(event of entries;track event.revision){
        <p>{{event.recordedAt | date:'medium'}} · {{event.actor}} · {{event.action==='close'?'Review closed':'Investigation'}} · {{event.evidence}}</p>
      }
      @if(historyFailed || next){<button type="button" class="btn small" [disabled]="reading" (click)="history()">{{historyFailed?'Retry history':'Older reviews'}}</button>}
    }
  `,
})
export class TrustSubmissionReview implements OnChanges {
  @Input({required:true}) connection!:string;
  @Input({required:true}) row!:TrustDispatchRow;
  readonly changed=output<void>();
  open=false;busy=false;reading=false;historyFailed=false;stale=false;message='';evidence='';
  entries:SubmissionReview[]=[];next?:number;
  private actionRequest?:Subscription;private historyRequest?:Subscription;
  private retry?:{key:string;id:string};
  private readonly api=inject(StudentOperationsService);private readonly destroy=inject(DestroyRef);
  ngOnChanges() {
    this.actionRequest?.unsubscribe();this.historyRequest?.unsubscribe();
    this.open=this.busy=this.reading=this.historyFailed=this.stale=false;
    this.entries=[];this.next=this.retry=undefined;this.message=this.evidence='';
  }
  toggle(){
    this.open=!this.open;
    if(this.open){this.entries=[];this.next=undefined;this.history();}
    else this.historyRequest?.unsubscribe();
  }
  history(){
    this.reading=true;this.historyFailed=false;
    this.historyRequest=this.api.submissionReviews(this.connection,this.row.id,this.next).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next:page=>{this.entries.push(...page.entries);this.next=page.next??undefined;this.reading=false;},
      error:()=>{this.reading=false;this.historyFailed=true;},
    });
  }
  check(){
    if(this.busy || !this.row.receipt)return;
    this.busy=true;this.message='';
    this.actionRequest=this.api.recoverTrustSubmission(this.connection,this.row.invoice,this.row.receipt,this.row.id)
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next:r=>{this.busy=false;if(r.status==='confirmed')this.changed.emit();else this.message='The payment could not be verified. Review the invoice and bank evidence.';},
        error:()=>{this.busy=false;this.message='Could not confirm the Xero verification result. Refresh the queue or retry the check.';},
      });
  }
  save(action:SubmissionReview['action']){
    const evidence=this.evidence.trim(),revision=this.row.reviewRevision??0;
    if(this.busy || this.stale || !evidence)return;
    const key=JSON.stringify([action,revision,evidence]);
    if(this.retry?.key!==key)this.retry={key,id:crypto.randomUUID()};
    this.busy=true;this.message='';
    this.actionRequest=this.api.recordSubmissionReview(this.connection,this.row.id,{action,revision,evidence,requestId:this.retry.id})
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next:()=>{this.busy=false;this.changed.emit();},
        error:e=>{this.busy=false;this.stale=e.status===409;this.message=this.stale?'The dispatch changed. Refresh before saving.':'Could not confirm the save. Retry with the same evidence.';},
      });
  }
}
