import {Component,DestroyRef,Input,OnChanges,inject} from '@angular/core';
import {FormsModule,NgForm} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {Subscription} from 'rxjs';
import {ManagerSelectComponent} from '../../components/shared/manager-select/manager-select.component';
import {ManagerListLoaderComponent} from '../../components/shared/manager-list-loader/manager-list-loader.component';
import {ManagerToastComponent} from '../../components/shared/manager-toast/manager-toast.component';
import {StudentOperationsService} from '../student-operations.service';
import type {CollegeEvent,CollegeEventInput,CollegeObligationInput,CollegeQueue,CollegeSettlementData,SettlementKind} from '../college-settlement.types';

const newTerms=():CollegeObligationInput=>({collegeId:'',scheduleId:null,instalment:'',policy:'',method:'gross',gross:'',offsetLimit:'0',due:'',funding:null,bill:null});
const newEvent=():CollegeEventInput=>({kind:'direct_proof',proof:null,amount:'',offset:'0',date:'',reference:'',evidence:''});
@Component({selector:'app-college-settlements',imports:[FormsModule,RouterLink,ManagerSelectComponent,ManagerListLoaderComponent,ManagerToastComponent],
  templateUrl:'./college-settlements.component.html',styleUrls:['./student-operations-students.page.css'],
  styles:[`:host{display:block;height:auto;min-width:0;overflow-wrap:anywhere}.form-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,13rem),1fr));gap:.65rem}input,textarea{max-width:100%;box-sizing:border-box}.ng-invalid.ng-touched{outline:2px solid #b42318}:host-context(html.dark) .ng-invalid.ng-touched{outline-color:#ff9990}.btn{min-height:40px}fieldset{min-width:0;border:0;padding:0}`]})
export class CollegeSettlementsComponent implements OnChanges {
  @Input() caseId=''; @Input() readonly=false;
  readonly api=inject(StudentOperationsService);private readonly destroy=inject(DestroyRef);
  private requests=new Subscription();private historyRequest?:Subscription;
  open=false;loading=false;busy=false;failed=false;historyError=false;historyLoading=false;creating=false;editing=false;
  page=1;limit=25;direction:'asc'|'desc'='asc';historyPage=1;more=false;
  data?:CollegeSettlementData;queue?:CollegeQueue;events:CollegeEvent[]=[];
  terms=newTerms();entry=newEvent();proofLabel='';toast='';tone:'success'|'error'='success';
  private retry?:{payload:string;id:string};
  readonly methods=[{value:'gross',label:'Gross remittance'},{value:'net',label:'Net remittance with authorised offset'}];
  readonly limits=[25,50,100].map(n=>({value:String(n),label:String(n)}));
  readonly labels:Record<SettlementKind,string>={direct_proof:'Paid Directly to College · student proof',direct_confirmation:'College confirmation',
    agency_payment:'Agency remittance',applied_refund:'Refund of confirmed cash',unapplied_refund:'Unapplied college refund'};
  readonly kinds=(Object.keys(this.labels) as SettlementKind[]).filter(k=>k!=='direct_confirmation').map(k=>({value:k,label:this.labels[k]}));
  ngOnChanges(){this.reset();this.open=false;this.toast='';}
  private reset(){this.requests.unsubscribe();this.requests=new Subscription();this.historyRequest?.unsubscribe();this.historyLoading=false;
    this.data=this.queue=undefined;this.events=[];this.busy=this.loading=this.failed=this.editing=this.creating=false;this.retry=undefined;this.page=1;this.terms=newTerms();this.entry=newEvent();}
  toggle(){if(this.busy)return;this.open=!this.open;this.reset();if(this.open)this.load(1);}
  load(page:number){
    this.page=page;this.loading=true;this.failed=false;this.editing=this.creating=false;this.events=[];this.historyRequest?.unsubscribe();
    const error=()=>{this.failed=true;this.loading=false;};
    if(!this.caseId)this.requests.add(this.api.collegeQueue(page,this.limit,this.direction).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next:q=>{this.queue=q;this.loading=false;},error}));
    else this.requests.add(this.api.collegeObligations(this.caseId,page).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next:d=>{this.data=d;this.loading=false;if(d.row)this.history(1);},error}));
  }
  history(page:number){const id=this.data?.row?.id;if(!id)return;this.historyRequest?.unsubscribe();
    this.historyPage=page;this.historyLoading=true;this.historyError=false;
    this.historyRequest=this.api.collegeHistory(this.caseId,id,page).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next:r=>{this.events=r.rows;this.more=r.more;this.historyLoading=false;},error:()=>{this.historyError=true;this.historyLoading=false;}});
  }
  startTerms(){this.terms=newTerms();this.terms.collegeId=this.data?.colleges[0]?.value??'';this.creating=true;this.editing=false;}
  startEvent(proof?:CollegeEvent){this.entry=newEvent();this.proofLabel='';this.editing=true;this.creating=false;
    if(proof){this.entry.kind='direct_confirmation';this.entry.proof=proof.id;this.entry.amount=proof.remaining??'';this.proofLabel=proof.reference;}}
  save(form:NgForm){
    if(this.busy || this.readonly)return;
    if(form.invalid){form.form.markAllAsTouched();this.message('Check the highlighted fields.','error');return;}
    const row=this.data?.row;
    const value=this.creating?{...this.terms,offsetLimit:this.terms.method==='gross'?'0':this.terms.offsetLimit,
      scheduleId:this.terms.scheduleId||null,bill:this.terms.bill?.trim()||null,funding:this.terms.funding||null}:
      {...this.entry,offset:this.entry.kind==='agency_payment'?this.entry.offset:'0'};
    const payload=JSON.stringify([this.caseId,this.creating?'create':row?.id,value]);
    if(this.retry?.payload!==payload)this.retry={payload,id:crypto.randomUUID()};
    const id=this.retry.id;
    const request=this.creating?this.api.createCollegeObligation(this.caseId,value as CollegeObligationInput,id):
      this.api.recordCollegeSettlement(this.caseId,row!.id,value as CollegeEventInput,id);
    this.busy=true;
    this.requests.add(request.pipe(takeUntilDestroyed(this.destroy)).subscribe({next:()=>{
      this.busy=false;this.retry=undefined;this.message(this.creating?'College obligation saved.':'Settlement evidence saved.','success');this.load(this.page);
    },error:e=>{this.busy=false;this.message(typeof e.error?.message==='string'?e.error.message:'Could not save. Retry with the same details.','error');}}));
  }
  message(text:string,tone:'success'|'error'){this.toast=text;this.tone=tone;}
  get lastPage(){return Math.max(1,this.caseId?this.data?.total??1:Math.ceil((this.queue?.total??0)/this.limit));}
}
