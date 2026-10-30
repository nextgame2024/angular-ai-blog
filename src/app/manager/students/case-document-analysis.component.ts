import { Component,ElementRef,EventEmitter,Input,Output,ViewChild,OnChanges,OnDestroy,inject,SimpleChanges } from '@angular/core';
import { FormControl,FormGroup,ReactiveFormsModule,Validators } from '@angular/forms';
import { Subject,takeUntil } from 'rxjs';
import { StudentOperationsService } from '../student-operations/student-operations.service';
import type { StudentDocumentAnalysis } from '../student-operations/student-operations.types';
import { ManagerToastComponent } from '../components/shared/manager-toast/manager-toast.component';
import { ManagerListLoaderComponent } from '../components/shared/manager-list-loader/manager-list-loader.component';
import { CaseOfferReviewComponent } from './case-offer-review.component';

@Component({selector:'app-case-document-analysis',imports:[CaseOfferReviewComponent,ReactiveFormsModule,ManagerToastComponent,ManagerListLoaderComponent],
  templateUrl:'./case-document-analysis.component.html',styleUrls:['./case-document-analysis.component.css']})
export class CaseDocumentAnalysisComponent implements OnChanges,OnDestroy {
  @Input() caseId='';@Input() documentId='';@Input() status:string|null=null;@Input() canManage=false;
  @Output() changed=new EventEmitter<void>();
  @Output() caseChanged=new EventEmitter<void>();
  @ViewChild('modal',{static:true}) modal!:ElementRef<HTMLDialogElement>;
  private readonly api=inject(StudentOperationsService);private readonly scope$=new Subject<void>();
  data:StudentDocumentAnalysis|null=null;loading=false;busy=false;failed=false;message='';
  private request:{fingerprint:string;key:string}|null=null;
  readonly form=new FormGroup({name:new FormControl('',{nonNullable:true,validators:[Validators.required,Validators.maxLength(500)]}),
    expiresOn:new FormControl('',{nonNullable:true}),signerName:new FormControl('',{nonNullable:true}),
    expiryVerified:new FormControl(false,{nonNullable:true}),
    reason:new FormControl('',{nonNullable:true,validators:[Validators.maxLength(500)]})});
  get label(){return ({checking:'Checking',passed:'Passed',needs_review:'Needs review',invalid:'Invalid',check_failed:'Check failed'} as Record<string,string>)[this.status??'']??'Not checked';}
  ngOnChanges(changes:SimpleChanges){if(!changes['caseId']&&!changes['documentId'])return;this.scope$.next();this.modal?.nativeElement.close();this.data=null;this.busy=this.loading=false;this.request=null;}
  open(){if(!this.caseId||!this.documentId||!this.canManage||this.busy)return;this.modal.nativeElement.showModal();this.load();}
  close(event?:Event){if(this.busy){event?.preventDefault();return;}this.scope$.next();this.loading=false;this.modal.nativeElement.close();}
  load(){
    if(this.loading||this.busy)return;this.loading=true;this.failed=false;this.message='';this.data=null;this.request=null;
    this.api.documentAnalysis(this.caseId,this.documentId).pipe(takeUntil(this.scope$)).subscribe({next:data=>{
      this.data=data;const identity=data.extraction?.kind!=='letter_of_offer'?data.extraction:null;
      this.form.reset({name:identity?.studentName??'',expiresOn:identity?.expiresOn??'',signerName:identity?.signerName??'',expiryVerified:false,reason:''});this.loading=false;
    },error:()=>{this.loading=false;this.failed=true;this.message='The document check could not be loaded. Try again.';}});
  }
  private key(value:unknown){const fingerprint=JSON.stringify(value);if(this.request?.fingerprint!==fingerprint)this.request={fingerprint,key:crypto.randomUUID()};return this.request!.key;}
  save(decision:'confirmed'|'rejected'){
    const data=this.data;if(!this.canManage||this.busy||this.loading||!data?.resultId||!data.extraction||data.extraction.kind==='letter_of_offer')return;
    if(decision==='confirmed'&&data.currentForType===false)return;
    this.form.markAllAsTouched();
    const fields=this.form.getRawValue();
    if(this.form.controls.reason.invalid||(decision==='confirmed'&&(this.form.controls.name.invalid||!fields.name.trim()||(data.extraction.kind==='passport'&&(!fields.expiresOn||(data.extraction.mrzExpiryMatches===false&&!fields.expiryVerified)))))) {this.message='Enter the student name and verify the expiry date when applicable.';return;}
    const corrections={...data.extraction,studentName:fields.name.trim()};
    if(corrections.kind==='passport'){corrections.expiresOn=fields.expiresOn||null;if(fields.expiryVerified||fields.expiresOn!==data.extraction.expiresOn)corrections.mrzExpiryMatches=null;}
    else corrections.signerName=fields.signerName.trim()||null;
    const value={resultId:data.resultId,expectedReviewVersion:data.reviewVersion,decision,reason:fields.reason.trim()||null,corrections:decision==='rejected'?null:corrections};
    this.busy=true;this.message='';this.form.disable({emitEvent:false});
    this.api.reviewDocumentAnalysis(this.caseId,this.documentId,value,this.key(value)).pipe(takeUntil(this.scope$)).subscribe({next:()=>this.success(),error:e=>this.error(e)});
  }
  retry(){const data=this.data;if(!this.canManage||this.busy||this.loading||!data?.jobId||!data.enabled||data.status!=='check_failed')return;
    this.busy=true;this.api.retryDocumentAnalysis(this.caseId,this.documentId,data.jobId,this.key({jobId:data.jobId})).pipe(takeUntil(this.scope$)).subscribe({next:()=>this.success(),error:e=>this.error(e)});
  }
  start(){if(!this.canManage||this.busy||this.loading||!this.data?.canStart)return;this.busy=true;
    this.api.startDocumentAnalysis(this.caseId,this.documentId,this.key({start:true})).pipe(takeUntil(this.scope$)).subscribe({next:()=>this.success(),error:e=>this.error(e)});
  }
  private success(){this.busy=false;this.request=null;this.form.enable({emitEvent:false});this.modal.nativeElement.close();this.changed.emit();this.caseChanged.emit();}
  offerSaved(){this.success();}
  private error(error:any){this.busy=false;this.form.enable({emitEvent:false});this.message=error?.status===409?'This check changed. Reload before saving.':'The change could not be confirmed. Check the fields and retry, or reload the check.';}
  reasonLabel(reason:string){return ({missing_evidence:'Source evidence needs review.',student_identity_needs_review:'Check that this document belongs to the student.',expiry_unreadable:'Confirm the passport expiry date.',expiry_conflict:'Printed and machine-readable expiry dates disagree.',passport_expired:'The passport has expired.',signature_evidence_needs_review:'Confirm the student signed the completed agreement.'} as Record<string,string>)[reason]??reason;}
  ngOnDestroy(){this.scope$.next();this.scope$.complete();this.modal.nativeElement.close();}
}
