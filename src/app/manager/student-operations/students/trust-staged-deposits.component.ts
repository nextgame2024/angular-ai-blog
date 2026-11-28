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
        <details><summary>Save a bank screenshot</summary>
          <fieldset class="form-grid" [disabled]="saving">
            <label>Bank date<input type="date" [max]="today" [(ngModel)]="imageDate" [ngModelOptions]="{standalone:true}"></label>
            <label>Amount received (AUD)<input inputmode="decimal" [(ngModel)]="imageAmount" [ngModelOptions]="{standalone:true}"></label>
            <label>Bank transaction ID<input maxlength="150" [(ngModel)]="imageId" [ngModelOptions]="{standalone:true}"></label>
            <label>Bank reference (optional)<input maxlength="150" [(ngModel)]="imageReference" [ngModelOptions]="{standalone:true}"></label>
            <label>Bank screenshot (PNG or JPEG, up to 5 MB)<input #upload type="file" accept="image/png,image/jpeg" (change)="selectImage(upload)"></label>
            <button type="button" class="btn small" [disabled]="!imageReady()" (click)="saveImage(upload)">Save screenshot for invoice review</button>
          </fieldset>
        </details>
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
            <p>{{ row.account }} @if (row.source; as csv) { · {{ csv.name }} · Record {{ csv.record }} }</p>
            @if (row.screenshotSha256) {
              <button class="btn small" type="button" (click)="downloadImage(row.id)">Download saved bank screenshot</button>
            }
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
  draft?:Omit<StagedTrustDeposit,'id'|'account'|'source'> & {source:NonNullable<StagedTrustDeposit['source']>};
  imageDate='';imageAmount='';imageId='';imageReference='';image?:File;
  private downloadRequest?:Subscription;
  private appliedSearch='';
  private readonly api=inject(StudentOperationsService);
  private readonly destroy=inject(DestroyRef);
  private listRequest?:Subscription;
  private saveRequest?:Subscription;

  ngOnChanges(changes:SimpleChanges) {
    if (changes['connection']) {
      this.listRequest?.unsubscribe();
      this.saveRequest?.unsubscribe();this.downloadRequest?.unsubscribe();
      this.image=undefined;this.imageDate=this.imageAmount=this.imageId=this.imageReference='';
      this.open=this.saving=this.loaded=this.loading=false;
      this.account=this.search=this.appliedSearch=this.selected=this.message=this.error='';
      this.rows=[]; this.options=[]; this.draft=undefined;
    } else if (changes['revision'] && this.open) this.load(this.page);
  }
  toggle() {
    if(this.saving) return;
    this.open=!this.open;
    if(!this.open) this.image=undefined;
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
  selectImage(input:HTMLInputElement) {
    const candidate=input.files?.[0];
    this.image=undefined;this.message='';
    if (!candidate) return;
    if (!['image/png','image/jpeg'].includes(candidate.type) || !candidate.size || candidate.size>5242880) {
      input.value='';this.message='Select a nonempty PNG or JPEG up to 5 MB.';return;
    }
    this.image=candidate;
  }
  imageReady() {
    return !!(this.image && this.account.trim() && this.imageId.trim() && this.imageDate && this.imageDate<=this.today &&
      /^(0|[1-9]\d{0,11})(\.\d{1,2})?$/.test(this.imageAmount) && Number(this.imageAmount)>0);
  }
  saveImage(input:HTMLInputElement) {
    if (!this.image || !this.imageReady() || this.saving || this.picker) return;
    const data=new FormData();
    for(const [key,value] of Object.entries({account:this.account.trim(),amount:this.imageAmount,receivedOn:this.imageDate,
      bankTransactionId:this.imageId.trim(),reference:this.imageReference.trim()})) data.append(key,value);
    data.append('file',this.image);this.saving=true;this.message='';
    this.saveRequest=this.api.stageTrustScreenshot(this.connection,data).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next:result=>{
        this.saving=false;this.image=undefined;input.value='';this.imageDate=this.imageAmount=this.imageId=this.imageReference='';
        this.message=result.created?'Bank screenshot saved.':'This screenshot was already saved.';
        this.search=this.appliedSearch='';this.outcomesChanged.emit();this.load(1);
      },
      error:err=>{this.saving=false;this.message=err.status===409?'Review the saved deposit for conflicting evidence.':'Could not save the bank screenshot. Retry with the same details.';},
    });
  }
  downloadImage(id:string) {
    this.downloadRequest?.unsubscribe();
    this.downloadRequest=this.api.stagedTrustScreenshot(this.connection,id).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next:blob=>{
        const url=URL.createObjectURL(blob),link=document.createElement('a');
        link.href=url;link.download=blob.type==='image/png'?'bank-deposit.png':'bank-deposit.jpg';link.click();
        setTimeout(()=>URL.revokeObjectURL(url),1000);
      },error:()=>{this.message='The screenshot could not be downloaded.';},
    });
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
