import {Component,EventEmitter,Input,Output,OnChanges,OnDestroy,inject} from '@angular/core';
import {PageJumpComponent} from '../../../shared/components/page-jump/page-jump.component';
import {FormControl,ReactiveFormsModule} from '@angular/forms';
import {Subject,takeUntil} from 'rxjs';
import {StudentOperationsService} from '../student-operations.service';
import type {XeroCollegeMatch,XeroCollegeMatchResult} from '../student-operations.types';
import {ManagerSelectComponent} from '../../components/shared/manager-select/manager-select.component';
import {ManagerToastComponent} from '../../components/shared/manager-toast/manager-toast.component';
import {ManagerListLoaderComponent} from '../../components/shared/manager-list-loader/manager-list-loader.component';

@Component({selector:'app-college-matching',imports:[PageJumpComponent,ReactiveFormsModule,ManagerSelectComponent,ManagerToastComponent,ManagerListLoaderComponent],
  templateUrl:'./college-matching.component.html',styleUrls:['./college-matching.component.css']})
export class CollegeMatchingComponent implements OnChanges,OnDestroy {
  @Input() connectionId='';
  @Output() changed=new EventEmitter<void>();
  readonly pageSize=new FormControl('25',{nonNullable:true});
  readonly pageSizes=[{value:'25',label:'25 per page'},{value:'50',label:'50 per page'},{value:'100',label:'100 per page'}];
  readonly status=new FormControl('all',{nonNullable:true});
  readonly statuses=[{value:'all',label:'All contacts'},{value:'unresolved',label:'Unresolved'},{value:'college',label:'College linked'},{value:'other',label:'Other customer'}];
  direction:'asc'|'desc'='asc';
  private readonly api=inject(StudentOperationsService);private readonly stop$=new Subject<void>();
  private readonly destroyed$=new Subject<void>();
  constructor(){this.pageSize.valueChanges.pipe(takeUntil(this.destroyed$)).subscribe(()=>this.load());this.status.valueChanges.pipe(takeUntil(this.destroyed$)).subscribe(()=>this.load());}
  readonly search=new FormControl('',{nonNullable:true});readonly college=new FormControl('',{nonNullable:true});
  data:XeroCollegeMatchResult|null=null;selected:XeroCollegeMatch|null=null;loading=false;busy=false;message='';tone:'success'|'error'='error';
  options:Array<{value:string;label:string}>=[];
  get pages(){return Math.max(1,Math.ceil((this.data?.total??0)/Number(this.pageSize.value)));}
  ngOnChanges(){this.stop$.next();this.data=null;this.options=[];this.selected=null;this.college.enable({emitEvent:false});this.busy=this.loading=false;this.load();}
  ngOnDestroy(){this.stop$.next();this.stop$.complete();this.destroyed$.next();this.destroyed$.complete();}
  load(page=1){if(!this.connectionId||this.busy)return;this.stop$.next();this.loading=true;
    this.api.xeroCollegeMatches(this.connectionId,{page,limit:Number(this.pageSize.value),q:this.search.value,status:this.status.value,direction:this.direction}).pipe(takeUntil(this.stop$)).subscribe({next:data=>{
      this.data=data;this.options=data.colleges.map(c=>({value:c.collegeId,label:[...new Set([c.name,c.tradingName,c.acronym].filter((v):v is string=>!!v))].join(' — ')}));
      this.loading=false;if(page>1&&!data.items.length)this.load(1);
    },error:()=>{this.loading=false;this.tone='error';this.message='College mappings could not be loaded. Try again.';}});}
  sort(){this.direction=this.direction==='asc'?'desc':'asc';this.load();}
  review(row:XeroCollegeMatch){if(this.busy)return;this.selected=row;this.college.setValue(row.collegeId??'');}
  save(classification:'college'|'other'|'unresolved'){
    if(!this.selected||this.busy)return;
    if(classification==='college'&&!this.options.some(c=>c.value===this.college.value)){this.college.markAsTouched();this.tone='error';this.message='Select an available college.';return;}
    this.busy=true;this.college.disable({emitEvent:false});
    this.api.resolveXeroCollege(this.connectionId,this.selected.contactId,{classification,collegeId:classification==='college'?this.college.value:null,expectedRevision:this.selected.revision}).pipe(takeUntil(this.stop$)).subscribe({
      next:()=>{this.busy=false;this.college.enable({emitEvent:false});this.selected=null;this.tone='success';this.message='Contact mapping saved.';this.changed.emit();this.load(this.data?.page??1);},
      error:()=>{this.busy=false;this.college.enable({emitEvent:false});this.tone='error';this.message='The mapping could not be saved. Reload if another user has changed it.';}});
  }
}
