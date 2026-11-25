import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnDestroy, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { PageJumpComponent } from '../../../shared/components/page-jump/page-jump.component';
import { ManagerSelectComponent } from '../shared/manager-select/manager-select.component';
import { ManagerToastComponent } from '../shared/manager-toast/manager-toast.component';
import { ManagerListLoaderComponent } from '../shared/manager-list-loader/manager-list-loader.component';
import { ManagerEmptyStateComponent } from '../shared/manager-empty-state/manager-empty-state.component';
import { BmCollegeCommissionRule, ManagerCollegesService } from '../../services/manager.colleges.service';

type Sort = 'classification' | 'location' | 'program' | 'commissionBasisPoints';
@Component({
  selector: 'app-college-commissions',
  imports: [CommonModule, ReactiveFormsModule, PageJumpComponent, ManagerSelectComponent, ManagerToastComponent, ManagerListLoaderComponent, ManagerEmptyStateComponent],
  templateUrl: './college-commissions.component.html',
  styleUrls: ['../clients/manager-clients.page.css','../users/manager-users.page.css','./college-commissions.component.css'],
})
export class CollegeCommissionsComponent implements OnChanges, OnDestroy, OnInit {
  @Input({required:true}) collegeId = '';
  private readonly api = inject(ManagerCollegesService);
  private readonly fb = inject(FormBuilder);
  private readonly cancelled = new Subject<void>();
  private readonly destroyed = new Subject<void>();
  private requestId = 0;
  rules: BmCollegeCommissionRule[] = [];
  displayedRules: BmCollegeCommissionRule[] = [];
  loading = false;
  saving = false;
  loadFailed = false;
  editing: BmCollegeCommissionRule | null = null;
  formOpen = false;
  message = '';
  tone: 'success' | 'error' = 'success';
  page = 1;
  sort: Sort = 'classification';
  direction: 'asc' | 'desc' = 'asc';
  readonly columns: {key: Sort; label: string}[] = [
    {key:'classification',label:'Classification'}, {key:'location',label:'Location'},
    {key:'program',label:'Program'}, {key:'commissionBasisPoints',label:'Commission'},
  ];
  readonly classificationOptions = [{value:'',label:'Any classification'},...['ELICOS','VET','HE'].map(value=>({value,label:value}))];
  readonly locationOptions = [{value:'',label:'Any location'},...['ON-SHORE','OFF-SHORE'].map(value=>({value,label:value}))];
  readonly benefitSources=[{value:'enrolment',label:'Enrolment fee'},{value:'materials',label:'Materials fee'}];
  readonly benefits=this.fb.array<ReturnType<CollegeCommissionsComponent['benefitForm']>>([]);
  private benefitForm(b?:import('../../student-operations/student-commission.types').CommissionBenefit){return this.fb.nonNullable.group({source:[b?.source??'materials'],percentage:[String((b?.percentageBasisPoints??10000)/100),[Validators.required,Validators.min(0.01),Validators.max(100),Validators.pattern(/^\d+(?:\.\d{1,2})?$/)]],gstInclusive:[b?.gstInclusive??true],itemCode:[b?.itemCode??'',[Validators.required,Validators.maxLength(100)]],saleName:[b?.saleName??'',[Validators.required,Validators.maxLength(100)]],advisorName:[b?.advisorName??'',[Validators.maxLength(200)]]});}
  addBenefit(){if(this.benefits.length<2)this.benefits.push(this.benefitForm());}
  readonly methodOptions=[{value:'percentage',label:'Net tuition percentage'},{value:'gross_percentage',label:'Gross percentage ÷ 1.10'},{value:'trimester',label:'Trimester: 20% / 15% / 0%'},{value:'first_month',label:'First month / later months'}];
  readonly cashbackModes=[{value:'none',label:'No cashback'},{value:'enrolment_gross',label:'Enrolment fee ÷ 1.10'},{value:'fixed_net',label:'Fixed net per enrolment fee line'}];
  get usesConfiguration(){return !this.editing||!!this.editing.configuration;}
  get blockedConfiguration(){return this.editing?.configuration?.state==='blocked';}
  readonly benefitOptions = [{value:'not_recorded',label:'Not recorded'},{value:'not_applicable',label:'Not applicable'},{value:'specified',label:'Specified'}];
  readonly pageSizes = [25,50,100].map(value=>({value:String(value),label:`${value} per page`}));
  readonly pageSize = this.fb.nonNullable.control('25');
  readonly form = this.fb.nonNullable.group({
    city:[''],effectiveFrom:[''],effectiveTo:[''],method:['percentage'],laterPercentage:[''],nonBulkOnly:[false],cashbackMode:['none'],
    classification: [''], location: [''], program: ['',Validators.maxLength(300)],
    percentage: ['', [Validators.required, Validators.pattern(/^(?:\d{1,2}(?:\.\d{1,2})?|100(?:\.0{1,2})?)$/)]],
    cashback_status: ['not_recorded'], cashback_description: ['',Validators.maxLength(2000)],
    cashback_calculation: ['',Validators.pattern(/^\d{1,12}(?:\.\d{1,2})?$/)],
    bonus_amount: ['',Validators.pattern(/^\d{1,12}(?:\.\d{1,2})?$/)],
    bonus_status: ['not_applicable'], bonus_description: ['',Validators.maxLength(2000)],
    application_conditions: ['',Validators.maxLength(5000)],
  });

  ngOnChanges(): void {
    this.cancelled.next(); this.requestId++; this.rules=[]; this.displayedRules=[];
    this.formOpen=false; this.saving=false; this.page=1; this.message=''; this.load();
  }
  ngOnInit(): void {
    this.pageSize.valueChanges.pipe(takeUntil(this.destroyed)).subscribe(()=>this.changePageSize());
    for (const benefit of ['cashback','bonus'] as const) {
      const field=benefit==='cashback'?'cashback_calculation':'bonus_amount';
      this.form.controls[`${benefit}_status`].valueChanges.pipe(takeUntil(this.destroyed)).subscribe(status=>{
        if(status!=='specified') this.form.controls[field].setValue('');
      });
    }
  }
  ngOnDestroy(): void { this.cancelled.next(); this.cancelled.complete(); this.destroyed.next(); this.destroyed.complete(); }
  get limit(): number { return Number(this.pageSize.value); }
  get totalPages(): number { return Math.max(1,Math.ceil(this.rules.length/this.limit)); }
  get start(): number { return this.rules.length?(this.page-1)*this.limit+1:0; }
  get end(): number { return Math.min(this.page*this.limit,this.rules.length); }
  get hasData(): boolean { return this.rules.length>0; }
  load(): void {
    if(!this.collegeId) return;
    const request=++this.requestId;
    this.loading=true; this.loadFailed=false;
    this.api.commissions(this.collegeId).pipe(takeUntil(this.cancelled)).subscribe({
      next:({rules})=>{if(request!==this.requestId)return;this.rules=rules;this.loading=false;this.updatePage();},
      error:err=>{if(request!==this.requestId)return;this.loading=false;this.loadFailed=true;this.notify(err?.error?.error||'Could not load commission rules. Try again.','error');},
    });
  }
  updatePage(): void {
    this.page=Math.min(this.page,this.totalPages);
    const sign=this.direction==='asc'?1:-1, column=this.sort;
    this.displayedRules=[...this.rules].sort((a,b)=>{
      const x=a[column], y=b[column];
      const comparison=typeof x==='number'&&typeof y==='number'?x-y:String(x||'Any').localeCompare(String(y||'Any'),'en-AU',{sensitivity:'base'});
      return comparison*sign||a.ruleId.localeCompare(b.ruleId);
    }).slice((this.page-1)*this.limit,this.page*this.limit);
  }
  changePageSize(): void {this.page=1;this.updatePage();}
  goToPage(page:number): void {if(page>=1&&page<=this.totalPages&&!this.loading){this.page=page;this.updatePage();}}
  sortBy(column:Sort): void {this.direction=this.sort===column&&this.direction==='asc'?'desc':'asc';this.sort=column;this.page=1;this.updatePage();}
  sortAria(column:Sort): string {return this.sort===column?(this.direction==='asc'?'ascending':'descending'):'none';}
  rate(rule:BmCollegeCommissionRule): string {return `${(rule.commissionBasisPoints/100).toFixed(2)}%`;}
  isDefault(rule:BmCollegeCommissionRule): boolean {return !rule.classification&&!rule.location&&!rule.program&&!rule.configuration?.city&&!rule.configuration?.effectiveFrom&&!rule.configuration?.effectiveTo;}
  exactRate(rule:BmCollegeCommissionRule){const c=rule.configuration;return c?`${c.rateNumerator} / ${c.rateDenominator}`:this.rate(rule);}
  benefitLabel(status:string): string {return this.benefitOptions.find(o=>o.value===status)?.label||status;}
  open(rule:BmCollegeCommissionRule|null=null): void {
    if(this.saving)return;
    this.editing=rule;this.formOpen=true;this.benefits.clear();for(const b of rule?.configuration?.benefits??[])this.benefits.push(this.benefitForm(b));
    const c=rule?.configuration,gross=!!c&&c.rateMethod==='fixed'&&c.rateDenominator%11===0;
    this.form.reset({city:c?.city??'',effectiveFrom:c?.effectiveFrom??'',effectiveTo:c?.effectiveTo??'',method:c?.rateMethod==='trimester'?'trimester':c?.rateMethod==='first_month'?'first_month':gross?'gross_percentage':'percentage',laterPercentage:c?(c.laterRateNumerator*100/c.rateDenominator).toFixed(2):'',nonBulkOnly:c?.nonBulkOnly??false,cashbackMode:c?.cashback.mode??'none',classification:rule?.classification||'',location:rule?.location||'',program:rule?.program||'',
      percentage:c?(c.rateNumerator*(gross?110:100)/c.rateDenominator).toFixed(2):rule?(rule.commissionBasisPoints/100).toFixed(2):'',cashback_status:rule?.cashbackStatus||'not_recorded',
      cashback_description:rule?.cashbackDescription||'',cashback_calculation:c?.cashback.mode==='fixed_net'?(c.cashback.amountMinor/100).toFixed(2):rule?.cashbackCalculation??'',bonus_amount:rule?.bonusAmount??'',
      bonus_status:rule?.bonusStatus||'not_applicable',bonus_description:rule?.bonusDescription||'',application_conditions:rule?.applicationConditions||''});
  }
  save(): void {
    if(this.saving)return;
    if(this.usesConfiguration){this.form.controls.cashback_status.setValue(this.form.controls.cashbackMode.value==='none'?'not_applicable':'specified',{emitEvent:false});this.form.controls.bonus_status.setValue('not_applicable',{emitEvent:false});}
    for(const benefit of ['cashback','bonus'] as const) {
      const control=this.form.controls[benefit==='cashback'?'cashback_calculation':'bonus_amount'];
      control.setValidators([Validators.pattern(/^\d{1,12}(?:\.\d{1,2})?$/),...((this.usesConfiguration?benefit==='cashback'&&this.form.controls.cashbackMode.value==='fixed_net':this.form.controls[`${benefit}_status`].value==='specified')?[Validators.required]:[])]);
      control.updateValueAndValidity();
    }
    if(this.form.invalid||this.benefits.invalid){this.benefits.markAllAsTouched();this.form.markAllAsTouched();this.notify('Enter a commission from 0% to 100% with up to two decimal places and complete the highlighted fields.','error');return;}
    const benefitValues=this.benefits.getRawValue().map(b=>({source:b.source,percentageBasisPoints:Math.round(Number(b.percentage)*100),gstInclusive:b.gstInclusive,itemCode:b.itemCode.trim(),saleName:b.saleName.trim(),advisorName:b.advisorName.trim()||null}));
    if(new Set(benefitValues.map(b=>b.source)).size!==benefitValues.length||this.form.controls.cashbackMode.value!=='none'&&benefitValues.some(b=>b.source==='enrolment')){this.notify('Use only one calculation for each source fee.','error');return;}
    const {percentage,cashback_calculation,bonus_amount,city,effectiveFrom,effectiveTo,method,laterPercentage,nonBulkOnly,cashbackMode,...fields}=this.form.getRawValue();
    const [whole,fraction='']=percentage.split('.');
    const value={...fields,commission_basis_points:Number(whole)*100+Number(fraction.padEnd(2,'0')),
      cashback_calculation:this.decimalValue(cashback_calculation),bonus_amount:this.decimalValue(bonus_amount),
      cashback_calculation_description:this.editing?.cashbackCalculationDescription??null,
      ...(this.editing?{expected_updated_at:this.editing.updatedAt}:{})};
    if(this.usesConfiguration){
      const numerator=method==='trimester'?2000:Number(whole)*100+Number(fraction.padEnd(2,'0')),denominator=method==='gross_percentage'?11000:10000;
      const later=method==='first_month'&&/^(?:\d{1,2}(?:\.\d{1,2})?|100(?:\.0{1,2})?)$/.test(laterPercentage)?Math.round(Number(laterPercentage)*100):method==='first_month'?NaN:0;
      if(!Number.isSafeInteger(later)||later<0||later>10000||effectiveFrom&&effectiveTo&&effectiveFrom>effectiveTo){this.form.markAllAsTouched();this.notify('Check the later-month percentage and enrolment date range.','error');return;}
      Object.assign(value,{commission_basis_points:Math.round(numerator*10000/denominator),configuration:{benefits:benefitValues,version:2,state:'ready',blockedReason:null,city:city.trim()||null,effectiveFrom:effectiveFrom||null,effectiveTo:effectiveTo||null,dateBasis:effectiveFrom||effectiveTo?'enrolment_date':null,rateNumerator:numerator,rateDenominator:denominator,rateMethod:method==='trimester'?'trimester':method==='first_month'?'first_month':'fixed',laterRateNumerator:later,nonBulkOnly,cashback:{mode:cashbackMode,amountMinor:cashbackMode==='fixed_net'?Math.round(Number(cashback_calculation)*100):0}},cashback_calculation:null,bonus_amount:null});
    }
    this.saving=true;
    const request=this.editing?this.api.updateCommission(this.collegeId,this.editing.ruleId,value):this.api.createCommission(this.collegeId,value);
    request.pipe(takeUntil(this.cancelled)).subscribe({
      next:()=>{this.saving=false;this.formOpen=false;this.notify('Commission rule saved.');this.load();},
      error:err=>{this.saving=false;this.notify(err?.error?.error||'Could not save the rule. Try again.','error');},
    });
  }
  private decimalValue(value: string | number | null): string | null {
    if(value===''||value==null)return null;
    const [whole,fraction='']=String(value).split('.');
    return `${whole}.${fraction.padEnd(2,'0')}`;
  }
  formatBenefit(field:'cashback_calculation'|'bonus_amount'): void {
    const control=this.form.controls[field];
    if(control.value!==''&&control.valid)control.setValue(this.decimalValue(control.value)!);
  }
  archive(rule:BmCollegeCommissionRule): void {
    if(this.saving||!confirm(`Archive the ${this.rate(rule)} commission rule?`))return;
    this.saving=true;
    this.api.archiveCommission(this.collegeId,rule).pipe(takeUntil(this.cancelled)).subscribe({
      next:()=>{this.saving=false;this.notify('Commission rule archived.');this.load();},
      error:err=>{this.saving=false;this.notify(err?.error?.error||'Could not archive the rule. Try again.','error');},
    });
  }
  private notify(message:string,tone:'success'|'error'='success'): void {this.message=message;this.tone=tone;}
}
