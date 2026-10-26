import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PersistanceService } from '../../shared/services/persistance.service';
import { StudentOperationsService } from './student-operations.service';

describe('StudentOperationsService', () => {
  let service: StudentOperationsService;
  let http: HttpTestingController;
  let credential: string | null;

  beforeEach(() => {
    credential = 'business-manager-token';
    TestBed.configureTestingModule({ providers: [
      StudentOperationsService,
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: PersistanceService, useValue: { get: () => credential } },
    ] });
    service = TestBed.inject(StudentOperationsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());
  it('reads local invoice proposals and prepares them with authenticated idempotency, without provider paths',()=>{
    service.caseInvoiceDrafts('case/id').subscribe();const read=http.expectOne(r=>r.url.endsWith('/cases/case%2Fid/invoice-drafts'));expect(read.request.headers.get('Authorization')).toBe('Token business-manager-token');read.flush({batches:[],preparation:null});
    const value={offerId:'offer',caseVersion:1,invoices:[]};service.prepareCaseInvoiceDrafts('case/id',value,'draft-key').subscribe();const write=http.expectOne(r=>r.url.endsWith('/cases/case%2Fid/invoice-drafts'));expect(write.request.method).toBe('POST');expect(write.request.headers.get('Idempotency-Key')).toBe('draft-key');expect(write.request.body).toEqual(value);write.flush({batchId:'batch',count:8});
  });
  it('queues checking a saved file with authenticated idempotency and no file body',()=>{
    service.startDocumentAnalysis('case/id','doc/id','saved-check-key').subscribe();const request=http.expectOne(r=>r.url.endsWith('/cases/case%2Fid/documents/doc%2Fid/analysis/start'));expect(request.request.body).toEqual({});expect(request.request.headers.get('Idempotency-Key')).toBe('saved-check-key');expect(request.request.headers.get('Authorization')).toBe('Token business-manager-token');request.flush({queued:true});
  });
  it('loads document checks and sends review/retry with authentication and idempotency',()=>{
    service.documentAnalysis('case/id','doc/id').subscribe();const read=http.expectOne(r=>r.url.endsWith('/cases/case%2Fid/documents/doc%2Fid/analysis'));expect(read.request.headers.get('Authorization')).toBe('Token business-manager-token');read.flush({});
    const value={resultId:'result',expectedReviewVersion:1,decision:'confirmed',reason:'Checked',corrections:null};service.reviewDocumentAnalysis('case','doc',value,'review-key').subscribe();const review=http.expectOne(r=>r.url.endsWith('/analysis/review'));expect(review.request.body).toEqual(value);expect(review.request.headers.get('Idempotency-Key')).toBe('review-key');review.flush({});
    service.retryDocumentAnalysis('case','doc','job','retry-key').subscribe();const retry=http.expectOne(r=>r.url.endsWith('/analysis/retry'));expect(retry.request.body).toEqual({jobId:'job'});expect(retry.request.headers.get('Idempotency-Key')).toBe('retry-key');retry.flush({});
  });
  it('loads company-scoped document requirements by status without a client company identifier',()=>{
    service.documentRequirements('pre_sale').subscribe();const r=http.expectOne(q=>q.url.endsWith('/cases/document-requirements'));
    expect(r.request.method).toBe('GET');expect(r.request.params.get('status')).toBe('pre_sale');expect(r.request.params.has('companyId')).toBeFalse();expect(r.request.headers.get('Authorization')).toBe('Token business-manager-token');r.flush({requirements:[]});
  });
  it('reads and updates case-linked checklists with authentication, version and idempotency headers',()=>{
    service.caseChecklist('case/id').subscribe();
    const read=http.expectOne(r=>r.url.endsWith('/cases/case%2Fid/checklist'));
    expect(read.request.method).toBe('GET');expect(read.request.headers.get('Authorization')).toBe('Token business-manager-token');read.flush({status:'pre_sale',items:[]});
    const value={itemKey:'signed_engagement_letter',completed:true,recordVersion:0};service.updateCaseChecklist('case/id',value,'checklist-key').subscribe();
    const write=http.expectOne(r=>r.url.endsWith('/cases/case%2Fid/checklist'));
    expect(write.request.method).toBe('PATCH');expect(write.request.body).toEqual(value);expect(write.request.headers.get('Idempotency-Key')).toBe('checklist-key');
    expect(write.request.headers.get('Authorization')).toBe('Token business-manager-token');write.flush({status:'pre_sale',items:[]});
  });

  it('uses authenticated metadata requests and never sends a client company for document types',()=>{
    service.documentTypes().subscribe();const list=http.expectOne(r=>r.url.endsWith('/cases/document-types'));expect(list.request.headers.get('Authorization')).toBe('Token business-manager-token');list.flush({types:[]});
    service.createDocumentType({name:'Passport',required:true},'create-type-key').subscribe();const add=http.expectOne(r=>r.url.endsWith('/cases/document-types'));expect(add.request.body).toEqual({name:'Passport',required:true});expect(add.request.headers.get('Idempotency-Key')).toBe('create-type-key');add.flush({});
    service.updateDocumentType('type-1',{status:'archived',recordVersion:1},'archive-type-key').subscribe();const archive=http.expectOne(r=>r.url.endsWith('/cases/document-types/type-1'));expect(archive.request.method).toBe('PATCH');expect(archive.request.body.status).toBe('archived');archive.flush({});
  });
  it('uploads multipart bytes with a Contact identity and never a company, invoice target or forced content type',()=>{
    const file=new File(['pdf'],'passport.pdf',{type:'application/pdf'});
    service.uploadCaseDocument('case-1',file,'type-1','upload-key').subscribe();
    const request=http.expectOne(r=>r.url.endsWith('/cases/case-1/documents/upload'));
    expect(request.request.headers.get('Authorization')).toBe('Token business-manager-token');expect(request.request.headers.get('Idempotency-Key')).toBe('upload-key');
    expect(request.request.headers.has('Content-Type')).toBeFalse();
    const form=request.request.body as FormData;expect(form.get('file')).toEqual(file);expect(form.has('contactId')).toBeFalse();expect(form.has('connectionId')).toBeFalse();expect(form.get('documentTypeId')).toBe('type-1');expect(form.has('companyId')).toBeFalse();expect(form.has('sourceKind')).toBeFalse();request.flush({documentId:'document-1'});
  });

  it('creates a student and first case with one authenticated idempotent request', () => {
    const value={studentName:'Student',studentEmail:'student@example.test',mobile:null,phone:null,courseName:null,collegeId:null,advisorId:null,status:'pre_sale',currentStage:'documents_requested'};
    service.createStudentWithCase(value,'create-student-case-key').subscribe();
    const request=http.expectOne(candidate=>candidate.url.endsWith('/workspace/cases/student'));
    expect(request.request.method).toBe('POST');expect(request.request.body).toEqual(value);
    expect(request.request.headers.get('Idempotency-Key')).toBe('create-student-case-key');
    expect(request.request.headers.get('Authorization')).toContain('business-manager-token');
    request.flush({caseId:'case-1',recordVersion:1});
    service.createCase({userId:'user-1',courseName:null,collegeId:null,advisorId:null,status:'pre_sale',currentStage:'documents_requested'},'existing-student-case-key').subscribe();
    const next=http.expectOne(candidate=>candidate.url.endsWith('/workspace/cases'));
    expect(next.request.body.userId).toBe('user-1');
    expect(next.request.headers.get('Idempotency-Key')).toBe('existing-student-case-key');
    next.flush({caseId:'case-2',recordVersion:1});
  });

  it('loads case edit choices and submits one versioned, idempotent case update', () => {
    service.caseEditOptions().subscribe();
    const choices = http.expectOne(candidate => candidate.url.endsWith('/workspace/cases/edit-options'));
    expect(choices.request.method).toBe('GET');
    choices.flush({ advisors: [], colleges: [] });

    service.caseWorkflowOptions().subscribe();
    http.expectOne(candidate => candidate.url.endsWith('/workspace/cases/options')).flush({ statuses: [], stages: [], allowedStatuses: {} });

    const value = { recordVersion: 3, studentName: 'Student', studentEmail: 'student@example.test', mobile: null, phone: null, courseName: null, collegeId: null, advisorId: null, status: 'in_progress', currentStage: 'imported_pending_review' };
    service.updateCase('case-1', value, 'case-update-key').subscribe();
    const update = http.expectOne(candidate => candidate.url.endsWith('/workspace/cases/case-1'));
    expect(update.request.method).toBe('PATCH');
    expect(update.request.body).toEqual(value);
    expect(update.request.headers.get('Idempotency-Key')).toBe('case-update-key');
    update.flush({ caseId: 'case-1', recordVersion: 4 });
  });

  it('discovers the identity-bound workspace with an explicit credential', () => {
    service.workspace().subscribe();
    const request = http.expectOne((candidate) => candidate.url.endsWith(
      '/api/business-packs/student-operations/v1/workspace',
    ));
    expect(request.request.headers.get('Authorization')).toBe('Token business-manager-token');
    request.flush({ packId: 'student-operations' });
  });

  it('loads the initial Payments register without a browser-selected tenant or connection', () => {
    service.paymentsRegister({ page: 4, limit: 100, q: 'ATI', status: 'DRAFT', dateFrom: '2026-01-01', dateTo: '2026-12-31', paymentTrack: 'Pending', sort: 'date', direction: 'desc' }).subscribe();
    const request = http.expectOne(candidate => candidate.url.endsWith('/workspace/payments-register'));
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Token business-manager-token');
    expect(request.request.params.get('page')).toBe('4');
    expect(request.request.params.get('limit')).toBe('100');
    expect(request.request.params.get('paymentTrack')).toBe('Pending');
    expect(request.request.params.get('dateFrom')).toBe('2026-01-01');
    expect(request.request.params.has('tenantId')).toBeFalse();
    expect(request.request.params.has('connectionId')).toBeFalse();
    request.flush({ workspace: {}, connection: null, invoices: null, connectionIssue: 'unavailable' });
  });

  it('loads dashboard context and metrics with one request', () => {
    service.dashboard().subscribe();
    const request = http.expectOne((candidate) => candidate.url.endsWith(
      '/api/business-packs/student-operations/v1/workspace/dashboard',
    ));
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Token business-manager-token');
    request.flush({
      workspace: { packId: 'student-operations' },
      summary: { totalStudents: 0, activeStudents: 0, actionRequired: 0, onHold: 0 },
    });
  });

  it('reuses the last dashboard response without another request', () => {
    const dashboard = {
      workspace: { packId: 'student-operations' },
      summary: { totalStudents: 4, activeStudents: 3, actionRequired: 1, onHold: 0 },
    };
    const responses: unknown[] = [];

    service.dashboard().subscribe((response) => responses.push(response));
    http.expectOne((candidate) => candidate.url.endsWith('/workspace/dashboard')).flush(dashboard);

    service.dashboard().subscribe((response) => responses.push(response));
    http.expectNone((candidate) => candidate.url.endsWith('/workspace/dashboard'));
    expect(responses).toEqual([dashboard, dashboard]);
  });

  it('refreshes explicitly and replaces the cached dashboard', () => {
    service.dashboard().subscribe();
    http.expectOne((candidate) => candidate.url.endsWith('/workspace/dashboard')).flush({
      workspace: { packId: 'student-operations' },
      summary: { totalStudents: 1, activeStudents: 1, actionRequired: 0, onHold: 0 },
    });

    service.dashboard({ refresh: true }).subscribe();
    const refresh = http.expectOne((candidate) => candidate.url.endsWith('/workspace/dashboard'));
    expect(refresh.request.method).toBe('GET');
    refresh.flush({
      workspace: { packId: 'student-operations' },
      summary: { totalStudents: 2, activeStudents: 2, actionRequired: 0, onHold: 0 },
    });
  });

  it('does not reuse dashboard values after the credential changes', () => {
    service.dashboard().subscribe();
    http.expectOne((candidate) => candidate.url.endsWith('/workspace/dashboard')).flush({
      workspace: { packId: 'student-operations' },
      summary: { totalStudents: 1, activeStudents: 1, actionRequired: 0, onHold: 0 },
    });

    credential = 'another-user-token';
    service.dashboard().subscribe();
    const request = http.expectOne((candidate) => candidate.url.endsWith('/workspace/dashboard'));
    expect(request.request.headers.get('Authorization')).toBe('Token another-user-token');
    request.flush({
      workspace: { packId: 'student-operations' },
      summary: { totalStudents: 0, activeStudents: 0, actionRequired: 0, onHold: 0 },
    });
  });

  it('sends bounded student-list filters without a browser-selected tenant', () => {
    service.students({ page: 2, limit: 20, q: 'student', status: 'active' }).subscribe();
    const request = http.expectOne((candidate) => candidate.url.endsWith(
      '/api/business-packs/student-operations/v1/workspace/students',
    ));
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('limit')).toBe('20');
    expect(request.request.params.get('q')).toBe('student');
    expect(request.request.params.get('status')).toBe('active');
    expect(request.request.url).not.toContain('/tenants/');
    request.flush({ students: [], page: 2, limit: 20, total: 0 });
  });

  it('sends Students register filters through the identity-bound workspace', () => {
    service.studentRegister({
      page: 2, limit: 25, q: 'Joselin', advisorId: 'advisor-1',
      advisorName: 'S15 Paulina', collegeName: 'ATI',
      from: '2026-10-01', to: '2026-10-14', attentionThisWeek: true,
      sortBy: 'nextPayment', sortDir: 'desc',
    }).subscribe();
    const request = http.expectOne((candidate) => candidate.url.endsWith(
      '/api/business-packs/student-operations/v1/workspace/student-register',
    ));
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Token business-manager-token');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('q')).toBe('Joselin');
    expect(request.request.params.get('advisorName')).toBe('S15 Paulina');
    expect(request.request.params.get('collegeName')).toBe('ATI');
    expect(request.request.params.get('from')).toBe('2026-10-01');
    expect(request.request.params.get('to')).toBe('2026-10-14');
    expect(request.request.params.get('attentionThisWeek')).toBe('true');
    expect(request.request.params.get('sortBy')).toBe('nextPayment');
    expect(request.request.params.get('sortDir')).toBe('desc');
    expect(request.request.url).not.toContain('/tenants/');
    request.flush({ students: [], page: 2, limit: 25, total: 0 });
  });

  it('creates a student with idempotency and invalidates the dashboard cache', () => {
    service.dashboard().subscribe();
    http.expectOne((candidate) => candidate.url.endsWith('/workspace/dashboard')).flush({
      workspace: { packId: 'student-operations' },
      summary: { totalStudents: 0, activeStudents: 0, actionRequired: 0, onHold: 0 },
    });
    service.createStudent({
      studentReference: 'STU-001', legalName: 'Synthetic Student', preferredName: null,
      email: 'student@example.invalid', currentStage: 'new_application', status: 'active',
      advisorIdentityUserId: null, collegeName: null,
    }, 'create-student-001').subscribe();
    const request = http.expectOne((candidate) => candidate.url.endsWith('/workspace/students'));
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Idempotency-Key')).toBe('create-student-001');
    request.flush({ studentId: 'student-1' });

    service.dashboard().subscribe();
    http.expectOne((candidate) => candidate.url.endsWith('/workspace/dashboard')).flush({
      workspace: { packId: 'student-operations' },
      summary: { totalStudents: 1, activeStudents: 1, actionRequired: 0, onHold: 0 },
    });
  });

  it('updates a student with its record version and idempotency key', () => {
    service.updateStudent('student-1', {
      studentReference: 'STU-001', legalName: 'Synthetic Student', preferredName: null,
      email: 'student@example.invalid', currentStage: 'new_application', status: 'active',
      advisorIdentityUserId: null, collegeName: null, recordVersion: 3,
    }, 'update-student-001').subscribe();
    const request = http.expectOne((candidate) => candidate.url.endsWith('/workspace/students/student-1'));
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body.recordVersion).toBe(3);
    expect(request.request.headers.get('Idempotency-Key')).toBe('update-student-001');
    request.flush({ studentId: 'student-1', recordVersion: 4 });
  });

  it('loads the current agency Xero connection status', () => {
    service.xeroStatus().subscribe();
    const request = http.expectOne((candidate) => candidate.url.endsWith(
      '/workspace/integrations/xero',
    ));
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Token business-manager-token');
    request.flush({ configured: true, connections: [] });
  });

  it('starts Xero authorization without accepting a browser-selected agency', () => {
    service.beginXeroAuthorization().subscribe();
    const request = http.expectOne((candidate) => candidate.url.endsWith(
      '/workspace/integrations/xero/authorization',
    ));
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});
    expect(request.request.url).not.toContain('/tenants/');
    request.flush({ authorizationUrl: 'https://login.xero.com/example', expiresInSeconds: 600 });
  });

  it('tests a connected Xero organisation using an encoded connection id', () => {
    service.testXeroConnection('connection/id').subscribe();
    const request = http.expectOne((candidate) => candidate.url.endsWith(
      '/workspace/integrations/xero/connections/connection%2Fid/test',
    ));
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});
    request.flush({ organisation: { name: 'Agency Trust' }, bankAccounts: [] });
  });

  it('pages stored invoice-derived candidates without calling Xero from the browser', () => {
    service.xeroStudentCandidates('connection/id', {
      page: 2, limit: 20, q: 'student', sort: 'invoiceDate', direction: 'desc',
    }).subscribe();
    const request = http.expectOne((candidate) => candidate.url.endsWith(
      '/workspace/integrations/xero/connections/connection%2Fid/student-candidates',
    ));
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('limit')).toBe('20');
    expect(request.request.params.get('q')).toBe('student');
    expect(request.request.params.get('sort')).toBe('invoiceDate');
    expect(request.request.params.get('direction')).toBe('desc');
    request.flush({ candidates: [], page: 2, limit: 20, total: 0 });
  });

  it('pages and sorts stored Xero invoices without calling Xero from the browser', () => {
    service.xeroStudentInvoices('connection/id', {
      page: 312, limit: 25, q: 'ATI', status: 'DRAFT', dateFrom: '2026-01-01',
      dateTo: '2026-12-31', paymentTrack: 'Pending', sort: 'dueDate', direction: 'desc',
    }).subscribe();
    const request = http.expectOne((candidate) => candidate.url.endsWith(
      '/workspace/integrations/xero/connections/connection%2Fid/student-invoices',
    ));
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('page')).toBe('312');
    expect(request.request.params.get('limit')).toBe('25');
    expect(request.request.params.get('q')).toBe('ATI');
    expect(request.request.params.get('status')).toBe('DRAFT');
    expect(request.request.params.get('dateFrom')).toBe('2026-01-01');
    expect(request.request.params.get('dateTo')).toBe('2026-12-31');
    expect(request.request.params.get('paymentTrack')).toBe('Pending');
    expect(request.request.params.get('sort')).toBe('dueDate');
    expect(request.request.params.get('direction')).toBe('desc');
    request.flush({ invoices: [], page: 312, limit: 25, total: 7793, totalPages: 312 });
  });

  it('loads payment track choices once from the stored invoice register', () => {
    service.xeroStudentInvoicePaymentTracks('connection/id').subscribe((result) => {
      expect(result.paymentTracks).toEqual(['Pending', 'Complete']);
    });
    const request = http.expectOne((candidate) => candidate.url.endsWith(
      '/workspace/integrations/xero/connections/connection%2Fid/student-invoices/payment-tracks',
    ));
    expect(request.request.method).toBe('GET');
    request.flush({ paymentTracks: ['Pending', 'Complete'] });
  });

  it('loads stored Xero invoice detail by encoded id', () => {
    service.xeroStudentInvoice('connection/id', 'invoice/id').subscribe();
    const request = http.expectOne((candidate) => candidate.url.endsWith(
      '/workspace/integrations/xero/connections/connection%2Fid/student-invoices/invoice%2Fid',
    ));
    expect(request.request.method).toBe('GET');
    request.flush({ xeroInvoiceId: 'invoice/id', lineItems: [] });
  });

  it('queues and reads durable Xero student synchronization', () => {
    service.refreshXeroStudents('connection/id').subscribe();
    const refresh = http.expectOne((candidate) => candidate.url.endsWith(
      '/workspace/integrations/xero/connections/connection%2Fid/student-sync',
    ));
    expect(refresh.request.method).toBe('POST');
    refresh.flush({ syncRunId: 'run-1', status: 'queued' });

    service.xeroStudentSyncStatus('connection/id').subscribe();
    const status = http.expectOne((candidate) => candidate.url.endsWith(
      '/workspace/integrations/xero/connections/connection%2Fid/student-sync',
    ));
    expect(status.request.method).toBe('GET');
    status.flush({ configured: true, latestRun: { syncRunId: 'run-1', status: 'queued' } });
  });

  it('assigns an explicit TRUST organisation for student synchronization', () => {
    service.configureXeroTrust('connection/id').subscribe();
    const request = http.expectOne((candidate) => candidate.url.endsWith(
      '/workspace/integrations/xero/connections/connection%2Fid/student-role/trust',
    ));
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});
    request.flush({ connectionId: 'connection/id', organisationRole: 'trust' });
  });

});
