import {Component,DestroyRef,Input,OnChanges,inject} from '@angular/core';
import {CurrencyPipe} from '@angular/common';
import {FormsModule,NgForm} from '@angular/forms';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {Subscription} from 'rxjs';
import {StudentOperationsService} from '../student-operations.service';
import type {CommissionClaim,Decision,CommissionCommand} from '../commission-claim.types';
import {ManagerSelectComponent} from '../../components/shared/manager-select/manager-select.component';
import {ManagerToastComponent} from '../../components/shared/manager-toast/manager-toast.component';
import {ManagerListLoaderComponent} from '../../components/shared/manager-list-loader/manager-list-loader.component';

@Component({selector:'app-commission-claim',imports:[FormsModule,CurrencyPipe,ManagerSelectComponent,ManagerToastComponent,ManagerListLoaderComponent],
 styleUrls:['./student-operations-students.page.css'],styles:[`:host{display:block;height:auto;min-width:0;overflow-wrap:anywhere}
 fieldset{min-width:0;border:0;padding:.5rem 0}.btn{min-height:40px}input,textarea{max-width:100%;box-sizing:border-box}
 .ng-invalid.ng-touched{outline:2px solid #b42318}:host-context(html.dark) .ng-invalid.ng-touched{outline-color:#ff9990}`],
 templateUrl:'./commission-claim.component.html'})
export class CommissionClaimComponent implements OnChanges{
 @Input({required:true}) caseId!:string;@Input({required:true}) obligation!:string;@Input() readonly=false;
 private api=inject(StudentOperationsService);private destroy=inject(DestroyRef);private request?:Subscription;
 open=false;loading=false;busy=false;failed=false;data?:CommissionClaim;
 decision:Decision='uncertain';policy='';earnedOn='';selected='';source='';amount='';confirmCreate=false;
 message='';tone:'success'|'error'='success';
 options:{value:string;label:string}[]=[];sources:{value:string;label:string}[]=[];
 decisions=[{value:'uncertain',label:'Awaiting evidence'},{value:'ineligible',label:'Ineligible'},{value:'eligible',label:'Eligible'}];
 private retry?:{payload:string;id:string};
 ngOnChanges(){this.request?.unsubscribe();this.open=this.busy=this.loading=false;this.data=undefined;this.message='';this.clear();}
 clear(){this.confirmCreate=false;this.selected=this.source=this.amount=this.policy=this.earnedOn='';this.decision='uncertain';this.retry=undefined;}
 toggle(){if(this.busy)return;this.open=!this.open;this.request?.unsubscribe();if(this.open)this.load();}
 load(){this.loading=true;this.failed=false;this.clear();this.request=this.api.commissionClaim(this.caseId,this.obligation).pipe(takeUntilDestroyed(this.destroy)).subscribe({
   next:d=>{this.loading=false;this.data=d;this.options=d.candidates.filter(v=>v.verified).map(v=>({value:v.id,label:(v.label||v.id)+' · '+v.status}));
     this.sources=(d.totals?.sources??[]).map(v=>({value:v.kind+'/'+v.id,label:(v.kind==='cash'?'PTY receipt':'College offset')+' · '+v.label+' · AUD '+(v.available/100).toFixed(2)+' · '+v.id}));},
   error:()=>{this.failed=true;this.loading=false;}});
 }
 save(form:NgForm,action:'review'|'link'|'create'|'allocate'){
   if(this.readonly||this.busy||!this.data)return;
   const revision=this.data.history[0]?.revision??0;
   if(form.invalid || (action==='review'&&this.decision==='eligible'&&!this.data.token)){form.form.markAllAsTouched();this.notify('Check the required fields and calculation.','error');return;}
   let body:CommissionCommand;
   if(action==='review')body={revision,requestId:'',decision:this.decision,policy:this.policy.trim(),earnedOn:this.decision==='eligible'?this.earnedOn:null,token:this.data.token};
   else if(action==='allocate'){
     const choice=this.data.totals?.sources.find(v=>v.kind+'/'+v.id===this.source);
     const minor=Math.round(Number(this.amount)*100);
     if(!choice||minor<=0||minor>Math.min(choice.available,this.data.totals!.outstanding)){this.notify('Check the source and allocation amount.','error');return;}
     body={revision,requestId:'',kind:choice.kind,source:choice.id,minor};
   }else{
     if(action==='create'&&!this.confirmCreate || action==='link'&&!this.selected)return;
     body={revision,action,invoiceId:action==='link'?this.selected:null};
   }
   const payload=JSON.stringify(body);
   if('requestId' in body){if(this.retry?.payload!==payload)this.retry={payload,id:crypto.randomUUID()};body.requestId=this.retry.id;}
   this.busy=true;this.request=this.api.commissionCommand(this.caseId,this.obligation,action==='review'||action==='allocate'?action:'invoice',body)
     .pipe(takeUntilDestroyed(this.destroy)).subscribe({next:()=>{this.busy=false;this.notify(action==='create'?'PTY draft created.':'Commission record saved.','success');this.load();},
     error:e=>{this.busy=false;this.confirmCreate=false;this.notify(typeof e.error?.message==='string'?e.error.message:'Could not verify the result. Reload the claim.','error');}});
 }
 notify(message:string,tone:'success'|'error'){this.message=message;this.tone=tone;}
}
