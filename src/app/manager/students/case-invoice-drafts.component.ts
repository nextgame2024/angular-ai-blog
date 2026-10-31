import { CommonModule } from '@angular/common';
import { Component,ElementRef,EventEmitter,Input,OnChanges,OnDestroy,Output,ViewChild,inject } from '@angular/core';
import { FormArray,FormControl,FormGroup,ReactiveFormsModule,Validators } from '@angular/forms';
import { Subject,takeUntil } from 'rxjs';
import { ManagerSelectComponent } from '../components/shared/manager-select/manager-select.component';
import { ManagerToastComponent } from '../components/shared/manager-toast/manager-toast.component';
import { ManagerListLoaderComponent } from '../components/shared/manager-list-loader/manager-list-loader.component';
import { StudentOperationsService } from '../student-operations/student-operations.service';
import type { CaseInvoiceDraftData,CaseInvoiceDraft,CaseInvoiceDraftLine,StudentCaseInvoiceDetail } from '../student-operations/student-operations.types';
import { offerMoneyInput } from './case-offer-review.component';

const text=(value='',required=true)=>new FormControl(value,{nonNullable:true,validators:[Validators.maxLength(4000),...(required?[Validators.required]:[])]});
const amount=(value='')=>new FormControl(value,{nonNullable:true,validators:[c=>offerMoneyInput(c.value)===null?{money:true}:null]});
const decimal4=/^\d{1,8}(\.\d{1,4})?$/;
const scaled=(value:string)=>{const [whole,fraction='']=value.split('.');return BigInt(whole)*10000n+BigInt(fraction.padEnd(4,'0'));};
const displayDecimal=(value:string)=>{const amount=scaled(value);return amount%100n===0n?`${amount/10000n}.${String((amount%10000n)/100n).padStart(2,'0')}`:value.replace(/0+$/,'').replace(/\.$/,'');};
const lineForm=(kind:CaseInvoiceDraftLine['kind'],label:string,value:number)=>new FormGroup({kind:text(kind),description:text(label),itemId:text('',false),itemCode:text('',false),
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
  data:CaseInvoiceDraftData|null=null;loading=false;busy=false;busyLabel='';failed=false;message='';tone:'success'|'error'='error';
  detail:StudentCaseInvoiceDetail|null=null;
  readonlyMode=false;detailLoading=false;detailFailed=false;
  manualMode=false;
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
  conflict=false;
  private request:{fingerprint:string;key:string}|null=null;
  private draftIdentity:{batchId:string;revision:number}|null=null;
  private preview:NonNullable<CaseInvoiceDraftData['preparation']>|null=null;
  private sessionExports:CaseInvoiceDraftData['batches'][number]['exports']={};
  readonly form=new FormGroup({advisorId:text(),reviewNote:text('',false),confirmed:new FormControl(false,{nonNullable:true}),invoices:new FormArray<ReturnType<typeof paymentForm>>([])});
  readonly feeOptions=[{value:'yes',label:'Apply fee'},{value:'no',label:'Do not apply'}];
  get preparation(){return this.preview??this.data?.preparation??null;}
  get advisors(){return this.preparation?.advisors.map(a=>({value:a.advisorId,label:`${a.code} ${a.name}`}))??[];}
  get canPrepare(){return Boolean(this.data?.preparation);}
  get itemOptions(){return this.preparation?.catalogue?.items.map(i=>({value:i.itemId,label:`${i.code} — ${i.name}`}))??[];}
  get activeInvoice(){return this.form.controls.invoices.at(this.activePayment);}
  get activeInvoiceNumber():number|string{return this.activeInvoice?.getRawValue().sequence??'—';}
  get activeNeedsReview(){return Boolean(this.activeInvoice&&this.isReviewSequence(this.activeInvoice.controls.sequence.value));}
  get hasCreatableInvoices(){return this.form.controls.invoices.controls.some(payment=>!this.isFrozenSequence(payment.controls.sequence.value));}
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
  hasUnresolvedItems(payment:ReturnType<typeof paymentForm>){return payment.controls.lines.controls.some(l=>this.lineAmount(l)>0&&(!l.controls.itemId.value||!l.controls.accountCode.value||this.taxRate(l)?.rate==null));}
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
          if(tuition&&tuition.controls.itemId.value!==id)tuition.controls.itemId.setValue(id);
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
    this.manualMode=false;
    const p=this.data?.preparation;if(!p||this.busy||this.disabled||this.loading)return;this.preview=structuredClone(p);this.readonlyMode=false;this.detail=null;this.activePayment=0;this.conflict=false;this.request=null;this.message='';
    const saved=p.savedBatch;
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
    this.modal.nativeElement.showModal();
  }
  openManual(){
    if(this.busy||this.disabled||!this.caseId||!this.data?.canCreateXero)return;
    this.previewStop$.next();this.detailStop$.next();this.manualMode=true;this.readonlyMode=false;this.detail=null;
    this.activePayment=0;this.conflict=false;this.request=null;this.draftIdentity=null;this.preview=null;this.sessionExports={};this.message='';
    this.form.enable({emitEvent:false});this.form.reset({advisorId:'',reviewNote:'',confirmed:false});this.form.controls.invoices.clear();
    this.manualReference.reset('');this.manualCurrency.reset('AUD');this.referenceMode.reset('reference');this.manualCollege.reset('');this.manualBrandingTheme.reset('');this.collegeOptions=[];this.brandingOptions=[];
    this.busy=true;this.busyLabel='Loading invoice form…';this.modal.nativeElement.showModal();
    this.api.manualCaseInvoiceOptions(this.caseId).pipe(takeUntil(this.scope$),takeUntil(this.previewStop$)).subscribe({next:options=>{
      this.preview={...options,offerId:'',offerVersion:0,today:'',savedBatch:null,
        source:{kind:'letter_of_offer',studentName:options.student.name,evidence:[],issues:[],collegeName:null,abn:null,cricosProviderCode:null,currency:'AUD',statedTotalMinor:null,courses:[],fees:[],instalments:[]}};
      this.collegeOptions=(options.colleges??[]).map(c=>({value:c.collegeId,label:c.name}));
      this.brandingOptions=(options.brandingThemes??[]).map(t=>({value:t.brandingThemeId,label:t.name}));
      if(options.advisors.some(a=>a.advisorId===options.student.advisorId))this.form.controls.advisorId.setValue(options.student.advisorId!);
      const college=options.colleges?.find(c=>c.isPrimary);
      if(college){this.referenceMode.setValue('college');this.manualCollege.setValue(college.collegeId);}
      this.busy=false;
      const payment=paymentForm(1,'','',0,[]);payment.controls.feeApplies.setValue('no');
      this.form.controls.invoices.push(payment);this.addLine(payment,'other','',0);
      payment.controls.lines.at(0).patchValue({quantity:'',price:''},{emitEvent:false});
    },error:()=>{this.busy=false;this.message='The invoice form could not be loaded. Close it and try again.';this.tone='error';}});
  }
  show(batch:CaseInvoiceDraftData['batches'][number],invoice:CaseInvoiceDraft){
    const receipt=batch.exports[String(invoice.sequence)];if(receipt?.status!=='created'||!receipt.invoiceId)return;
    this.showInvoice((batch.snapshot as {catalogueConnectionId?:string}).catalogueConnectionId??this.preparation?.catalogue?.connectionId??'',receipt.invoiceId);
  }
  showInvoice(connectionId:string,invoiceId:string){
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
    if(action==='current'&&this.activeNeedsReview){this.message='This invoice needs review and cannot be sent again until its Xero outcome is reconciled.';this.tone='error';return;}
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
          control.setValidators([Validators.maxLength(500),...(this.lineAmount(line)>0?[Validators.required,Validators.pattern(/\S/)]:[])]);control.updateValueAndValidity();
        }
      }
      if(payment.controls.feeApplies.value==='yes'&&offerMoneyInput(payment.controls.fee.value)===0)payment.controls.fee.setErrors({positive:true});
    }
    this.form.markAllAsTouched();
    const invalidPayment=this.form.controls.invoices.controls.findIndex(i=>i.invalid||this.hasUnresolvedItems(i)||i.controls.lines.controls.some(l=>Number(l.controls.quantity.value)<=0||this.lineAmount(l)>1_000_000_000));
    const confirmationMissing=action!=='save'&&!this.form.controls.confirmed.value;
    this.manualReference.markAsTouched();this.manualCurrency.markAsTouched();this.manualCollege.markAsTouched();this.manualBrandingTheme.markAsTouched();
    if(this.manualMode){
      const referenceMissing=this.referenceMode.value==='reference'?!this.manualReference.value.trim():!this.collegeOptions.some(c=>c.value===this.manualCollege.value);
      if(referenceMissing||this.manualCurrency.invalid||this.manualBrandingTheme.invalid){
        this.message=referenceMissing?(this.referenceMode.value==='college'?'Select a college.':'Enter an invoice reference.'):this.manualCurrency.invalid?'Enter a valid currency.':'Select a branding theme.';this.tone='error';return;
      }
    }
    if(this.form.invalid||invalidPayment>=0||confirmationMissing){
      if(invalidPayment>=0)this.activePayment=invalidPayment;
      this.message=confirmationMissing?'Review every instalment and tick the confirmation checkbox before creating invoices in Xero.':'Complete the preview fields, rates, accounting details and fee choices.';
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
    const invoices=this.form.controls.invoices.controls.map(i=>{const invoice=i.getRawValue();return {sequence:invoice.sequence,issueDate:invoice.issueDate,dueDate:invoice.dueDate,
      conditionalFeeApplies:invoice.feeApplies==='yes',conditionalFeeMinor:invoice.feeApplies==='yes'?offerMoneyInput(invoice.fee)!:0,
      lines:i.controls.lines.controls.filter(l=>this.lineAmount(l)>0).map(l=>{const line=l.getRawValue();return {kind:line.kind,description:line.description,itemCode:line.itemCode,itemId:line.itemId,
        quantity:line.quantity,unitPrice:line.price,amountMinor:this.lineAmount(l),accountCode:line.accountCode,taxType:line.taxType};})};});
    const common={caseVersion:p.caseVersion,advisorId:v.advisorId,...(this.draftIdentity?{draftBatchId:this.draftIdentity.batchId,draftRevision:this.draftIdentity.revision}:{}),catalogueConnectionId:p.catalogue.connectionId,catalogueRevision:p.catalogue.revision,reviewNote:v.reviewNote,invoices};
    const value=this.manualMode?{...common,referenceMode:this.referenceMode.value,reference:this.manualReference.value,
      ...(this.referenceMode.value==='college'?{collegeId:this.manualCollege.value}:{}),brandingThemeId:this.manualBrandingTheme.value,currency:this.manualCurrency.value}:{...common,offerId:p.offerId,offerVersion:p.offerVersion};
    const fingerprint=JSON.stringify(value);if(this.request?.fingerprint!==fingerprint)this.request={fingerprint,key:crypto.randomUUID()};
    this.busy=true;this.busyLabel=action==='save'?'Saving invoice drafts…':action==='current'?'Creating Xero invoice…':'Creating Xero invoices…';this.form.disable({emitEvent:false});this.message='';
    (this.manualMode?this.api.prepareManualCaseInvoice(this.caseId,value,this.request!.key):this.api.prepareCaseInvoiceDrafts(this.caseId,value,this.request!.key)).pipe(takeUntil(this.scope$)).subscribe({next:result=>{
      this.draftIdentity={batchId:result.batchId,revision:result.revision};
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
    if(next<0){this.modal.nativeElement.close();this.preview=null;this.sessionExports={};this.previewStop$.next();}
    else{this.activePayment=next;this.form.controls.confirmed.setValue(false);}
    this.changed.emit();if(this.showCreatedInvoices)this.load();}
  ngOnDestroy(){this.scope$.next();this.scope$.complete();this.previewStop$.next();this.previewStop$.complete();this.detailStop$.next();this.detailStop$.complete();}
}
