import { Component,DestroyRef,Input,OnChanges,inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { ManagerSelectComponent } from '../../components/shared/manager-select/manager-select.component';
import { StudentOperationsService } from '../student-operations.service';
import type { TrustAccountMapping } from '../student-operations.types';

@Component({
  selector:'app-trust-receipt-account',imports:[DatePipe,FormsModule,ManagerSelectComponent],styleUrls:['./student-operations-students.page.css'],
  styles:[':host {display:block;min-width:0;overflow-wrap:anywhere} input,textarea {max-width:100%;box-sizing:border-box}'],
  template:`
    <button type="button" class="btn small" [attr.aria-expanded]="open" [disabled]="saving" (click)="toggle()">TRUST receipt account</button>
    @if (open) {
      <button type="button" class="btn small" [disabled]="saving || loading" (click)="load()">Reload imported accounts</button>
      @if (loading) { <p role="status">Loading imported accounts…</p> }
      @if (message) { <p role="status">{{message}}</p> }
      @if (data; as d) {
        @if (d.history[0]?.accountId) {
          <p>Current mapping · {{d.history[0].receiptLabel}} → {{d.history[0].accountName}} · {{d.history[0].accountId}}</p>
          @if (!d.active) { <p>This mapping requires review before release.</p> }
        } @else { <p>No receiving account mapped.</p> }
        @if (!d.fresh) { <p>Awaiting a successful bank account catalogue import from the last 24 hours.</p> }
        @else if (!options.length) { <p>The import contains no eligible active AUD bank accounts.</p> }
        @else {
          <p>Accounts imported {{d.importedAt | date:'medium'}}. This mapping applies to matching receipt labels across this TRUST organisation.</p>
          <label>Receiving account label from bank evidence<input maxlength="120" [(ngModel)]="label" [ngModelOptions]="{standalone:true}" [disabled]="saving"></label>
          <app-manager-select ariaLabel="Xero receiving bank account" [options]="options" [(ngModel)]="account" [ngModelOptions]="{standalone:true}" [disabled]="saving" />
        }
        @if ((d.fresh && options.length) || d.history[0]?.accountId) {
          <label>Reason for account change<textarea maxlength="500" [(ngModel)]="reason" [ngModelOptions]="{standalone:true}" [disabled]="saving"></textarea></label>
          @if (d.fresh && options.length) { <button type="button" class="btn small" [disabled]="saving || !reason.trim() || !label.trim() || !account || (d.active && account===d.history[0]?.accountId && label.trim()===d.history[0]?.receiptLabel)" (click)="save(false)">Save account mapping</button> }
          @if (d.history[0]?.accountId) { <button type="button" class="btn small" [disabled]="saving || !reason.trim()" (click)="save(true)">Remove account mapping</button> }
        }
        @if (d.history.length) {
          <details><summary>Recent account changes</summary>
            @for (entry of d.history; track entry.revision) {
              <p>{{entry.recordedAt | date:'medium'}} · {{entry.accountName || 'Mapping removed'}} {{entry.accountId}} · {{entry.receiptLabel}} · {{entry.actor}} · {{entry.reason}}</p>
            }
          </details>
        }
      }
    }
  `,
})
export class TrustReceiptAccountPanel implements OnChanges {
  @Input({required:true}) connection!:string;
  open=false;loading=false;saving=false;message='';reason='';label='';account='';
  options:{value:string;label:string}[]=[];
  data?:TrustAccountMapping;
  private request?:Subscription;
  private retry?:{key:string;id:string};
  private readonly api=inject(StudentOperationsService);
  private readonly destroy=inject(DestroyRef);
  ngOnChanges() {
    this.request?.unsubscribe();this.open=this.saving=this.loading=false;this.data=this.retry=undefined;
    this.reason=this.message=this.label=this.account='';this.options=[];
  }
  toggle() {this.open=!this.open;if (this.open) this.load();else this.request?.unsubscribe();}
  load() {
    this.request?.unsubscribe();this.loading=true;this.data=undefined;this.reason='';
    this.request=this.api.trustReceiptAccount(this.connection).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next:d=>{
        this.data=d;this.loading=false;
        this.options=d.accounts.map(a=>({value:a.id,label:a.name+' · '+a.id}));
        this.account=d.active?d.history[0].accountId || '':'';
        this.label=d.history[0]?.receiptLabel || '';
      },
      error:()=>{this.loading=false;this.message='Could not load the receiving account. Reload to retry.';},
    });
  }
  save(remove:boolean) {
    const d=this.data,reason=this.reason.trim();
    if (!d || this.saving || !reason || (remove?!d.history[0]?.accountId:!d.fresh || !this.account || !this.label.trim())) return;
    const body={revision:d.revision,catalogueRevision:d.catalogueRevision,accountId:remove?null:this.account,receiptLabel:remove?null:this.label.trim(),reason};
    const key=JSON.stringify(body);
    if (this.retry?.key!==key) this.retry={key,id:crypto.randomUUID()};
    this.saving=true;
    this.request=this.api.changeTrustReceiptAccount(this.connection,{...body,requestId:this.retry.id}).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next:()=>{this.saving=false;this.retry=undefined;this.message='Account change recorded.';this.load();},
      error:err=>{
        this.saving=false;
        if (err.status===409) {this.message='The catalogue or mapping changed. Review the refreshed details.';this.load();}
        else this.message='Could not confirm the change. Retry with the same details.';
      },
    });
  }
}
