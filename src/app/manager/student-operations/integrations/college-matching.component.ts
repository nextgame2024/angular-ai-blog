import {A11yModule} from '@angular/cdk/a11y';
import {Component,EventEmitter,Input,Output,OnChanges,OnDestroy,inject} from '@angular/core';
import {PageJumpComponent} from '../../../shared/components/page-jump/page-jump.component';
import {FormControl,FormGroup,Validators,ReactiveFormsModule} from '@angular/forms';
import {Subject,takeUntil} from 'rxjs';
import {StudentOperationsService} from '../student-operations.service';
import type {XeroCollegeMatch,XeroCollegeMatchResult} from '../student-operations.types';
import {ManagerSelectComponent} from '../../components/shared/manager-select/manager-select.component';
import {ManagerToastComponent} from '../../components/shared/manager-toast/manager-toast.component';
import {ManagerListLoaderComponent} from '../../components/shared/manager-list-loader/manager-list-loader.component';

@Component({selector:'app-college-matching',imports:[A11yModule,PageJumpComponent,ReactiveFormsModule,ManagerSelectComponent,ManagerToastComponent,ManagerListLoaderComponent],
  templateUrl:'./college-matching.component.html',styleUrls:['./college-matching.component.css']})
export class CollegeMatchingComponent implements OnChanges,OnDestroy {
  @Input() connectionId='';
  @Output() changed=new EventEmitter<void>();
  readonly pageSize=new FormControl('25',{nonNullable:true});
  readonly pageSizes=[{value:'25',label:'25 per page'},{value:'50',label:'50 per page'},{value:'100',label:'100 per page'}];
  readonly status=new FormControl('unresolved',{nonNullable:true});
  readonly statuses=[{value:'all',label:'All contacts'},{value:'unresolved',label:'Pending match'},{value:'college',label:'College linked'},{value:'supplier',label:'Supplier linked'},{value:'student',label:'Student linked'},{value:'other',label:'Other customer'}];
  readonly scope=new FormControl('sales',{nonNullable:true});
  readonly scopes=[{value:'sales',label:'Active contacts with sales'},{value:'active',label:'All active contacts'},{value:'all',label:'All imported contacts'}];
  readonly kind=new FormControl<'college'|'supplier'|'student'>('college',{nonNullable:true});
  readonly kinds=[{value:'college',label:'College'},{value:'supplier',label:'Supplier'},{value:'student',label:'Student'}];
  readonly student=new FormControl('',{nonNullable:true});
  studentOptions:Array<{value:string;label:string}>=[];
  readonly supplier=new FormControl('',{nonNullable:true});
  readonly creation=new FormGroup({name:new FormControl('',{nonNullable:true,validators:[Validators.required,Validators.maxLength(200)]}),email:new FormControl('',{nonNullable:true,validators:[Validators.email]}),phone:new FormControl('',{nonNullable:true,validators:[Validators.maxLength(50)]}),notes:new FormControl('',{nonNullable:true,validators:[Validators.maxLength(4000)]}),supplierType:new FormControl<'services'|'products'>('services',{nonNullable:true})});
  readonly supplierTypes=[{value:'services',label:'Services'},{value:'products',label:'Products'}];
  supplierOptions:Array<{value:string;label:string}>=[];
  creating=false;createClosed=false;
  private collegesLoaded=false;
  direction:'asc'|'desc'='asc';
  private readonly api=inject(StudentOperationsService);private readonly stop$=new Subject<void>();
  private readonly destroyed$=new Subject<void>();
  constructor(){this.kind.valueChanges.pipe(takeUntil(this.destroyed$)).subscribe(()=>{this.creating=false;this.createClosed=false;this.creation.controls.email.setValidators(this.kind.value==='student'?[Validators.required,Validators.email]:[Validators.email]);this.creation.controls.email.updateValueAndValidity();});this.scope.valueChanges.pipe(takeUntil(this.destroyed$)).subscribe(()=>this.load());this.pageSize.valueChanges.pipe(takeUntil(this.destroyed$)).subscribe(()=>this.load());this.status.valueChanges.pipe(takeUntil(this.destroyed$)).subscribe(()=>this.load());}
  readonly search=new FormControl('',{nonNullable:true});readonly college=new FormControl('',{nonNullable:true});
  data:XeroCollegeMatchResult|null=null;selected:XeroCollegeMatch|null=null;loading=false;busy=false;message='';tone:'success'|'error'='error';
  options:Array<{value:string;label:string}>=[];
  get pages(){return Math.max(1,Math.ceil((this.data?.total??0)/Number(this.pageSize.value)));}
  ngOnChanges(){this.stop$.next();this.data=null;this.options=[];this.collegesLoaded=false;this.selected=null;this.supplierOptions=[];this.studentOptions=[];this.unlock();this.loading=false;this.load();}
  ngOnDestroy(){this.stop$.next();this.stop$.complete();this.destroyed$.next();this.destroyed$.complete();}
  load(page=1){if(!this.connectionId||this.busy)return;this.stop$.next();this.loading=true;
    this.api.xeroCollegeMatches(this.connectionId,{page,limit:Number(this.pageSize.value),q:this.search.value,status:this.status.value,direction:this.direction,scope:this.scope.value,includeColleges:this.collegesLoaded?'false':'true'}).pipe(takeUntil(this.stop$)).subscribe({next:data=>{
      this.data=data;if(data.colleges){this.collegesLoaded=true;this.options=data.colleges.map(c=>({value:c.collegeId,label:[...new Set([c.name,c.tradingName,c.acronym,c.status==='archived'?'Closed / inactive':null].filter((v):v is string=>!!v))].join(' — ')}));}
      if(data.students)this.studentOptions=data.students.map(s=>({value:s.studentUserId,label:[s.name,s.reference,s.email].filter(Boolean).join(' — ')}));
      if(data.suppliers)this.supplierOptions=data.suppliers.map(s=>({value:s.supplierId,label:s.name+(s.status==='archived'?' — Closed / inactive':'')}));
      this.loading=false;if(page>1&&!data.items.length)this.load(Math.max(1,Math.ceil(data.total/Number(this.pageSize.value))));
    },error:()=>{this.loading=false;this.tone='error';this.message='College mappings could not be loaded. Try again.';}});}
  sort(){this.direction=this.direction==='asc'?'desc':'asc';this.load();}
  review(row:XeroCollegeMatch){if(this.busy)return;this.message='';this.selected=row;this.kind.setValue(row.classification==='student'?'student':row.classification==='supplier'?'supplier':'college');this.college.reset(row.collegeId??'');this.supplier.reset(row.supplierId??'');this.student.reset(row.studentUserId??'');this.creating=false;this.createClosed=false;this.creation.reset({name:row.name,email:row.email??'',phone:'',notes:'',supplierType:'services'});}
  close(){if(!this.busy)this.selected=null;}
  startCreate(closed=false){if(this.kind.value==='student'){this.creation.controls.name.setValue(this.creation.controls.name.value.replace(/^(?:[a-z]+\d+\b[\s\-–—]*)+/iu,'').trim());}this.creating=true;this.createClosed=closed;}
  save(classification:'college'|'supplier'|'student'|'other'|'unresolved',create=false){
    if(!this.selected||this.busy)return;
    if(create&&(this.creation.invalid||!this.creation.controls.name.value.trim())){this.creation.markAllAsTouched();this.tone='error';this.message='Enter a name and check the highlighted fields.';return;}
    const target=classification==='student'?this.student:classification==='supplier'?this.supplier:this.college;
    const options=classification==='student'?this.studentOptions:classification==='supplier'?this.supplierOptions:this.options;
    if(!create&&['college','supplier','student'].includes(classification)&&!options.some(c=>c.value===target.value)){target.markAsTouched();this.tone='error';this.message=`Select an available ${classification}.`;return;}
    this.busy=true;this.student.disable({emitEvent:false});this.college.disable({emitEvent:false});this.supplier.disable({emitEvent:false});this.kind.disable({emitEvent:false});this.creation.disable({emitEvent:false});
    const body={classification,collegeId:classification==='college'&&!create?this.college.value:null,expectedRevision:this.selected.revision,
      ...(classification==='student'?{studentUserId:create?null:this.student.value}:{}),
      ...(classification==='supplier'?{supplierId:create?null:this.supplier.value}:{}),
      ...(create?{create:{...this.creation.getRawValue(),closed:this.createClosed}}:{})};
    this.api.resolveXeroCollege(this.connectionId,this.selected.contactId,body).pipe(takeUntil(this.stop$)).subscribe({
      next:()=>{this.unlock();this.close();if(create)this.collegesLoaded=false;this.tone='success';this.message=create?'Record created and contact linked.':'Contact mapping saved.';this.changed.emit();this.load(this.data?.page??1);},
      error:(error)=>{this.unlock();this.tone='error';this.message=error?.status===409?'This contact changed or a record with that name already exists. Cancel and refresh before trying again.':'The mapping could not be saved. Check your details or retry. Your entries have been kept.';}});
  }
  private unlock(){this.busy=false;this.student.enable({emitEvent:false});this.college.enable({emitEvent:false});this.supplier.enable({emitEvent:false});this.kind.enable({emitEvent:false});this.creation.enable({emitEvent:false});}
}
