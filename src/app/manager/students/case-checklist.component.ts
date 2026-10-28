import { Component,EventEmitter,HostListener,Input,OnChanges,OnDestroy,Output,inject } from '@angular/core';
import { Subject,takeUntil } from 'rxjs';
import { StudentOperationsService } from '../student-operations/student-operations.service';
import type { StudentCaseChecklist } from '../student-operations/student-operations.types';
import { ManagerToastComponent } from '../components/shared/manager-toast/manager-toast.component';
import { ManagerListLoaderComponent } from '../components/shared/manager-list-loader/manager-list-loader.component';

@Component({
  selector:'app-case-checklist',
  imports:[ManagerToastComponent,ManagerListLoaderComponent],
  templateUrl:'./case-checklist.component.html',styleUrls:['./case-checklist.component.css'],
})
export class CaseChecklistComponent implements OnChanges,OnDestroy {
  @Input() caseId='';
  @Input() status='';
  @Input() canManage=false;
  @Input() disabled=false;
  @Input() refreshToken=0;
  @Output() changed=new EventEmitter<void>();
  @Output() workflowUpdated=new EventEmitter<void>();
  private readonly api=inject(StudentOperationsService);
  private readonly scope$=new Subject<void>();
  private readonly observation$=new Subject<void>();
  private statusTimer:ReturnType<typeof setTimeout>|null=null;
  private progress:StudentCaseChecklist['progress'];
  private observations=0;
  private reloadPending=false;
  private notifyPending=false;
  private requestInFlight=false;
  backgroundPaused=false;
  items:StudentCaseChecklist['items']=[];
  loading=false;busy=false;failed=false;message='';
  tone:'error'|'success'='error';
  private request:{fingerprint:string;key:string}|null=null;
  get complete(){return this.items.filter(i=>i.completed).length;}
  ngOnChanges(changes:import('@angular/core').SimpleChanges){
    if(changes['disabled']){if(this.disabled)this.stopObservation();else this.scheduleObservation();}
    if(changes['refreshToken']&&!changes['caseId']&&!changes['status']){this.load();return;}
    if(!changes['caseId']&&!changes['status'])return;
    this.stopObservation();this.scope$.next();this.progress=undefined;this.observations=0;this.backgroundPaused=false;this.reloadPending=this.notifyPending=this.requestInFlight=false;
    this.busy=this.loading=this.failed=false;this.message='';this.request=null;this.items=[];
    if(!['pre_sale','on_hold'].includes(this.status))return;
    if(this.caseId)this.load();
    else this.items=[
      ['signed_engagement_letter','Signed engagement letter'],['document_completeness','Document completeness'],
      ['invoice_loo_consistency','Invoice/LoO consistency'],['pending_track_status','Pending Track status'],
    ].map(([key,label])=>({key,label,completed:false,recordVersion:0,updatedBy:null,updatedAt:null}));
  }
  load(silent=false,notifyParent=false){
    if(!this.caseId||!['pre_sale','on_hold'].includes(this.status))return;
    if(this.requestInFlight||this.busy){this.reloadPending=true;this.notifyPending||=notifyParent;return;}
    this.stopObservation();if(!silent){this.observations=0;this.backgroundPaused=false;}
    this.loading=!silent;this.requestInFlight=true;this.failed=false;
    this.api.caseChecklist(this.caseId).pipe(takeUntil(this.scope$)).subscribe({
      next:value=>{this.items=value.items;this.progress=value.progress;this.loading=this.requestInFlight=false;
        if(notifyParent)this.workflowUpdated.emit();
        if(this.reloadPending){const notify=this.notifyPending;this.reloadPending=this.notifyPending=false;this.load(true,notify);}
        else this.scheduleObservation();
      },
      error:()=>{this.loading=this.requestInFlight=false;this.failed=true;this.notify('The checklist could not be loaded. Try again.');},
    });
  }
  private stopObservation(){
    if(this.statusTimer!==null)clearTimeout(this.statusTimer);
    this.statusTimer=null;this.observation$.next();
  }
  private scheduleObservation(){
    if(this.statusTimer!==null||!this.progress?.backgroundPending||!this.caseId||this.disabled||this.requestInFlight||this.busy||document.hidden)return;
    if(this.observations>=60){this.backgroundPaused=true;return;}
    this.statusTimer=setTimeout(()=>{
      this.statusTimer=null;this.observations++;
      this.api.caseChecklistProgress(this.caseId).pipe(takeUntil(this.scope$),takeUntil(this.observation$)).subscribe({
        next:progress=>{this.progress=progress;
          if(!progress.backgroundPending)this.load(true,true);
          else this.scheduleObservation();
        },
        error:()=>{this.backgroundPaused=true;this.notify('Saved checklist updates could not be refreshed. Use Refresh status.');},
      });
    },5000);
  }
  @HostListener('document:visibilitychange') visibilityChanged(){
    if(document.hidden)this.stopObservation();else this.scheduleObservation();
  }
  toggle(item:StudentCaseChecklist['items'][number],event:Event){
    // Keep the control at the confirmed server value until the save succeeds.
    (event.target as HTMLInputElement).checked=item.completed;
    if(item.automatic||!this.caseId||!this.canManage||this.disabled||this.busy||this.loading||this.failed||this.status!=='pre_sale')return;
    const value={itemKey:item.key,completed:!item.completed,recordVersion:item.recordVersion};
    const fingerprint=JSON.stringify(value);
    if(this.request?.fingerprint!==fingerprint)this.request={fingerprint,key:crypto.randomUUID()};
    this.stopObservation();this.busy=true;this.message='';
    this.api.updateCaseChecklist(this.caseId,value,this.request!.key).pipe(takeUntil(this.scope$)).subscribe({
      next:result=>{this.items=result.items;this.busy=false;this.request=null;this.notify(this.complete===this.items.length?'Checklist complete.':'Checklist updated.','success');this.changed.emit();
        if(this.reloadPending){const notify=this.notifyPending;this.reloadPending=this.notifyPending=false;this.load(true,notify);}else this.scheduleObservation();
      },
      error:e=>{this.busy=false;
        if(e?.status===409){this.request=null;this.failed=true;this.notify('The case or checklist changed. Reload the checklist before trying again.');}
        else this.notify('The change could not be confirmed. Retry the same checkbox.');
      },
    });
  }
  private notify(message:string,tone:'error'|'success'='error'){this.message=message;this.tone=tone;}
  ngOnDestroy(){this.stopObservation();this.scope$.next();this.scope$.complete();this.observation$.complete();}
}
