import {A11yModule} from '@angular/cdk/a11y';
import {Component,Input,Output,EventEmitter,OnChanges,OnDestroy,inject} from '@angular/core';
import {FormControl,ReactiveFormsModule} from '@angular/forms';
import {Subject,takeUntil} from 'rxjs';
import {StudentOperationsService} from '../student-operations.service';
import type {InvoiceStudentOption,XeroStudentInvoice} from '../student-operations.types';
import {ManagerSelectComponent} from '../../components/shared/manager-select/manager-select.component';
import {ManagerToastComponent} from '../../components/shared/manager-toast/manager-toast.component';
import {ManagerListLoaderComponent} from '../../components/shared/manager-list-loader/manager-list-loader.component';

@Component({selector:'app-invoice-student-link',imports:[A11yModule,ReactiveFormsModule,ManagerSelectComponent,ManagerToastComponent,ManagerListLoaderComponent],styleUrls:['../integrations/college-matching.component.css'],template:`
<div class="review-backdrop" (click)="close()"><div class="review-modal" role="dialog" aria-modal="true" aria-labelledby="invoice-student-title" tabindex="-1" cdkTrapFocus [cdkTrapFocusAutoCapture]="true" (click)="$event.stopPropagation()" (keydown.escape)="close()">
<header><h2 id="invoice-student-title">Link invoice to student</h2><button class="btn" (click)="close()" [disabled]="busy" aria-label="Close student linking">✕</button></header>
<div class="review-body">
@if(message){<app-manager-toast [message]="message" tone="error" (closed)="message=''" />}
<dl class="contact-details"><div><dt>Invoice</dt><dd>{{invoice.invoiceNumber||invoice.xeroInvoiceId}}</dd></div><div><dt>Reference</dt><dd>{{invoice.reference||'Not provided'}}</dd></div><div><dt>Recipient</dt><dd>{{invoice.contactName||'Not provided'}}</dd></div><div><dt>College</dt><dd>{{invoice.collegeName||'Not linked'}}</dd></div></dl>
@if(loading){<app-manager-list-loader label="Loading students…" />}
<label class="field">Student *<app-manager-select [formControl]="student" [options]="options" [searchable]="true" placeholder="Search by name, email or student reference" ariaLabel="Student" /></label>
@if(caseOptions.length>1){<label class="field">Student case *<app-manager-select [formControl]="studentCase" [options]="caseOptions" [searchable]="true" ariaLabel="Student case" placeholder="Select the case for this invoice" /></label>}
<p>The college or supplier recipient stays unchanged. If the student has no case, an imported case will be created for a sales invoice; other transaction types need an existing case.</p>
</div><footer class="actions"><button class="btn primary" (click)="save()" [disabled]="busy||loading||!student.value">{{busy?'Linking…':'Link student'}}</button><button class="btn" (click)="close()" [disabled]="busy">Cancel</button></footer>
</div></div>`})
export class InvoiceStudentLinkComponent implements OnChanges,OnDestroy {
 @Input({required:true}) connectionId='';@Input({required:true}) invoice!:XeroStudentInvoice;
 @Output() closed=new EventEmitter<void>();@Output() linked=new EventEmitter<void>();
 readonly student=new FormControl('',{nonNullable:true});readonly studentCase=new FormControl('',{nonNullable:true});
 private api=inject(StudentOperationsService);private stop$=new Subject<void>();private destroyed$=new Subject<void>();
 students:InvoiceStudentOption[]=[];options:Array<{value:string;label:string}>=[];caseOptions:Array<{value:string;label:string}>=[];loading=false;busy=false;message='';
 constructor(){this.student.valueChanges.pipe(takeUntil(this.destroyed$)).subscribe(()=>{this.studentCase.reset('');this.updateCaseOptions();});}
 private updateCaseOptions(){this.caseOptions=(this.students.find(s=>s.studentUserId===this.student.value)?.cases??[]).map(c=>({value:c.caseId,label:c.label}));}
 ngOnChanges(){this.stop$.next();this.loading=true;this.message='';this.student.reset(this.invoice.linkedStudentUserId??'');this.api.invoiceStudentOptions(this.connectionId).pipe(takeUntil(this.stop$)).subscribe({next:r=>{this.students=r.students;this.options=r.students.map(s=>({value:s.studentUserId,label:[s.name,s.reference,s.email].filter(Boolean).join(' — ')}));this.updateCaseOptions();this.loading=false;},error:()=>{this.loading=false;this.message='Students could not be loaded. Close and try again.';}});}
 ngOnDestroy(){this.stop$.next();this.stop$.complete();this.destroyed$.next();this.destroyed$.complete();}
 close(){if(!this.busy)this.closed.emit();}
 save(){if(this.busy||this.loading)return;const cases=this.caseOptions;
 if(!this.students.some(s=>s.studentUserId===this.student.value)){this.message='Select an existing student.';return;}
 if(cases.length>1&&!cases.some(c=>c.value===this.studentCase.value)){this.message='Select the case that this invoice belongs to.';return;}
 this.busy=true;this.student.disable({emitEvent:false});this.studentCase.disable({emitEvent:false});
 this.api.linkInvoiceStudent(this.connectionId,this.invoice.xeroInvoiceId,{studentUserId:this.student.value,...(cases.length?{caseId:cases.length===1?cases[0].value:this.studentCase.value}:{})}).pipe(takeUntil(this.stop$)).subscribe({next:()=>{this.busy=false;this.linked.emit();},error:e=>{this.busy=false;this.student.enable({emitEvent:false});this.studentCase.enable({emitEvent:false});this.message=typeof e?.error?.message==='string'?e.error.message:'The invoice could not be linked. Your selection has been kept.';}});
 }
}
