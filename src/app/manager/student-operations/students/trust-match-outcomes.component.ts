import { Component, DestroyRef, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { StudentOperationsService } from '../student-operations.service';
import type { TrustMatchOutcome, TrustMatchOutcomes, TrustOutcomeQuery } from '../student-operations.types';
import { ManagerSelectComponent } from '../../components/shared/manager-select/manager-select.component';
import { ManagerListLoaderComponent } from '../../components/shared/manager-list-loader/manager-list-loader.component';
import { PageJumpComponent } from '../../../shared/components/page-jump/page-jump.component';
import { TrustMatchHistory } from './trust-match-history.component';

const labels:Record<TrustMatchOutcome,string>={
  unreviewed:'Awaiting first review',dismissed:'Reviewed without an active acceptance',awaiting_receipt:'Accepted, awaiting receipt',
  same_invoice:'Verified on accepted invoice',different_invoice:'Verified on another invoice',
  no_acceptance:'Verified without an accepted match',conflict:'Conflicting bank evidence',
};

@Component({
  selector:'app-trust-match-outcomes',
  imports:[FormsModule,DatePipe,DecimalPipe,ManagerSelectComponent,ManagerListLoaderComponent,PageJumpComponent,TrustMatchHistory],
  styleUrls:['./student-operations-students.page.css'],
  styles:[`
    :host { display:block; min-width:0; }
    .invoice-table.outcome-table { min-width:0; overflow-wrap:anywhere; }
  `],
  template:`
    <button type="button" class="btn small" [attr.aria-expanded]="open" (click)="toggle()">Match outcomes</button>
    @if (open) {
      <form class="student-form" (ngSubmit)="apply()">
        <div class="form-grid">
          <label>Bank deposit date from<input type="date" required name="from" [(ngModel)]="from"></label>
          <label>Through<input type="date" required name="to" [(ngModel)]="to"></label>
        </div>
        <button type="submit" class="btn small">Apply dates and refresh</button>
      </form>
      @if (validation) { <p role="alert">{{ validation }}</p> }
      @if (loading) { <app-manager-list-loader label="Loading match outcomes…" /> }
      @if (error) { <p role="alert">Could not load match outcomes.</p><button type="button" class="btn small" (click)="load(page)">Retry report</button> }
      @if (data; as report) {
        <h4>Staged TRUST deposits · {{ appliedFrom }} to {{ appliedTo }}</h4>
        <p>{{ report.reviewed }} of {{ report.total }} deposits reviewed.
          @if (report.medianReviewMinutes !== null) { Median time from staging to first review · {{ report.medianReviewMinutes | number:'1.0-1' }} minutes. }
        </p>
        @if (compared) {
          <p>{{ report.counts.same_invoice || 0 }} of {{ compared }} verified deposits with an accepted match were verified on the accepted invoice
            ({{ 100 * (report.counts.same_invoice || 0) / compared | number:'1.0-1' }}%).</p>
        } @else { <p>No verified deposits with an accepted match to compare.</p> }
        @if (report.bands.length) {
          <details><summary>Agreement by matching rule and score</summary>
            @for (band of report.bands; track band.version + '/' + band.lookup + '/' + band.score) {
              <p>Rule {{ band.version }} · {{ band.lookup === 'manual' ? 'Manual lookup' : 'Suggested invoice' }} · Score {{ band.score }}
                · {{ band.agreed }} of {{ band.verified }} on the accepted invoice</p>
            }
          </details>
        }
        <app-manager-select ariaLabel="Deposit outcome" [options]="options" [ngModel]="outcome" (ngModelChange)="outcome=$event;load(1)" />
        @if (report.deposits.length) {
          <div class="invoice-table-scroll"><table class="invoice-table outcome-table">
            <thead><tr><th [attr.aria-sort]="sortAria('date')"><button class="sort-button" type="button" (click)="sortBy('date')">Date <span class="sort-indicator" aria-hidden="true"></span></button></th>
              <th>Bank transaction</th><th [attr.aria-sort]="sortAria('amount')"><button class="sort-button" type="button" (click)="sortBy('amount')">Deposit <span class="sort-indicator" aria-hidden="true"></span></button></th><th>Outcome</th><th>Accepted invoice</th><th>Verified invoice</th><th>Review</th></tr></thead>
            <tbody>@for (row of report.deposits; track row.id) {
              <tr><td data-label="Date">{{ row.date | date:'mediumDate':'UTC' }}</td><td data-label="Bank transaction">{{ row.transactionId }}</td>
                <td data-label="Deposit">AUD {{ row.amount | number:'1.2-2' }}</td><td data-label="Outcome">{{ labels[row.outcome] }}</td>
                <td data-label="Accepted invoice">{{ row.acceptedNumber || row.acceptedId || '—' }}</td>
                <td data-label="Verified invoice">{{ row.verifiedNumber || row.verifiedId || '—' }}</td>
                <td data-label="Review"><app-trust-match-history [depositId]="row.id" [connection]="connection" [revision]="historyRevision" /></td></tr>
            }</tbody>
          </table></div>
        } @else { <p>No staged deposits match the selected dates and outcome.</p> }
        <footer class="invoice-pagination"><span>{{ report.filteredTotal }} deposits</span><div class="page-buttons">
          <app-manager-select ariaLabel="Deposits per report page" [options]="sizes" [ngModel]="limit" (ngModelChange)="limit=$event;load(1)" />
          <button type="button" [disabled]="page<=1" (click)="load(1)" aria-label="First outcome page">«</button>
          <button type="button" [disabled]="page<=1" (click)="load(page-1)" aria-label="Previous outcome page">‹</button>
          <app-page-jump [page]="page" [totalPages]="pages" label="Outcome page number" (pageChange)="load($event)" />
          <button type="button" [disabled]="page>=pages" (click)="load(page+1)" aria-label="Next outcome page">›</button>
          <button type="button" [disabled]="page>=pages" (click)="load(pages)" aria-label="Last outcome page">»</button>
        </div></footer>
      }
    }
  `,
})
export class TrustMatchOutcomesPanel implements OnChanges {
  @Input({required:true}) connection!:string;
  @Input() revision=0;
  readonly labels=labels;
  readonly sizes=['10','25','50'].map(value=>({value,label:value}));
  options:{value:string;label:string}[]=[];
  to=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Brisbane',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  from=new Date(Date.parse(this.to)-29*86400000).toISOString().slice(0,10);
  appliedFrom=this.from; appliedTo=this.to;
  outcome:TrustOutcomeQuery['outcome']='all';
  sort:TrustOutcomeQuery['sort']='date'; direction:TrustOutcomeQuery['direction']='desc';
  limit='25'; page=1; pages=1; compared=0; historyRevision=0;
  open=false; loading=false; error=false; validation='';
  data?:TrustMatchOutcomes;
  private readonly api=inject(StudentOperationsService);
  private readonly destroy=inject(DestroyRef);
  private request?:Subscription;
  ngOnChanges(changes:SimpleChanges) {
    if (changes['connection']) {
      this.request?.unsubscribe(); this.open=false; this.data=undefined; this.outcome='all'; this.validation='';
    } else if (this.open && changes['revision']) this.load(this.page);
  }
  toggle() {
    this.open=!this.open;
    if (this.open) this.load(1);
    else this.request?.unsubscribe();
  }
  apply() {
    if (!this.from || !this.to || this.from>this.to || Date.parse(this.to)-Date.parse(this.from)>365*86400000) {
      this.validation='Choose a deposit date range of up to 366 days.'; return;
    }
    this.validation=''; this.appliedFrom=this.from; this.appliedTo=this.to; this.load(1);
  }
  sortAria(field:TrustOutcomeQuery['sort']) {
    return field!==this.sort?'none':this.direction==='asc'?'ascending':'descending';
  }
  sortBy(field:TrustOutcomeQuery['sort']) {
    this.direction=this.sort===field && this.direction==='desc'?'asc':'desc';
    this.sort=field; this.load(1);
  }
  load(page:number) {
    this.request?.unsubscribe(); this.page=page; this.loading=true; this.error=false; this.data=undefined;
    this.request=this.api.trustMatchOutcomes(this.connection,{from:this.appliedFrom,to:this.appliedTo,outcome:this.outcome,page,limit:Number(this.limit),sort:this.sort,direction:this.direction})
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next:report=>{
          this.pages=Math.max(1,Math.ceil(report.filteredTotal/report.limit));
          if (page>this.pages) {this.load(this.pages);return;}
          this.data=report; this.loading=false; this.historyRevision++;
          this.compared=(report.counts.same_invoice||0)+(report.counts.different_invoice||0);
          this.options=[{value:'all',label:'All outcomes · '+report.total},
            ...Object.entries(labels).map(([value,label])=>({value,label:label+' · '+(report.counts[value as TrustMatchOutcome]||0)}))];
        },
        error:()=>{this.error=true; this.loading=false;},
      });
  }
}
