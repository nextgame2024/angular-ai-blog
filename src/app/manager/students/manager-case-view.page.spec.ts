import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { StudentOperationsService } from '../student-operations/student-operations.service';
import type { StudentCaseDetail } from '../student-operations/student-operations.types';
import { ManagerCaseViewPageComponent } from './manager-case-view.page';
import {By} from '@angular/platform-browser';
import {CaseChecklistComponent} from './case-checklist.component';

describe('ManagerCaseViewPageComponent', () => {
  const params = new BehaviorSubject(convertToParamMap({ caseId: 'case-1' }));
  const routeData: { creation?: 'student' | 'case' } = {};
  const detail: StudentCaseDetail = {
    caseId: 'case-1', caseNumber: 'CASE-1', userId: 'user-1', studentId: 'student-1',
    studentReference: 'STD-1', studentName: 'Example Student', studentEmail: 'student@example.com', studentPhone: null, studentMobile: null,
    title: null, courseName: null, advisorId: 'advisor-1', advisorName: 'Advisor Name', status: 'in_progress',
    currentStage: 'imported_pending_review', openedOn: '2026-10-16',
    createdAt: '2026-10-16T00:00:00Z', updatedAt: '2026-10-17T00:00:00Z', recordVersion: 1,
    advisors: [], colleges: [],
  };
  const api = {
    caseInvoiceDetail:jasmine.createSpy().and.returnValue(of({invoiceId:'xero-1',invoiceNumber:'INV-10577',studentName:'Example Student',advisorName:'Advisor Name',reference:'Fixture College',status:'PAID',type:'ACCREC',date:'2026-10-27',dueDate:'2026-10-27',currency:'AUD',total:'100',amountPaid:'100',amountDue:'0',paymentTrack:'Paid out',lineItems:[]})),
    caseInvoiceDrafts:jasmine.createSpy().and.returnValue(of({batches:[],preparation:null})),
    documentRequirements:jasmine.createSpy().and.returnValue(of({requirements:[]})),
    documentTypes:jasmine.createSpy().and.returnValue(of({types:[{documentTypeId:'passport-type',name:'Passport',required:true,status:'active',recordVersion:1}]})),
    caseDocumentUploadOptions:jasmine.createSpy().and.returnValue(of({available:true,enabled:true})),
    caseChecklist:jasmine.createSpy().and.returnValue(of({status:'pre_sale',items:[]})),
    updateCaseChecklist:jasmine.createSpy(),
    workspace: jasmine.createSpy().and.returnValue(of({ role: 'chief_executive' })),
    caseDetail: jasmine.createSpy().and.returnValue(of(detail)),
    caseEditOptions: jasmine.createSpy().and.returnValue(of({ advisors: [{ advisorId: 'advisor-1', code: 'S15', name: 'Advisor Name', xeroLabel: 'S15 Advisor Name' }], colleges: [{ collegeId: 'college-1', name: 'ECA College' }] })),
    caseWorkflowOptions: jasmine.createSpy().and.returnValue(of({ statuses: ['in_progress', 'pre_sale', 'on_hold', 'awaiting_payment', 'payment_received'], stages: ['documents_requested', 'awaiting_payment', 'payment_monitoring'], allowedStatuses: { imported_pending_review: ['in_progress'], documents_requested: ['pre_sale'], awaiting_payment: ['pre_sale', 'on_hold'], payment_monitoring: ['awaiting_payment','payment_received'] } })),
    updateCase: jasmine.createSpy().and.returnValue(of({ caseId: 'case-1', recordVersion: 2 })),
    createCase: jasmine.createSpy(),
    createStudentWithCase: jasmine.createSpy(),
    studentRegister: jasmine.createSpy().and.returnValue(of({ students: [], page: 1, limit: 25, total: 0 })),
    casesForStudent: jasmine.createSpy().and.returnValue(of({ cases: [
      { caseId: 'case-1', caseNumber: 'CASE-1', status: 'in_progress', currentStage: 'imported_pending_review' },
      { caseId: 'case-2', caseNumber: 'CASE-2', status: 'closed', currentStage: 'payments_complete' },
    ], total: 2, page: 1, limit: 100 })),
    caseInvoices: jasmine.createSpy().and.returnValue(of({ invoices: [{
      invoiceId: 'invoice-1', invoiceNumber: 'INV-1', type: 'ACCREC', status: 'PAID',
      date: '2026-10-16', dueDate: '2026-10-20', amountDue: '0', currency: 'AUD',
    }], total: 1, page: 1, limit: 25 })),
    caseDocuments: jasmine.createSpy().and.returnValue(of({ documents: [{
      documentId: 'document-1', fileName: 'offer.pdf', mimeType: 'application/pdf', sizeBytes: 1024,
      sourceKind: 'invoice', lastSeenAt: '2026-10-16T00:00:00Z',
    }], discovery: [], discoveryRequested: true, total: 1, page: 1, limit: 25 })),
    caseActivity: jasmine.createSpy().and.returnValue(of({ activity: [{
      activityId: 'activity-1', eventType: 'case.created', summary: 'Case created',
      createdAt: '2026-10-16T00:00:00Z',
    }], page: 1, limit: 25 })),
    caseDocumentContent: jasmine.createSpy(),
    replaceCaseDocument:jasmine.createSpy().and.returnValue(of({documentId:'document-1',replaced:true,cleanupPending:false})),
    deleteCaseDocument:jasmine.createSpy().and.returnValue(of({deleted:true})),
  };

  beforeEach(async () => {
    delete routeData.creation;
    params.next(convertToParamMap({ caseId: 'case-1' }));
    for (const spy of Object.values(api)) spy.calls.reset();
    api.workspace.and.returnValue(of({ role: 'chief_executive' }));
    api.caseInvoiceDrafts.and.returnValue(of({batches:[],preparation:null}));
    api.documentRequirements.and.returnValue(of({requirements:[]}));
    api.caseDetail.and.returnValue(of(detail));
    api.caseEditOptions.and.returnValue(of({ advisors: [{ advisorId: 'advisor-1', code: 'S15', name: 'Advisor Name', xeroLabel: 'S15 Advisor Name' }], colleges: [{ collegeId: 'college-1', name: 'ECA College' }] }));
    api.updateCase.and.returnValue(of({ caseId: 'case-1', recordVersion: 2 }));
    api.studentRegister.and.returnValue(of({ students: [], page: 1, limit: 25, total: 0 }));
    api.caseInvoices.and.returnValue(of({ invoices: [{ invoiceId: 'invoice-1', invoiceNumber: 'INV-1', type: 'ACCREC', status: 'PAID', date: '2026-10-16', dueDate: '2026-10-20', amountDue: '0', currency: 'AUD' }], total: 1, page: 1, limit: 25 }));
    api.caseDocuments.and.returnValue(of({ documents: [{ documentId: 'document-1', fileName: 'offer.pdf', mimeType: 'application/pdf', sizeBytes: 1024, sourceKind: 'invoice', lastSeenAt: '2026-10-16T00:00:00Z' }], discovery: [], discoveryRequested: true, total: 1, page: 1, limit: 25 }));
    api.caseActivity.and.returnValue(of({ activity: [{ activityId: 'activity-1', eventType: 'case.created', summary: 'Case created', createdAt: '2026-10-16T00:00:00Z' }], page: 1, limit: 25 }));
    api.replaceCaseDocument.and.returnValue(of({documentId:'document-1',replaced:true,cleanupPending:false}));
    api.deleteCaseDocument.and.returnValue(of({deleted:true}));
    await TestBed.configureTestingModule({
      imports: [ManagerCaseViewPageComponent],
      providers: [provideRouter([]), { provide: ActivatedRoute, useValue: { paramMap: params.asObservable(), snapshot: { data: routeData } } },
        { provide: StudentOperationsService, useValue: api }],
    }).compileComponents();
  });

  it('shows eight confirmed invoices once, counts them in both locations and opens read-only details without a creation notice',()=>{
    const invoices=Array.from({length:8},(_,index)=>({invoiceId:`xero-${index+1}`,connectionId:'connection',invoiceNumber:`INV-${10577+index}`,draftBatchId:'batch',type:'ACCREC',status:'DRAFT',date:'2026-10-27',dueDate:'2026-10-27',currency:'AUD',amountPaid:'0',amountDue:'100'}));
    api.caseInvoices.and.returnValue(of({invoices,total:8,page:1,limit:25}));
    api.caseInvoiceDrafts.and.returnValue(of({canCreateXero:true,preparation:null,batches:[{batchId:'batch',currentOffer:true,exports:Object.fromEntries(invoices.map((invoice,index)=>[String(index+1),{status:'created',invoiceId:invoice.invoiceId,invoiceNumber:invoice.invoiceNumber}])),snapshot:{studentName:'Example Student',advisorLabel:'Advisor Name',collegeName:'Fixture College',currency:'AUD',reviewNote:'',invoices:invoices.map((invoice,index)=>({sequence:index+1,invoiceNumber:`INV-${index+1}`,issueDate:invoice.date,dueDate:invoice.dueDate,totalMinor:10000,conditionalFeeMinor:0,lines:[]}))}}]}));
    const fixture=TestBed.createComponent(ManagerCaseViewPageComponent);fixture.detectChanges();const root=fixture.nativeElement as HTMLElement;
    expect(root.querySelector('#invoices-heading .count')?.textContent).toBe('8');expect(root.querySelector('.case-summary dd')?.textContent).toBe('8');
    expect(root.querySelectorAll('.invoice-table tbody tr').length).toBe(8);expect(root.querySelector('.draft-section table')).toBeNull();expect(root.textContent).not.toContain('No Xero invoices are linked');
    (root.querySelector('.invoice-number') as HTMLButtonElement).click();fixture.detectChanges();
    const dialog=root.querySelector('app-case-invoice-drafts dialog') as HTMLDialogElement;expect(dialog.open).toBeTrue();
    expect(dialog.querySelector('h2')?.textContent).toBe('INV-10577');expect(dialog.querySelector('.notice')).toBeNull();expect(dialog.querySelector('input')).toBeNull();
    expect(getComputedStyle(dialog.querySelector('h2')!).fontSize).toBe('14.4px');
    expect(getComputedStyle(root.querySelector('.invoice-number')!).fontSize).toBe('12px');
  });

  it('uses the same six headers and read-only detail request for imported invoices',()=>{
    api.caseInvoices.and.returnValue(of({invoices:[{invoiceId:'imported',connectionId:'connection',invoiceNumber:'INV-8602',type:'ACCREC',status:'PAID'}],total:1,page:1,limit:25}));
    const fixture=TestBed.createComponent(ManagerCaseViewPageComponent);fixture.detectChanges();const root=fixture.nativeElement as HTMLElement;
    expect(Array.from(root.querySelectorAll('.invoice-table th')).map(header=>header.textContent?.trim())).toEqual(['Invoice','Date / Due','Status','Track','Paid','Due']);
    (root.querySelector('.invoice-number') as HTMLButtonElement).click();fixture.detectChanges();
    expect(api.caseInvoiceDetail).toHaveBeenCalledWith('case-1','connection','imported');
    expect((root.querySelector('app-case-invoice-drafts dialog') as HTMLDialogElement).open).toBeTrue();
  });
  it('keeps imported and newly created invoice links clickable when connection metadata is absent',()=>{
    const invoices=[{invoiceId:'imported',invoiceNumber:'INV-8602',type:'ACCREC',status:'PAID'},
      {invoiceId:'created',invoiceNumber:'INV-10584',type:'ACCREC',status:'DRAFT',draftBatchId:'batch'}];
    api.caseInvoices.and.returnValue(of({invoices,total:2,page:1,limit:25}));
    const fixture=TestBed.createComponent(ManagerCaseViewPageComponent);fixture.detectChanges();const root=fixture.nativeElement as HTMLElement;
    const links=root.querySelectorAll<HTMLButtonElement>('.invoice-table button.invoice-number');expect(links.length).toBe(2);
    for(let index=0;index<links.length;index++){
      links[index].click();fixture.detectChanges();expect(api.caseInvoiceDetail).toHaveBeenCalledWith('case-1','',invoices[index].invoiceId);
      expect((root.querySelector('app-case-invoice-drafts dialog') as HTMLDialogElement).open).toBeTrue();
      fixture.componentInstance.invoiceDrafts?.close();fixture.detectChanges();
    }
  });

  it('shows just one invoice loader while the register and preparation requests are pending',()=>{
    api.caseInvoices.and.returnValue(new Subject());api.caseInvoiceDrafts.and.returnValue(new Subject());
    const fixture=TestBed.createComponent(ManagerCaseViewPageComponent);fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('section[aria-labelledby="invoices-heading"] app-manager-list-loader').length).toBe(1);
  });

  it('refreshes the invoice count after creation, including when an earlier list request is pending',()=>{
    const initial=new Subject<unknown>();api.caseInvoices.and.returnValue(initial);
    const fixture=TestBed.createComponent(ManagerCaseViewPageComponent);fixture.detectChanges();const component=fixture.componentInstance;
    api.caseInvoices.and.returnValue(of({invoices:[],total:8,page:1,limit:25}));component.onInvoiceDraftsChanged();
    initial.next({invoices:[],total:0,page:1,limit:25});initial.complete();fixture.detectChanges();
    expect(api.caseInvoices).toHaveBeenCalledTimes(2);expect(component.invoices?.total).toBe(8);
  });

  it('refreshes the stage, related case and checklist after invoice creation without changing Pre-sale status',()=>{
    const fixture=TestBed.createComponent(ManagerCaseViewPageComponent);fixture.detectChanges();
    const c=fixture.componentInstance,before=c.checklistRefresh;
    api.caseDetail.and.returnValue(of({...c.case,currentStage:'awaiting_payment',status:'pre_sale'}));
    c.onInvoiceDraftsChanged();fixture.detectChanges();
    expect(c.case?.currentStage).toBe('awaiting_payment');expect(c.case?.status).toBe('pre_sale');expect(c.checklistRefresh).toBeGreaterThan(before);
    expect(fixture.nativeElement.querySelector('.current')?.textContent).toContain('Awaiting Payment');
  });
  it('refreshes the case stage, invoices and activity when background checklist completion arrives',()=>{
    api.caseDetail.and.returnValue(of({...detail,status:'pre_sale',currentStage:'checklist_complete'}));
    const f=TestBed.createComponent(ManagerCaseViewPageComponent);f.detectChanges();
    const checklist=f.debugElement.query(By.directive(CaseChecklistComponent)).componentInstance as CaseChecklistComponent;
    const activity=api.caseActivity.calls.count(),invoices=api.caseInvoices.calls.count();
    api.caseDetail.and.returnValue(of({...detail,status:'pre_sale',currentStage:'awaiting_payment'}));
    checklist.workflowUpdated.emit();f.detectChanges();
    expect(f.componentInstance.case?.currentStage).toBe('awaiting_payment');expect(f.componentInstance.case?.status).toBe('pre_sale');
    expect(api.caseActivity.calls.count()).toBe(activity+1);expect(api.caseInvoices.calls.count()).toBe(invoices+1);
    expect(f.nativeElement.querySelector('.current').textContent).toContain('Awaiting Payment');f.destroy();
  });

  it('opens Add student as a completely unsaved form without loading case records or allocating IDs', () => {
    routeData.creation = 'student';
    const fixture = TestBed.createComponent(ManagerCaseViewPageComponent); fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(fixture.componentInstance.editing).toBeTrue();
    for (const field of ['studentName','studentEmail','mobile','phone','courseName']) {
      expect((root.querySelector(`[formControlName="${field}"]`) as HTMLInputElement).value).toBe('');
    }
    expect(root.textContent).toContain('Assigned on save');
    expect(root.querySelector('.draft-case strong')?.textContent).toBe('New case');
    expect(root.textContent).not.toContain('CASE-1');expect(root.textContent).not.toContain('STD-1');
    expect(root.textContent).not.toContain('Imported — Pending Review');
    expect(api.caseDetail).not.toHaveBeenCalled();expect(api.casesForStudent).not.toHaveBeenCalled();
    expect(api.caseDocuments).not.toHaveBeenCalled();expect(api.caseInvoices).not.toHaveBeenCalled();
    expect(api.caseActivity).not.toHaveBeenCalled();expect(api.createStudentWithCase).not.toHaveBeenCalled();
    const navigate = spyOn(TestBed.inject(Router),'navigate').and.resolveTo(true);
    (root.querySelector('.draft-case .cancel') as HTMLButtonElement).click();
    expect(navigate).toHaveBeenCalledWith(['/manager/students']);
    expect(api.createStudentWithCase).not.toHaveBeenCalled();
  });

  const requirementNames=['Engagement letter','Letter of Offer','Passport'];
  const requirementRows=requirementNames.map((name,index)=>({requirementKey:`required-${index}`,documentTypeId:index===2?'passport-type':`type-${index}`,name,required:true,available:true,uploaded:false}));
  it('shows the database requirements as disabled draft upload rows without allocating records',()=>{
    routeData.creation='student';api.documentRequirements.and.returnValue(of({requirements:requirementRows}));
    const f=TestBed.createComponent(ManagerCaseViewPageComponent);f.detectChanges();
    const rows=[...f.nativeElement.querySelectorAll('.required-document-row')] as HTMLElement[];
    expect(rows.map(row=>row.querySelector('strong')?.textContent)).toEqual(requirementNames);
    expect(rows.every(row=>row.querySelector<HTMLButtonElement>('button')!.disabled)).toBeTrue();
    expect(rows.every(row=>row.querySelectorAll('.document-action-button').length===0)).toBeTrue();
    expect(api.documentRequirements).toHaveBeenCalledWith('pre_sale');expect(api.caseDocuments).not.toHaveBeenCalled();expect(api.createStudentWithCase).not.toHaveBeenCalled();
  });
  it('opens the shared upload modal with the missing requirement type locked',()=>{
    api.caseDocuments.and.returnValue(of({documents:[],requirements:[requirementRows[2]],discovery:[],total:0,page:1,limit:25}));
    const f=TestBed.createComponent(ManagerCaseViewPageComponent);f.detectChanges();
    (f.nativeElement.querySelector('.requirement-upload') as HTMLButtonElement).click();f.detectChanges();
    expect(f.nativeElement.querySelector('dialog').open).toBeTrue();
    const selector=f.nativeElement.querySelector('dialog [aria-label="Document type"]') as HTMLButtonElement;
    expect(selector.disabled).toBeTrue();expect(selector.textContent).toContain('Passport');
  });
  it('hides fulfilled rows using whole-case coverage, keeps real files and shows missing rows on page one only',()=>{
    const f=TestBed.createComponent(ManagerCaseViewPageComponent);f.detectChanges();
    const c=f.componentInstance;c.documents={...c.documents!,requirements:requirementRows.map((r,i)=>({...r,uploaded:i===2}))};f.detectChanges();
    expect(f.nativeElement.querySelectorAll('.required-document-row').length).toBe(2);
    expect(f.nativeElement.querySelectorAll('.document-action-button').length).toBe(2);
    c.documents={...c.documents,page:2};f.detectChanges();expect(f.nativeElement.querySelector('.required-document-row')).toBeNull();
  });
  it('ignores stale draft requirement responses after the selected status changes',()=>{
    routeData.creation='student';const pending=new Subject<any>();api.documentRequirements.and.returnValue(pending);
    const f=TestBed.createComponent(ManagerCaseViewPageComponent);f.detectChanges();
    api.documentRequirements.and.returnValue(of({requirements:[]}));f.componentInstance.editForm.controls.status.setValue('on_hold');pending.next({requirements:requirementRows});f.detectChanges();
    expect(f.componentInstance.missingDocumentRequirements).toEqual([]);expect(f.componentInstance.requirementsLoading).toBeFalse();
  });
  for(const width of [390,1440])for(const dark of [false,true])it(`fits missing-document upload rows at ${width}px in ${dark?'dark':'light'} mode`,()=>{
    routeData.creation='student';api.documentRequirements.and.returnValue(of({requirements:requirementRows}));
    const f=TestBed.createComponent(ManagerCaseViewPageComponent);f.detectChanges();
    const frame=document.createElement('iframe');frame.style.width=`${width}px`;frame.style.height='1000px';document.body.appendChild(frame);
    try{const doc=frame.contentDocument!,win=frame.contentWindow!;document.querySelectorAll('style').forEach(style=>doc.head.appendChild(style.cloneNode(true)));doc.documentElement.classList.toggle('dark',dark);
      const host=f.nativeElement.cloneNode(true) as HTMLElement;doc.body.appendChild(host);
      const card=host.querySelector('[aria-labelledby="documents-heading"]') as HTMLElement;
      expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth+1);
      for(const button of card.querySelectorAll<HTMLElement>('.requirement-upload'))expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
      expect(win.getComputedStyle(card).backgroundColor).toBe(dark?'rgb(30, 41, 59)':'rgb(255, 255, 255)');
    }finally{frame.remove();f.destroy();}
  });

  it('shows activity attribution and refreshes activity after a checklist change',()=>{
    api.caseActivity.and.returnValue(of({activity:[{activityId:'completed',eventType:'case.checklist_completed',summary:'Checklist complete',actorName:'SophiaAi',createdAt:'2026-10-24T00:00:00Z'}],page:1,limit:25}));
    const f=TestBed.createComponent(ManagerCaseViewPageComponent);f.detectChanges();
    expect(f.nativeElement.querySelector('.activity-list strong').textContent).toContain('Checklist complete — SophiaAi');
    expect(f.nativeElement.querySelector('.activity-list small').textContent).toContain('24 Oct 2026');
    const before=api.caseActivity.calls.count();f.componentInstance.loadActivity(1);expect(api.caseActivity.calls.count()).toBe(before+1);
  });

  it('validates Add student and retries the exact save with the same idempotency key', () => {
    routeData.creation = 'student';
    api.createStudentWithCase.and.returnValue(throwError(()=>({status:0})));
    const fixture = TestBed.createComponent(ManagerCaseViewPageComponent); fixture.detectChanges();
    fixture.componentInstance.saveEdit();fixture.detectChanges();
    expect(api.createStudentWithCase).not.toHaveBeenCalled();
    expect(fixture.componentInstance.editForm.controls.studentName.touched).toBeTrue();
    expect(fixture.nativeElement.querySelector('app-manager-toast [role="alert"]')).not.toBeNull();
    fixture.componentInstance.editForm.patchValue({studentName:' New Student ',studentEmail:'new@example.test',mobile:'0400 111 222'});
    fixture.componentInstance.saveEdit();
    const first=api.createStudentWithCase.calls.mostRecent().args;
    expect(first[0]).toEqual(jasmine.objectContaining({studentName:'New Student',studentEmail:'new@example.test',mobile:'0400 111 222',courseName:null,status:'pre_sale',currentStage:'documents_requested'}));
    expect(first[0].recordVersion).toBeUndefined();expect(first[0].userId).toBeUndefined();
    expect(fixture.componentInstance.editForm.controls.studentName.value).toBe(' New Student ');
    fixture.componentInstance.saveEdit();
    expect(api.createStudentWithCase.calls.mostRecent().args[1]).toBe(first[1]);
    fixture.componentInstance.editForm.controls.studentEmail.setValue('changed@example.test');
    fixture.componentInstance.saveEdit();
    expect(api.createStudentWithCase.calls.mostRecent().args[1]).not.toBe(first[1]);
    const navigate=spyOn(TestBed.inject(Router),'navigate').and.resolveTo(true);
    api.createStudentWithCase.and.returnValue(of({caseId:'created-case',recordVersion:1}));
    fixture.componentInstance.saveEdit();
    expect(navigate).toHaveBeenCalledWith(['/manager/students/cases','created-case'],{state:{createdCaseMode:'student'}});
    expect(api.updateCase).not.toHaveBeenCalled();expect(api.createCase).not.toHaveBeenCalled();
  });

  it('creates an additional case for the already authorized student without changing identity or copying records', () => {
    routeData.creation='case';api.createCase.and.returnValue(of({caseId:'new-case',recordVersion:1}));
    const fixture=TestBed.createComponent(ManagerCaseViewPageComponent);fixture.detectChanges();
    const root=fixture.nativeElement as HTMLElement;
    expect((root.querySelector('[formControlName="studentName"]') as HTMLInputElement).readOnly).toBeTrue();
    expect(fixture.componentInstance.editForm.controls.studentName.value).toBe('Example Student');
    expect(fixture.componentInstance.editForm.controls.courseName.value).toBe('');
    expect(api.caseDocuments).not.toHaveBeenCalled();expect(api.caseInvoices).not.toHaveBeenCalled();
    expect(root.querySelector('.draft-case')?.textContent).toContain('Case number assigned on save');
    const navigate=spyOn(TestBed.inject(Router),'navigate').and.resolveTo(true);
    fixture.componentInstance.saveEdit();
    expect(api.createCase).toHaveBeenCalledWith(jasmine.objectContaining({userId:'user-1',currentStage:'documents_requested',courseName:null}),jasmine.any(String));
    expect(navigate).toHaveBeenCalledWith(['/manager/students/cases','new-case'],{state:{createdCaseMode:'case'}});
    expect(api.updateCase).not.toHaveBeenCalled();expect(api.createStudentWithCase).not.toHaveBeenCalled();
  });

  it('hides creation actions and refuses a direct Add student route for an advisor', () => {
    routeData.creation='student';api.workspace.and.returnValue(of({role:'advisor'}));
    const fixture=TestBed.createComponent(ManagerCaseViewPageComponent);fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('permission');
    expect(fixture.nativeElement.querySelector('.draft-case')).toBeNull();
    fixture.componentInstance.saveEdit();expect(api.createStudentWithCase).not.toHaveBeenCalled();
    expect(api.caseEditOptions).not.toHaveBeenCalled();
  });

  it('waits for workspace authority before displaying a new-case draft and fails safely if access cannot load',()=>{
    routeData.creation='case';const workspace=new Subject<{role:string}>();api.workspace.and.returnValue(workspace);
    const fixture=TestBed.createComponent(ManagerCaseViewPageComponent);fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.student-overview')).toBeNull();
    expect(api.caseEditOptions).not.toHaveBeenCalled();
    workspace.error(new Error('private error'));fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.draft-case')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('workspace access');
    expect(fixture.nativeElement.textContent).not.toContain('private error');
    api.workspace.and.returnValue(throwError(()=>new Error('private error')));
    const failed=TestBed.createComponent(ManagerCaseViewPageComponent);failed.detectChanges();
    expect(failed.nativeElement.querySelector('.draft-case')).toBeNull();
    expect(failed.nativeElement.textContent).toContain('workspace access');
  });

  it('places New Case inside the saved student case page, never in an unsaved draft or advisor view',()=>{
    const fixture=TestBed.createComponent(ManagerCaseViewPageComponent);fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.related-cases .new-case-button')?.getAttribute('href')).toBe('/manager/students/cases/case-1/new');
    expect(fixture.nativeElement.querySelector('.new-case-button').getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    fixture.componentInstance.workspace={role:'advisor'} as never;fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.new-case-button')).toBeNull();
  });

  for (const width of [390, 900, 1440]) for (const dark of [false, true]) {
    it(`keeps progress and related cards equal with a scrolling case list at ${width}px in ${dark ? 'dark' : 'light'} mode`, () => {
      for (const mode of ['saved', 'edit', 'case'] as const) {
        if (mode === 'case') routeData.creation = 'case';
        const fixture = TestBed.createComponent(ManagerCaseViewPageComponent); fixture.detectChanges();
        const component = fixture.componentInstance;
        if (mode === 'edit') component.beginEdit('case-1');
        component.relatedCases = Array.from({ length: 30 }, (_, index) => ({
          ...component.relatedCases[0], caseId: `case-${index + 1}`, caseNumber: `CASE-${index + 1}`,
        }));
        component.relatedTotal = 100; fixture.detectChanges();
        const frame = document.createElement('iframe');
        frame.style.width = `${width}px`; frame.style.height = '900px'; document.body.appendChild(frame);
        try {
          const doc = frame.contentDocument!, win = frame.contentWindow!;
          document.querySelectorAll('style').forEach(style => doc.head.appendChild(style.cloneNode(true)));
          doc.documentElement.classList.toggle('dark', dark); doc.body.style.margin = '0';
          const host = fixture.nativeElement.cloneNode(true) as HTMLElement;
          host.style.display = 'block'; host.style.width = '100%'; doc.body.appendChild(host);
          const progress = doc.querySelector('.progress-card') as HTMLElement;
          const stages = progress.querySelector('.stage-list') as HTMLElement;
          expect(parseFloat(win.getComputedStyle(stages).marginTop)).toBeGreaterThanOrEqual(24);
          expect(stages.getBoundingClientRect().bottom).toBeLessThanOrEqual(progress.getBoundingClientRect().bottom);
          const related = doc.querySelector('.related-cases') as HTMLElement;
          const scroll = doc.querySelector('.related-scroll') as HTMLElement;
          expect(Math.abs(progress.getBoundingClientRect().height - related.getBoundingClientRect().height)).toBeLessThan(1);
          expect(scroll.scrollHeight).toBeGreaterThan(scroll.clientHeight);
          expect(scroll.clientHeight).toBeGreaterThan(44);
          expect(scroll.getBoundingClientRect().bottom).toBeLessThan(related.getBoundingClientRect().bottom);
          expect(related.scrollHeight).toBeLessThanOrEqual(related.clientHeight + 1);
          expect(scroll.getAttribute('tabindex')).toBe('0');
          expect(scroll.getAttribute('aria-label')).toBe('Student cases');
          expect(win.getComputedStyle(scroll).overflowY).toBe('auto');
          expect(win.getComputedStyle(scroll).scrollbarWidth).toBe('thin');
          expect(related.scrollWidth).toBeLessThanOrEqual(related.clientWidth + 1);
          scroll.scrollTop = scroll.scrollHeight;
          const more = scroll.querySelector('.secondary-button') as HTMLElement;
          expect(more.getBoundingClientRect().bottom).toBeLessThanOrEqual(scroll.getBoundingClientRect().bottom + 1);
          if (mode === 'saved') {
            const button = related.querySelector('.new-case-button') as HTMLElement;
            const title = related.querySelector('h2') as HTMLElement;
            expect(button.parentElement).toBe(title.parentElement);
            expect(button.getBoundingClientRect().left).toBeGreaterThanOrEqual(title.getBoundingClientRect().right);
            expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
          }
          if (width > 850) {
            expect(Math.abs(progress.getBoundingClientRect().bottom - related.getBoundingClientRect().bottom)).toBeLessThan(1);
            const content = doc.querySelector('.content-grid') as HTMLElement;
            expect(content.getBoundingClientRect().top - progress.getBoundingClientRect().bottom).toBeLessThan(14);
          }
        } finally { frame.remove(); fixture.destroy(); }
      }
    });
  }

  for(const width of [390,1440]) for(const dark of [false,true]) {
    it(`keeps Add student draft and save controls usable at ${width}px in ${dark?'dark':'light'} mode`,()=>{
      routeData.creation='student';
      const fixture=TestBed.createComponent(ManagerCaseViewPageComponent);fixture.detectChanges();
      const frame=document.createElement('iframe');frame.style.width=`${width}px`;frame.style.height='900px';document.body.appendChild(frame);
      try {
        const doc=frame.contentDocument!,win=frame.contentWindow!;
        document.querySelectorAll('style').forEach(style=>doc.head.appendChild(style.cloneNode(true)));
        doc.documentElement.classList.toggle('dark',dark);doc.body.style.margin='0';
        const host=fixture.nativeElement.cloneNode(true) as HTMLElement;host.style.display='block';host.style.width='100%';doc.body.appendChild(host);
        const card=doc.querySelector('.student-overview') as HTMLElement,draft=doc.querySelector('.draft-case') as HTMLElement;
        expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth+1);
        expect(draft.scrollWidth).toBeLessThanOrEqual(draft.clientWidth+1);
        expect(draft.textContent).toContain('Case number assigned on save');
        for(const button of draft.querySelectorAll('button')) expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
        expect(win.getComputedStyle(card).backgroundColor).toBe(dark?'rgb(30, 41, 59)':'rgb(255, 255, 255)');
        expect(doc.querySelector('.new-case-button')).toBeNull();
      } finally {frame.remove();fixture.destroy();}
    });
  }

  it('shows real case, related case, document, invoice and activity data with actions per case', () => {
    const fixture = TestBed.createComponent(ManagerCaseViewPageComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Example Student');
    expect(root.textContent).toContain('CASE-2');
    expect(root.textContent).toContain('offer.pdf');
    expect(root.textContent).toContain('INV-1');
    expect(root.textContent).toContain('Case created');
    expect(root.textContent).toContain('In progress');
    expect(root.querySelector('a[href="/manager/students/cases/case-2"]')).not.toBeNull();
    expect(root.querySelectorAll('.related-item')).toHaveSize(2);
    expect(root.querySelectorAll('.related-actions .edit')).toHaveSize(2);
    expect(root.querySelectorAll('.related-actions .archive')).toHaveSize(2);
    expect([...(root.querySelectorAll('.related-actions .edit') as NodeListOf<HTMLButtonElement>)].every(button => !button.disabled)).toBeTrue();
    expect([...(root.querySelectorAll('.related-actions .archive') as NodeListOf<HTMLButtonElement>)].every(button => button.disabled)).toBeTrue();
    expect(root.textContent).not.toContain('Approve');
    expect(root.querySelector('app-case-document-actions .toolbar')?.textContent).toContain('Upload');
    expect(api.caseInvoices).toHaveBeenCalledWith('case-1', 1);
    expect(api.caseDocuments).toHaveBeenCalledWith('case-1', 1);
    expect(root.querySelector('.related-cases')?.closest('aside')).not.toBeNull();
    expect(root.querySelector('.progress-card')?.closest('.workspace-main')).not.toBeNull();
  });

  it('distinguishes queued discovery, refreshes metadata, and stops after completion', fakeAsync(() => {
    const pending = { documents: [], discovery: [{ status: 'queued', count: 2 }], discoveryRequested: true, total: 0, page: 1, limit: 25 };
    api.caseDocuments.and.returnValue(of(pending));
    spyOnProperty(document, 'hidden', 'get').and.returnValue(false);
    const fixture = TestBed.createComponent(ManagerCaseViewPageComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('2 document sources waiting');
    expect(fixture.nativeElement.textContent).not.toContain('still running');
    api.caseDocuments.and.returnValue(of({ ...pending, discovery: [{ status: 'succeeded', count: 2 }] }));
    tick(120000); fixture.detectChanges();
    expect(api.caseDocuments).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.textContent).toContain('No documents were found');
    tick(120000); expect(api.caseDocuments).toHaveBeenCalledTimes(2);
    fixture.destroy();
  }));

  it('does not poll hidden pages or after leaving the case', fakeAsync(() => {
    api.caseDocuments.and.returnValue(of({ documents: [], discovery: [{ status: 'processing', count: 1 }], discoveryRequested: true, total: 0, page: 1, limit: 25 }));
    spyOnProperty(document, 'hidden', 'get').and.returnValue(true);
    const fixture = TestBed.createComponent(ManagerCaseViewPageComponent);
    fixture.detectChanges(); tick(30000);
    expect(api.caseDocuments).toHaveBeenCalledTimes(1);
    fixture.destroy(); tick(120000);
    expect(api.caseDocuments).toHaveBeenCalledTimes(1);
  }));

  it('polls local analysis state independently of discovery and refreshes activity when checks finish',fakeAsync(()=>{
    const pending={documents:[],discovery:[],discoveryRequested:false,total:0,page:1,limit:25,analysisPending:true};
    api.caseDocuments.and.returnValue(of(pending));spyOnProperty(document,'hidden','get').and.returnValue(false);
    const fixture=TestBed.createComponent(ManagerCaseViewPageComponent);fixture.detectChanges();const activities=api.caseActivity.calls.count();
    api.caseDocuments.and.returnValue(of({...pending,analysisPending:false}));tick(10000);
    expect(api.caseDocuments).toHaveBeenCalledTimes(2);expect(api.caseActivity.calls.count()).toBe(activities+1);
    tick(20000);expect(api.caseDocuments).toHaveBeenCalledTimes(2);fixture.destroy();
  }));

  it('recovers polling after a temporary status request failure',fakeAsync(()=>{
    const pending={documents:[],discovery:[],discoveryRequested:false,total:0,page:1,limit:25,analysisPending:true};
    api.caseDocuments.and.returnValue(of(pending));spyOnProperty(document,'hidden','get').and.returnValue(false);
    const fixture=TestBed.createComponent(ManagerCaseViewPageComponent);fixture.detectChanges();
    api.caseDocuments.and.returnValue(throwError(()=>new Error('temporary network failure')));tick(10000);
    expect(api.caseDocuments).toHaveBeenCalledTimes(2);
    api.caseDocuments.and.returnValue(of({...pending,analysisPending:false}));tick(30000);
    expect(api.caseDocuments).toHaveBeenCalledTimes(3);expect(fixture.componentInstance.documentError).toBe('');
    tick(60000);expect(api.caseDocuments).toHaveBeenCalledTimes(3);fixture.destroy();
  }));

  it('does not report an empty completed discovery when sources failed', () => {
    api.caseDocuments.and.returnValue(of({ documents: [], discovery: [{ status: 'failed', count: 2 }], discoveryRequested: true, total: 0, page: 1, limit: 25 }));
    const fixture = TestBed.createComponent(ManagerCaseViewPageComponent); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Document discovery is incomplete');
    expect(fixture.nativeElement.textContent).not.toContain('No documents were found');
  });

  for (const width of [360, 1280]) for (const dark of [false, true]) {
    it(`keeps discovery notices inside the card at ${width}px in ${dark ? 'dark' : 'light'} mode`, () => {
      const wasDark = document.documentElement.classList.contains('dark');
      document.documentElement.classList.toggle('dark', dark);
      api.caseDocuments.and.returnValue(of({ documents: [], discovery: [{ status: 'queued', count: 2 }], discoveryRequested: true, total: 0, page: 1, limit: 25 }));
      const fixture = TestBed.createComponent(ManagerCaseViewPageComponent);
      try {
        fixture.nativeElement.style.width = `${width}px`;
        fixture.detectChanges();
        const notice = fixture.nativeElement.querySelector('.notice') as HTMLElement;
        const card = notice.closest('.card') as HTMLElement;
        expect(notice.scrollWidth).toBeLessThanOrEqual(card.clientWidth);
        expect(getComputedStyle(notice).backgroundColor).toBe(dark ? 'rgb(23, 61, 77)' : 'rgb(238, 248, 252)');
      } finally {
        fixture.destroy();
        document.documentElement.classList.toggle('dark', wasDark);
      }
    });
  }

  it('shows accessible View and Download icon actions with tooltips', () => {
    const fixture = TestBed.createComponent(ManagerCaseViewPageComponent);
    fixture.detectChanges();
    const actions = [...(fixture.nativeElement as HTMLElement).querySelectorAll('.document-actions button')] as HTMLButtonElement[];
    expect(actions).toHaveSize(2);
    expect(actions.map(button => button.title)).toEqual(['View', 'Download']);
    expect(actions.map(button => button.getAttribute('aria-label'))).toEqual(['View offer.pdf', 'Download offer.pdf']);
    expect(actions.every(button => button.querySelector('svg[aria-hidden="true"]') !== null)).toBeTrue();
    expect(actions.every(button => button.disabled === false)).toBeTrue();
  });

  it('shows case actions to assigned advisors but not to a student without a workspace role', () => {
    api.workspace.and.returnValue(of({ role: 'advisor' }));
    const advisor = TestBed.createComponent(ManagerCaseViewPageComponent);
    advisor.detectChanges();
    expect((advisor.nativeElement as HTMLElement).querySelectorAll('.related-actions .edit')).toHaveSize(2);

    api.workspace.and.returnValue(throwError(() => new Error('No staff entitlement')));
    const student = TestBed.createComponent(ManagerCaseViewPageComponent);
    student.detectChanges();
    expect((student.nativeElement as HTMLElement).querySelector('.related-actions')).toBeNull();
    expect(student.componentInstance.canShowCaseActions).toBeFalse();
  });

  it('edits fields in their display positions and saves them with one case request', () => {
    const fixture = TestBed.createComponent(ManagerCaseViewPageComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    (root.querySelector('.related-item.selected .edit') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(root.querySelector('.case-edit-form')).toBeNull();
    expect(root.querySelector('.student-overview input[formControlName="studentName"]')).not.toBeNull();
    expect(root.querySelector('.student-overview input[formControlName="studentEmail"]')).not.toBeNull();
    expect(root.querySelectorAll('.inline-identity-fields input')).toHaveSize(4);
    expect(root.querySelector('.student-overview input[formControlName="courseName"]')).not.toBeNull();
    expect(root.querySelectorAll('.student-overview.editing .overview-facts > div')).toHaveSize(4);
    expect(root.querySelectorAll('.student-overview.editing .overview-facts dt .fact-icon')).toHaveSize(4);
    expect(root.querySelector('.student-overview.editing .inline-readonly-value')?.textContent).toContain('16 Oct 2026');
    expect(root.querySelector('.progress-heading-row.editing h2')?.textContent).toBe('Case Progress');
    expect(root.querySelector('.progress-heading-row.editing app-manager-select[formControlName="currentStage"]')).not.toBeNull();
    expect(root.querySelector('.student-overview app-manager-select[formControlName="collegeId"]')).not.toBeNull();
    expect(root.querySelector('.page-header app-manager-select[formControlName="status"]')).not.toBeNull();
    expect(root.querySelector('.progress-card app-manager-select[formControlName="currentStage"]')).not.toBeNull();
    expect(root.querySelector('.related-item.selected .edit')).toBeNull();
    expect(root.querySelector('.related-item.selected .archive')).toBeNull();
    expect(root.querySelector('.related-item.selected .save')).not.toBeNull();

    fixture.componentInstance.editForm.patchValue({ studentName: 'Updated Student', studentEmail: 'new@example.com', mobile: '0412 345 678', phone: '07 1234 5678', courseName: 'Business English', collegeId: 'college-1', advisorId: 'advisor-1' });
    fixture.componentInstance.saveEdit();
    expect(api.updateCase).toHaveBeenCalledWith('case-1', jasmine.objectContaining({
      recordVersion: 1, studentName: 'Updated Student', studentEmail: 'new@example.com',
      mobile: '0412 345 678', phone: '07 1234 5678', courseName: 'Business English', collegeId: 'college-1', advisorId: 'advisor-1',
      status: 'in_progress', currentStage: 'imported_pending_review',
    }), jasmine.any(String));
    fixture.detectChanges();
    expect(root.querySelector('.related-item.selected .edit')).not.toBeNull();
    expect(root.querySelector('.related-item.selected .save')).toBeNull();
    expect(root.textContent).toContain('Business English');
    expect(root.querySelector('app-manager-toast .toast[role="status"]')?.textContent).toContain('Case saved.');
  });

  it('shows the shared translucent loading overlay while edit options load', () => {
    const choices = new Subject<{ advisors: { advisorId: string; code: string; name: string; xeroLabel: string }[]; colleges: { collegeId: string; name: string }[] }>();
    api.caseEditOptions.and.returnValue(choices.asObservable());
    const fixture = TestBed.createComponent(ManagerCaseViewPageComponent);
    fixture.detectChanges();
    fixture.componentInstance.beginEdit('case-1');
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.edit-loading-overlay app-manager-list-loader')).not.toBeNull();
    expect(root.querySelector('.case-page')?.getAttribute('aria-busy')).toBe('true');
    choices.next({ advisors: [], colleges: [] });
    choices.complete();
    fixture.detectChanges();
    expect(root.querySelector('.edit-loading-overlay')).toBeNull();
    expect(root.querySelector('.case-page')?.getAttribute('aria-busy')).toBe('false');
  });

  for (const width of [390, 900, 1440]) for (const dark of [false, true]) {
    it(`lays out the compact case editor without overflow at ${width}px in ${dark ? 'dark' : 'light'} mode`, () => {
      const fixture = TestBed.createComponent(ManagerCaseViewPageComponent);
      fixture.detectChanges();
      fixture.componentInstance.beginEdit('case-1');
      fixture.detectChanges();
      const frame = document.createElement('iframe');
      frame.style.width = `${width}px`;
      frame.style.height = '900px';
      document.body.appendChild(frame);
      try {
        const doc = frame.contentDocument!, win = frame.contentWindow!;
        document.querySelectorAll('style').forEach(style => doc.head.appendChild(style.cloneNode(true)));
        doc.documentElement.classList.toggle('dark', dark);
        doc.body.style.margin = '0';
        const host = fixture.nativeElement.cloneNode(true) as HTMLElement;
        host.style.display = 'block'; host.style.width = '100%';
        doc.body.appendChild(host);
        const card = doc.querySelector('.student-overview.editing') as HTMLElement;
        const identity = card.querySelector('.student-name') as HTMLElement;
        const facts = card.querySelector('.overview-facts') as HTMLElement;
        const field = (name: string) => card.querySelector(`[formControlName="${name}"]`) as HTMLElement;
        const name = field('studentName').getBoundingClientRect();
        const email = field('studentEmail').getBoundingClientRect();
        const mobile = field('mobile').getBoundingClientRect();
        const phone = field('phone').getBoundingClientRect();
        const factBoxes = [...facts.children].map(element => element.getBoundingClientRect());
        expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth + 1);
        expect(card.querySelectorAll('.inline-identity-fields input')).toHaveSize(4);
        expect(doc.querySelector('.inline-status app-manager-select[formControlName="status"]')).not.toBeNull();
        expect(card.querySelector('#case-edit-student-reference')?.textContent).toContain('STD-1');
        expect(field('studentName').getAttribute('aria-describedby')).toBe('case-edit-student-reference');
        for (const input of card.querySelectorAll('input')) {
          expect(input.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
          expect(input.getBoundingClientRect().right).toBeLessThanOrEqual(card.getBoundingClientRect().right);
        }
        expect(win.getComputedStyle(field('studentName')).backgroundColor).toBe(dark ? 'rgb(38, 52, 73)' : 'rgb(255, 255, 255)');
        expect(win.getComputedStyle(card).backgroundColor).toBe(dark ? 'rgb(30, 41, 59)' : 'rgb(255, 255, 255)');
        if (width > 1100) {
          expect(identity.getBoundingClientRect().right).toBeLessThanOrEqual(facts.getBoundingClientRect().left);
          expect(Math.abs(identity.getBoundingClientRect().top - facts.getBoundingClientRect().top)).toBeLessThan(2);
        } else {
          expect(facts.getBoundingClientRect().top).toBeGreaterThanOrEqual(identity.getBoundingClientRect().bottom);
        }
        if (width > 600) {
          expect(name.top).toBe(email.top);
          expect(mobile.top).toBe(phone.top);
          expect(mobile.top).toBeGreaterThan(name.bottom);
          expect(factBoxes[0].top).toBe(factBoxes[1].top);
          expect(factBoxes[2].top).toBe(factBoxes[3].top);
          expect(factBoxes[2].top).toBeGreaterThan(factBoxes[0].bottom);
        } else {
          expect(email.top).toBeGreaterThan(name.bottom);
          expect(mobile.top).toBeGreaterThan(email.bottom);
          expect(phone.top).toBeGreaterThan(mobile.bottom);
          expect(factBoxes[1].top).toBeGreaterThan(factBoxes[0].bottom);
        }
        expect(api.updateCase).not.toHaveBeenCalled();
      } finally {
        frame.remove(); fixture.destroy();
      }
    });
  }

  it('shows the same overlay until the case save finishes', () => {
    const pending = new Subject<{ caseId: string; recordVersion: number }>();
    api.updateCase.and.returnValue(pending.asObservable());
    const fixture = TestBed.createComponent(ManagerCaseViewPageComponent);
    fixture.detectChanges();
    fixture.componentInstance.beginEdit('case-1');
    fixture.componentInstance.saveEdit();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.edit-loading-overlay')?.textContent).toContain('Saving case…');
    expect(root.querySelector('.case-page')?.getAttribute('aria-busy')).toBe('true');
    pending.next({ caseId: 'case-1', recordVersion: 2 });
    pending.complete();
    fixture.detectChanges();
    expect(root.querySelector('.edit-loading-overlay')).toBeNull();
    expect(root.querySelector('.case-page')?.getAttribute('aria-busy')).toBe('false');
    expect(root.querySelector('app-manager-toast .toast[role="status"]')?.textContent).toContain('Case saved.');
  });

  it('dismisses the save toast on close or after a few seconds', fakeAsync(() => {
    const fixture = TestBed.createComponent(ManagerCaseViewPageComponent);
    fixture.detectChanges();
    fixture.componentInstance.beginEdit('case-1');
    fixture.componentInstance.saveEdit();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('app-manager-toast .toast[role="status"]')).not.toBeNull();
    (root.querySelector('app-manager-toast button[aria-label="Close notification"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(root.querySelector('app-manager-toast')).toBeNull();

    fixture.componentInstance.beginEdit('case-1');
    fixture.componentInstance.saveEdit();
    fixture.detectChanges();
    expect(root.querySelector('app-manager-toast')).not.toBeNull();
    tick(4000);
    fixture.detectChanges();
    expect(root.querySelector('app-manager-toast')).toBeNull();
  }));

  it('filters stages by the selected status and does not save an invalid email', () => {
    const fixture = TestBed.createComponent(ManagerCaseViewPageComponent);
    fixture.detectChanges();
    fixture.componentInstance.beginEdit('case-1');
    fixture.detectChanges();
    fixture.componentInstance.editForm.controls.status.setValue('pre_sale');
    expect(fixture.componentInstance.stageOptions.map(item => item.value)).toEqual(['documents_requested', 'awaiting_payment']);
    fixture.componentInstance.editForm.controls.studentEmail.setValue('not-an-email');
    fixture.componentInstance.saveEdit();
    expect(api.updateCase).not.toHaveBeenCalled();
    expect(fixture.componentInstance.editError).toContain('required fields');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('app-manager-toast .toast[role="alert"]')).not.toBeNull();
  });
  it('removes retired progress steps and puts both new statuses under Payment Monitoring only',()=>{
    const f=TestBed.createComponent(ManagerCaseViewPageComponent);f.detectChanges();const c=f.componentInstance;
    expect(c.workflowStages.map(stage=>stage.value)).not.toContain('payment_received');
    expect(c.workflowStages.map(stage=>stage.value)).not.toContain('invoices_created');
    const progress=f.nativeElement.querySelector('.stage-list') as HTMLElement;
    expect(progress.textContent).not.toContain('Invoices Created');expect(progress.textContent).not.toContain('Payment Received');
    c.beginEdit('case-1');f.detectChanges();c.editForm.controls.status.setValue('in_progress');
    expect(c.stageOptions.map(stage=>stage.value)).toEqual(['imported_pending_review']);
    for(const status of ['awaiting_payment','payment_received']){
      c.editForm.controls.status.setValue(status);expect(c.stageOptions.map(stage=>stage.value)).toEqual(['payment_monitoring']);
    }
    expect(c.statusLabel('payment_received')).toBe('Payment Received');expect(c.statusLabel('awaiting_payment')).toBe('Awaiting Payment');f.destroy();
  });

  it('opens a fetched PDF in a new tab with its preview MIME type', () => {
    const fixture = TestBed.createComponent(ManagerCaseViewPageComponent);
    fixture.detectChanges();
    const preview = { opener: window, closed: false, location: { href: '' }, close: jasmine.createSpy('close') };
    const open = spyOn(window, 'open').and.returnValue(preview as unknown as Window);
    const createUrl = spyOn(URL, 'createObjectURL').and.returnValue('blob:case-preview');
    api.caseDocumentContent.and.returnValue(of(new Blob(['%PDF-1.7'], { type: 'application/octet-stream' })));

    const button = (fixture.nativeElement as HTMLElement).querySelector('.document-actions button') as HTMLButtonElement;
    button.click();

    expect(open).toHaveBeenCalledWith('about:blank', '_blank');
    expect(preview.opener).toBeNull();
    expect(api.caseDocumentContent).toHaveBeenCalledWith('case-1', 'document-1');
    expect((createUrl.calls.mostRecent().args[0] as Blob).type).toBe('application/pdf');
    expect(preview.location.href).toBe('blob:case-preview');
    expect(fixture.componentInstance.viewingId).toBeNull();
  });

  it('keeps the download action on the authorized document-content endpoint', () => {
    const fixture = TestBed.createComponent(ManagerCaseViewPageComponent);
    fixture.detectChanges();
    api.caseDocumentContent.and.returnValue(of(new Blob(['file'], { type: 'application/octet-stream' })));
    spyOn(URL, 'createObjectURL').and.returnValue('blob:case-download');
    const click = spyOn(HTMLAnchorElement.prototype, 'click');

    const button = (fixture.nativeElement as HTMLElement).querySelectorAll('.document-actions button')[1] as HTMLButtonElement;
    button.click();

    expect(api.caseDocumentContent).toHaveBeenCalledWith('case-1', 'document-1');
    expect(click).toHaveBeenCalled();
    expect(fixture.componentInstance.downloadingId).toBeNull();
  });

  it('keeps download available when a file type is not safe to preview', () => {
    api.caseDocuments.and.returnValue(of({ documents: [{
      documentId: 'document-2', fileName: 'diagram.svg', mimeType: 'image/svg+xml', sizeBytes: 1024,
      sourceKind: 'contacts', lastSeenAt: '2026-10-16T00:00:00Z',
    }], discovery: [], discoveryRequested: true, total: 1, page: 1, limit: 25 }));
    const fixture = TestBed.createComponent(ManagerCaseViewPageComponent);
    fixture.detectChanges();
    const actions = [...(fixture.nativeElement as HTMLElement).querySelectorAll('.document-actions button')] as HTMLButtonElement[];
    expect(actions[0].disabled).toBeTrue();
    expect(actions[0].title).toBe('Preview unavailable; download instead');
    expect(actions[1].disabled).toBeFalse();
  });

  it('offers replacement for every document and deletion only for new Files uploads',()=>{
    api.caseDocuments.and.returnValue(of({documents:[
      {documentId:'legacy',fileName:'legacy.pdf',mimeType:'application/pdf',sizeBytes:20,sourceKind:'Contacts',lastSeenAt:'2026-10-16',documentTypeId:'passport-type',documentTypeName:'Passport',canReplaceFile:true,canDelete:false},
      {documentId:'files',fileName:'new.pdf',mimeType:'application/pdf',sizeBytes:20,sourceKind:'Contacts',lastSeenAt:'2026-10-16',documentTypeId:'passport-type',documentTypeName:'Passport',canReplaceFile:true,canDelete:true},
    ],discovery:[],discoveryRequested:true,total:2,page:1,limit:25}));
    const fixture=TestBed.createComponent(ManagerCaseViewPageComponent);fixture.detectChanges();const root=fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('button[title="Replace document"]').length).toBe(2);expect(root.querySelectorAll('button[title="Delete document"]').length).toBe(1);
    expect(root.querySelector('.case-record-card > input[type="file"]')).toBeNull();
    (root.querySelector('button[aria-label="Replace legacy.pdf"]') as HTMLButtonElement).click();fixture.detectChanges();
    const replaceDialog=root.querySelector('app-case-document-actions dialog') as HTMLDialogElement;
    expect(replaceDialog.open).toBeTrue();expect(replaceDialog.textContent).toContain('Replace document');
    expect((replaceDialog.querySelector('[aria-label="Document type"]') as HTMLButtonElement).disabled).toBeTrue();
    expect(api.replaceCaseDocument).not.toHaveBeenCalled();
    const dialog=root.querySelector('.document-mutation-dialog') as HTMLDialogElement;expect(dialog.open).toBeFalse();
    (replaceDialog.querySelector('button[aria-label="Close dialog"]') as HTMLButtonElement).click();fixture.detectChanges();
    (root.querySelector('button[aria-label="Delete new.pdf"]') as HTMLButtonElement).click();fixture.detectChanges();expect(dialog.open).toBeTrue();expect(dialog.textContent).toContain('cannot be undone');
    (dialog.querySelector('.mutation-confirm') as HTMLButtonElement).click();fixture.detectChanges();expect(api.deleteCaseDocument).toHaveBeenCalledWith('case-1','files',jasmine.any(String));expect(dialog.open).toBeFalse();
  });

  it('shows an access-safe error when the case cannot be read', () => {
    api.caseDetail.and.returnValue(throwError(() => new Error('private backend error')));
    const fixture = TestBed.createComponent(ManagerCaseViewPageComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Case unavailable');
    expect(fixture.nativeElement.textContent).not.toContain('private backend error');
    expect(api.caseInvoices).not.toHaveBeenCalled();
  });

  it('shows all overview icons and a recorded mobile number', () => {
    api.caseDetail.and.returnValue(of({ ...detail, studentPhone: '0412 345 678' }));
    const fixture = TestBed.createComponent(ManagerCaseViewPageComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('.overview-facts .fact-icon svg').length).toBe(4);
    expect(root.querySelector('.student-identifiers a[href="mailto:student@example.com"]')).not.toBeNull();
    expect(root.querySelector('.student-identifiers a[href="tel:0412345678"]')?.textContent).toContain('0412 345 678');
  });

  it('shows imported as the green first step only while a migrated case awaits review', () => {
    const fixture = TestBed.createComponent(ManagerCaseViewPageComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const steps = [...root.querySelectorAll('.stage-list li')] as HTMLElement[];
    expect(steps).toHaveSize(6);
    expect(steps[0].textContent).toContain('Imported — Pending Review');
    expect(steps[0].classList.contains('current')).toBeTrue();
    expect(steps[0].getAttribute('aria-current')).toBe('step');
    expect(steps.slice(1).every(step => !step.classList.contains('current'))).toBeTrue();
    expect(steps[5].textContent).toContain('Payments Complete');
    const stageList = root.querySelector('.stage-list') as HTMLElement;
    expect(getComputedStyle(stageList).flexWrap).toBe('nowrap');
    expect(getComputedStyle(stageList).overflowX).toBe('auto');
    expect(root.querySelector('.stage-list')?.textContent).not.toContain('Current');
    expect(root.textContent).not.toContain('Stages shown here do not imply');

    api.caseDetail.and.returnValue(of({ ...detail, currentStage: 'awaiting_payment', status: 'pre_sale' }));
    const normal = TestBed.createComponent(ManagerCaseViewPageComponent);
    normal.detectChanges();
    const normalSteps = [...normal.nativeElement.querySelectorAll('.stage-list li')] as HTMLElement[];
    expect(normalSteps).toHaveSize(5);
    expect(normalSteps.map(step => step.textContent).join(' ')).not.toContain('Imported — Pending Review');
    expect(normalSteps[2].classList.contains('current')).toBeTrue();
    expect(normal.nativeElement.textContent).toContain('Pre-sale');
  });

  it('omits the phone when the student has none recorded', () => {
    const fixture = TestBed.createComponent(ManagerCaseViewPageComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.student-identifiers a[href^="tel:"]')).toBeNull();
    expect(root.querySelector('.student-identifiers')?.textContent).not.toContain('Not recorded');
  });

  it('fits the six current timeline steps on desktop and scrolls one row on mobile', () => {
    const fixture = TestBed.createComponent(ManagerCaseViewPageComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    root.style.width = '1440px';
    const list = root.querySelector('.stage-list') as HTMLElement;
    expect(list.scrollWidth).toBeLessThanOrEqual(list.clientWidth + 1);
    root.style.width = '390px';
    const steps = [...list.querySelectorAll('li')] as HTMLElement[];
    expect(list.scrollWidth).toBeGreaterThan(list.clientWidth);
    expect(steps[0].getBoundingClientRect().top).toBe(steps[5].getBoundingClientRect().top);
  });

  it('keeps long invoice lists inside a scrollable card with a visible table header', () => {
    const invoices = Array.from({ length: 25 }, (_, index) => ({
      invoiceId: `invoice-${index}`, invoiceNumber: `INV-${index}`, type: 'ACCREC', status: 'PAID',
      date: '2026-10-16', dueDate: '2026-10-20', amountDue: '0', currency: 'AUD',
    }));
    api.caseInvoices.and.returnValue(of({ invoices, total: 25, page: 1, limit: 25 }));
    const fixture = TestBed.createComponent(ManagerCaseViewPageComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const cards = [...root.querySelectorAll('.case-record-card')] as HTMLElement[];
    const invoiceScroll = cards[1].querySelector('.record-table-scroll') as HTMLElement;
    const documentScroll = cards[0].querySelector('.record-table-scroll') as HTMLElement;

    expect(cards).toHaveSize(2);
    expect(invoiceScroll.getAttribute('tabindex')).toBe('0');
    expect(documentScroll.getAttribute('aria-label')).toBe('Case documents');
    expect(invoiceScroll.scrollHeight).toBeGreaterThan(invoiceScroll.clientHeight);
    expect(getComputedStyle(invoiceScroll).overflowY).toBe('auto');
    expect(getComputedStyle(invoiceScroll.querySelector('th')!).position).toBe('sticky');
    if (window.innerWidth > 760) {
      expect(cards[0].getBoundingClientRect().height).toBe(cards[1].getBoundingClientRect().height);
      expect(cards[1].getBoundingClientRect().width).toBeGreaterThan(cards[0].getBoundingClientRect().width);
    }
  });

  for(const width of [390,1440]) for(const dark of [false,true]) {
    it(`can reach the last invoice with compact non-underlined links at ${width}px in ${dark?'dark':'light'} mode`,()=>{
      const invoices=Array.from({length:25},(_,index)=>({invoiceId:`invoice-${index}`,invoiceNumber:`INV-${index}`,reference:'Fixture College',type:'ACCREC',status:'DRAFT',date:'2026-10-28',dueDate:'2027-01-15',amountDue:'100',currency:'AUD'}));
      api.caseInvoices.and.returnValue(of({invoices,total:25,page:1,limit:25}));
      const fixture=TestBed.createComponent(ManagerCaseViewPageComponent);fixture.detectChanges();
      const frame=document.createElement('iframe');frame.style.width=`${width}px`;frame.style.height='900px';document.body.appendChild(frame);
      try{
        const doc=frame.contentDocument!,win=frame.contentWindow!;
        document.querySelectorAll('style').forEach(style=>doc.head.appendChild(style.cloneNode(true)));
        doc.documentElement.classList.toggle('dark',dark);doc.body.style.margin='0';
        const host=fixture.nativeElement.cloneNode(true) as HTMLElement;host.style.display='block';doc.body.appendChild(host);
        const scroll=host.querySelector('[aria-label="Linked case invoices"]') as HTMLElement;
        const card=scroll.closest('.case-record-card') as HTMLElement;
        expect(scroll.clientHeight).toBeGreaterThan(44);expect(scroll.scrollHeight).toBeGreaterThan(scroll.clientHeight);
        expect(scroll.getBoundingClientRect().bottom).toBeLessThanOrEqual(card.getBoundingClientRect().bottom);
        scroll.scrollTop=scroll.scrollHeight;
        expect(scroll.scrollTop).toBeGreaterThan(0);
        const last=scroll.querySelector('tbody tr:last-child') as HTMLElement;
        expect(last.getBoundingClientRect().bottom).toBeLessThanOrEqual(scroll.getBoundingClientRect().bottom+1);
        const link=scroll.querySelector('.invoice-number') as HTMLElement;
        expect(win.getComputedStyle(link).textDecorationLine).toBe('none');
        expect(link.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
        const number=link.querySelector('span')!,reference=link.querySelector('small')!;
        expect(reference.getBoundingClientRect().top-number.getBoundingClientRect().bottom).toBeLessThan(5);
        expect(win.getComputedStyle(reference).textDecorationLine).toBe('none');
      }finally{frame.remove();fixture.destroy();}
    });
  }

  it('keeps sparse case cards compact and aligned instead of reserving a tall empty row', () => {
    api.caseDocuments.and.returnValue(of({ documents: [], discovery: [], discoveryRequested: true, total: 0, page: 1, limit: 25 }));
    const fixture = TestBed.createComponent(ManagerCaseViewPageComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const documents = root.querySelector('.case-record-card') as HTMLElement;
    const invoices = root.querySelectorAll('.case-record-card')[1] as HTMLElement;
    const activity = root.querySelector('.activity-card') as HTMLElement;
    const actions = root.querySelector('.case-actions-card') as HTMLElement;

    expect(documents.textContent).toContain('No documents were found');
    if (window.innerWidth > 760) {
      expect(getComputedStyle(documents).minHeight).toBe('320px');
      expect(getComputedStyle(documents).maxHeight).toBe('576px');
      expect(getComputedStyle(activity).minHeight).toBe('256px');
      expect(getComputedStyle(activity).maxHeight).toBe('448px');
      expect(documents.getBoundingClientRect().height).toBe(invoices.getBoundingClientRect().height);
      expect(documents.getBoundingClientRect().height).toBeLessThan(480);
    } else {
      expect(getComputedStyle(documents).maxHeight).toBe('none');
      expect(getComputedStyle(activity).maxHeight).toBe('none');
    }
    if (window.innerWidth > 1250) {
      expect(invoices.getBoundingClientRect().height).toBe(actions.getBoundingClientRect().height);
      expect(activity.getBoundingClientRect().height).toBeLessThan(420);
    }
  });

  it('places activity beside case summary and scrolls a long activity history inside the card', () => {
    const activity = Array.from({ length: 25 }, (_, index) => ({
      activityId: `activity-${index}`, eventType: 'case.updated', summary: `Case event ${index}`,
      createdAt: '2026-10-16T00:00:00Z',
    }));
    api.caseActivity.and.returnValue(of({ activity, page: 1, limit: 25 }));
    const fixture = TestBed.createComponent(ManagerCaseViewPageComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const grid = root.querySelector('.content-grid') as HTMLElement;
    const cards = [...grid.querySelectorAll(':scope > .card')] as HTMLElement[];
    const activityScroll = cards[3].querySelector('.activity-scroll') as HTMLElement;

    expect(cards.map(card => card.querySelector('h2')?.textContent?.trim())).toEqual([
      'Documents 1', 'Linked invoices 1', 'Next Actions', 'Recent activity', 'Case at a glance', 'Meet Sophia',
    ]);
    expect(root.querySelector('.workspace-sidebar .case-summary')).toBeNull();
    expect(activityScroll.getAttribute('aria-label')).toBe('Recent case activity');
    expect(activityScroll.getAttribute('tabindex')).toBe('0');
    expect(cards[4].querySelector('.summary-scroll')?.getAttribute('aria-label')).toBe('Case summary');
    expect(activityScroll.scrollHeight).toBeGreaterThan(activityScroll.clientHeight);
    expect(getComputedStyle(activityScroll).overflowY).toBe('auto');
    if (window.innerWidth > 1250) {
      expect(cards[3].getBoundingClientRect().height).toBe(cards[4].getBoundingClientRect().height);
      expect(cards[3].getBoundingClientRect().top).toBe(cards[5].getBoundingClientRect().top);
    }
  });

  it('reserves a noninteractive Sophia and next-actions column without inventing pending tasks', () => {
    const fixture = TestBed.createComponent(ManagerCaseViewPageComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const grid = root.querySelector('.content-grid') as HTMLElement;
    const actions = grid.querySelector('.case-actions-card') as HTMLElement;
    const sophia = grid.querySelector('.sophia-card') as HTMLElement;
    const image = sophia.querySelector('img') as HTMLImageElement;
    const buttons = [...sophia.querySelectorAll('button')] as HTMLButtonElement[];

    expect(actions.textContent).toContain('No checklist is configured for this case status yet.');
    expect(actions.textContent).not.toContain('pending');
    expect(sophia.textContent).toContain('Sophia AI Runtime is connected');
    expect(sophia.textContent).not.toContain('Online');
    expect(image.getAttribute('src')).toBe('/assets/avatars/SophiaAiRuntime.jpg');
    expect(buttons.map(button => button.textContent?.trim())).toEqual(['Chat with Sophia', 'Open full Sophia']);
    expect(buttons.every(button => button.disabled)).toBeTrue();
    if (window.innerWidth > 1250) {
      const cards = [...grid.querySelectorAll(':scope > .card')] as HTMLElement[];
      expect(cards[0].getBoundingClientRect().height).toBe(cards[2].getBoundingClientRect().height);
      expect(cards[3].getBoundingClientRect().height).toBe(cards[5].getBoundingClientRect().height);
    }
    expect(sophia.scrollHeight).toBeLessThanOrEqual(sophia.clientHeight + 2);
  });

  it('styles the new cards for dark mode without enabling their controls', () => {
    const wasDark = document.documentElement.classList.contains('dark');
    document.documentElement.classList.add('dark');
    try {
      const fixture = TestBed.createComponent(ManagerCaseViewPageComponent);
      fixture.detectChanges();
      const root = fixture.nativeElement as HTMLElement;
      const actionScroll = root.querySelector('.action-scroll') as HTMLElement;
      const message = root.querySelector('.sophia-message') as HTMLElement;
      const button = root.querySelector('.sophia-button.primary') as HTMLButtonElement;
      expect(getComputedStyle(actionScroll).backgroundColor).toBe('rgb(32, 46, 65)');
      expect(getComputedStyle(message).backgroundColor).toBe('rgb(43, 54, 80)');
      expect(button.disabled).toBeTrue();
    } finally {
      if (!wasDark) document.documentElement.classList.remove('dark');
    }
  });

  it('does not invent financial amounts when the API redacts them', () => {
    api.caseInvoices.and.returnValue(of({ invoices: [{
      invoiceId: 'invoice-2', invoiceNumber: 'INV-REDACTED', type: 'ACCREC', status: 'DRAFT',
      date: null, dueDate: null,
    }], total: 1, page: 1, limit: 25 }));
    const fixture = TestBed.createComponent(ManagerCaseViewPageComponent);
    fixture.detectChanges();
    const row = fixture.nativeElement.querySelector('#invoices-heading')?.closest('section')?.querySelector('tbody tr') as HTMLElement;
    expect(row.textContent).toContain('INV-REDACTED');
    expect(row.textContent).toContain('Ref: —');
    expect(row.querySelector('td:nth-child(4)')?.textContent?.trim()).toBe('—');
    expect(row.querySelector('td:nth-last-child(2)')?.textContent?.trim()).toBe('—');
    expect(row.querySelector('td:last-child')?.textContent?.trim()).toBe('—');
  });

  it('shows the paid amount separately from the remaining due balance', () => {
    api.caseInvoices.and.returnValue(of({ invoices: [{
      invoiceId: 'invoice-8602', invoiceNumber: 'INV-8602', type: 'ACCREC', status: 'PAID',
      reference: 'ECA COLLEGE', paymentTrack: 'Student → college',
      date: '2026-08-16', dueDate: '2026-08-16', amountPaid: '2100.00', amountDue: '0.00', currency: 'AUD',
    }], total: 1, page: 1, limit: 25 }));
    const fixture = TestBed.createComponent(ManagerCaseViewPageComponent);
    fixture.detectChanges();
    const table = fixture.nativeElement.querySelector('#invoices-heading')?.closest('section')?.querySelector('table') as HTMLTableElement;
    const headings = [...table.querySelectorAll('th')].map(th => th.textContent?.trim());
    const cells = [...table.querySelectorAll('tbody td')].map(td => td.textContent?.trim());

    expect(headings).toEqual(['Invoice', 'Date / Due', 'Status', 'Track', 'Paid', 'Due']);
    expect(cells[0]).toContain('INV-8602');
    expect(cells[0]).toContain('Ref: ECA COLLEGE');
    expect(cells[0]).not.toContain('ACCREC');
    expect(cells[3]).toBe('Student → college');
    expect(cells[4]).toBe('$2,100.00');
    expect(cells[5]).toBe('$0.00');
    expect(getComputedStyle(table).minWidth).toBe('576px');
  });

  it('shortens the awaiting-payment status in case details and identifies unnumbered overpayments', () => {
    api.caseInvoices.and.returnValue(of({ invoices: [
      { invoiceId: 'invoice-3501', invoiceNumber: 'INV-3501', type: 'ACCREC', status: 'AUTHORISED',
        reference: null, paymentTrack: 'Pending', date: '2022-08-17', dueDate: '2022-08-17' },
      { invoiceId: 'overpayment-1', invoiceNumber: null, type: 'RECEIVE-OVERPAYMENT', status: 'PAID',
        reference: null, paymentTrack: null, date: '2021-01-27', dueDate: null },
    ], total: 2, page: 1, limit: 25 }));
    const fixture = TestBed.createComponent(ManagerCaseViewPageComponent);
    fixture.detectChanges();
    const rows = [...(fixture.nativeElement as HTMLElement).querySelectorAll('.invoice-table tbody tr')] as HTMLElement[];
    expect(rows[0].querySelector('.invoice-status')?.textContent?.trim()).toBe('Awaiting');
    expect(rows[0].textContent).toContain('Pending');
    expect(rows[0].textContent).not.toContain('AUTHORISED');
    expect(rows[1].querySelector('td')?.textContent).toContain('Overpayment');
    expect(rows[1].textContent).not.toContain('RECEIVE-OVERPAYMENT');
  });

  it('recovers student identity from the register when an older case API omits it', () => {
    api.caseDetail.and.returnValue(of({ ...detail, studentName: null, studentEmail: null, openedOn: null }));
    api.studentRegister.and.returnValue(of({ students: [{
      userId: 'user-1', studentReference: 'STD-1', legalName: 'Recovered Student', email: 'recovered@example.com',
    }], page: 1, limit: 25, total: 1 }));
    const fixture = TestBed.createComponent(ManagerCaseViewPageComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.student-name')?.textContent).toContain('Recovered Student');
    expect(root.querySelector('.student-name')?.textContent).not.toContain('Student name unavailable');
    expect(root.textContent).toContain('16 Oct 2026');
    expect(api.studentRegister).toHaveBeenCalledWith({ page: 1, limit: 25, q: 'STD-1' });
  });
});
