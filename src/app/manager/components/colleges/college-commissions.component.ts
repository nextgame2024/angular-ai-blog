import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnDestroy, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { PageJumpComponent } from '../../../shared/components/page-jump/page-jump.component';
import { ManagerSelectComponent } from '../shared/manager-select/manager-select.component';
import { ManagerToastComponent } from '../shared/manager-toast/manager-toast.component';
import { ManagerListLoaderComponent } from '../shared/manager-list-loader/manager-list-loader.component';
import { BmCollegeCommissionRule, ManagerCollegesService } from '../../services/manager.colleges.service';

type Sort = 'classification' | 'location' | 'program' | 'commissionBasisPoints';
@Component({
  selector: 'app-college-commissions',
  imports: [CommonModule, ReactiveFormsModule, PageJumpComponent, ManagerSelectComponent, ManagerToastComponent, ManagerListLoaderComponent],
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
  readonly benefitOptions = [{value:'not_recorded',label:'Not recorded'},{value:'not_applicable',label:'Not applicable'},{value:'specified',label:'Specified — see description'}];
  readonly pageSizes = [25,50,100].map(value=>({value:String(value),label:`${value} per page`}));
  readonly pageSize = this.fb.nonNullable.control('25');
  readonly form = this.fb.nonNullable.group({
    classification: [''], location: [''], program: ['',Validators.maxLength(300)],
    percentage: ['', [Validators.required, Validators.pattern(/^(?:\d{1,2}(?:\.\d{1,2})?|100(?:\.0{1,2})?)$/)]],
    cashback_status: ['not_recorded'], cashback_description: ['',Validators.maxLength(2000)],
    cashback_calculation_description: ['',Validators.maxLength(2000)],
    bonus_status: ['not_applicable'], bonus_description: ['',Validators.maxLength(2000)],
    application_conditions: ['',Validators.maxLength(5000)],
  });

  ngOnChanges(): void {
    this.cancelled.next(); this.requestId++; this.rules=[]; this.displayedRules=[];
    this.formOpen=false; this.saving=false; this.page=1; this.message=''; this.load();
  }
  ngOnInit(): void {this.pageSize.valueChanges.pipe(takeUntil(this.destroyed)).subscribe(()=>this.changePageSize());}
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
  isDefault(rule:BmCollegeCommissionRule): boolean {return !rule.classification&&!rule.location&&!rule.program;}
  benefitLabel(status:string): string {return this.benefitOptions.find(o=>o.value===status)?.label||status;}
  open(rule:BmCollegeCommissionRule|null=null): void {
    if(this.saving)return;
    this.editing=rule;this.formOpen=true;
    this.form.reset({classification:rule?.classification||'',location:rule?.location||'',program:rule?.program||'',
      percentage:rule?(rule.commissionBasisPoints/100).toFixed(2):'',cashback_status:rule?.cashbackStatus||'not_recorded',
      cashback_description:rule?.cashbackDescription||'',cashback_calculation_description:rule?.cashbackCalculationDescription||'',
      bonus_status:rule?.bonusStatus||'not_applicable',bonus_description:rule?.bonusDescription||'',application_conditions:rule?.applicationConditions||''});
  }
  save(): void {
    if(this.saving)return;
    for(const benefit of ['cashback','bonus'] as const) {
      const control=this.form.controls[`${benefit}_description`];
      control.setValidators([Validators.maxLength(2000),...(this.form.controls[`${benefit}_status`].value==='specified'?[Validators.required,Validators.pattern(/\S/)]:[])]);
      control.updateValueAndValidity();
    }
    if(this.form.invalid){this.form.markAllAsTouched();this.notify('Enter a commission from 0% to 100% with up to two decimal places and complete the highlighted fields.','error');return;}
    const {percentage,...fields}=this.form.getRawValue();
    const [whole,fraction='']=percentage.split('.');
    const value={...fields,commission_basis_points:Number(whole)*100+Number(fraction.padEnd(2,'0')),
      ...(this.editing?{expected_updated_at:this.editing.updatedAt}:{})};
    this.saving=true;
    const request=this.editing?this.api.updateCommission(this.collegeId,this.editing.ruleId,value):this.api.createCommission(this.collegeId,value);
    request.pipe(takeUntil(this.cancelled)).subscribe({
      next:()=>{this.saving=false;this.formOpen=false;this.notify('Commission rule saved.');this.load();},
      error:err=>{this.saving=false;this.notify(err?.error?.error||'Could not save the rule. Try again.','error');},
    });
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
