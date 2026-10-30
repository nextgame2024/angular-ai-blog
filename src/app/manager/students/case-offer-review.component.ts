import { Component,ElementRef,Input,Output,EventEmitter,OnInit,OnDestroy,inject } from '@angular/core';
import { FormArray,FormControl,FormGroup,ReactiveFormsModule,Validators } from '@angular/forms';
import { of,Subject,takeUntil,switchMap } from 'rxjs';
import { ManagerSelectComponent } from '../components/shared/manager-select/manager-select.component';
import { ManagerToastComponent } from '../components/shared/manager-toast/manager-toast.component';
import { ManagerAddressAutocompleteComponent } from '../components/shared/manager-address-autocomplete/manager-address-autocomplete.component';
import { ManagerCollegesService } from '../services/manager.colleges.service';
import { StudentOperationsService } from '../student-operations/student-operations.service';
import type { StudentDocumentAnalysis,StudentOfferExtraction } from '../student-operations/student-operations.types';

export function offerMoneyInput(value:string):number|null {
  if(!/^\d{1,8}(\.\d{1,2})?$/.test(value.trim()))return null;
  const [whole,fraction='']=value.trim().split('.');const amount=Number(whole)*100+Number(fraction.padEnd(2,'0'));
  return amount<=1_000_000_000?amount:null;
}
const control=(value:string,required=false)=>new FormControl(value,{nonNullable:true,validators:[Validators.maxLength(500),...(required?[Validators.required]:[])]});
const amountControl=(value:string)=>new FormControl(value,{nonNullable:true,validators:[Validators.required,c=>offerMoneyInput(c.value)===null?{money:true}:null]});
type TextControls<K extends string>={[P in K]:FormControl<string>};
type CourseForm=FormGroup<TextControls<'name'|'code'|'startsOn'|'endsOn'|'duration'>>;
type FeeForm=FormGroup<TextControls<'label'|'amount'|'condition'>&{conditional:FormControl<boolean>}>;
type ComponentForm=FormGroup<TextControls<'label'|'amount'>>;
type InstalmentForm=FormGroup<TextControls<'sequence'|'dueTerm'|'dueOn'|'total'|'includedFee'>&{components:FormArray<ComponentForm>}>;
@Component({selector:'app-case-offer-review',imports:[ReactiveFormsModule,ManagerSelectComponent,ManagerToastComponent,ManagerAddressAutocompleteComponent],providers:[ManagerCollegesService],
  templateUrl:'./case-offer-review.component.html',styleUrls:['./case-offer-review.component.css']})
export class CaseOfferReviewComponent implements OnInit,OnDestroy {
  readonly offerMoneyInput=offerMoneyInput;
  @Input({required:true}) analysis!:StudentDocumentAnalysis;@Input() caseId='';@Input() documentId='';
  @Output() saved=new EventEmitter<void>();@Output() busyChange=new EventEmitter<boolean>();@Output() problem=new EventEmitter<string>();
  private readonly api=inject(StudentOperationsService);private readonly colleges=inject(ManagerCollegesService);private readonly stop$=new Subject<void>();
  private request:{fingerprint:string;key:string}|null=null;
  private readonly host=inject<ElementRef<HTMLElement>>(ElementRef);
  readonly tabs=[{key:'details',label:'Details'},{key:'fees',label:'Fee details'},{key:'instalments',label:'Instalment schedule'},{key:'review',label:'Evidence & review note'}] as const;
  activeTab:'details'|'fees'|'instalments'|'review'='details';
  private focusTimer:ReturnType<typeof setTimeout>|null=null;
  selectTab(tab:typeof this.activeTab){if(!this.busy)this.activeTab=tab;}
  tabKey(event:KeyboardEvent,index:number){
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)||this.busy)return;
    event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?this.tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+this.tabs.length)%this.tabs.length;
    this.activeTab=this.tabs[next].key;this.host.nativeElement.querySelector<HTMLButtonElement>(`[data-offer-tab="${this.activeTab}"]`)?.focus();
  }
  private showProblem(message:string,tab:typeof this.activeTab){
    this.activeTab=tab;this.problem.emit(message);
    if(this.focusTimer)clearTimeout(this.focusTimer);
    this.focusTimer=setTimeout(()=>{this.host.nativeElement.querySelector<HTMLElement>(`#offer-panel-${this.documentId}-${tab} [aria-invalid="true"] input, #offer-panel-${this.documentId}-${tab} input.ng-invalid, #offer-panel-${this.documentId}-${tab} textarea.ng-invalid, #offer-panel-${this.documentId}-${tab} app-manager-select[aria-invalid="true"] button`)?.focus();},0);
  }
  busy=false;creating=false;createdCollegeId:string|null=null;
  collegeError='';collegeNotice='';scheduleError='';addingPayment=false;
  directory:Array<{collegeId:string;name:string;abn:string|null}>=[];
  readonly form=new FormGroup({name:control('',true),collegeName:control('',true),campusAddress:control(''),abn:control(''),cricos:control(''),currency:control('AUD',true),total:amountControl(''),
    collegeId:control('',true),reason:control(''),replaceCollege:new FormControl(false,{nonNullable:true}),acknowledgeTotals:new FormControl(false,{nonNullable:true}),
    courses:new FormArray<CourseForm>([]),fees:new FormArray<FeeForm>([]),instalments:new FormArray<InstalmentForm>([])});
  readonly paymentName=control('',true);
  readonly collegeForm=new FormGroup({college_name:new FormControl('',{nonNullable:true,validators:[Validators.required,Validators.maxLength(200),c=>c.value.trim()?null:{required:true}]}),
    owner_name:new FormControl('',{nonNullable:true,validators:[Validators.maxLength(200)]}),abn:new FormControl('',{nonNullable:true,validators:[Validators.maxLength(80)]}),
    notes:new FormControl('',{nonNullable:true,validators:[Validators.maxLength(5000)]})});
  get source(){return this.analysis.extraction as StudentOfferExtraction;}
  get collegeOptions(){return this.directory.map(c=>({value:c.collegeId,label:c.abn?`${c.name} · ABN ${c.abn}`:c.name}));}
  get currentCollegeName(){return this.directory.find(c=>c.collegeId===this.analysis.offer?.currentCollegeId)?.name??'Not assigned';}
  get replacingCollege(){return Boolean(this.analysis.offer?.currentCollegeId&&this.form.controls.collegeId.value!==this.analysis.offer.currentCollegeId);}
  money(value:number|null){return value===null?'':`${Math.floor(value/100)}.${String(value%100).padStart(2,'0')}`;}
  ngOnInit(){
    const source=this.source;this.directory=this.analysis.offer?.colleges??[];
    this.form.patchValue({name:source.studentName??'',collegeName:source.collegeName??'',campusAddress:source.campusAddress??'',abn:source.abn??'',cricos:source.cricosProviderCode??'',currency:source.currency,total:this.money(source.statedTotalMinor),collegeId:this.analysis.offer?.selectedCollegeId??''});
    for(const course of source.courses)this.addCourse(course);
    for(const fee of source.fees)this.addFee(fee);
    for(const item of source.instalments)this.addInstalment(item);
  }
  addCourse(v?:StudentOfferExtraction['courses'][number]){if(this.busy||this.form.controls.courses.length>=30)return;this.form.controls.courses.push(new FormGroup({name:control(v?.name??'',true),code:control(v?.code??''),startsOn:control(v?.startsOn??''),endsOn:control(v?.endsOn??''),duration:control(v?.duration??'')}));}
  addFee(v?:StudentOfferExtraction['fees'][number]){if(this.busy||this.form.controls.fees.length>=100)return;this.form.controls.fees.push(new FormGroup({label:control(v?.label??'',true),amount:amountControl(this.money(v?.amountMinor??null)),conditional:new FormControl(v?.conditional??false,{nonNullable:true}),condition:control(v?.condition??'')}));}
  addInstalment(v?:StudentOfferExtraction['instalments'][number]){if(this.busy||this.form.controls.instalments.length>=200)return;this.form.controls.instalments.push(new FormGroup({sequence:control(String(v?.sequence??this.form.controls.instalments.length+1),true),dueTerm:control(v?.dueTerm??''),dueOn:control(v?.dueOn??''),total:amountControl(this.money(v?.totalMinor??null)),includedFee:amountControl(this.money(v?.includedConditionalFeeMinor??0)),components:new FormArray<ComponentForm>((v?.components??[]).map(c=>new FormGroup({label:control(c.label,true),amount:amountControl(this.money(c.amountMinor))})))}));}
  get componentLabels(){
    const labels:string[]=[];
    for(const payment of this.form.controls.instalments.controls)for(const component of payment.controls.components.controls){const label=component.controls.label.value.trim();if(label&&!labels.some(value=>value.toLocaleLowerCase()===label.toLocaleLowerCase()))labels.push(label);}
    return labels;
  }
  get conditionalFeeLabel(){
    const labels=this.form.controls.fees.controls.filter(fee=>fee.controls.conditional.value).map(fee=>fee.controls.label.value.trim()).filter(Boolean);
    return labels.length===1?labels[0]:labels.length>1?'Conditional fees':'Conditional fee';
  }
  componentFor(payment:InstalmentForm,label:string){return payment.controls.components.controls.find(component=>component.controls.label.value.trim().toLocaleLowerCase()===label.toLocaleLowerCase())??null;}
  setComponentAmount(payment:InstalmentForm,label:string,event:Event){
    const value=(event.target as HTMLInputElement).value,existing=this.componentFor(payment,label);
    if(existing){existing.controls.amount.setValue(value);return;}
    if(payment.controls.components.length<20)payment.controls.components.push(new FormGroup({label:control(label,true),amount:amountControl(value)}));
  }
  openAddPayment(){
    if(this.busy||!this.form.controls.instalments.length||this.componentLabels.length>=20)return;
    this.scheduleError='';this.paymentName.reset('');this.addingPayment=true;
    if(this.focusTimer)clearTimeout(this.focusTimer);
    this.focusTimer=setTimeout(()=>this.host.nativeElement.querySelector<HTMLInputElement>('#new-payment-name')?.focus(),0);
  }
  cancelAddPayment(){if(!this.busy){this.addingPayment=false;this.scheduleError='';}}
  addPaymentColumn(){
    if(this.busy||!this.addingPayment)return;
    this.paymentName.markAsTouched();const name=this.paymentName.value.trim();
    if(!name){this.scheduleError='Enter a payment name.';return;}
    if(this.componentLabels.some(label=>label.toLocaleLowerCase()===name.toLocaleLowerCase())){this.scheduleError='A payment with that name already exists.';return;}
    if(this.form.controls.instalments.controls.some(payment=>payment.controls.components.length>=20)){this.scheduleError='The schedule cannot have more than 20 payment columns.';return;}
    for(const payment of this.form.controls.instalments.controls)payment.controls.components.push(new FormGroup({label:control(name,true),amount:amountControl('0.00')}));
    this.addingPayment=false;this.paymentName.reset('');
  }
  remove(array:FormArray,index:number){if(!this.busy)array.removeAt(index);}
  get paymentTotals(){const rows=this.form.controls.instalments.getRawValue();return {total:rows.reduce((n,r)=>n+(offerMoneyInput(r.total)??0),0),included:rows.reduce((n,r)=>n+(offerMoneyInput(r.includedFee)??0),0)};}
  get firstPaymentSummary(){
    const rows=this.form.controls.instalments.getRawValue();
    if(!rows.length||rows.some(r=>!/^\d+$/.test(r.sequence)||!Number.isSafeInteger(Number(r.sequence))||Number(r.sequence)<1))return null;
    const first=[...rows].sort((a,b)=>Number(a.sequence)-Number(b.sequence))[0];
    if(rows.filter(r=>Number(r.sequence)===Number(first.sequence)).length!==1)return null;
    const total=offerMoneyInput(first.total),included=offerMoneyInput(first.includedFee);
    return total===null||included===null||included>total?null:{total,base:total-included};
  }
  get totalsDiffer(){const total=offerMoneyInput(this.form.controls.total.value),rows=this.paymentTotals;return total!==null&&total!==rows.total&&total!==rows.total-rows.included;}
  beginCollege(){
    if(this.busy)return;this.activeTab='details';
    if(!this.creating){this.creating=true;this.createdCollegeId=null;this.collegeError='';this.collegeNotice='';this.collegeForm.enable({emitEvent:false});this.collegeForm.reset({college_name:this.form.controls.collegeName.value.slice(0,200),owner_name:'',abn:this.form.controls.abn.value,notes:''});}
    if(this.focusTimer)clearTimeout(this.focusTimer);
    this.focusTimer=setTimeout(()=>this.host.nativeElement.querySelector<HTMLInputElement>('.college-form input')?.focus(),0);
  }
  cancelCollege(){if(!this.busy){this.creating=false;this.collegeError='';}}
  createCollege(){
    if(this.busy||!this.creating)return;this.activeTab='details';this.collegeError='';this.collegeForm.markAllAsTouched();if(this.collegeForm.invalid){this.collegeError='Enter a college name and valid details.';this.beginCollege();return;}
    this.setBusy(true);
    const creation=this.createdCollegeId?of({college:{collegeId:this.createdCollegeId}}):this.colleges.createFromOffer(this.collegeForm.getRawValue());
    creation.pipe(switchMap(value=>{this.createdCollegeId=value.college.collegeId;return this.api.documentAnalysis(this.caseId,this.documentId);}),takeUntil(this.stop$)).subscribe({
      next:result=>{this.directory=result.offer?.colleges??[];if(!this.directory.some(c=>c.collegeId===this.createdCollegeId)){this.setBusy(false);this.collegeError='The college was saved but is not available for selection. Retry loading the selection or cancel and select an existing college.';return;}
        this.form.controls.collegeId.setValue(this.createdCollegeId!);this.creating=false;this.collegeNotice='College saved and selected. Continue reviewing the offer.';this.setBusy(false);},
      error:err=>{this.setBusy(false);this.collegeError=err?.status===409?'A matching college already exists or has conflicting details. Cancel and select an existing college.':this.createdCollegeId?'The college was saved. Retry loading its selection.':'The college could not be saved. Check the details and retry.';},
    });
  }
  save(decision:'confirmed'|'rejected'){
    if(this.busy||!this.analysis.resultId)return;
    if(this.creating){this.activeTab='details';this.collegeError='Save or cancel the new college before reviewing the offer.';return;}
    if(decision==='confirmed'&&this.analysis.currentForType===false)return;
    this.form.markAllAsTouched();const v=this.form.getRawValue();
    let corrections:StudentOfferExtraction|null=null;
    if(decision==='confirmed'){
      const rows=v.instalments??[],courses=v.courses??[],fees=v.fees??[];
      if(this.form.invalid||!courses.length||!fees.length||!rows.length||!v.name.trim()||!v.collegeName.trim()||!v.collegeId||!/^[A-Z]{3}$/.test(v.currency)||offerMoneyInput(v.total)===null||
        fees.some(f=>offerMoneyInput(f.amount)===null)||rows.some(r=>offerMoneyInput(r.total)===null||offerMoneyInput(r.includedFee)===null||!/^\d+$/.test(r.sequence)||Number(r.sequence)<1||(!r.dueOn&&!r.dueTerm))){
        const detailsInvalid=!v.name.trim()||!v.collegeName.trim()||!v.collegeId||this.form.controls.name.invalid||this.form.controls.collegeName.invalid||this.form.controls.collegeId.invalid||!courses.length||this.form.controls.courses.invalid;
        const feesInvalid=!fees.length||this.form.controls.fees.invalid||this.form.controls.currency.invalid||!/^[A-Z]{3}$/.test(v.currency)||offerMoneyInput(v.total)===null;
        this.showProblem('Complete the offer, choose a college, and enter valid amounts with up to two decimal places.',detailsInvalid?'details':feesInvalid?'fees':'instalments');return;}
      if(this.replacingCollege&&!v.replaceCollege){this.showProblem('Confirm replacing the existing case college.','details');return;}
      if(new Set(rows.map(r=>Number(r.sequence))).size!==rows.length){this.showProblem('Each instalment needs a unique number.','instalments');return;}
      if(rows.some(r=>offerMoneyInput(r.includedFee)!>offerMoneyInput(r.total)!)){this.showProblem('An included conditional fee cannot exceed its payment.','instalments');return;}
      if(courses.some(c=>c.startsOn&&c.endsOn&&c.endsOn<c.startsOn)){this.showProblem('Course end dates must follow their start dates.','details');return;}
      if(this.totalsDiffer&&!v.acknowledgeTotals){this.showProblem('Review and acknowledge the difference between the total and instalments.','fees');return;}
      corrections={...this.source,studentName:v.name.trim(),collegeName:v.collegeName.trim(),campusAddress:v.campusAddress.trim()||null,abn:v.abn.trim()||null,cricosProviderCode:v.cricos.trim()||null,currency:v.currency,statedTotalMinor:offerMoneyInput(v.total),
        courses:courses.map(c=>({name:c.name.trim(),code:c.code.trim()||null,startsOn:c.startsOn||null,endsOn:c.endsOn||null,duration:c.duration.trim()||null})),
        fees:fees.map(f=>({label:f.label.trim(),amountMinor:offerMoneyInput(f.amount)!,conditional:f.conditional,condition:f.condition.trim()||null})),
        instalments:rows.map(r=>({sequence:Number(r.sequence),dueTerm:r.dueTerm.trim()||null,dueOn:r.dueOn||null,totalMinor:offerMoneyInput(r.total)!,includedConditionalFeeMinor:offerMoneyInput(r.includedFee)!,components:r.components.map(c=>({label:c.label.trim(),amountMinor:offerMoneyInput(c.amount)!}))}))};
    }
    const value={resultId:this.analysis.resultId,expectedReviewVersion:this.analysis.reviewVersion,expectedCaseVersion:this.analysis.offer?.caseRecordVersion,
      decision,reason:v.reason.trim()||null,corrections,collegeId:v.collegeId||null,replaceCollege:v.replaceCollege,acknowledgeTotals:v.acknowledgeTotals};
    const fingerprint=JSON.stringify(value);if(this.request?.fingerprint!==fingerprint)this.request={fingerprint,key:crypto.randomUUID()};
    this.setBusy(true);this.api.reviewDocumentAnalysis(this.caseId,this.documentId,value,this.request!.key).pipe(takeUntil(this.stop$)).subscribe({next:()=>{this.setBusy(false);this.saved.emit();},error:e=>{this.setBusy(false);this.problem.emit(e?.status===409?'The case or offer changed. Reload before saving.':'The offer could not be confirmed. Check dates, amounts and the selected college, then retry.');}});
  }
  private setBusy(value:boolean){this.busy=value;for(const form of [this.form,this.collegeForm])value?form.disable({emitEvent:false}):form.enable({emitEvent:false});if(this.createdCollegeId&&this.creating)this.collegeForm.disable({emitEvent:false});this.busyChange.emit(value);}
  ngOnDestroy(){if(this.focusTimer)clearTimeout(this.focusTimer);this.stop$.next();this.stop$.complete();}
}
