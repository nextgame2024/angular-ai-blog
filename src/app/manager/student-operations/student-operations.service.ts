import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { finalize, of, shareReplay, tap } from 'rxjs';
import type { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { PersistanceService } from '../../shared/services/persistance.service';
import type {
  StudentOperationsStudentList,
  StudentOperationsStudentDetail,
  StudentOperationsStudentWrite,
  StudentOperationsDashboard,
  StudentOperationsWorkspace,
  StudentRegisterQuery,
  StudentRegisterResult,
  StudentCaseDetail,
  StudentCaseEditOptions,
  StudentCaseWorkflowOptions,
  StudentCaseList,
  StudentCaseInvoices,
  StudentCaseDocuments,
  StudentDocumentType,
  StudentDocumentRequirement,
  StudentCaseActivity,
  StudentCaseChecklist,
  XeroConnectionStatus,
  XeroConnectionTest,
  XeroStudentCandidateResult,
  XeroStudentInvoiceDetail,
  XeroStudentInvoiceResult,
  XeroStudentSyncRun,
  XeroStudentSyncStatus,
  PaymentsRegisterBootstrap,
  XeroStudentInvoiceQuery,
} from './student-operations.types';

@Injectable({ providedIn: 'root' })
export class StudentOperationsService {
  documentRequirements(status:string): Observable<{requirements:StudentDocumentRequirement[]}> {
    return this.http.get<{requirements:StudentDocumentRequirement[]}>(`${this.workspaceBase}/cases/document-requirements`,{headers:this.headers(),params:new HttpParams().set('status',status)});
  }
  caseChecklist(caseId:string): Observable<StudentCaseChecklist> {
    return this.http.get<StudentCaseChecklist>(`${this.workspaceBase}/cases/${encodeURIComponent(caseId)}/checklist`,{headers:this.headers()});
  }
  updateCaseChecklist(caseId:string,value:{itemKey:string;completed:boolean;recordVersion:number},key:string): Observable<StudentCaseChecklist> {
    return this.http.patch<StudentCaseChecklist>(`${this.workspaceBase}/cases/${encodeURIComponent(caseId)}/checklist`,value,{headers:this.writeHeaders(key)});
  }
  documentTypes(): Observable<{types: StudentDocumentType[]}> {
    return this.http.get<{types: StudentDocumentType[]}>(`${this.workspaceBase}/cases/document-types`,{headers:this.headers()});
  }
  createDocumentType(value:{name:string;required:boolean},key:string): Observable<StudentDocumentType> {
    return this.http.post<StudentDocumentType>(`${this.workspaceBase}/cases/document-types`,value,{headers:this.writeHeaders(key)});
  }
  updateDocumentType(id:string,value:{name?:string;required?:boolean;status?:'archived';recordVersion:number},key:string): Observable<StudentDocumentType> {
    return this.http.patch<StudentDocumentType>(`${this.workspaceBase}/cases/document-types/${encodeURIComponent(id)}`,value,{headers:this.writeHeaders(key)});
  }
  caseDocumentUploadOptions(caseId:string): Observable<{enabled:boolean;available:boolean}> {
    return this.http.get<{enabled:boolean;available:boolean}>(`${this.workspaceBase}/cases/${encodeURIComponent(caseId)}/documents/upload-options`,{headers:this.headers()});
  }
  uploadCaseDocument(caseId:string,file:File,typeId:string,key:string): Observable<{documentId:string}> {
    const body=new FormData(); body.append('documentTypeId',typeId); body.append('file',file);
    return this.http.post<{documentId:string}>(`${this.workspaceBase}/cases/${encodeURIComponent(caseId)}/documents/upload`,body,{headers:this.writeHeaders(key)});
  }
  private readonly http = inject(HttpClient);
  private readonly persistence = inject(PersistanceService);
  private readonly workspaceBase = environment.sophiaRuntimeApiUrl
    .replace(/\/+$/, '')
    .replace(/\/runtime$/, '/business-packs/student-operations/v1/workspace');
  private dashboardCache: StudentOperationsDashboard | null = null;
  private dashboardCacheCredential: string | null = null;
  private dashboardCacheTimestamp: number | null = null;
  private dashboardRequest$: Observable<StudentOperationsDashboard> | null = null;
  private dashboardRequestCredential: string | null = null;

  workspace(): Observable<StudentOperationsWorkspace> {
    return this.http.get<StudentOperationsWorkspace>(this.workspaceBase, {
      headers: this.headers(),
    });
  }

  paymentsRegister(input: XeroStudentInvoiceQuery): Observable<PaymentsRegisterBootstrap> {
    return this.http.get<PaymentsRegisterBootstrap>(`${this.workspaceBase}/payments-register`, {
      headers: this.headers(), params: this.invoiceParams(input),
    });
  }

  dashboard(options: { refresh?: boolean } = {}): Observable<StudentOperationsDashboard> {
    const credential = this.accessToken();
    this.clearDashboardForChangedCredential(credential);

    if (!options.refresh && this.dashboardCache) {
      return of(this.dashboardCache);
    }

    if (this.dashboardRequest$ && this.dashboardRequestCredential === credential) {
      return this.dashboardRequest$;
    }

    const request$ = this.http.get<StudentOperationsDashboard>(
      `${this.workspaceBase}/dashboard`,
      { headers: this.headers(credential) },
    ).pipe(
      tap((dashboard) => {
        if (this.accessToken() === credential) {
          this.dashboardCache = dashboard;
          this.dashboardCacheCredential = credential;
          this.dashboardCacheTimestamp = Date.now();
        }
      }),
      finalize(() => {
        if (this.dashboardRequestCredential === credential) {
          this.dashboardRequest$ = null;
          this.dashboardRequestCredential = null;
        }
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    this.dashboardRequestCredential = credential;
    this.dashboardRequest$ = request$;
    return request$;
  }

  hasDashboardCache(): boolean {
    const credential = this.accessToken();
    this.clearDashboardForChangedCredential(credential);
    return this.dashboardCache !== null;
  }

  dashboardCachedAt(): number | null {
    return this.hasDashboardCache() ? this.dashboardCacheTimestamp : null;
  }

  invalidateDashboard(): void {
    this.dashboardCache = null;
    this.dashboardCacheCredential = null;
    this.dashboardCacheTimestamp = null;
  }

  students(input: {
    page: number;
    limit: number;
    q?: string;
    status?: string;
    advisor?: string;
    college?: string;
  }): Observable<StudentOperationsStudentList> {
    let params = new HttpParams()
      .set('page', String(input.page))
      .set('limit', String(input.limit));
    if (input.q) params = params.set('q', input.q);
    if (input.status) params = params.set('status', input.status);
    if (input.advisor) params = params.set('advisor', input.advisor);
    if (input.college) params = params.set('college', input.college);
    return this.http.get<StudentOperationsStudentList>(`${this.workspaceBase}/students`, {
      headers: this.headers(),
      params,
    });
  }

  studentRegister(input: StudentRegisterQuery): Observable<StudentRegisterResult> {
    let params = new HttpParams()
      .set('page', String(input.page))
      .set('limit', String(input.limit));
    if (input.q) params = params.set('q', input.q);
    if (input.status) params = params.set('status', input.status);
    if (input.advisorId) params = params.set('advisorId', input.advisorId);
    if (input.collegeId) params = params.set('collegeId', input.collegeId);
    if (input.advisorName) params = params.set('advisorName', input.advisorName);
    if (input.collegeName) params = params.set('collegeName', input.collegeName);
    if (input.from && input.to) {
      params = params.set('from', input.from).set('to', input.to);
    }
    if (input.attentionThisWeek) params = params.set('attentionThisWeek', 'true');
    if (input.sortBy) params = params.set('sortBy', input.sortBy);
    if (input.sortDir) params = params.set('sortDir', input.sortDir);
    return this.http.get<StudentRegisterResult>(`${this.workspaceBase}/student-register`, {
      headers: this.headers(), params,
    });
  }

  caseDetail(caseId: string): Observable<StudentCaseDetail> {
    return this.http.get<StudentCaseDetail>(`${this.workspaceBase}/cases/${encodeURIComponent(caseId)}`, { headers: this.headers() });
  }

  caseEditOptions(): Observable<StudentCaseEditOptions> {
    return this.http.get<StudentCaseEditOptions>(`${this.workspaceBase}/cases/edit-options`, { headers: this.headers() });
  }

  caseWorkflowOptions(): Observable<StudentCaseWorkflowOptions> {
    return this.http.get<StudentCaseWorkflowOptions>(`${this.workspaceBase}/cases/options`, { headers: this.headers() });
  }

  createCase(value: {
    userId: string; courseName: string | null; collegeId: string | null; advisorId: string | null;
    status: string; currentStage: string;
  }, idempotencyKey: string): Observable<{ caseId: string; recordVersion: number }> {
    return this.http.post<{ caseId: string; recordVersion: number }>(`${this.workspaceBase}/cases`,value,
      {headers:this.writeHeaders(idempotencyKey)}).pipe(tap(()=>this.invalidateDashboard()));
  }

  createStudentWithCase(value: {
    studentName: string; studentEmail: string; mobile: string | null; phone: string | null;
    courseName: string | null; collegeId: string | null; advisorId: string | null;
    status: string; currentStage: string;
  }, idempotencyKey: string): Observable<{ caseId: string; recordVersion: number }> {
    return this.http.post<{ caseId: string; recordVersion: number }>(`${this.workspaceBase}/cases/student`,value,
      {headers:this.writeHeaders(idempotencyKey)}).pipe(tap(()=>this.invalidateDashboard()));
  }

  updateCase(caseId: string, value: {
    recordVersion: number; studentName: string; studentEmail: string; mobile: string | null; phone: string | null;
    courseName: string | null;
    collegeId: string | null; advisorId: string | null;
    status: string; currentStage: string;
  }, idempotencyKey: string): Observable<{ caseId: string; recordVersion: number }> {
    return this.http.patch<{ caseId: string; recordVersion: number }>(
      `${this.workspaceBase}/cases/${encodeURIComponent(caseId)}`, value,
      { headers: this.writeHeaders(idempotencyKey) },
    ).pipe(tap(() => this.invalidateDashboard()));
  }

  casesForStudent(userId: string, page = 1): Observable<StudentCaseList> {
    return this.http.get<StudentCaseList>(`${this.workspaceBase}/cases`, {
      headers: this.headers(), params: new HttpParams().set('userId', userId).set('page', page).set('limit', 100),
    });
  }

  caseInvoices(caseId: string, page = 1): Observable<StudentCaseInvoices> {
    return this.http.get<StudentCaseInvoices>(`${this.workspaceBase}/cases/${encodeURIComponent(caseId)}/invoices`, {
      headers: this.headers(), params: new HttpParams().set('page', page).set('limit', 25),
    });
  }

  caseInvoiceDrafts(caseId:string):Observable<import('./student-operations.types').CaseInvoiceDraftData>{
    return this.http.get<import('./student-operations.types').CaseInvoiceDraftData>(`${this.workspaceBase}/cases/${encodeURIComponent(caseId)}/invoice-drafts`,{headers:this.headers()});
  }
  prepareCaseInvoiceDrafts(caseId:string,value:unknown,key:string):Observable<{batchId:string;count:number;revision:number;updatedAt:string}>{
    return this.http.post<{batchId:string;count:number;revision:number;updatedAt:string}>(`${this.workspaceBase}/cases/${encodeURIComponent(caseId)}/invoice-drafts`,value,{headers:this.writeHeaders(key)});
  }
  createCaseXeroInvoices(caseId:string,batchId:string,sequences:number[]):Observable<{created:number;skipped:number;results:Array<{sequence:number;status:string;invoiceId?:string;invoiceNumber?:string|null;errorCode?:string;message?:string}>}>{
    return this.http.post<{created:number;skipped:number;results:Array<{sequence:number;status:string;invoiceId?:string;invoiceNumber?:string|null;errorCode?:string;message?:string}>}>(
      `${this.workspaceBase}/cases/${encodeURIComponent(caseId)}/invoice-drafts/${encodeURIComponent(batchId)}/xero`,{sequences,confirmed:true},{headers:this.headers()});
  }

  caseDocuments(caseId: string, page = 1): Observable<StudentCaseDocuments> {
    return this.http.get<StudentCaseDocuments>(`${this.workspaceBase}/cases/${encodeURIComponent(caseId)}/documents`, {
      headers: this.headers(), params: new HttpParams().set('page', page).set('limit', 25),
    });
  }

  documentAnalysis(caseId:string,documentId:string):Observable<import('./student-operations.types').StudentDocumentAnalysis>{
    return this.http.get<import('./student-operations.types').StudentDocumentAnalysis>(`${this.workspaceBase}/cases/${encodeURIComponent(caseId)}/documents/${encodeURIComponent(documentId)}/analysis`,{headers:this.headers()});
  }
  reviewDocumentAnalysis(caseId:string,documentId:string,value:unknown,key:string){
    return this.http.post(`${this.workspaceBase}/cases/${encodeURIComponent(caseId)}/documents/${encodeURIComponent(documentId)}/analysis/review`,value,{headers:this.headers().set('Idempotency-Key',key)});
  }
  retryDocumentAnalysis(caseId:string,documentId:string,jobId:string,key:string){
    return this.http.post(`${this.workspaceBase}/cases/${encodeURIComponent(caseId)}/documents/${encodeURIComponent(documentId)}/analysis/retry`,{jobId},{headers:this.headers().set('Idempotency-Key',key)});
  }
  startDocumentAnalysis(caseId:string,documentId:string,key:string){
    return this.http.post(`${this.workspaceBase}/cases/${encodeURIComponent(caseId)}/documents/${encodeURIComponent(documentId)}/analysis/start`,{},{headers:this.headers().set('Idempotency-Key',key)});
  }

  caseActivity(caseId: string, page = 1): Observable<StudentCaseActivity> {
    return this.http.get<StudentCaseActivity>(`${this.workspaceBase}/cases/${encodeURIComponent(caseId)}/activity`, {
      headers: this.headers(), params: new HttpParams().set('page', page).set('limit', 25),
    });
  }

  caseDocumentContent(caseId: string, documentId: string): Observable<Blob> {
    return this.http.get(`${this.workspaceBase}/cases/${encodeURIComponent(caseId)}/documents/${encodeURIComponent(documentId)}/content`, {
      headers: this.headers(), responseType: 'blob',
    });
  }

  student(studentId: string): Observable<StudentOperationsStudentDetail> {
    return this.http.get<StudentOperationsStudentDetail>(
      `${this.workspaceBase}/students/${encodeURIComponent(studentId)}`,
      { headers: this.headers() },
    );
  }

  advisors(): Observable<{ advisorIdentityUserIds: string[] }> {
    return this.http.get<{ advisorIdentityUserIds: string[] }>(
      `${this.workspaceBase}/advisors`,
      { headers: this.headers() },
    );
  }

  createStudent(
    value: StudentOperationsStudentWrite,
    idempotencyKey: string,
  ): Observable<StudentOperationsStudentDetail> {
    return this.http.post<StudentOperationsStudentDetail>(
      `${this.workspaceBase}/students`,
      value,
      { headers: this.writeHeaders(idempotencyKey) },
    ).pipe(tap(() => this.invalidateDashboard()));
  }

  updateStudent(
    studentId: string,
    value: StudentOperationsStudentWrite & { recordVersion: number },
    idempotencyKey: string,
  ): Observable<StudentOperationsStudentDetail> {
    return this.http.patch<StudentOperationsStudentDetail>(
      `${this.workspaceBase}/students/${encodeURIComponent(studentId)}`,
      value,
      { headers: this.writeHeaders(idempotencyKey) },
    ).pipe(tap(() => this.invalidateDashboard()));
  }

  xeroStatus(): Observable<XeroConnectionStatus> {
    return this.http.get<XeroConnectionStatus>(`${this.workspaceBase}/integrations/xero`, {
      headers: this.headers(),
    });
  }

  beginXeroAuthorization(): Observable<{ authorizationUrl: string; expiresInSeconds: number }> {
    return this.http.post<{ authorizationUrl: string; expiresInSeconds: number }>(
      `${this.workspaceBase}/integrations/xero/authorization`,
      {},
      { headers: this.headers() },
    );
  }

  testXeroConnection(connectionId: string): Observable<XeroConnectionTest> {
    return this.http.post<XeroConnectionTest>(
      `${this.workspaceBase}/integrations/xero/connections/${encodeURIComponent(connectionId)}/test`,
      {},
      { headers: this.headers() },
    );
  }

  xeroStudentCandidates(
    connectionId: string,
    input: {
      page: number;
      limit: number;
      q?: string;
      sort?: 'student' | 'studentReference' | 'invoiceDate' | 'invoiceReference' | 'concept' | 'advisor' | 'college' | 'invoices' | 'nextPayment' | 'paymentState';
      direction?: 'asc' | 'desc';
    },
  ): Observable<XeroStudentCandidateResult> {
    let params = new HttpParams().set('page', String(input.page)).set('limit', String(input.limit));
    if (input.q) params = params.set('q', input.q);
    if (input.sort) params = params.set('sort', input.sort);
    if (input.direction) params = params.set('direction', input.direction);
    return this.http.get<XeroStudentCandidateResult>(
      `${this.workspaceBase}/integrations/xero/connections/${encodeURIComponent(connectionId)}/student-candidates`,
      { headers: this.headers(), params },
    );
  }

  xeroStudentInvoices(
    connectionId: string,
    input: XeroStudentInvoiceQuery,
  ): Observable<XeroStudentInvoiceResult> {
    return this.http.get<XeroStudentInvoiceResult>(
      `${this.workspaceBase}/integrations/xero/connections/${encodeURIComponent(connectionId)}/student-invoices`,
      { headers: this.headers(), params: this.invoiceParams(input) },
    );
  }

  private invoiceParams(input: XeroStudentInvoiceQuery): HttpParams {
    let params = new HttpParams().set('page', String(input.page)).set('limit', String(input.limit));
    if (input.q) params = params.set('q', input.q);
    if (input.status) params = params.set('status', input.status);
    if (input.dateFrom) params = params.set('dateFrom', input.dateFrom);
    if (input.dateTo) params = params.set('dateTo', input.dateTo);
    if (input.paymentTrack) params = params.set('paymentTrack', input.paymentTrack);
    if (input.sort) params = params.set('sort', input.sort);
    if (input.direction) params = params.set('direction', input.direction);
    return params;
  }

  xeroStudentInvoicePaymentTracks(connectionId: string): Observable<{ paymentTracks: string[] }> {
    return this.http.get<{ paymentTracks: string[] }>(
      `${this.workspaceBase}/integrations/xero/connections/${encodeURIComponent(connectionId)}/student-invoices/payment-tracks`,
      { headers: this.headers() },
    );
  }

  xeroStudentInvoice(connectionId: string, invoiceId: string): Observable<XeroStudentInvoiceDetail> {
    return this.http.get<XeroStudentInvoiceDetail>(
      `${this.workspaceBase}/integrations/xero/connections/${encodeURIComponent(connectionId)}/student-invoices/${encodeURIComponent(invoiceId)}`,
      { headers: this.headers() },
    );
  }

  xeroStudentSyncStatus(connectionId: string): Observable<XeroStudentSyncStatus> {
    return this.http.get<XeroStudentSyncStatus>(
      `${this.workspaceBase}/integrations/xero/connections/${encodeURIComponent(connectionId)}/student-sync`,
      { headers: this.headers() },
    );
  }

  refreshXeroStudents(connectionId: string): Observable<XeroStudentSyncRun> {
    return this.http.post<XeroStudentSyncRun>(
      `${this.workspaceBase}/integrations/xero/connections/${encodeURIComponent(connectionId)}/student-sync`,
      {},
      { headers: this.headers() },
    );
  }

  configureXeroTrust(connectionId: string): Observable<{ connectionId: string; organisationRole: 'trust' }> {
    return this.http.post<{ connectionId: string; organisationRole: 'trust' }>(
      `${this.workspaceBase}/integrations/xero/connections/${encodeURIComponent(connectionId)}/student-role/trust`,
      {},
      { headers: this.headers() },
    );
  }

  private accessToken(): string | null {
    return this.persistence.get<string>('accessToken')
      ?? this.persistence.get<string>('token')
      ?? null;
  }

  private headers(token = this.accessToken()): HttpHeaders {
    return token
      ? new HttpHeaders({ Authorization: `Token ${token}` })
      : new HttpHeaders();
  }

  private writeHeaders(idempotencyKey: string): HttpHeaders {
    return this.headers().set('Idempotency-Key', idempotencyKey);
  }

  private clearDashboardForChangedCredential(credential: string | null): void {
    const cacheBelongsToAnotherCredential = this.dashboardCache
      && this.dashboardCacheCredential !== credential;
    if (cacheBelongsToAnotherCredential) {
      this.invalidateDashboard();
    }
  }
}
