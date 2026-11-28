import {Component,DestroyRef,Input,OnChanges,SimpleChanges,inject,output} from '@angular/core';
import {DatePipe} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {Subscription} from 'rxjs';
import {ManagerSelectComponent} from '../../components/shared/manager-select/manager-select.component';
import {ManagerListLoaderComponent} from '../../components/shared/manager-list-loader/manager-list-loader.component';
import {PageJumpComponent} from '../../../shared/components/page-jump/page-jump.component';
import {StudentOperationsService} from '../student-operations.service';
import type {TrustPaymentException} from '../student-operations.types';

@Component({
  selector:'app-trust-payment-exceptions',imports:[DatePipe,FormsModule,ManagerSelectComponent,ManagerListLoaderComponent,PageJumpComponent],
  styleUrls:['./student-operations-students.page.css'],
  styles:[':host{display:block;height:auto;min-width:0;overflow-wrap:anywhere} table.invoice-table{min-width:0} input{max-width:100%;box-sizing:border-box}'],
  template:`
    <button class="btn small" type="button" [attr.aria-expanded]="open" (click)="toggle()">Payment exceptions and follow-up</button>
    @if(open){
      <form class="student-form" (ngSubmit)="search()">
        <label>Invoice, bank transaction, payment or dispatch ID<input name="query" type="search" maxlength="150" [(ngModel)]="q"></label>
        <app-manager-select name="reason" ariaLabel="Follow-up reason" [(ngModel)]="reason" [options]="reasons"/>
        <app-manager-select name="owner" ariaLabel="Assigned reviewer" [(ngModel)]="owner" [options]="owners"/>
        <button class="btn small">Search and refresh</button>
      </form>
      @if(loading){<app-manager-list-loader label="Loading payment follow-ups…" />}
      @if(error){<p role="alert">Could not load payment follow-ups.</p><button type="button" class="btn small" (click)="load(page)">Retry</button>}
      @if(message){<p role="status">{{message}}</p>}
      @if(data;as result){
        <p>{{result.count}} linked payments needing follow-up</p>
        @if(result.count){
          <div class="invoice-table-scroll"><table class="invoice-table"><thead><tr>
            <th [attr.aria-sort]="direction==='asc'?'ascending':'descending'"><button type="button" class="sort-button" (click)="sort()">Linked <span class="sort-indicator" aria-hidden="true"></span></button></th>
            <th>Payment</th><th>Follow-up</th><th>Evidence</th><th>Reviewer</th></tr></thead><tbody>
            @for(row of result.rows;track row.payment){
              <tr><td data-label="Linked">{{row.linkedAt | date:'mediumDate'}} · {{row.days}} days</td>
                <td data-label="Payment"><button class="invoice-link" type="button" (click)="review.emit(row.invoice)">{{row.invoiceNumber || row.invoice}}</button>
                  <div>AUD {{row.amount}} · {{row.payment}}</div>@if(row.bankId){<div>{{row.bankId}}</div>}</td>
                <td data-label="Follow-up">{{labels[row.reason]}}@if(row.historical){<div>Historical invoice</div>}</td>
                <td data-label="Evidence"><div>Invoice import · {{imports[row.imported]}} @if(row.importedAt){ · {{row.importedAt | date:'short'}}}</div>
                  @if(row.dispatch){<div>Direct Xero check · {{row.direct ? bank[row.direct] : 'Awaiting check'}} @if(row.checkedAt){ · {{row.checkedAt | date:'short'}}}</div>}
                  @if(row.lastKnown && row.lastKnown!==row.direct){<div>Last available bank result · {{bank[row.lastKnown]}} · {{row.lastKnownAt | date:'short'}}</div>}
                  @if(row.previousDirectReconciled || row.previousImportReconciled){<div>Previously reconciled in {{row.previousDirectReconciled ? 'a direct bank check' : 'an invoice import'}}</div>}
                  <div>Staff report · {{row.staffAt ? ('Reconciled · '+((row.staffDate || row.staffAt) | date:'mediumDate')) : 'None recorded'}}</div></td>
                <td data-label="Reviewer">{{row.ownerLabel || (row.claimId?'Assigned reviewer':'Unassigned')}}
                  @if(!row.claimId || row.mine){<button class="btn small" type="button" [disabled]="busy" (click)="claim(row)">{{row.mine ? 'Release follow-up' : 'Claim follow-up'}}</button>}
                </td></tr>
            }
          </tbody></table></div>
        } @else {<p>No linked payments match these follow-up filters.</p>}
        <footer class="invoice-pagination"><div class="page-buttons">
          <app-manager-select ariaLabel="Payments per page" [options]="sizes" [ngModel]="limit" (ngModelChange)="limit=$event;load(1)" />
          <button type="button" aria-label="First page" [disabled]="page<=1" (click)="load(1)">«</button>
          <button type="button" aria-label="Previous page" [disabled]="page<=1" (click)="load(page-1)">‹</button>
          <app-page-jump [page]="page" [totalPages]="pages" label="Follow-up page" (pageChange)="load($event)" />
          <button type="button" aria-label="Next page" [disabled]="page>=pages" (click)="load(page+1)">›</button>
          <button type="button" aria-label="Last page" [disabled]="page>=pages" (click)="load(pages)">»</button>
        </div></footer>
      }
    }
  `,
})
export class TrustPaymentExceptions implements OnChanges {
  @Input({required:true}) connection!:string;
  @Input() revision=0;
  @Input() importTimestamp?:string;
  readonly review=output<string>();
  readonly labels={reversed:'Reconciliation reversed or payment changed',historical:'Review historical invoice',conflicting:'Sources disagree',
    changed:'Payment missing or changed',stale:'Bank check overdue',pending:'Awaiting bank reconciliation',unknown:'Evidence incomplete'};
  readonly imports={conflicting:'Conflicting reconciliation flags',reconciled:'Reconciled',pending:'Pending',unknown:'Status unavailable',mismatch:'Linked payment missing or changed',awaiting_import:'Awaiting payment import'};
  readonly bank={reconciled:'Reconciled',pending:'Pending',unknown:'Status unavailable',missing:'Payment missing',changed:'Payment changed',deleted:'Payment deleted',unavailable:'Check unavailable'};
  readonly reasons=[{value:'all',label:'All reasons'},...Object.entries(this.labels).map(([value,label])=>({value,label}))];
  readonly owners=[{value:'all',label:'All reviewers'},{value:'mine',label:'My follow-ups'},{value:'unassigned',label:'Unassigned'}];
  readonly sizes=['25','50','100'].map(value=>({value,label:value}));
  open=false;loading=false;busy=false;error=false;message='';page=1;pages=1;limit='25';direction='asc';q='';reason='all';owner='all';
  data?:{count:number;rows:TrustPaymentException[]};
  private filters={q:'',reason:'all',owner:'all'};
  private read?:Subscription;private write?:Subscription;
  private readonly api=inject(StudentOperationsService);private readonly destroy=inject(DestroyRef);
  ngOnChanges(changes:SimpleChanges){
    if(changes['connection']){
      this.read?.unsubscribe();this.write?.unsubscribe();this.open=this.busy=this.loading=this.error=false;this.data=undefined;
      this.q=this.message='';this.reason=this.owner='all';this.direction='asc';this.page=1;
    } else if(this.open)this.load(this.page);
  }
  toggle(){this.open=!this.open;if(this.open)this.search();else this.read?.unsubscribe();}
  search(){this.filters={q:this.q.trim(),reason:this.reason,owner:this.owner};this.message='';this.load(1);}
  sort(){this.direction=this.direction==='asc'?'desc':'asc';this.load(1);}
  load(page:number){
    this.read?.unsubscribe();this.loading=true;this.error=false;this.page=page;this.data=undefined;
    this.read=this.api.trustPaymentExceptions(this.connection,{...this.filters,page,limit:Number(this.limit),direction:this.direction})
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({next:data=>{
        this.pages=Math.max(1,Math.ceil(data.count/Number(this.limit)));
        if(page>this.pages){this.load(this.pages);return;}this.loading=false;this.data=data;
      },error:()=>{this.loading=false;this.error=true;}});
  }
  claim(row:TrustPaymentException){
    if(this.busy || (row.claimId&&!row.mine))return;
    this.busy=true;this.message='';
    this.write=this.api.changeTrustReviewClaim(this.connection,row.invoice,row.receipt,row.payment,row.claimId??undefined)
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({next:()=>{this.busy=false;if(this.open)this.load(this.page);},
        error:()=>{this.busy=false;this.message='Could not confirm the assignment. Review the refreshed follow-up.';if(this.open)this.load(this.page);}});
  }
}
