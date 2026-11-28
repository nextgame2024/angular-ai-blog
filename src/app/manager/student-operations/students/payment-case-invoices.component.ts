import { Component, DestroyRef, Input, OnChanges, inject } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { StudentOperationsService } from '../student-operations.service';
import type { StudentCaseInvoices, StudentCaseInvoiceDetail } from '../student-operations.types';
import { ManagerListLoaderComponent } from '../../components/shared/manager-list-loader/manager-list-loader.component';

@Component({
  selector:'app-payment-case-invoices',imports:[DatePipe,CurrencyPipe,RouterLink,ManagerListLoaderComponent],
  styleUrls:['./student-operations-students.page.css'],
  styles:[':host{display:block;min-width:0}table.invoice-table{min-width:0;overflow-wrap:anywhere}'],
  template:`
    <button type="button" class="btn small" [attr.aria-expanded]="open" (click)="toggle()">Case {{reference}} · linked invoices</button>
    @if(open){
      <a class="btn small" [routerLink]="['/manager/students/cases',caseId]" target="_blank" rel="noopener">Open student case in new tab</a>
      @if(loading){<app-manager-list-loader label="Loading case invoices…" />}
      @if(error){<p role="alert">Could not load the case invoices.</p><button class="btn small" (click)="load(page)">Retry case invoices</button>}
      @if(data;as result){
        <table class="invoice-table"><thead><tr><th>Organisation</th><th>Document</th><th>Import history</th><th>Paid</th><th>Due</th></tr></thead><tbody>
          @for(row of result.invoices;track row.connectionId+':'+row.invoiceId){
            <tr><td data-label="Organisation">{{row.organisation || 'Unknown'}}</td><td data-label="Document">
              <button class="invoice-link" type="button" (click)="inspect(row)">{{row.invoiceNumber || row.invoiceId}}</button>
              <small>{{row.status}}</small></td>
              <td data-label="Import history">{{row.coverage==='imported'?'Imported':row.coverage==='historical'?'Earlier import':row.coverage==='awaiting_import'?'Awaiting import':'Unknown'}}
                @if(row.importedAt){<small>{{row.importedAt | date:'mediumDate'}}</small>}</td>
              <td data-label="Paid">{{row.amountPaid!=null && row.currency ? (row.amountPaid | currency:row.currency:'code') : 'Unknown'}}</td>
              <td data-label="Due">{{row.amountDue!=null && row.currency ? (row.amountDue | currency:row.currency:'code') : 'Unknown'}}</td></tr>
          } @empty {<tr><td colspan="5">No confirmed case invoices.</td></tr>}
        </tbody></table>
        @if(result.total>result.limit){<button class="btn small" type="button" [disabled]="page<=1" (click)="load(page-1)">Previous</button>
          Page {{page}} <button class="btn small" type="button" [disabled]="page*result.limit>=result.total" (click)="load(page+1)">Next</button>}
      }
      @if(checking){<p role="status">Loading linked document…</p>}
      @if(detailError && selected){<p role="alert">Could not load this linked document.</p><button class="btn small" (click)="inspect(selected)">Retry document</button>}
      @if(detail;as doc){<section><h4>{{doc.invoiceNumber || doc.invoiceId}}</h4><p>{{doc.studentName}} · {{doc.reference || 'Reference unavailable'}} · {{doc.status}}</p>
        @for(line of doc.lineItems;track $index){<p>{{line.description || line.itemCode}}</p>}
      </section>}
      <button class="btn small" type="button" (click)="toggle()">Return to receipt or invoice</button>
    }
  `,
})
export class PaymentCaseInvoices implements OnChanges {
  @Input({required:true}) caseId!:string;
  @Input({required:true}) reference!:string;
  private readonly api=inject(StudentOperationsService);
  private readonly destroy=inject(DestroyRef);
  private listRequest?:Subscription;
  private detailRequest?:Subscription;
  open=false;page=1;loading=false;error=false;checking=false;detailError=false;
  data?:StudentCaseInvoices;detail?:StudentCaseInvoiceDetail;selected?:StudentCaseInvoices['invoices'][number];
  ngOnChanges() { this.reset();this.open=false; }
  private reset() {
    this.listRequest?.unsubscribe();this.detailRequest?.unsubscribe();
    this.data=this.detail=this.selected=undefined;
    this.loading=this.checking=this.error=this.detailError=false;
  }
  toggle() {this.open=!this.open;if(this.open)this.load(1);else this.reset();}
  load(page:number) {
    this.reset();this.page=page;this.loading=true;
    this.listRequest=this.api.caseInvoices(this.caseId,page,'both').pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next:data=>{this.data=data;this.loading=false;},error:()=>{this.loading=false;this.error=true;},
    });
  }
  inspect(row:StudentCaseInvoices['invoices'][number]) {
    this.detailRequest?.unsubscribe();this.detail=undefined;this.selected=row;this.detailError=false;this.checking=true;
    this.detailRequest=this.api.caseInvoiceDetail(this.caseId,row.connectionId??'',row.invoiceId).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next:doc=>{this.detail=doc;this.checking=false;},error:()=>{this.detailError=true;this.checking=false;},
    });
  }
}
