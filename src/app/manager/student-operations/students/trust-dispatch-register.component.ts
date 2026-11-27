import { Component,DestroyRef,Input,OnChanges,inject,output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { ManagerSelectComponent } from '../../components/shared/manager-select/manager-select.component';
import { ManagerListLoaderComponent } from '../../components/shared/manager-list-loader/manager-list-loader.component';
import { PageJumpComponent } from '../../../shared/components/page-jump/page-jump.component';
import type { TrustDispatchRow } from '../student-operations.types';
import { StudentOperationsService } from '../student-operations.service';

@Component({
  selector:'app-trust-dispatch-register',imports:[FormsModule,DatePipe,ManagerSelectComponent,ManagerListLoaderComponent,PageJumpComponent],
  styleUrls:['./student-operations-students.page.css'],
  styles:[':host {display:block;min-width:0;overflow-wrap:anywhere} .invoice-table.dispatch-table {min-width:0} input {max-width:100%;box-sizing:border-box}'],
  template:`
    <button type="button" class="btn small" [attr.aria-expanded]="open" (click)="toggle()">Payment dispatch queue</button>
    @if (open) {
      <form class="student-form" (ngSubmit)="search()">
        <label>Invoice, bank transaction or dispatch ID<input type="search" maxlength="150" name="q" [(ngModel)]="query"></label>
        <app-manager-select ariaLabel="Dispatch status" name="status" [options]="statuses" [(ngModel)]="status" />
        <button class="btn small">Search and refresh</button>
      </form>
      @if (loading) { <app-manager-list-loader label="Loading payment dispatches…" /> }
      @if (error) { <p role="alert">Could not load dispatches. Search and refresh to retry.</p> }
      @if (data; as result) {
        <p>{{result.count}} dispatch records</p>
        @if (result.rows.length) {
          <div class="invoice-table-scroll"><table class="invoice-table dispatch-table"><thead><tr>
            <th [attr.aria-sort]="direction==='asc'?'ascending':'descending'"><button type="button" class="sort-button" (click)="sortDate()">Queued <span class="sort-indicator" aria-hidden="true"></span></button></th>
            <th>Invoice</th><th>Bank transaction</th><th>Amount AUD</th><th>Status</th><th>Release reviewer</th></tr></thead><tbody>
            @for (row of result.rows; track row.id) {
              <tr><td data-label="Queued">{{row.queuedAt | date:'medium'}}</td>
                <td data-label="Invoice"><button type="button" class="invoice-link" (click)="review.emit(row.invoice)">{{row.invoiceNumber || row.invoice}}</button></td>
                <td data-label="Bank transaction">{{row.bankId}}</td><td data-label="Amount AUD">{{row.amount}}</td>
                <td data-label="Status">{{labels[row.status]}}
                  @if (row.paymentId) { <div>Xero payment {{row.paymentId}}</div> }
                  @if (row.workerCheck; as check) {
                    <div>Invoice check {{check.attempt}} · {{checks[check.status]}} · {{check.at | date:'short'}}</div>
                    @if (check.detail) { <div>{{check.detail}}</div> }
                  }
                </td><td data-label="Release reviewer">{{row.reviewer}}</td></tr>
            }
          </tbody></table></div>
        } @else { <p>No dispatches match this search.</p> }
        <footer class="invoice-pagination"><div class="page-buttons">
          <app-manager-select ariaLabel="Dispatches per page" [options]="sizes" [ngModel]="limit" (ngModelChange)="limit=$event;load(1)" />
          <button type="button" aria-label="First dispatch page" [disabled]="page<=1" (click)="load(1)">«</button>
          <button type="button" aria-label="Previous dispatch page" [disabled]="page<=1" (click)="load(page-1)">‹</button>
          <app-page-jump [page]="page" [totalPages]="pages" label="Dispatch page" (pageChange)="load($event)" />
          <button type="button" aria-label="Next dispatch page" [disabled]="page>=pages" (click)="load(page+1)">›</button>
          <button type="button" aria-label="Last dispatch page" [disabled]="page>=pages" (click)="load(pages)">»</button>
        </div></footer>
      }
    }
  `,
})
export class TrustDispatchRegister implements OnChanges {
  @Input({required:true}) connection!:string;
  readonly review=output<string>();
  readonly labels={recorded:'Recorded locally',cancelled:'Cancelled',expired:'Expired',submitted:'Awaiting Xero verification',confirmed:'Confirmed in Xero'};
  readonly checks={matched:'Matched at check time',review:'Review required',retry:'Retry available',checking:'Checking',exhausted:'Attempts exhausted'};
  readonly statuses=[{value:'all',label:'All dispatches'},...Object.entries(this.labels).map(([value,label])=>({value,label}))];
  readonly sizes=['25','50','100'].map(value=>({value,label:value}));
  open=false;loading=false;error=false;query='';status='all';direction='desc';page=1;pages=1;limit='25';
  data?:{count:number;rows:TrustDispatchRow[]};
  private appliedQuery='';private appliedStatus='all';
  private request?:Subscription;
  private readonly api=inject(StudentOperationsService);
  private readonly destroy=inject(DestroyRef);
  ngOnChanges() {
    this.request?.unsubscribe();this.data=undefined;this.open=this.loading=this.error=false;
    this.query=this.appliedQuery='';this.status=this.appliedStatus='all';
  }
  toggle() {this.open=!this.open;if (this.open) this.search();else this.request?.unsubscribe();}
  search() {this.appliedQuery=this.query.trim();this.appliedStatus=this.status;this.load(1);}
  sortDate() {this.direction=this.direction==='asc'?'desc':'asc';this.load(1);}
  load(page:number) {
    this.request?.unsubscribe();this.loading=true;this.error=false;this.data=undefined;this.page=page;
    this.request=this.api.trustDispatches(this.connection,{q:this.appliedQuery,status:this.appliedStatus,direction:this.direction,
      limit:Number(this.limit),page}).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next:data=>{this.pages=Math.max(1,Math.ceil(data.count/Number(this.limit)));if (page>this.pages) {this.load(this.pages);return;}
        this.data=data;this.loading=false;},
      error:()=>{this.loading=false;this.error=true;},
    });
  }
}
