import {Component,ElementRef,EventEmitter,Input,OnChanges,OnDestroy,Output,ViewChild,inject} from '@angular/core';
import {FormControl,ReactiveFormsModule} from '@angular/forms';
import {Subject,takeUntil} from 'rxjs';
import {PageJumpComponent} from '../../../shared/components/page-jump/page-jump.component';
import {ManagerSelectComponent} from '../shared/manager-select/manager-select.component';
import {ManagerListLoaderComponent} from '../shared/manager-list-loader/manager-list-loader.component';
import {StudentOperationsService} from '../../student-operations/student-operations.service';
import {xeroInvoiceStatusLabel} from '../../student-operations/xero-invoice-display';
import type {XeroStudentInvoice,XeroStudentInvoiceDetail,XeroStudentInvoiceResult,XeroStudentInvoiceSort} from '../../student-operations/student-operations.types';

@Component({selector:'app-supplier-invoices',imports:[ReactiveFormsModule,PageJumpComponent,ManagerSelectComponent,ManagerListLoaderComponent],
  templateUrl:'./supplier-invoices.component.html',
  styleUrls:['../../student-operations/students/student-operations-students.page.css','./supplier-invoices.component.css']})
export class SupplierInvoicesComponent implements OnChanges,OnDestroy {
  @Input() supplierId='';
  @Output() availability=new EventEmitter<number>();
  @Output() failed=new EventEmitter<string>();
  @ViewChild('invoiceDialog') set invoiceDialog(ref:ElementRef<HTMLDialogElement>|undefined){if(ref&&!ref.nativeElement.open)ref.nativeElement.showModal();}
  private readonly api=inject(StudentOperationsService);
  private readonly stop$=new Subject<void>();
  private readonly listStop$=new Subject<void>();
  private readonly detailStop$=new Subject<void>();
  private readonly destroyed$=new Subject<void>();
  connectionId='';
  xeroInvoices:XeroStudentInvoiceResult|null=null;
  loadingInvoices=false;
  invoiceLoadError='';
  selectedXeroInvoice:XeroStudentInvoiceDetail|null=null;
  loadingInvoiceDetail=false;invoiceDetailError='';
  invoiceSort:XeroStudentInvoiceSort='date';invoiceSortDirection:'asc'|'desc'='desc';
  readonly invoicePageSize=new FormControl('25',{nonNullable:true});
  readonly invoicePageSizeOptions=[25,50,100].map(n=>({value:String(n),label:`${n} per page`}));
  readonly isPty=true;
  constructor(){this.invoicePageSize.valueChanges.pipe(takeUntil(this.destroyed$)).subscribe(()=>this.load());}
  ngOnChanges(){this.initialise();}
  ngOnDestroy(){for(const stop of [this.stop$,this.listStop$,this.detailStop$,this.destroyed$]){stop.next();stop.complete();}}
  initialise(){
    this.stop$.next();this.listStop$.next();this.closeInvoiceDetail();this.connectionId='';this.xeroInvoices=null;this.invoiceLoadError='';this.loadingInvoices=false;
    this.invoiceSort='date';this.invoiceSortDirection='desc';this.invoicePageSize.setValue('25',{emitEvent:false});
    if(!this.supplierId)return;
    this.loadingInvoices=true;
    this.api.xeroStatus().pipe(takeUntil(this.stop$)).subscribe({next:data=>{
      const connections=data.connections.filter(c=>c.status==='active'&&c.organisationRole==='operating');
      if(connections.length!==1){this.loadingInvoices=false;this.availability.emit(0);return;}
      this.connectionId=connections[0].connectionId;this.load();
    },error:error=>{this.loadingInvoices=false;this.availability.emit(0);if(![403,404].includes(error?.status))this.fail();}});
  }
  load(page=1){
    if(!this.supplierId||!this.connectionId)return;
    this.listStop$.next();this.loadingInvoices=true;this.invoiceLoadError='';
    this.api.xeroStudentInvoices(this.connectionId,{supplierId:this.supplierId,page,limit:Number(this.invoicePageSize.value),sort:this.invoiceSort,direction:this.invoiceSortDirection})
      .pipe(takeUntil(this.listStop$),takeUntil(this.stop$)).subscribe({next:data=>{
        if(page>1&&!data.invoices.length){this.load(1);return;}
        this.xeroInvoices=data;this.loadingInvoices=false;this.availability.emit(data.total);
      },error:()=>{this.loadingInvoices=false;this.fail();}});
  }
  private fail(){this.invoiceLoadError='Supplier invoices could not be loaded. Please retry.';this.failed.emit(this.invoiceLoadError);}
  get invoicePageStart(){return this.xeroInvoices?.total?((this.xeroInvoices.page-1)*this.xeroInvoices.limit)+1:0;}
  get invoicePageEnd(){return this.xeroInvoices?Math.min(this.xeroInvoices.page*this.xeroInvoices.limit,this.xeroInvoices.total):0;}
  sortXeroInvoices(sort:XeroStudentInvoiceSort){if(this.loadingInvoices)return;this.invoiceSortDirection=this.invoiceSort===sort&&this.invoiceSortDirection==='asc'?'desc':'asc';this.invoiceSort=sort;this.load();}
  invoiceSortAria(sort:XeroStudentInvoiceSort){return this.invoiceSort!==sort?'none':this.invoiceSortDirection==='asc'?'ascending':'descending';}
  goToInvoicePage(page:number){if(!this.loadingInvoices&&page>=1&&page<=(this.xeroInvoices?.totalPages??1))this.load(page);}
  openInvoiceDetail(invoice:Pick<XeroStudentInvoice,'xeroInvoiceId'>,connection=this.connectionId){
    this.detailStop$.next();this.loadingInvoiceDetail=true;this.invoiceDetailError='';this.selectedXeroInvoice=null;
    this.api.xeroStudentInvoice(connection,invoice.xeroInvoiceId).pipe(takeUntil(this.detailStop$),takeUntil(this.stop$)).subscribe({next:detail=>{this.selectedXeroInvoice=detail;this.loadingInvoiceDetail=false;},error:()=>{this.loadingInvoiceDetail=false;this.invoiceDetailError='Invoice details could not be loaded. Close this dialog and try again.';}});
  }
  closeInvoiceDetail(){this.detailStop$.next();this.selectedXeroInvoice=null;this.loadingInvoiceDetail=false;this.invoiceDetailError='';}
  openRelatedInvoice(related:NonNullable<XeroStudentInvoiceDetail['relatedInvoices']>[number]){if(related.indexed)this.openInvoiceDetail({xeroInvoiceId:related.invoiceId},related.connectionId);}
  invoiceStatusLabel=xeroInvoiceStatusLabel;
  formatMoney(value:number|string|null,currency:string|null){return value===null?'—':new Intl.NumberFormat('en-AU',{style:'currency',currency:currency||'AUD',maximumFractionDigits:2}).format(Number(value));}
  formatDate(value:string|null){return value?new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(value)):'—';}
}
