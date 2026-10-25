import { Component,ElementRef,EventEmitter,Input,Output,ViewChild,OnDestroy,OnChanges,inject } from '@angular/core';
import { FormControl,FormGroup,FormsModule,ReactiveFormsModule,Validators } from '@angular/forms';
import { Subject,takeUntil,forkJoin,of } from 'rxjs';
import { StudentOperationsService } from '../student-operations/student-operations.service';
import type { StudentDocumentType } from '../student-operations/student-operations.types';
import { ManagerSelectComponent } from '../components/shared/manager-select/manager-select.component';
import { ManagerToastComponent } from '../components/shared/manager-toast/manager-toast.component';
import { ManagerListLoaderComponent } from '../components/shared/manager-list-loader/manager-list-loader.component';
import { PageJumpComponent } from '../../shared/components/page-jump/page-jump.component';

@Component({
  selector:'app-case-document-actions',
  imports:[FormsModule,ReactiveFormsModule,ManagerSelectComponent,ManagerToastComponent,ManagerListLoaderComponent,PageJumpComponent],
  templateUrl:'./case-document-actions.component.html',styleUrls:['./case-document-actions.component.css'],
})
export class CaseDocumentActionsComponent implements OnChanges,OnDestroy {
  @Input() caseId='';
  @Input() canManage=false;
  @Output() changed=new EventEmitter<void>();
  @ViewChild('modal',{static:true}) modal!:ElementRef<HTMLDialogElement>;
  @ViewChild('fileInput') fileInput?:ElementRef<HTMLInputElement>;
  private readonly api=inject(StudentOperationsService);
  private readonly scope$=new Subject<void>();
  mode:'types'|'upload'='types';
  isOpen=false;
  types:StudentDocumentType[]=[];
  private busyValue=false; private loadingValue=false; private failedValue=false;
  get busy(){return this.busyValue;} set busy(value:boolean){this.busyValue=value;this.syncFormState();}
  get loading(){return this.loadingValue;} set loading(value:boolean){this.loadingValue=value;this.syncFormState();}
  get failed(){return this.failedValue;} set failed(value:boolean){this.failedValue=value;this.syncFormState();}
  editingType:StudentDocumentType|null=null;
  storageAvailable=false;
  uploadEnabled=false;
  lockedTypeId:string|null=null;
  file:File|null=null; fileTouched=false; page=1; pageSize=25; descending=false;
  message=''; tone:'error'|'success'='error';
  private request:{fingerprint:string;key:string}|null=null;
  uploadElapsed=0;
  private uploadTimer:ReturnType<typeof setInterval>|null=null;
  get uploadMessage(){return this.uploadElapsed>=10?'Still saving your document securely. Storage preparation can take a little longer.':'Preparing secure storage and uploading your document…';}
  private stopUploadTimer(){if(this.uploadTimer)clearInterval(this.uploadTimer);this.uploadTimer=null;}
  readonly typeForm=new FormGroup({name:new FormControl('',{nonNullable:true,validators:[Validators.required,Validators.maxLength(120)]}),required:new FormControl('no',{nonNullable:true})});
  readonly uploadForm=new FormGroup({documentTypeId:new FormControl('',{nonNullable:true,validators:[Validators.required]})});
  readonly yesNo=[{value:'no',label:'No'},{value:'yes',label:'Yes'}];
  readonly sizes=[{value:'25',label:'25 per page'},{value:'50',label:'50 per page'},{value:'100',label:'100 per page'}];
  get typeOptions(){return this.types.map(t=>({value:t.documentTypeId,label:t.name}));}
  private syncFormState(){if(!this.typeForm || !this.uploadForm)return;for(const form of [this.typeForm,this.uploadForm]){if(this.busy || this.loading || this.failed)form.disable({emitEvent:false});else form.enable({emitEvent:false});}if(this.lockedTypeId)this.uploadForm.controls.documentTypeId.disable({emitEvent:false});}
  get pages(){return Math.max(1,Math.ceil(this.types.length/this.pageSize));}
  get pageStart(){return this.types.length ? (this.page-1)*this.pageSize+1 : 0;}
  get pageEnd(){return Math.min(this.page*this.pageSize,this.types.length);}
  get visibleTypes(){return [...this.types].sort((a,b)=>(a.name.localeCompare(b.name)||a.documentTypeId.localeCompare(b.documentTypeId))*(this.descending?-1:1)).slice((this.page-1)*this.pageSize,this.page*this.pageSize);}
  ngOnChanges(){this.stopUploadTimer();this.scope$.next();this.busy=this.loading=false;this.modal?.nativeElement.close();this.isOpen=false;this.request=null;}
  ngOnDestroy(){this.stopUploadTimer();this.scope$.next();this.scope$.complete();this.modal.nativeElement.close();}
  open(mode:'types'|'upload',typeId?:string) {
    if(!this.canManage || !this.caseId || this.busy) return;
    this.lockedTypeId=mode==='upload'&&typeId?typeId:null;
    this.mode=mode;this.message='';this.page=1;this.file=null;this.fileTouched=false;this.cancelTypeEdit();this.uploadForm.reset({documentTypeId:this.lockedTypeId??''});this.request=null;this.storageAvailable=false;this.uploadEnabled=false;
    if(this.fileInput) this.fileInput.nativeElement.value='';
    this.isOpen=true;this.modal.nativeElement.showModal();this.loadTypes();
  }
  close(event?:Event){if(this.busy){event?.preventDefault();return;}this.modal.nativeElement.close();this.isOpen=false;}
  loadTypes(){
    if(this.loading || this.busy) return;
    this.loading=true;this.failed=false;
    forkJoin({types:this.api.documentTypes(),options:this.mode==='upload'?this.api.caseDocumentUploadOptions(this.caseId):of(null)}).pipe(takeUntil(this.scope$)).subscribe({next:r=>{this.types=r.types.types;if(r.options){this.storageAvailable=r.options.available;this.uploadEnabled=r.options.enabled;}this.page=Math.min(this.page,this.pages);this.loading=false;if(this.lockedTypeId&&!this.types.some(t=>t.documentTypeId===this.lockedTypeId)){this.failed=true;this.notify('This document type is no longer available. Refresh the documents list.');}},error:()=>{this.loading=false;this.failed=true;this.notify('Document options could not be loaded. Retry.');}});
  }
  edit(type:StudentDocumentType){if(this.busy)return;this.editingType=type;this.typeForm.reset({name:type.name,required:type.required?'yes':'no'});this.modal.nativeElement.querySelector<HTMLInputElement>('[formControlName="name"]')?.focus();}
  cancelTypeEdit(){this.editingType=null;this.typeForm.reset({name:'',required:'no'});}
  private key(value:unknown){const fingerprint=JSON.stringify(value);if(this.request?.fingerprint!==fingerprint)this.request={fingerprint,key:crypto.randomUUID()};return this.request!.key;}
  saveType(){
    if(!this.canManage || this.busy || this.loading || this.failed) return;
    const name=this.typeForm.controls.name.value.trim().replace(/\s+/g,' ');
    if(this.typeForm.invalid || !name){this.typeForm.markAllAsTouched();this.notify('Enter a document type name.');return;}
    if(this.types.some(t=>t.documentTypeId!==this.editingType?.documentTypeId && t.name.toLocaleLowerCase()===name.toLocaleLowerCase())){this.typeForm.controls.name.setErrors({duplicate:true});this.typeForm.controls.name.markAsTouched();this.notify('An active document type with that name already exists.');return;}
    const value={name,required:this.typeForm.controls.required.value==='yes'};
    const edit=this.editingType;
    const key=this.key({action:'save',id:edit?.documentTypeId,version:edit?.recordVersion,...value});
    const call=edit?this.api.updateDocumentType(edit.documentTypeId,{...value,recordVersion:edit.recordVersion},key):this.api.createDocumentType(value,key);
    this.busy=true;
    call.pipe(takeUntil(this.scope$)).subscribe({next:r=>{this.types=[...this.types.filter(t=>t.documentTypeId!==r.documentTypeId),r];this.busy=false;this.request=null;this.cancelTypeEdit();this.notify(edit?'Document type updated.':'Document type added.','success');this.changed.emit();},error:e=>{this.busy=false;this.notify(e?.status===409?'The type already exists or changed. Reload the list and review the name.':'The document type could not be saved. Try again.');}});
  }
  archive(type:StudentDocumentType){
    if(!this.canManage || this.busy)return;
    this.busy=true;
    this.api.updateDocumentType(type.documentTypeId,{status:'archived',recordVersion:type.recordVersion},this.key({action:'archive',id:type.documentTypeId,version:type.recordVersion})).pipe(takeUntil(this.scope$)).subscribe({next:()=>{this.types=this.types.filter(t=>t.documentTypeId!==type.documentTypeId);this.page=Math.min(this.page,this.pages);if(this.editingType?.documentTypeId===type.documentTypeId)this.cancelTypeEdit();this.busy=false;this.request=null;this.notify('Document type archived. Existing documents are unchanged.','success');this.changed.emit();},error:()=>{this.busy=false;this.notify('The type could not be archived. Reload the list and try again.');}});
  }
  selectFile(event:Event){this.file=(event.target as HTMLInputElement).files?.[0]??null;this.fileTouched=true;this.request=null;}
  upload(){
    if(!this.canManage || !this.caseId || this.busy || this.loading || this.failed || !this.uploadEnabled || !this.storageAvailable)return;
    const file=this.file,typeId=this.lockedTypeId??this.uploadForm.controls.documentTypeId.value;this.fileTouched=true;this.uploadForm.markAllAsTouched();
    if(!file || !file.size || file.size>10*1024*1024 || !/\.(pdf|jpe?g|png)$/i.test(file.name) || !this.types.some(t=>t.documentTypeId===typeId)) {this.notify('Choose a document type and a PDF, JPEG or PNG file up to 10 MB.');return;}
    this.busy=true;
    this.uploadElapsed=0;this.stopUploadTimer();this.uploadTimer=setInterval(()=>this.uploadElapsed++,1000);
    this.api.uploadCaseDocument(this.caseId,file,typeId,this.key({action:'upload',caseId:this.caseId,typeId,name:file.name,size:file.size,lastModified:file.lastModified})).pipe(takeUntil(this.scope$)).subscribe({next:()=>{this.stopUploadTimer();this.busy=false;this.request=null;this.file=null;if(this.fileInput)this.fileInput.nativeElement.value='';this.uploadForm.controls.documentTypeId.reset(this.lockedTypeId??'');this.fileTouched=false;this.close();this.notify('Document uploaded.','success');this.changed.emit();},error:e=>{this.stopUploadTimer();this.busy=false;this.notify(this.uploadError(e));}});
  }
  private uploadError(e:any):string {
    const code=e?.error?.errorCode;
    if(code==='student_document_storage_pending')return 'Additional document storage is being prepared. Wait two minutes, then retry this same file.';
    if(code==='student_document_storage_review_required')return 'This document needs administrator review before it can be uploaded again.';
    if(code==='student_document_storage_full')return 'Document storage is full. Contact your administrator before uploading more files.';
    if(e?.status===413)return 'The file is too large. Maximum size is 10 MB.';
    if(['xero_attachment_write_scope_missing','xero_contact_write_scope_missing','student_document_setup_required'].includes(code))return 'An administrator must enable document storage in company integrations.';
    if(code==='xero_rate_limited')return 'Document storage is temporarily busy. Wait, then retry this same file.';
    return e?.status===409?'The upload is processing or its details changed. Wait two minutes, then retry the same file; reload types if needed.':'The upload could not be confirmed. Wait two minutes and retry this same file.';
  }
  notify(message:string,tone:'error'|'success'='error'){this.message=message;this.tone=tone;}
  changePage(value:number){if(this.busy || this.loading || this.failed || !Number.isSafeInteger(value))return;this.page=Math.max(1,Math.min(this.pages,value));}
  setSize(value:string|null){if(this.busy || this.loading || this.failed)return;const size=Number(value);this.pageSize=[25,50,100].includes(size)?size:25;this.page=1;}
}
