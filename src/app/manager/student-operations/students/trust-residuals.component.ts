import { Component, DestroyRef, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ManagerSelectComponent } from '../../components/shared/manager-select/manager-select.component';
import { ManagerListLoaderComponent } from '../../components/shared/manager-list-loader/manager-list-loader.component';
import { PageJumpComponent } from '../../../shared/components/page-jump/page-jump.component';
import type { TrustResidualRow, TrustResidualDetail } from '../student-operations.types';
import { StudentOperationsService } from '../student-operations.service';

@Component({
  selector:'app-trust-residuals',imports:[FormsModule,DatePipe,ManagerSelectComponent,ManagerListLoaderComponent,PageJumpComponent],
  styleUrls:['./student-operations-students.page.css'],
  styles:[':host {display:block;min-width:0;overflow-wrap:anywhere} .invoice-table.residual-table {min-width:0} input,textarea {max-width:100%;box-sizing:border-box}'],
  template:`
    <button type="button" class="btn small" [disabled]="saving" [attr.aria-expanded]="open" (click)="toggle()">Student residuals</button>
    @if (open) {
      <form class="student-form" (ngSubmit)="search()">
        <label>Bank transaction, assigned student or student reference<input type="search" maxlength="150" name="query" [(ngModel)]="query"></label>
        <app-manager-select ariaLabel="Residual attribution" name="status" [options]="statuses" [(ngModel)]="status" />
        <button class="btn small" [disabled]="saving">Search and refresh</button>
      </form>
      @if (studentFilter; as filter) {
        <p>Residuals attributed to {{filter.name}} · {{filter.reference}}
          <button class="btn small" type="button" [disabled]="saving" (click)="studentFilter=undefined;search()">Show all students</button></p>
      }
      @if (message) { <p role="status">{{message}}</p> }
      @if (loading) { <app-manager-list-loader label="Loading student residuals…" /> }
      @if (data; as report) {
        <p>{{report.count}} active split residuals · AUD {{report.total}}</p>
        @if (report.rows.length) {
          <div class="invoice-table-scroll"><table class="invoice-table residual-table"><thead><tr>
            <th [attr.aria-sort]="aria('date')"><button class="sort-button" (click)="order('date')" type="button">Deposit date <span class="sort-indicator" aria-hidden="true"></span></button></th>
            <th>Bank transaction</th><th [attr.aria-sort]="aria('amount')"><button class="sort-button" (click)="order('amount')" type="button">Residual AUD <span class="sort-indicator" aria-hidden="true"></span></button></th>
            <th>Student</th><th>Review</th></tr></thead><tbody>
            @for (row of report.rows; track row.id) {
              <tr><td data-label="Deposit date">{{row.date}} · {{row.days}} days</td><td data-label="Bank transaction">{{row.bankId}}</td>
                <td data-label="Residual AUD">{{row.amount}}</td><td data-label="Student">@if (row.studentId) {
                  <button class="invoice-link" type="button" [disabled]="saving" (click)="filterStudent(row)">{{row.student}} · {{row.reference}}</button>
                } @else { Unassigned }</td>
                <td data-label="Review"><button type="button" class="btn small" [disabled]="saving" (click)="review(row)">Review residual</button></td></tr>
            }
          </tbody></table></div>
        } @else { <p>No active residuals match this search.</p> }
        <footer class="invoice-pagination"><div class="page-buttons">
          <app-manager-select ariaLabel="Residuals per page" [options]="sizes" [ngModel]="limit" (ngModelChange)="limit=$event;load(1)" [disabled]="saving" />
          <button type="button" aria-label="First residual page" [disabled]="saving || page<=1" (click)="load(1)">«</button>
          <button type="button" aria-label="Previous residual page" [disabled]="saving || page<=1" (click)="load(page-1)">‹</button>
          <app-page-jump [page]="page" [totalPages]="pages" label="Residual page number" (pageChange)="load($event)" />
          <button type="button" aria-label="Next residual page" [disabled]="saving || page>=pages" (click)="load(page+1)">›</button>
          <button type="button" aria-label="Last residual page" [disabled]="saving || page>=pages" (click)="load(pages)">»</button>
        </div></footer>
      }
      @if (reading) { <app-manager-list-loader label="Loading residual review…" /> }
      @if (detail; as item) {
        <h4>{{selected?.bankId}} · AUD {{item.amount}}</h4>
        @if (!item.choices.length) { <p>No confirmed student link on the reserved invoices. Check the contact match before assigning this money.</p> }
        <app-manager-select ariaLabel="Attribute residual to student" [options]="students" [(ngModel)]="student" [disabled]="saving" />
        <label>Reason for attribution change<textarea maxlength="500" [(ngModel)]="reason" [disabled]="saving"></textarea></label>
        <button class="btn small" type="button" [disabled]="saving || !reason.trim() || student===current" (click)="save()">Save attribution</button>
        @if (item.history.length) {
          <details><summary>Recent attribution history</summary>
            @for (entry of item.history; track entry.revision) {
              <p>{{entry.recordedAt | date:'medium'}} · {{entry.reviewer}} · {{entry.student || 'Cleared attribution'}} · {{entry.reason}}</p>
            }
          </details>
        }
      }
    }
  `,
})
export class TrustResidualsPanel implements OnChanges {
  @Input({required:true}) connection!:string;
  @Input() revision=0;
  open=false; loading=false; reading=false; saving=false;
  query=''; status='all'; private appliedQuery=''; private appliedStatus='all';
  sort='date'; direction='asc'; page=1; pages=1; limit='25';
  readonly statuses=[{value:'all',label:'All attributions'},{value:'assigned',label:'Assigned'},{value:'unassigned',label:'Unassigned'}];
  readonly sizes=['25','50','100'].map(value=>({value,label:value}));
  studentFilter?:{id:string;name:string|null;reference:string|null};
  message=''; reason=''; student=''; current='';
  students:{value:string;label:string}[]=[];
  selected?:TrustResidualRow; detail?:TrustResidualDetail; data?:{count:number;total:string;rows:TrustResidualRow[]};
  private listRequest?:Subscription; private detailRequest?:Subscription; private write?:Subscription;
  private retry?:{key:string;id:string};
  private readonly api=inject(StudentOperationsService);
  private readonly destroy=inject(DestroyRef);
  ngOnChanges(changes:SimpleChanges) {
    if (changes['connection']) {
      this.listRequest?.unsubscribe(); this.write?.unsubscribe(); this.clearReview();
      this.open=this.saving=this.loading=false; this.data=undefined; this.message=this.query=this.appliedQuery='';
      this.status=this.appliedStatus='all'; this.studentFilter=undefined;
    } else if (this.open && !this.saving) this.load(this.page);
  }
  toggle() {
    this.open=!this.open;
    if (this.open) this.search();
    else { this.listRequest?.unsubscribe(); this.clearReview(); }
  }
  private clearReview() {
    this.detailRequest?.unsubscribe(); this.reading=false; this.detail=this.selected=this.retry=undefined; this.reason='';
  }
  filterStudent(row:TrustResidualRow) {
    if (!row.studentId) return;
    this.studentFilter={id:row.studentId,name:row.student,reference:row.reference};
    this.status='all'; this.query=''; this.search();
  }
  search() {
    this.message=''; this.appliedStatus=this.status; this.appliedQuery=this.query.trim(); this.load(1);
  }
  aria(field:string) {return this.sort!==field?'none':this.direction==='asc'?'ascending':'descending';}
  order(field:string) {
    if (this.saving) return;
    this.direction=this.sort===field && this.direction==='asc'?'desc':'asc'; this.sort=field; this.load(1);
  }
  load(page:number) {
    if (this.saving) return;
    this.listRequest?.unsubscribe(); this.clearReview(); this.loading=true; this.data=undefined; this.page=page;
    this.listRequest=this.api.trustResiduals(this.connection,{q:this.appliedQuery,status:this.appliedStatus,sort:this.sort,
      direction:this.direction,page,limit:Number(this.limit),...(this.studentFilter?{studentId:this.studentFilter.id}:{})}).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next:data=>{
        this.pages=Math.max(1,Math.ceil(data.count/Number(this.limit)));
        if (page>this.pages) {this.load(this.pages);return;}
        this.data=data; this.loading=false;
      },
      error:()=>{this.loading=false; this.message='Could not load residuals. Search and refresh to retry.';},
    });
  }
  review(row:TrustResidualRow) {
    this.clearReview(); this.message=''; this.selected=row; this.reading=true;
    this.detailRequest=this.api.trustResidual(this.connection,row.id).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next:item=>{
        this.reading=false; this.detail=item;
        this.current=this.student=item.history[0]?.studentId || '';
        this.students=[{value:'',label:'Unassigned'},...item.choices.map(s=>({value:s.id,label:s.name+' · '+s.reference}))];
        if (this.current && !item.choices.some(s=>s.id===this.current)) {
          this.students.push({value:this.current,label:(item.history[0].student || this.current)+' · link requires review'});
        }
      },
      error:()=>{this.reading=false; this.message='This residual could not be opened. Refresh the list and review it again.';},
    });
  }
  save() {
    if (!this.selected || !this.detail || this.student===this.current || this.saving || !this.reason.trim()) return;
    const body={studentId:this.student || null,reservation:this.detail.reservation,revision:this.detail.revision,reason:this.reason.trim()};
    const key=JSON.stringify([this.selected.id,body]);
    if (this.retry?.key!==key) this.retry={key,id:crypto.randomUUID()};
    this.saving=true;
    this.write=this.api.reviewTrustResidual(this.connection,this.selected.id,{...body,requestId:this.retry.id})
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next:()=>{this.saving=false; this.message='Residual attribution recorded.'; this.load(this.page);},
        error:err=>{
          this.saving=false;
          if ([404,409].includes(err.status)) {
            this.message='The reservation or student link changed. Reopen the residual to review it.'; this.load(this.page);
          } else this.message='Could not confirm the save. Retry with the same details.';
        },
      });
  }
}
