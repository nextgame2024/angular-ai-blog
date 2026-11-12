import { CommonModule } from '@angular/common';
import { Component,ElementRef,EventEmitter,Input,OnChanges,OnDestroy,Output,ViewChild,inject } from '@angular/core';
import { FormArray,FormControl,FormGroup,ReactiveFormsModule,Validators } from '@angular/forms';
import { Subject,takeUntil,switchMap,of } from 'rxjs';
import type {CommissionOptions,CommissionDraft,InvoiceExportResult} from '../student-operations/student-commission.types';
import { ManagerSelectComponent } from '../components/shared/manager-select/manager-select.component';
import { ManagerToastComponent } from '../components/shared/manager-toast/manager-toast.component';
import { ManagerListLoaderComponent } from '../components/shared/manager-list-loader/manager-list-loader.component';
import { StudentOperationsService } from '../student-operations/student-operations.service';
import type { CaseInvoiceDraftData,CaseInvoiceDraft,CaseInvoiceDraftLine,StudentCaseInvoiceDetail,CaseManualInvoiceOptions } from '../student-operations/student-operations.types';
import { offerMoneyInput } from './case-offer-review.component';

const text=(value='',required=true)=>new FormControl(value,{nonNullable:true,validators:[Validators.maxLength(4000),...(required?[Validators.required]:[])]});
const amount=(value='')=>new FormControl(value,{nonNullable:true,validators:[c=>offerMoneyInput(c.value)===null?{money:true}:null]});
const decimal4=/^\d{1,8}(\.\d{1,4})?$/;
const scaled=(value:string)=>{const [whole,fraction='']=value.split('.');return BigInt(whole)*10000n+BigInt(fraction.padEnd(4,'0'));};
const displayDecimal=(value:string)=>{const amount=scaled(value);return amount%100n===0n?`${amount/10000n}.${String((amount%10000n)/100n).padStart(2,'0')}`:value.replace(/0+$/,'').replace(/\.$/,'');};
const lineForm=(kind:CaseInvoiceDraftLine['kind'],label:string,value:number)=>new FormGroup({lineItemId:text('',false),kind:text(kind),description:text(label),itemId:text('',false),itemCode:text('',false),
  quantity:new FormControl('1',{nonNullable:true,validators:[Validators.required,Validators.pattern(/^\d{1,6}(\.\d{1,4})?$/),c=>Number(c.value)>0?null:{positive:true}]}),
  price:new FormControl((value/100).toFixed(2),{nonNullable:true,validators:[Validators.required,Validators.pattern(decimal4)]}),accountCode:text('',false),taxType:text('',false)});
type DraftLineForm=ReturnType<typeof lineForm>;
const paymentForm=(sequence:number,date:string,dueDate:string,fee:number,lines:DraftLineForm[])=>new FormGroup({sequence:new FormControl(sequence,{nonNullable:true}),issueDate:text(date),dueDate:text(dueDate),
  feeApplies:text(),fee:amount((fee/100).toFixed(2)),lines:new FormArray(lines)});

@Component({selector:'app-case-invoice-drafts',imports:[CommonModule,ReactiveFormsModule,ManagerSelectComponent,ManagerToastComponent,ManagerListLoaderComponent],
  templateUrl:'./case-invoice-drafts.component.html',styleUrls:['./case-invoice-drafts.component.css']})
export class CaseInvoiceDraftsComponent implements OnChanges,OnDestroy {
  readonly offerMoneyInput=offerMoneyInput;
  @Input() caseId='';@Input() refreshToken=0;@Input() disabled=false;@Input() showCreatedInvoices=true;@Output() changed=new EventEmitter<void>();
  @Output() creationAvailable=new EventEmitter<boolean>(true);
  @ViewChild('modal',{static:true}) modal!:ElementRef<HTMLDialogElement>;
  private readonly api=inject(StudentOperationsService);private readonly scope$=new Subject<void>();
  private readonly previewStop$=new Subject<void>();
  data:CaseInvoiceDraftData|null=null;loading=false;busyLabel='';failed=false;message='';tone:'success'|'error'='error';
  private busyValue=false;
  get busy(){return this.busyValue;}
  set busy(value:boolean){this.busyValue=value;for(const control of [this.manualCollege]){if(control){if(value)control.disable({emitEvent:false});else control.enable({emitEvent:false});}}this.syncPtyTypeControls();}
  detail:StudentCaseInvoiceDetail|null=null;
  readonlyMode=false;detailLoading=false;detailFailed=false;
  manualMode=false;
  editTarget:{connectionId:string;invoiceId:string;expectedFingerprint:string;invoiceNumber:string;status:string;paymentTrack:string;conditionalFeeLineId?:string;retryKey?:string}|null=null;
  readonly manualReference=text();
  readonly referenceMode=new FormControl<'reference'|'college'>('reference',{nonNullable:true});
  readonly manualCollege=new FormControl('',{nonNullable:true});
  readonly manualBrandingTheme=new FormControl('',{nonNullable:true,validators:[Validators.required]});
  collegeOptions:Array<{value:string;label:string}>=[];
  brandingOptions:Array<{value:string;label:string}>=[];
  readonly manualCurrency=new FormControl('AUD',{nonNullable:true,validators:[Validators.required,Validators.pattern(/^[A-Z]{3}$/)]});
  private readonly detailStop$=new Subject<void>();
  private detailTarget:{connectionId:string;invoiceId:string}|null=null;
  activePayment=0;
  ptySide=false;ptyLoading=false;ptyOptions:CommissionOptions|null=null;ptyDrafts:CommissionDraft[]=[];
  private readonly ptyItemsByCode=new Map<string,NonNullable<CommissionOptions['items']>>();
  readonly ptyTypeOfSaleOptions:Array<{value:string;label:string}>=[];
  private readonly ptySaleTypes=new Map<number,FormControl<string>>();
  private readonly ptySaleOptions=new Map<number,Array<{value:string;label:string}>>();
  private readonly emptyPtySaleType=new FormControl('',{nonNullable:true});
  get activePtyTypeOfSale(){return this.ptySaleTypes.get(this.activeInvoice?.controls.sequence.value)??this.emptyPtySaleType;}
  get activePtyTypeOfSaleOptions(){return this.ptySaleOptions.get(this.activeInvoice?.controls.sequence.value)??this.ptyTypeOfSaleOptions;}
  private syncPtyTypeControls(){
    const frozen=new Set(this.ptyDrafts?.filter(d=>d.status&&d.status!=='not_attempted').map(d=>d.sequence)??[]);
    for(const [sequence,control] of this.ptySaleTypes??[]){if(this.busy||frozen.has(sequence)||!this.ptyTypeOfSaleOptions.length)control.disable({emitEvent:false});else control.enable({emitEvent:false});}
  }
  private ptySaleTypeIssue(sequence:number){
    if(this.ptyOptions?.typeOfSaleIssue)return this.ptyOptions.typeOfSaleIssue;
    return this.ptyTypeOfSaleOptions.some(o=>o.value===this.ptySaleTypes.get(sequence)?.value)?null:'Select an available PTY Type of Sale for this invoice.';
  }
  get activePtySaleTypeIssue(){return this.activeInvoice?this.ptySaleTypeIssue(this.activeInvoice.controls.sequence.value):null;}
  private readonly ptyStop$=new Subject<void>();
  private retainingPaired=false;
  private ptyItemFor(payment:ReturnType<typeof paymentForm>){
    const lines=payment.controls.lines.controls.filter(l=>l.controls.kind.value==='tuition'&&this.lineAmount(l)>0);
    const codes=[...new Set(lines.map(l=>l.controls.itemCode.value.trim().toLowerCase()))];
    if(!codes.length||codes.includes(''))return {issue:'Select a tuition item on the matching TRUST invoice.'};
    if(codes.length!==1)return {issue:'Use one tuition item per invoice before preparing its PTY commission.'};
    const items=this.ptyItemsByCode.get(codes[0])??[];
    if(items.length!==1)return {issue:`The TRUST tuition item “${lines[0].controls.itemCode.value}” needs one matching item with an account in PTY. Refresh the item catalogue or check its setup.`};
    return {item:items[0],issue:null};
  }
  get ptyItemIssue(){return this.activeInvoice?this.ptyItemFor(this.activeInvoice).issue:null;}
  get ptySalesItemLabel(){
    const receipt=this.ptyReceipt;
    if(receipt?.status&&receipt.status!=='not_attempted'){
      const code=receipt.snapshot.value.lines[0]?.itemCode??'';
      const item=this.ptyItemsByCode.get(code.trim().toLowerCase())?.find(i=>i.code===code);
      return item?`${item.code} — ${item.name}`:code;
    }
    const selected=this.activeInvoice?this.ptyItemFor(this.activeInvoice).item:null;
    return selected?`${selected.code} — ${selected.name}`:'';
  }
  private ptyPricingFor(payment:ReturnType<typeof paymentForm>){
    const lines=payment.controls.lines.controls.filter(l=>l.controls.kind.value==='tuition'&&this.lineAmount(l)>0);
    const quantityPattern=/^\d{1,6}(\.\d{1,4})?$/;
    if(!lines.length||lines.some(l=>!quantityPattern.test(l.controls.quantity.value)||scaled(l.controls.quantity.value)<=0n))return {quantity:'',unitAmount:'',issue:'Confirm the TRUST tuition quantities before preparing commission.'};
    const quantityScaled=lines.reduce((n,l)=>n+scaled(l.controls.quantity.value),0n);
    const base=lines.reduce((n,l)=>n+BigInt(this.lineAmount(l)),0n),rate=BigInt(this.ptyOptions?.rule?.commission_basis_points??0);
    const commissionMinor=(base*rate+5000n)/10000n;
    const priceScaled=(commissionMinor*1_000_000n+quantityScaled/2n)/quantityScaled;
    const format=(value:bigint,minDecimals=0)=>{const fraction=String(value%10000n).padStart(4,'0').replace(/0+$/,'').padEnd(minDecimals,'0');return `${value/10000n}${fraction?'.'+fraction:''}`;};
    const issue=priceScaled<=0n||priceScaled>999_999_999_999n||(quantityScaled*priceScaled+500000n)/1000000n!==commissionMinor?'The commission cannot retain the TRUST quantity and exact total at four decimal places. Review this instalment.':null;
    return {quantity:format(quantityScaled),unitAmount:format(priceScaled,2),issue};
  }
  get ptyPricingIssue(){return this.activeInvoice?this.ptyPricingFor(this.activeInvoice).issue:null;}
  get ptyPreparationNotice(){
    const receipt=this.ptyReceipt,issues=[this.ptyOptions?.issue];
    if(!receipt?.status||receipt.status==='not_attempted')issues.push(this.ptyItemIssue,this.ptyOptions?.issue?null:this.ptyPricingIssue,this.activePtySaleTypeIssue);
    if(receipt?.stale||receipt?.adjustmentRequired)issues.push('The source TRUST invoice changed. Review the related invoices before any further action.');
    return [...new Set(issues.filter(Boolean))].join(' ');
  }
  get ptyLine(){
    const receipt=this.ptyReceipt,frozen=!!receipt?.status&&receipt.status!=='not_attempted',stored=frozen?receipt!.snapshot.value.lines[0]:null;
    const item=this.activeInvoice?this.ptyItemFor(this.activeInvoice).item:null;
    const pricing=this.activeInvoice?this.ptyPricingFor(this.activeInvoice):{quantity:'',unitAmount:''};
    const accountCode=stored?.accountCode??item?.accountCode;
    const account=this.ptyOptions?.accounts?.find(a=>a.code===accountCode);
    return {quantity:frozen?stored?.quantity??'':pricing.quantity,unitAmount:frozen?stored?.unitAmount??'':pricing.unitAmount,
      description:stored?.description??this.activeInvoice?.controls.lines.controls.filter(l=>l.controls.kind.value==='tuition').map(l=>l.controls.description.value).join('\n')??'',
      account:account?`${account.code} — ${account.name}`:accountCode??'Select an item on TRUST',tax:this.ptyOptions?.tax?.name??'GST on Income'};
  }
  get invoiceHeaderLabel(){
    if(!this.activeInvoice)return '';
    const statusLabel=(status:string)=>(({DRAFT:'Draft',SUBMITTED:'Awaiting approval',AUTHORISED:'Awaiting payment',PAID:'Paid',created:'Created in Xero',creating:'Creating',review_required:'Review required',not_attempted:'Draft'} as Record<string,string>)[status]??status);
    const role=!this.editTarget?(this.ptySide?' (PTY)':' (TRUST)'):'';
    const status=this.ptySide?statusLabel(this.ptyReceipt?.providerStatus||this.ptyReceipt?.status||'DRAFT'):this.editTarget?statusLabel(this.editTarget.status):this.isCreatedSequence(this.activeInvoice.controls.sequence.value)?'Created in Xero':this.activeNeedsReview?'Review required':'Draft';
    return `${this.editTarget?.invoiceNumber??'INV-'+this.activeInvoiceNumber}${role} · ${status}`;
  }
  get canCreateCurrentPty(){
    return Boolean(this.activeInvoice&&this.data?.canCreateXero&&!this.ptyLoading&&this.ptyOptions?.available&&!this.ptyOptions.issue&&
      this.isCreatedSequence(this.activeInvoice.controls.sequence.value)&&!this.ptyItemIssue&&!this.ptyPricingIssue&&!this.activePtySaleTypeIssue&&
      (!this.ptyReceipt?.status||this.ptyReceipt.status==='not_attempted'));
  }
  get ptyReceipt(){return this.ptyDrafts.find(d=>d.sequence===this.activeInvoice?.controls.sequence.value);}
  get ptyPending(){return this.ptyOptions?.available&&this.form.controls.invoices.controls.some(i=>!['created','creating','review_required'].includes(this.ptyDrafts.find(d=>d.sequence===i.controls.sequence.value)?.status??''));}
  get ptyCalculation(){
    if(this.ptyReceipt?.status&&this.ptyReceipt.status!=='not_attempted')return this.ptyReceipt.snapshot.calculation;
    const rate=this.ptyOptions?.rule?.commission_basis_points??0;
    const base=this.activeInvoice?.controls.lines.controls.filter(l=>l.controls.kind.value==='tuition').reduce((n,l)=>n+this.lineAmount(l),0)??0;
    return {tuitionMinor:base,basisPoints:rate,commissionMinor:Number((BigInt(base)*BigInt(rate)+5000n)/10000n)};
  }
  get ptyTax(){const rate=this.ptyOptions?.tax?.rate;return this.ptyReceipt?.status&&this.ptyReceipt.status!=='not_attempted'?this.ptyReceipt.snapshot.taxMinor:rate&&decimal4.test(rate)?Number((BigInt(this.ptyCalculation.commissionMinor)*scaled(rate)+500000n)/1000000n):0;}
  selectPayment(index:number,pty=false){this.activePayment=index;this.ptySide=pty;}
  private loadPty(){
    this.ptyStop$.next();this.ptyLoading=false;this.ptyOptions=null;this.ptyDrafts=[];this.ptyItemsByCode.clear();this.ptySaleTypes.clear();this.ptySaleOptions.clear();this.ptyTypeOfSaleOptions.length=0;this.ptySide=false;
    const collegeId=this.manualCollege.value;if(!collegeId||this.editTarget||this.manualMode&&this.referenceMode.value!=='college')return;
    this.ptyLoading=true;
    this.api.commissionOptions(this.caseId,collegeId).pipe(takeUntil(this.scope$),takeUntil(this.previewStop$),takeUntil(this.ptyStop$)).subscribe({next:o=>{
      this.ptyLoading=false;this.ptyOptions=o;
      this.ptyTypeOfSaleOptions.push(...(o.typeOfSaleOptions??[]));
      for(const payment of this.form.controls.invoices.controls){const sequence=payment.controls.sequence.value,control=new FormControl(o.defaultTypeOfSaleOptionId??'',{nonNullable:true});
        this.ptySaleTypes.set(sequence,control);this.ptySaleOptions.set(sequence,this.ptyTypeOfSaleOptions);
        control.valueChanges.pipe(takeUntil(this.scope$),takeUntil(this.previewStop$),takeUntil(this.ptyStop$)).subscribe(()=>{control.markAsDirty();this.form.controls.confirmed.setValue(false,{emitEvent:false});});
      }
      this.syncPtyTypeControls();
      for(const item of o.items??[]){if(!item.accountCode)continue;const code=item.code.trim().toLowerCase();this.ptyItemsByCode.set(code,[...(this.ptyItemsByCode.get(code)??[]),item]);}
      if(o.available&&this.draftIdentity)this.loadPtyDrafts();
    },error:()=>{this.ptyLoading=false;this.ptyOptions={available:true,issue:'PTY settings could not be loaded. Close and reopen the preview to retry.'};}});
  }
  private loadPtyDrafts(){const id=this.draftIdentity?.batchId;if(!id)return;
    this.api.commissionDrafts(this.caseId,id).pipe(takeUntil(this.scope$),takeUntil(this.previewStop$),takeUntil(this.ptyStop$)).subscribe({next:r=>{
      this.ptyDrafts=r.items;
      for(const row of r.items){
        const control=this.ptySaleTypes.get(row.sequence);if(!control)continue;
        const saved=row.snapshot.value.lines[0]?.tracking?.find(t=>t.name.trim().toLowerCase()==='type of sale');
        const option=this.ptyTypeOfSaleOptions.find(o=>saved?.trackingOptionId?o.value===saved.trackingOptionId:o.label===saved?.option);
        const frozen=!!row.status&&row.status!=='not_attempted';
        if(frozen||!control.dirty){control.setValue(option?.value??(saved?(frozen?'recorded:'+saved.option:''):(frozen?'recorded:none':this.ptyOptions?.defaultTypeOfSaleOptionId??'')),{emitEvent:false});}
        this.ptySaleOptions.set(row.sequence,frozen&&!option?[...this.ptyTypeOfSaleOptions,{value:control.value,label:saved?.option??'Not recorded'}]:this.ptyTypeOfSaleOptions);
      }
      this.syncPtyTypeControls();
    },error:()=>{this.message='The saved PTY invoices could not be loaded. Reopen the preview before creating commissions.';this.tone='error';this.ptyOptions={available:true,issue:this.message};}});
  }
  reconcilePty(){const id=this.draftIdentity?.batchId;if(!id||this.busy||!this.activeInvoice)return;this.busy=true;this.busyLabel='Checking PTY invoice status…';
    this.api.reconcileCommission(this.caseId,id,this.activeInvoice.controls.sequence.value).pipe(takeUntil(this.scope$)).subscribe({next:r=>{this.busy=false;this.message=r.results[0]?.message??'PTY invoice status checked.';this.tone=r.results.some(i=>i.status==='review_required')?'error':'success';this.loadPtyDrafts();this.changed.emit();},error:e=>{this.busy=false;this.message=e?.error?.message??'PTY could not be checked. Try again shortly.';this.tone='error';}});
  }
  conflict=false;
  private request:{fingerprint:string;key:string}|null=null;
  private draftIdentity:{batchId:string;revision:number}|null=null;
  private preview:NonNullable<CaseInvoiceDraftData['preparation']>|null=null;
  private sessionExports:CaseInvoiceDraftData['batches'][number]['exports']={};
  readonly form=new FormGroup({advisorId:text(),reviewNote:text('',false),confirmed:new FormControl(false,{nonNullable:true}),invoices:new FormArray<ReturnType<typeof paymentForm>>([])});
  readonly feeOptions=[{value:'yes',label:'Apply fee'},{value:'no',label:'Do not apply'}];
  readonly feeKindOptions=[{value:'tuition',label:'Tuition — commission base'},{value:'enrolment',label:'Enrolment'},{value:'materials',label:'Materials'},{value:'visa',label:'Visa'},{value:'oshc',label:'OSHC'},{value:'other',label:'Other fee'}];
  get preparation(){return this.preview??this.data?.preparation??null;}
  get advisors(){return this.preparation?.advisors.map(a=>({value:a.advisorId,label:`${a.code} ${a.name}`}))??[];}
  get canPrepare(){return Boolean(this.data?.preparation);}
  get itemOptions(){return this.preparation?.catalogue?.items.map(i=>({value:i.itemId,label:`${i.code} — ${i.name}`}))??[];}
  get activeInvoice(){return this.form.controls.invoices.at(this.activePayment);}
  get activeInvoiceNumber():number|string{return this.activeInvoice?.getRawValue().sequence??'—';}
  get activeNeedsReview(){return Boolean(this.activeInvoice&&this.isReviewSequence(this.activeInvoice.controls.sequence.value));}
  get hasCreatableInvoices(){return this.form.controls.invoices.controls.some(payment=>!this.isFrozenSequence(payment.controls.sequence.value))||Boolean(this.ptyPending);}
  get advisorLabel(){return this.advisors.find(a=>a.value===this.form.controls.advisorId.value)?.label??'Select an advisor';}
  private receipt(sequence:number){return this.sessionExports[String(sequence)]??this.preparation?.savedBatch?.exports[String(sequence)];}
  isCreatedSequence(sequence:number){return this.receipt(sequence)?.status==='created';}
  isReviewSequence(sequence:number){const status=this.receipt(sequence)?.status;return status==='creating'||status==='review_required';}
  isFrozenSequence(sequence:number){return this.isCreatedSequence(sequence)||this.isReviewSequence(sequence);}
  displayInvoices(batch:CaseInvoiceDraftData['batches'][number]){return batch.snapshot.invoices.filter(invoice=>batch.exports[String(invoice.sequence)]?.status==='created');}
  invoiceLabel(batch:CaseInvoiceDraftData['batches'][number],invoice:CaseInvoiceDraft){
    const receipt=batch.exports[String(invoice.sequence)];
    return receipt?.status==='created'?(receipt.invoiceNumber?.trim()||'Created in Xero'):invoice.invoiceNumber;
  }
  createdInvoice(invoiceId:string){
    for(const batch of this.data?.batches??[]){
      const invoice=batch.snapshot.invoices.find(item=>{const receipt=batch.exports[String(item.sequence)];return receipt?.status==='created'&&receipt.invoiceId===invoiceId;});
      if(invoice)return {batch,invoice};
    }
    return null;
  }
  private enableEditor(){
    this.form.enable({emitEvent:false});
    for(const payment of this.form.controls.invoices.controls)if(this.isFrozenSequence(payment.controls.sequence.value))payment.disable({emitEvent:false});
    if(this.form.controls.invoices.length&&this.form.controls.invoices.controls.every(i=>this.isFrozenSequence(i.controls.sequence.value)))this.manualCollege.disable({emitEvent:false});
    if(Object.values(this.sessionExports).some(receipt=>receipt.status!=='not_attempted'))this.form.controls.advisorId.disable({emitEvent:false});
  }
  private courseDescription(){
    const source=this.preparation?.source;if(!source)return 'Course Name: \nCampus: \nStart Date: ';
    const date=(value:string|null)=>value?new Intl.DateTimeFormat('en-AU',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(`${value}T00:00:00Z`)):'';
    const evidencedAddress=source.evidence.map(item=>item.quote.match(/(?:^|\n)\s*Address\s*:\s*([^\n]+)/i)?.[1]?.trim()).find(Boolean)??'';
    return source.courses.map(course=>`Course Name: ${course.name.toLocaleUpperCase('en-AU')}${course.duration?' - '+course.duration:''}\nCampus: ${source.campusAddress?.trim()||evidencedAddress}\nStart Date: ${date(course.startsOn)}`).join('\n\n').slice(0,4000);
  }
  accountLabel(line:DraftLineForm){const account=this.preparation?.catalogue?.accounts.find(a=>a.code===line.controls.accountCode.value);return account?`${account.code} — ${account.name}`:'Select an item';}
  taxRate(line:DraftLineForm){return this.preparation?.catalogue?.taxRates.find(t=>t.taxType===line.controls.taxType.value);}
  taxLabel(line:DraftLineForm){const tax=this.taxRate(line);return tax&&tax.rate!==null?`${tax.name} (${tax.rate}%)`:'Tax defaults missing';}
  lineTax(line:DraftLineForm){const rate=this.taxRate(line)?.rate;return rate&&decimal4.test(rate)?Number((BigInt(this.lineAmount(line))*scaled(rate)+500000n)/1000000n):0;}
  hasUnresolvedItems(payment:ReturnType<typeof paymentForm>){return payment.controls.lines.controls.some(l=>this.lineAmount(l)>0&&(!this.editTarget&&!l.controls.itemId.value||!l.controls.accountCode.value||this.taxRate(l)?.rate==null));}
  private bindFeeChoice(payment:ReturnType<typeof paymentForm>){
    payment.controls.feeApplies.valueChanges.pipe(takeUntil(this.previewStop$),takeUntil(this.scope$)).subscribe(choice=>{
      if(!choice||this.form.controls.invoices.controls.indexOf(payment)!==0)return;
      const sharedFee=offerMoneyInput(payment.controls.fee.value)??0;
      for(const other of this.form.controls.invoices.controls.slice(1)){
        if(choice==='yes'&&(offerMoneyInput(other.controls.fee.value)??0)===0&&sharedFee>0)other.controls.fee.setValue(payment.controls.fee.value,{emitEvent:false});
        if(other.controls.feeApplies.value!==choice)other.controls.feeApplies.setValue(choice);
      }
    });
  }
  addLine(payment:ReturnType<typeof paymentForm>,kind:CaseInvoiceDraftLine['kind']='other',description='Additional fee',value=0){
    if(this.busy||payment.controls.lines.length>=30)return;const line=lineForm(kind,description,value);payment.controls.lines.push(line);
    line.controls.itemId.valueChanges.pipe(takeUntil(this.previewStop$),takeUntil(this.scope$)).subscribe(id=>this.selectItem(payment,line,id));
    const matches=this.preparation?.catalogue?.items.filter(i=>[i.code,i.name].some(s=>s.trim().toLowerCase()===description.trim().toLowerCase()))??[];
    if(kind!=='tuition'&&matches.length===1)line.controls.itemId.setValue(matches[0].itemId);
  }
  removeLine(payment:ReturnType<typeof paymentForm>,index:number){if(!this.busy&&payment.controls.lines.at(index).controls.kind.value!=='tuition')payment.controls.lines.removeAt(index);}
  private tuitionUnitPrice(item:{code:string;name:string},current:number){
    const source=this.preparation?.source;if(!source||source.courses.length!==1||current<=0)return null;
    const identity=`${item.code} ${item.name}`.toLocaleLowerCase('en-AU');
    const basis=/\belicos\b|general\s+english/.test(identity)?'weeks':/higher\s+education|university/.test(identity)?'semesters':/\bvet\b|vocational/.test(identity)?'terms':null;
    if(!basis)return null;
    const duration=source.courses[0].duration?.toLocaleLowerCase('en-AU')??'';
    const countMatch=duration.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${basis.replace(/s$/,'')}s?\\b`));
    let countScaled=countMatch?BigInt(Math.round(Number(countMatch[1])*10000)):0n;
    if(!countScaled&&(basis==='terms'||basis==='semesters')){
      const tuitionPayments=source.instalments.filter(payment=>payment.components?.some(component=>/tuition/i.test(component.label))).length;
      countScaled=BigInt(tuitionPayments)*10000n;
    }
    if(countScaled<=0n)return null;
    const explicit=source.fees.find(fee=>!fee.conditional&&/^(total\s+)?tuition(\s+fee)?$/i.test(fee.label.trim()))?.amountMinor;
    const components=source.instalments.reduce((total,payment)=>total+(payment.components??[]).filter(component=>/tuition/i.test(component.label)).reduce((n,component)=>n+component.amountMinor,0),0);
    const tuitionTotal=explicit??(components>0?components:null);if(tuitionTotal===null)return null;
    const numerator=BigInt(tuitionTotal)*1_000_000n;
    if(numerator%countScaled!==0n)return null;
    const priceScaled=numerator/countScaled;if(priceScaled<=0n)return null;
    const quantityNumerator=BigInt(current)*1_000_000n;
    if(quantityNumerator%priceScaled!==0n)return null;
    const quantityScaled=quantityNumerator/priceScaled;
    if(quantityScaled<=0n||quantityScaled>10_000_000_000n)return null;
    return {price:displayDecimal(`${priceScaled/10000n}.${String(priceScaled%10000n).padStart(4,'0')}`),quantity:displayDecimal(`${quantityScaled/10000n}.${String(quantityScaled%10000n).padStart(4,'0')}`)};
  }
  selectItem(payment:ReturnType<typeof paymentForm>,line:DraftLineForm,id:string){
    const item=this.preparation?.catalogue?.items.find(i=>i.itemId===id);if(!item)return;
    const current=this.lineAmount(line);line.patchValue({itemCode:item.code,accountCode:item.accountCode??'',taxType:item.taxType??''},{emitEvent:false});
    if(this.manualMode){
      if(!line.controls.description.value.trim())line.controls.description.setValue(item.description||item.name);
      return; // Manual invoice amounts are entered by the user, not the catalogue.
    }
    if(line.controls.kind.value==='tuition'){
      const sourcePricing=this.tuitionUnitPrice(item,current);
      if(sourcePricing){line.controls.price.setValue(sourcePricing.price);line.controls.quantity.setValue(sourcePricing.quantity);}
      else if(item.unitPrice!==null&&decimal4.test(item.unitPrice)&&scaled(item.unitPrice)>0n){
        const divisor=scaled(item.unitPrice),units=BigInt(current)*1000000n;
        line.controls.price.setValue(displayDecimal(item.unitPrice));
        if(current>0&&units%divisor===0n){const q=units/divisor;line.controls.quantity.setValue(displayDecimal(`${q/10000n}.${String(q%10000n).padStart(4,'0')}`));}else line.controls.quantity.setValue('');
      }
      if(this.form.controls.invoices.controls.indexOf(payment)===0){
        for(const other of this.form.controls.invoices.controls.slice(1)){
          const tuition=other.controls.lines.controls.find(candidate=>candidate.controls.kind.value==='tuition');
          if(tuition&&!this.isFrozenSequence(other.controls.sequence.value)&&tuition.controls.itemId.value!==id)tuition.controls.itemId.setValue(id);
        }
      }
    }else if(item.unitPrice!==null&&decimal4.test(item.unitPrice)&&scaled(item.unitPrice)>0n&&current===0){
      line.controls.price.setValue(displayDecimal(item.unitPrice));
    }
  }
  ngOnChanges(changes:import('@angular/core').SimpleChanges){
    if(changes['caseId']){this.scope$.next();this.previewStop$.next();this.detailStop$.next();this.detail=null;this.detailLoading=false;this.data=null;this.preview=null;this.sessionExports={};this.loading=this.busy=this.conflict=false;this.modal?.nativeElement.close();this.request=null;this.draftIdentity=null;}
    if(changes['caseId']||changes['refreshToken'])this.load();
  }
  load(){if(!this.caseId||this.loading||this.busy)return;this.loading=true;this.failed=false;
    this.api.caseInvoiceDrafts(this.caseId).pipe(takeUntil(this.scope$)).subscribe({next:data=>{this.data=data;this.loading=false;this.creationAvailable.emit(Boolean(data.canCreateXero));
      if(this.manualMode&&this.draftIdentity){const saved=data.batches.find(b=>b.batchId===this.draftIdentity!.batchId);if(saved){this.sessionExports=structuredClone(saved.exports);this.enableEditor();}}
    },error:()=>{this.failed=true;this.loading=false;this.creationAvailable.emit(false);}});
  }
  open(){
    this.editTarget=null;
    this.manualMode=false;
    const p=this.data?.preparation;if(!p||this.busy||this.disabled||this.loading)return;this.preview=structuredClone(p);this.readonlyMode=false;this.detail=null;this.activePayment=0;this.conflict=false;this.request=null;this.message='';
    const saved=p.savedBatch;
    this.collegeOptions=(p.colleges??[]).map(college=>({value:college.collegeId,label:college.name}));
    this.manualCollege.reset(saved?.snapshot.collegeId??p.colleges?.find(college=>college.isPrimary)?.collegeId??'');
    this.sessionExports=structuredClone(saved?.exports??{});
    this.draftIdentity=saved?{batchId:saved.batchId,revision:saved.revision}:null;
    this.previewStop$.next();this.form.reset({advisorId:saved?.advisorId??p.student.advisorId??'',reviewNote:saved?.snapshot.reviewNote??'',confirmed:false});this.form.controls.invoices.clear();
    const first=Math.min(...p.source.instalments.map(i=>i.sequence));
    for(const source of p.source.instalments){
      const stored=saved?.snapshot.invoices.find(invoice=>invoice.sequence===source.sequence);
      if(stored){
        const payment=paymentForm(stored.sequence,stored.issueDate,stored.dueDate,stored.conditionalFeeMinor,[]);
        payment.controls.feeApplies.setValue(stored.conditionalFeeApplies?'yes':'no',{emitEvent:false});
        this.form.controls.invoices.push(payment);this.bindFeeChoice(payment);
        for(const savedLine of stored.lines){
          this.addLine(payment,savedLine.kind,savedLine.description,savedLine.amountMinor);
          const line=payment.controls.lines.at(payment.controls.lines.length-1),itemId=savedLine.itemId??p.catalogue?.items.find(item=>item.code===savedLine.itemCode)?.itemId??'';
          line.patchValue({description:savedLine.description,itemId,itemCode:savedLine.itemCode,quantity:savedLine.quantity,
            price:savedLine.unitPrice??(savedLine.unitAmountMinor/100).toFixed(2),accountCode:savedLine.accountCode,taxType:savedLine.taxType},{emitEvent:false});
        }
        continue;
      }
      const tuition=source.components?.find(c=>/tuition/i.test(c.label))?.amountMinor??0;
      const material=source.components?.find(c=>/material/i.test(c.label))?.amountMinor??0;
      const enrolment=source.sequence===first?p.source.fees.find(f=>!f.conditional&&/enrol/i.test(f.label))?.amountMinor??0:0;
      const course=this.courseDescription();
      // Keep each offer instalment's schedule; only undated payments start today.
      // Saved/operator-selected dates above always take precedence on reopening.
      const scheduledDate=source.dueOn??p.today;
      const payment=paymentForm(source.sequence,scheduledDate,scheduledDate,source.includedConditionalFeeMinor,[]);
      this.form.controls.invoices.push(payment);this.bindFeeChoice(payment);this.addLine(payment,'tuition',course||'Tuition Fee',tuition);
      if(enrolment>0)this.addLine(payment,'enrolment','Enrolment Fee',enrolment);
      if(material>0)this.addLine(payment,'materials','Materials fee',material);
    }
    const firstEditable=this.form.controls.invoices.controls.findIndex(payment=>!this.isFrozenSequence(payment.controls.sequence.value));
    const firstUnresolved=this.form.controls.invoices.controls.findIndex(payment=>!this.isCreatedSequence(payment.controls.sequence.value));
    this.activePayment=Math.max(0,firstEditable>=0?firstEditable:firstUnresolved);
    this.enableEditor();
    this.loadPty();
    this.manualCollege.valueChanges.pipe(takeUntil(this.previewStop$),takeUntil(this.scope$)).subscribe(()=>this.loadPty());
    this.modal.nativeElement.showModal();
  }
  openManual(){
    if(this.busy||this.disabled||!this.caseId||!this.data?.canCreateXero)return;
    this.resetManual();
    this.api.manualCaseInvoiceOptions(this.caseId).pipe(takeUntil(this.scope$),takeUntil(this.previewStop$)).subscribe({next:options=>{this.populateManual(options);this.bindManualPty();},error:()=>{this.busy=false;this.message='The invoice form could not be loaded. Close it and try again.';this.tone='error';}});
  }
  private resetManual(){
    this.editTarget=null;
    this.previewStop$.next();this.detailStop$.next();this.manualMode=true;this.readonlyMode=false;this.detail=null;
    this.ptyStop$.next();this.ptyLoading=false;this.ptyOptions=null;this.ptyDrafts=[];this.ptyItemsByCode.clear();this.ptySaleTypes.clear();this.ptySaleOptions.clear();this.ptyTypeOfSaleOptions.length=0;this.ptySide=false;
    this.activePayment=0;this.conflict=false;this.request=null;this.draftIdentity=null;this.preview=null;this.sessionExports={};this.message='';
    this.form.enable({emitEvent:false});this.form.reset({advisorId:'',reviewNote:'',confirmed:false});this.form.controls.invoices.clear();
    this.manualReference.reset('');this.manualCurrency.reset('AUD');this.referenceMode.reset('reference');this.manualCollege.reset('');this.manualBrandingTheme.reset('');this.collegeOptions=[];this.brandingOptions=[];
    this.busy=true;this.busyLabel='Loading invoice form…';this.modal.nativeElement.showModal();
  }
  private populateManual(options:CaseManualInvoiceOptions){
      const now=new Date(),today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      this.preview={...options,offerId:'',offerVersion:0,today,savedBatch:null,
        source:{kind:'letter_of_offer',studentName:options.student.name,evidence:[],issues:[],collegeName:null,abn:null,cricosProviderCode:null,currency:'AUD',statedTotalMinor:null,courses:[],fees:[],instalments:[]}};
      this.collegeOptions=(options.colleges??[]).map(c=>({value:c.collegeId,label:c.name}));
      this.brandingOptions=(options.brandingThemes??[]).map(t=>({value:t.brandingThemeId,label:t.name}));
      if(options.advisors.some(a=>a.advisorId===options.student.advisorId))this.form.controls.advisorId.setValue(options.student.advisorId!);
      const college=options.colleges?.find(c=>c.isPrimary);
      if(college){this.referenceMode.setValue('college');this.manualCollege.setValue(college.collegeId);}
      this.busy=false;
      const payment=paymentForm(1,today,today,0,[]);payment.controls.feeApplies.setValue('no');
      this.form.controls.invoices.push(payment);this.addLine(payment,'other','',0);
  }
  private bindManualPty(){
    this.loadPty();
    this.manualCollege.valueChanges.pipe(takeUntil(this.previewStop$),takeUntil(this.scope$)).subscribe(()=>this.loadPty());
    this.referenceMode.valueChanges.pipe(takeUntil(this.previewStop$),takeUntil(this.scope$)).subscribe(()=>this.loadPty());
  }
  resumeManualCommission(batch:CaseInvoiceDraftData['batches'][number]){
    if(this.busy||this.disabled||batch.offerId)return;this.resetManual();
    this.api.manualCaseInvoiceOptions(this.caseId).pipe(takeUntil(this.scope$),takeUntil(this.previewStop$)).subscribe({next:options=>{
      this.populateManual(options);const stored=batch.snapshot.invoices[0],payment=this.activeInvoice;
      this.sessionExports=structuredClone(batch.exports);this.draftIdentity={batchId:batch.batchId,revision:batch.revision};
      this.preview!.savedBatch={batchId:batch.batchId,revision:batch.revision,advisorId:batch.advisorId,snapshot:batch.snapshot,exports:batch.exports};
      this.form.patchValue({advisorId:batch.advisorId,reviewNote:batch.snapshot.reviewNote});
      this.manualCurrency.setValue(batch.snapshot.currency);this.referenceMode.setValue('college');this.manualCollege.setValue(batch.snapshot.collegeId??'',{emitEvent:false});
      payment.patchValue({sequence:stored.sequence,issueDate:stored.issueDate,dueDate:stored.dueDate,feeApplies:stored.conditionalFeeApplies?'yes':'no',fee:(stored.conditionalFeeMinor/100).toFixed(2)});payment.controls.lines.clear();
      for(const source of stored.lines){this.addLine(payment,source.kind,source.description,source.amountMinor);payment.controls.lines.at(payment.controls.lines.length-1).patchValue({itemId:source.itemId??'',itemCode:source.itemCode,quantity:source.quantity,price:source.unitPrice??(source.unitAmountMinor/100).toFixed(2),accountCode:source.accountCode,taxType:source.taxType},{emitEvent:false});}
      this.bindManualPty();this.ptySide=true;this.enableEditor();
    },error:()=>{this.busy=false;this.message='The saved manual invoice could not be reopened.';this.tone='error';}});
  }
  openEdit(connectionId:string,invoiceId:string){
    if(this.busy||this.disabled||!this.caseId)return;
    this.resetManual();this.busyLabel='Loading invoice…';
    this.api.caseInvoiceEditOptions(this.caseId,connectionId,invoiceId).pipe(takeUntil(this.scope$),takeUntil(this.previewStop$)).subscribe({next:options=>{
      this.populateManual(options);
      const invoice=options.invoice;
      this.editTarget={connectionId,invoiceId,expectedFingerprint:options.expectedFingerprint,invoiceNumber:invoice.invoiceNumber||'Invoice',status:invoice.status,paymentTrack:invoice.paymentTrack||'—'};
      this.manualCurrency.setValue(invoice.currencyCode||'AUD');this.manualBrandingTheme.setValue(invoice.brandingThemeId||'');
      this.referenceMode.setValue('reference');this.manualReference.setValue(invoice.invoiceReference||'');
      const college=options.colleges.find(c=>c.name===invoice.invoiceReference);
      if(college){this.referenceMode.setValue('college');this.manualCollege.setValue(college.collegeId);}
      const advisor=options.advisors.find(a=>`${a.code} ${a.name}`===invoice.advisorName||a.name===invoice.advisorName);
      this.form.controls.advisorId.setValue(advisor?.advisorId??'');
      const payment=this.activeInvoice;payment.patchValue({issueDate:invoice.invoiceDate||'',dueDate:invoice.dueDate||''});payment.controls.lines.clear();
      const fee=invoice.lineItems.find(l=>l.description?.trim().toLowerCase()==='conditional transfer fee'&&Number(l.quantity)===1&&Number(l.taxAmount)===0&&l.taxType==='BASEXCLUDED');
      if(fee){payment.patchValue({feeApplies:'yes',fee:Number(fee.unitAmount).toFixed(2)});this.editTarget.conditionalFeeLineId=fee.lineItemId??undefined;}
      for(const source of invoice.lineItems){
        if(source===fee)continue;
        this.addLine(payment,'other',source.description||'',0);
        const line=payment.controls.lines.at(payment.controls.lines.length-1),item=options.catalogue?.items.find(i=>i.code===source.itemCode);
        line.patchValue({lineItemId:source.lineItemId||'',itemId:item?.itemId||'',itemCode:source.itemCode||'',description:source.description||'',quantity:String(source.quantity??1),price:Number(source.unitAmount??0).toFixed(4).replace(/00$/,''),accountCode:source.accountCode||'',taxType:source.taxType||''},{emitEvent:false});
      }
      if(options.pending){
        const saved=options.pending.input;
        Object.assign(this.editTarget,{retryKey:options.pending.key,expectedFingerprint:saved.expectedFingerprint,conditionalFeeLineId:saved.conditionalFeeLineId});
        this.form.patchValue({advisorId:saved.advisorId,reviewNote:saved.reviewNote});this.referenceMode.setValue(saved.referenceMode);this.manualReference.setValue(saved.reference);this.manualCollege.setValue(saved.collegeId||'');this.manualBrandingTheme.setValue(saved.brandingThemeId||'');
        payment.patchValue({issueDate:saved.issueDate,dueDate:saved.dueDate,feeApplies:saved.conditionalFeeMinor?'yes':'no',fee:(saved.conditionalFeeMinor/100).toFixed(2)});payment.controls.lines.clear();
        for(const source of saved.lines){this.addLine(payment,'other',source.description,0);const line=payment.controls.lines.at(payment.controls.lines.length-1);line.patchValue({lineItemId:source.lineItemId||'',itemCode:source.itemCode,itemId:options.catalogue?.items.find(i=>i.code===source.itemCode)?.itemId||'',description:source.description,quantity:source.quantity,price:source.unitPrice,accountCode:source.accountCode,taxType:source.taxType},{emitEvent:false});}
        this.message='Your earlier save needs confirmation. Review and save these same changes before making further edits.';this.tone='error';
      }
    },error:error=>{this.busy=false;this.message=typeof error?.error?.message==='string'?error.error.message:'The invoice could not be opened for editing. Refresh the list and try again.';this.tone='error';}});
  }
  show(batch:CaseInvoiceDraftData['batches'][number],invoice:CaseInvoiceDraft){
    const receipt=batch.exports[String(invoice.sequence)];if(receipt?.status!=='created'||!receipt.invoiceId)return;
    this.showInvoice((batch.snapshot as {catalogueConnectionId?:string}).catalogueConnectionId??this.preparation?.catalogue?.connectionId??'',receipt.invoiceId);
  }
  showInvoice(connectionId:string,invoiceId:string){
    this.editTarget=null;
    this.manualMode=false;
    if(this.busy||this.disabled)return;this.detailStop$.next();this.readonlyMode=true;this.detail=null;this.message='';this.detailFailed=false;this.detailLoading=true;
    this.detailTarget={connectionId,invoiceId};if(!this.modal.nativeElement.open)this.modal.nativeElement.showModal();
    this.api.caseInvoiceDetail(this.caseId,connectionId,invoiceId).pipe(takeUntil(this.scope$),takeUntil(this.detailStop$)).subscribe({
      next:detail=>{this.detail=detail;this.detailLoading=false;},error:()=>{this.detailLoading=false;this.detailFailed=true;},
    });
  }
  reloadInvoice(){if(this.detailTarget)this.showInvoice(this.detailTarget.connectionId,this.detailTarget.invoiceId);}
  paymentTracking(tracking:Array<{name:string;option:string}>){return tracking.find(t=>t.name.trim().toLowerCase()==='payment track')?.option??'—';}
  invoiceMoney(value:string|number|null|undefined){return value===null||value===undefined||!Number.isFinite(Number(value))||!this.detail?.currency?'—':new Intl.NumberFormat('en-AU',{style:'currency',currency:this.detail.currency}).format(Number(value));}
  get invoiceTax(){const lines=this.detail?.lineItems??[];return lines.length&&lines.every(line=>typeof line.taxAmount==='number'&&Number.isFinite(line.taxAmount))?lines.reduce((sum,line)=>sum+Number(line.taxAmount),0):null;}
  get invoiceSubtotal(){return this.invoiceTax===null?null:Number(this.detail?.total)-this.invoiceTax;}
  close(event?:Event){if(this.busy){event?.preventDefault();return;}this.detailStop$.next();this.detailLoading=false;this.modal.nativeElement.close();this.preview=null;this.sessionExports={};this.previewStop$.next();if(this.conflict){this.conflict=false;this.load();}}
  reloadItems(){this.close();this.load();}
  lineAmount(line:DraftLineForm){
    const q=line.controls.quantity.value,price=line.controls.price.value;if(!/^\d{1,6}(\.\d{1,4})?$/.test(q)||!decimal4.test(price))return 0;
    return Number((scaled(q)*scaled(price)+500000n)/1000000n);
  }
  subtotal(payment:ReturnType<typeof paymentForm>){return payment.controls.lines.controls.reduce((n,l)=>n+this.lineAmount(l),0);}
  taxTotal(payment:ReturnType<typeof paymentForm>){return payment.controls.lines.controls.reduce((n,l)=>n+this.lineTax(l),0);}
  total(payment:ReturnType<typeof paymentForm>){return this.subtotal(payment)+this.taxTotal(payment)+(payment.controls.feeApplies.value==='yes'?(offerMoneyInput(payment.controls.fee.value)??0):0);}
  money(value:number,currency=this.manualMode&&/^[A-Z]{3}$/.test(this.manualCurrency.value)?this.manualCurrency.value:this.preparation?.source.currency??'AUD'){return new Intl.NumberFormat('en-AU',{style:'currency',currency}).format(value/100);}
  save(){this.persist('save');}
  createCurrent(){this.persist('current');}
  createAll(){this.persist('all');}
  reconcileCurrent(){
    const invoice=this.activeInvoice,batchId=this.draftIdentity?.batchId;if(!invoice||!batchId||!this.activeNeedsReview||this.busy||this.disabled)return;
    this.busy=true;this.busyLabel='Checking Xero invoice status…';this.form.disable({emitEvent:false});this.message='';
    this.api.reconcileCaseXeroInvoice(this.caseId,batchId,invoice.controls.sequence.value).pipe(takeUntil(this.scope$)).subscribe({next:result=>this.exportComplete(result),error:()=>{
      this.busy=false;this.enableEditor();this.message='Xero could not be checked right now. The invoice remains safely held for review; try again.';this.tone='error';
    }});
  }
  private persist(action:'save'|'current'|'all'){
    const p=this.preview;if(!p||this.busy||this.disabled||this.detail||this.conflict)return;
    if(this.ptySide&&action==='current'&&!this.isCreatedSequence(this.activeInvoice.controls.sequence.value)){this.message='Create the corresponding TRUST invoice first.';this.tone='error';return;}
    if(action!=='current'&&this.ptyLoading){this.message='Wait for PTY settings to finish loading.';this.tone='error';return;}
    const wantsPty=!this.editTarget&&(this.ptySide&&action==='current'||action!=='current'&&this.ptyOptions?.available&&!this.ptyOptions.issue&&this.ptyPending);
    if(this.ptySide&&action==='current'&&!this.canCreateCurrentPty){this.message=this.ptyOptions?.issue??this.ptyItemIssue??this.ptyPricingIssue??this.activePtySaleTypeIssue??'This PTY invoice is already created or awaiting Xero review.';this.tone='error';return;}
    if(wantsPty){
      const targets=this.form.controls.invoices.controls.filter(i=>(action!=='current'||i===this.activeInvoice)&&!['created','creating','review_required'].includes(this.ptyDrafts.find(d=>d.sequence===i.controls.sequence.value)?.status??''));
      const invalid=targets.find(i=>this.ptyItemFor(i).issue||this.ptyPricingFor(i).issue||this.ptySaleTypeIssue(i.controls.sequence.value));
      if(invalid){this.activePayment=this.form.controls.invoices.controls.indexOf(invalid);this.message=(this.ptyItemFor(invalid).issue??this.ptyPricingFor(invalid).issue??this.ptySaleTypeIssue(invalid.controls.sequence.value))!;this.tone='error';return;}
    }
    if(action==='current'&&!this.ptySide&&this.activeNeedsReview){this.message='This invoice needs review and cannot be sent again until its Xero outcome is reconciled.';this.tone='error';return;}
    if(action==='all'&&!this.hasCreatableInvoices){this.message='No pending invoice is available to create. Review the unresolved Xero outcome first.';this.tone='error';return;}
    if(!p.catalogue){this.message='The Xero item catalogue is not ready. Wait for background import, then close and reload items.';this.tone='error';return;}
    for(const payment of this.form.controls.invoices.controls){
      payment.controls.fee.updateValueAndValidity({emitEvent:false});
      // Switching off a fee must clear errors from a previous zero-fee attempt.
      if(payment.controls.feeApplies.value!=='yes')payment.controls.fee.setErrors(null);
      payment.controls.dueDate.updateValueAndValidity({emitEvent:false});
      if(payment.controls.issueDate.value&&payment.controls.dueDate.value&&payment.controls.dueDate.value<payment.controls.issueDate.value)payment.controls.dueDate.setErrors({beforeIssueDate:true});
      for(const line of payment.controls.lines.controls){
        for(const control of [line.controls.itemId,line.controls.accountCode,line.controls.taxType,line.controls.itemCode]){
          const required=this.lineAmount(line)>0&&(!this.editTarget||control===line.controls.accountCode||control===line.controls.taxType);
          control.setValidators([Validators.maxLength(500),...(required?[Validators.required,Validators.pattern(/\S/)]:[])]);control.updateValueAndValidity();
        }
      }
      if(payment.controls.feeApplies.value==='yes'&&offerMoneyInput(payment.controls.fee.value)===0)payment.controls.fee.setErrors({positive:true});
    }
    this.form.markAllAsTouched();
    const invalidPayment=this.form.controls.invoices.controls.findIndex(i=>i.invalid||this.hasUnresolvedItems(i)||i.controls.lines.controls.some(l=>Number(l.controls.quantity.value)<=0||this.lineAmount(l)>1_000_000_000));
    const confirmationMissing=action!=='save'&&!this.form.controls.confirmed.value;
    this.manualReference.markAsTouched();this.manualCurrency.markAsTouched();this.manualCollege.markAsTouched();this.manualBrandingTheme.markAsTouched();
    if(!this.manualMode&&!this.collegeOptions.some(college=>college.value===this.manualCollege.value)){
      this.message='Select an available college.';this.tone='error';return;
    }
    if(this.manualMode&&!this.form.controls.invoices.controls.every(i=>this.isFrozenSequence(i.controls.sequence.value))){
      const referenceMissing=this.referenceMode.value==='reference'?!this.editTarget&&!this.manualReference.value.trim():!this.collegeOptions.some(c=>c.value===this.manualCollege.value);
      if(referenceMissing||this.manualCurrency.invalid||!this.editTarget&&this.manualBrandingTheme.invalid){
        this.message=referenceMissing?(this.referenceMode.value==='college'?'Select a college.':'Enter an invoice reference.'):this.manualCurrency.invalid?'Enter a valid currency.':'Select a branding theme.';this.tone='error';return;
      }
    }
    if(this.form.invalid||invalidPayment>=0||confirmationMissing){
      if(invalidPayment>=0)this.activePayment=invalidPayment;
      this.message=confirmationMissing?(this.editTarget?'Review the invoice and tick the confirmation checkbox before saving.':'Review every instalment and tick the confirmation checkbox before creating invoices in Xero.'):'Complete the preview fields, rates, accounting details and fee choices.';
      if(!confirmationMissing){
        const payment=this.form.controls.invoices.at(Math.max(0,invalidPayment));
        if(this.form.controls.advisorId.invalid)this.message='Select an advisor.';
        else if(payment?.controls.dueDate.hasError('beforeIssueDate'))this.message='Due date must be on or after the issue date.';
        else if(payment?.controls.issueDate.invalid||payment?.controls.dueDate.invalid)this.message='Enter an issue date and due date.';
        else if(payment?.controls.lines.controls.some(l=>l.controls.description.invalid))this.message='Enter a description for each invoice item.';
        else if(payment?.controls.lines.controls.some(l=>l.controls.quantity.invalid))this.message='Enter a quantity greater than zero for each invoice item.';
        else if(payment?.controls.lines.controls.some(l=>l.controls.price.invalid))this.message='Enter a valid price for each invoice item.';
        else if(payment?.controls.feeApplies.value==='yes'&&payment.controls.fee.invalid)this.message='Enter a fee amount greater than zero or choose Do not apply.';
        else if(payment&&this.hasUnresolvedItems(payment))this.message='Select items with valid account and tax defaults.';
      }
      this.tone='error';return;
    }
    const v=this.form.getRawValue();
    if(this.editTarget){
      const target=this.editTarget,payment=this.activeInvoice.getRawValue();
      const value={expectedFingerprint:target.expectedFingerprint,confirmed:true,advisorId:v.advisorId,referenceMode:this.referenceMode.value,reference:this.manualReference.value,
        ...(this.referenceMode.value==='college'?{collegeId:this.manualCollege.value}:{}),...(this.manualBrandingTheme.value?{brandingThemeId:this.manualBrandingTheme.value}:{}),currency:this.manualCurrency.value,reviewNote:v.reviewNote,
        issueDate:payment.issueDate,dueDate:payment.dueDate,conditionalFeeMinor:payment.feeApplies==='yes'?(offerMoneyInput(payment.fee)??0):0,
        ...(target.conditionalFeeLineId?{conditionalFeeLineId:target.conditionalFeeLineId}:{}),
        lines:payment.lines.map(line=>({...line.lineItemId?{lineItemId:line.lineItemId}:{},itemCode:line.itemCode,description:line.description,quantity:line.quantity,unitPrice:line.price,accountCode:line.accountCode,taxType:line.taxType}))};
      const fingerprint=JSON.stringify(value);if(this.request?.fingerprint!==fingerprint)this.request={fingerprint,key:target.retryKey??crypto.randomUUID()};
      this.busy=true;this.busyLabel='Saving invoice…';this.form.disable({emitEvent:false});this.message='';
      this.api.updateCaseInvoice(this.caseId,target.connectionId,target.invoiceId,value,this.request!.key).pipe(takeUntil(this.scope$)).subscribe({next:()=>{
        this.busy=false;this.enableEditor();this.modal.nativeElement.close();this.preview=null;this.editTarget=null;this.previewStop$.next();this.message='Invoice updated successfully.';this.tone='success';this.changed.emit();if(this.showCreatedInvoices)this.load();
      },error:error=>{this.busy=false;this.enableEditor();this.message=typeof error?.error?.message==='string'?error.error.message:'The invoice update could not be confirmed. Retry the same changes.';this.tone='error';}});
      return;
    }
    const invoices=this.form.controls.invoices.controls.map(i=>{const invoice=i.getRawValue();return {sequence:invoice.sequence,issueDate:invoice.issueDate,dueDate:invoice.dueDate,
      conditionalFeeApplies:invoice.feeApplies==='yes',conditionalFeeMinor:invoice.feeApplies==='yes'?offerMoneyInput(invoice.fee)!:0,
      lines:i.controls.lines.controls.filter(l=>this.lineAmount(l)>0).map(l=>{const line=l.getRawValue();return {kind:line.kind,description:line.description,itemCode:line.itemCode,itemId:line.itemId,
        quantity:line.quantity,unitPrice:line.price,amountMinor:this.lineAmount(l),accountCode:line.accountCode,taxType:line.taxType};})};});
    const common={caseVersion:p.caseVersion,advisorId:v.advisorId,...(this.draftIdentity?{draftBatchId:this.draftIdentity.batchId,draftRevision:this.draftIdentity.revision}:{}),catalogueConnectionId:p.catalogue.connectionId,catalogueRevision:p.catalogue.revision,reviewNote:v.reviewNote,invoices};
    const value=this.manualMode?{...common,referenceMode:this.referenceMode.value,reference:this.manualReference.value,
      ...(this.referenceMode.value==='college'?{collegeId:this.manualCollege.value}:{}),brandingThemeId:this.manualBrandingTheme.value,currency:this.manualCurrency.value}:{...common,offerId:p.offerId,offerVersion:p.offerVersion,collegeId:this.manualCollege.value};
    const fingerprint=JSON.stringify(value);if(this.request?.fingerprint!==fingerprint)this.request={fingerprint,key:crypto.randomUUID()};
    this.busy=true;this.busyLabel=action==='save'?'Saving invoice drafts…':action==='current'?'Creating Xero invoice…':'Creating Xero invoices…';this.form.disable({emitEvent:false});this.message='';
    const allTrustFrozen=!!this.draftIdentity&&invoices.every(i=>this.isFrozenSequence(i.sequence));
    const saveRequest=allTrustFrozen&&wantsPty?of({...this.draftIdentity!,count:invoices.length}):this.manualMode?this.api.prepareManualCaseInvoice(this.caseId,value,this.request!.key):this.api.prepareCaseInvoiceDrafts(this.caseId,value,this.request!.key);
    saveRequest.pipe(takeUntil(this.scope$)).subscribe({next:result=>{
      this.draftIdentity={batchId:result.batchId,revision:result.revision};
      if(wantsPty){
        const pending=invoices.filter(i=>{const status=this.ptyDrafts.find(d=>d.sequence===i.sequence)?.status;return !status||status==='not_attempted';});
        const targets=action==='current'?pending.filter(i=>i.sequence===invoices[this.activePayment].sequence):pending;
        if(!targets.length){this.busy=false;this.message='The selected PTY invoices are already created or awaiting Xero review.';this.tone='error';this.enableEditor();return;}
        this.api.prepareCommissions(this.caseId,result.batchId,result.revision,targets.map(i=>({sequence:i.sequence,typeOfSaleOptionId:this.ptySaleTypes.get(i.sequence)?.value}))).pipe(
          switchMap(()=>action==='save'?of(null):this.api.createPairedInvoices(this.caseId,result.batchId,
            this.ptySide&&action==='current'?[]:action==='all'?invoices.filter(i=>!this.isFrozenSequence(i.sequence)).map(i=>i.sequence):[invoices[this.activePayment].sequence],targets.map(i=>i.sequence))),takeUntil(this.scope$)
        ).subscribe({next:r=>{if(!r){this.busy=false;this.enableEditor();this.message='TRUST and PTY drafts saved.';this.tone='success';this.loadPtyDrafts();this.changed.emit();return;}
          this.retainingPaired=true;this.exportComplete(r.trust);this.retainingPaired=false;
          const problems=[...(r.trust.results??[]),...r.pty.results].filter(i=>!['created','already_created'].includes(i.status));
          const finished=invoices.every(i=>this.receipt(i.sequence)?.status==='created'&&
            (r.pty.results.some(p=>p.sequence===i.sequence&&['created','already_created'].includes(p.status))||this.ptyDrafts.some(p=>p.sequence===i.sequence&&p.status==='created')));
          if(finished&&!problems.length){this.modal.nativeElement.close();this.preview=null;this.sessionExports={};this.previewStop$.next();}
          else this.loadPtyDrafts();
          this.message=`${r.trust.created} TRUST and ${r.pty.created} PTY draft invoices created.${problems.length?' '+(problems[0].message??'Some PTY invoices need review.'):''}`;this.tone=problems.length?'error':'success';
        },error:e=>{this.busy=false;this.enableEditor();this.message=e?.error?.message??'TRUST drafts were saved. Reopen the preview to check PTY before retrying.';this.tone='error';this.changed.emit();}});
        return;
      }
      if(action==='save'){this.busy=false;this.enableEditor();this.message=`${result.count} drafts saved. You can continue reviewing and editing them here.`;this.tone='success';this.changed.emit();if(this.showCreatedInvoices)this.load();return;}
      const sequences=action==='all'?invoices.filter(i=>!this.isFrozenSequence(i.sequence)).map(i=>i.sequence):[invoices[this.activePayment].sequence];
      this.api.createCaseXeroInvoices(this.caseId,result.batchId,sequences).pipe(takeUntil(this.scope$)).subscribe({next:r=>this.exportComplete(r),error:e=>{this.busy=false;this.enableEditor();
        const known:Record<string,string>={student_invoice_contact_unavailable:'The student needs an active linked Xero Contact. Ask an administrator to review the contact.',xero_contact_read_scope_missing:'An administrator must authorize Xero contact access in company integrations.'};
        this.message=(e?.status===409&&Object.prototype.hasOwnProperty.call(known,e?.error?.errorCode)&&known[e.error.errorCode])||'The drafts were saved, but Xero creation could not be confirmed. Reload the drafts before trying again.';
        this.tone='error';this.changed.emit();if(this.showCreatedInvoices)this.load();}});
    },error:e=>{this.busy=false;this.enableEditor();this.conflict=e?.status===409;this.message=this.conflict?'The case, offer, or a read-only Xero invoice changed. Close this preview and reopen it before editing again.':e?.status===400?'Check quantities, prices and dates. Explain any changes from the offer in the review note.':'Draft saving could not be confirmed. Retry the same preview.';this.tone='error';}});
  }
  private exportComplete(result:{created:number;skipped:number;results?:Array<{sequence:number;status:string;invoiceId?:string;invoiceNumber?:string|null;errorCode?:string;message?:string}>}){this.busy=false;
    for(const item of result.results??[]){
      const previous=this.sessionExports[String(item.sequence)];
      this.sessionExports[String(item.sequence)]={status:item.status==='already_created'?'created':item.status as 'not_attempted'|'creating'|'created'|'review_required',
        invoiceId:item.invoiceId??previous?.invoiceId??null,invoiceNumber:item.invoiceNumber??previous?.invoiceNumber??null};
    }
    this.enableEditor();
    const review=result.results?.filter(item=>item.status==='review_required'||item.status==='creating').length??result.skipped;
    const existing=result.results?.filter(item=>item.status==='already_created').length??0;
    const setup=result.results?.filter(item=>item.status==='not_attempted').length??0;
    const setupReason=result.results?.find(item=>item.status==='not_attempted'&&item.message)?.message;
    const reviewReason=result.results?.find(item=>(item.status==='review_required'||item.status==='creating')&&item.message)?.message;
    const successReason=result.results?.find(item=>(item.status==='created'||item.status==='already_created')&&item.message)?.message;
    this.message=this.manualMode&&!review&&!setup?'Invoice created successfully.':`${result.created} Xero draft invoice${result.created===1?'':'s'} created.${successReason?` ${successReason}`:''}${existing?` ${existing} already existed and was skipped.`:''}${setup?` ${setup} was not sent.${setupReason?` ${setupReason}`:' Xero setup needs attention.'}`:''}${review?` ${review} ${review===1?'needs':'need'} review before any retry.${reviewReason?` ${reviewReason}`:''}`:''}`;
    this.tone=review||setup?'error':'success';
    const nextEditable=this.form.controls.invoices.controls.findIndex(payment=>!this.isFrozenSequence(payment.controls.sequence.value));
    const nextReview=this.form.controls.invoices.controls.findIndex(payment=>this.isReviewSequence(payment.controls.sequence.value));
    const next=nextEditable>=0?nextEditable:nextReview;
    if(next<0&&!this.retainingPaired&&!this.ptyOptions?.available){this.modal.nativeElement.close();this.preview=null;this.sessionExports={};this.previewStop$.next();}
    else if(next<0){this.ptySide=true;this.form.controls.confirmed.setValue(false);}
    else{this.activePayment=next;this.form.controls.confirmed.setValue(false);}
    this.changed.emit();if(this.showCreatedInvoices)this.load();}
  ngOnDestroy(){this.scope$.next();this.scope$.complete();this.previewStop$.next();this.previewStop$.complete();this.detailStop$.next();this.detailStop$.complete();this.ptyStop$.next();this.ptyStop$.complete();}
}
