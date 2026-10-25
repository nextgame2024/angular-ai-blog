import { PageJumpComponent } from '../../shared/components/page-jump/page-jump.component';
import { CaseDocumentActionsComponent } from './case-document-actions.component';
import { CaseDocumentAnalysisComponent } from './case-document-analysis.component';
import { CaseChecklistComponent } from './case-checklist.component';
import { ListNavigationStateService } from '../../shared/services/list-navigation-state.service';
import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject, catchError, distinctUntilChanged, forkJoin, map, of, switchMap, takeUntil } from 'rxjs';
import { ManagerListLoaderComponent } from '../components/shared/manager-list-loader/manager-list-loader.component';
import { ManagerToastComponent } from '../components/shared/manager-toast/manager-toast.component';
import { ManagerSelectComponent, type ManagerSelectOption } from '../components/shared/manager-select/manager-select.component';
import { StudentOperationsService } from '../student-operations/student-operations.service';
import { CASE_STATUS_LABELS, CASE_WORKFLOW_STAGES, IMPORTED_CASE_STAGE, caseStageLabel } from '../student-operations/student-case-workflow';
import { xeroInvoiceStatusLabel } from '../student-operations/xero-invoice-display';
import type {
  StudentCaseActivity, StudentCaseDetail, StudentCaseDocuments, StudentCaseInvoices,
  StudentCaseList, StudentCaseStatus, StudentRegisterRow,
  StudentOperationsWorkspace,
  StudentCaseEditOptions, StudentCaseWorkflowOptions,
  StudentDocumentRequirement,
} from '../student-operations/student-operations.types';

@Component({
  selector: 'app-manager-case-view',
  imports: [CaseDocumentAnalysisComponent,CaseChecklistComponent,CaseDocumentActionsComponent,PageJumpComponent, CommonModule, RouterModule, ReactiveFormsModule, ManagerListLoaderComponent, ManagerSelectComponent, ManagerToastComponent],
  templateUrl: './manager-case-view.page.html',
  styleUrls: ['./manager-case-view.page.css'],
})
export class ManagerCaseViewPageComponent implements OnInit, OnDestroy {
  private readonly api = inject(StudentOperationsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();
  private readonly navigationState = inject(ListNavigationStateService);
  readonly creationMode: 'student' | 'case' | null = this.route.snapshot?.data?.['creation'] ?? null;
  private creationSourceCaseId = '';
  private creationRequest: { fingerprint: string; key: string } | null = null;
  private workspaceFailed = false;

  readonly Math = Math;
  case: StudentCaseDetail | null = null;
  workspace: StudentOperationsWorkspace | null = null;
  studentIdentity: Pick<StudentRegisterRow, 'legalName' | 'email'> | null = null;
  relatedCases: StudentCaseList['cases'] = [];
  relatedTotal = 0;
  relatedPage = 0;
  invoices: StudentCaseInvoices | null = null;
  documents: StudentCaseDocuments | null = null;
  draftDocumentRequirements:StudentDocumentRequirement[]=[];
  requirementsLoading=false;
  requirementsError='';
  private requirementRequest=0;
  private documentRequest=0;
  get missingDocumentRequirements():StudentDocumentRequirement[]{
    const data=this.creationMode?this.draftDocumentRequirements:this.documents?.requirements??[];
    return (this.documents?.page??1)===1?data.filter(r=>!r.uploaded):[];
  }
  activity: StudentCaseActivity | null = null;
  loading = true;
  error = '';
  invoiceError = '';
  documentError = '';
  activityError = '';
  relatedError = '';
  downloadError = '';
  downloadingId: string | null = null;
  viewingId: string | null = null;
  editing = false;
  editLoading = false;
  saving = false;
  editError = '';
  editSuccess = '';
  editOptions: StudentCaseEditOptions | null = null;
  workflowOptions: StudentCaseWorkflowOptions | null = null;
  readonly editForm = new FormGroup({
    studentName: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    studentEmail: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email, Validators.maxLength(320)] }),
    mobile: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(80)] }),
    phone: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(80)] }),
    courseName: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(200)] }),
    collegeId: new FormControl<string | null>(null),
    advisorId: new FormControl<string | null>(null),
    status: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    currentStage: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
  loadingRelated = false;
  loadingInvoices = false;
  loadingDocuments = false;
  loadingActivity = false;
  private currentId = '';
  private pendingPreview: Window | null = null;
  private documentPollTimer: ReturnType<typeof setTimeout> | null = null;
  private documentPollCount = 0;

  get primaryAdvisor(): string | null {
    return this.case?.advisorName || null;
  }
  get primaryCollege(): string | null {
    return this.case?.colleges.find(item => item.isPrimary)?.name || null;
  }
  get studentName(): string {
    if (this.creationMode === 'student') return this.case?.studentName ?? '';
    return this.case?.studentName || this.studentIdentity?.legalName || `Student ${this.case?.studentReference || ''}`.trim();
  }
  get studentEmail(): string | null {
    return this.case?.studentEmail || this.studentIdentity?.email || null;
  }
  get studentPhone(): string | null {
    return this.case?.studentPhone?.trim() || null;
  }
  get studentMobile(): string | null { return this.case?.studentMobile?.trim() || null; }
  get studentPhoneHref(): string | null {
    const phone = this.studentPhone?.replace(/[^\d+]/g, '') ?? '';
    return /\d/.test(phone) ? `tel:${phone}` : null;
  }
  get workflowStages(): ReadonlyArray<{ value: string; label: string }> {
    return this.case?.currentStage === IMPORTED_CASE_STAGE.value
      ? [IMPORTED_CASE_STAGE, ...CASE_WORKFLOW_STAGES] : CASE_WORKFLOW_STAGES;
  }
  get canLoadRelated(): boolean { return this.relatedCases.length < this.relatedTotal; }
  get canShowCaseActions(): boolean {
    return this.workspace?.role === 'chief_executive' || this.workspace?.role === 'operations' || this.workspace?.role === 'advisor';
  }
  get canEditCases(): boolean { return this.workspace?.role === 'chief_executive' || this.workspace?.role === 'operations'; }
  get collegeOptions(): ManagerSelectOption[] {
    return [{ value: '', label: 'No college' }, ...(this.editOptions?.colleges.map(item => ({ value: item.collegeId, label: item.name })) ?? [])];
  }
  get advisorOptions(): ManagerSelectOption[] {
    return [{ value: '', label: 'No advisor' }, ...(this.editOptions?.advisors.map(item => ({ value: item.advisorId, label: `${item.code} ${item.name}` })) ?? [])];
  }
  get statusOptions(): ManagerSelectOption[] {
    return (this.workflowOptions?.statuses ?? []).map(value => ({ value, label: this.statusLabel(value as StudentCaseStatus) }));
  }
  get stageOptions(): ManagerSelectOption[] {
    const status = this.editForm.controls.status.value;
    const options = this.workflowOptions;
    if (!options) return [];
    const stages = this.case?.currentStage === IMPORTED_CASE_STAGE.value
      ? [IMPORTED_CASE_STAGE.value, ...options.stages] : options.stages;
    return stages.filter(value => options.allowedStatuses[value]?.includes(status))
      .map(value => ({ value, label: this.stageLabel(value) }));
  }
  get discoveryPending(): number {
    return (this.documents?.discovery ?? [])
      .filter(item => item.status === 'queued' || item.status === 'processing')
      .reduce((sum, item) => sum + item.count, 0);
  }
  get discoveryFailed(): number {
    return (this.documents?.discovery ?? [])
      .filter(item => item.status === 'failed')
      .reduce((sum, item) => sum + item.count, 0);
  }
  get discoveryQueued(): number {
    return (this.documents?.discovery ?? []).filter(item => item.status === 'queued').reduce((sum, item) => sum + item.count, 0);
  }
  get discoveryProcessing(): number {
    return (this.documents?.discovery ?? []).filter(item => item.status === 'processing').reduce((sum, item) => sum + item.count, 0);
  }

  private stopDocumentPolling(): void {
    if (this.documentPollTimer) clearTimeout(this.documentPollTimer);
    this.documentPollTimer = null;
  }

  private scheduleDocumentPoll(): void {
    this.stopDocumentPolling();
    // Poll stored metadata only, never initiate provider work. Bound requests per visit.
    if ((!this.discoveryPending&&!this.documents?.analysisPending) || this.documentPollCount >= 30) return;
    this.documentPollTimer = setTimeout(() => {
      this.documentPollTimer = null;
      if (document.hidden) { this.scheduleDocumentPoll(); return; }
      this.documentPollCount++;
      this.loadDocuments(this.documents?.page ?? 1);
    }, this.documents?.analysisPending ? 10_000 : this.discoveryProcessing ? 30_000 : 120_000);
  }

  ngOnInit(): void {
    const createdMode=this.router.getCurrentNavigation()?.extras.state?.['createdCaseMode'];
    this.editForm.controls.status.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.onStatusChange());
    this.api.workspace().pipe(takeUntil(this.destroy$)).subscribe({
      next: workspace => {
        this.workspace = workspace;
        if (this.creationMode) {
          if (!this.canEditCases) { this.error = 'You do not have permission to create students or cases.'; this.loading = false; return; }
          if (this.creationMode === 'student') this.prepareCreation();
          else if (this.case) this.prepareCreation(this.case);
          return;
        }
        if (this.case && this.route.snapshot?.queryParamMap?.get('edit') === '1' && this.canEditCases && !this.editing) this.beginEdit(this.case.caseId);
      },
      error: () => { this.workspace = null; this.workspaceFailed = true; if (this.creationMode) { this.loading = false; this.error = 'Student creation is unavailable. Check your workspace access and try again.'; } },
    });
    if (this.creationMode === 'student') return;
    this.route.paramMap.pipe(
      map(params => params.get('caseId') ?? ''),
      distinctUntilChanged(),
      switchMap(caseId => {
        this.currentId = caseId;
        this.reset();
        if (!caseId) return of(null);
        return this.api.caseDetail(caseId).pipe(catchError(() => of(null)));
      }),
      takeUntil(this.destroy$),
    ).subscribe(detail => {
      this.loading = false;
      if (!detail) {
        this.error = 'This case could not be opened. It may be unavailable or you may not have access.';
        return;
      }
      this.case = detail;
      if (this.creationMode === 'case') {
        if (this.workspaceFailed) this.error = 'Case creation is unavailable. Check your workspace access and try again.';
        else if (!this.workspace) this.loading = true;
        else if (this.canEditCases) this.prepareCreation(detail);
        else if (this.workspace) this.error = 'You do not have permission to create cases.';
        return;
      }
      if (createdMode === 'student' || createdMode === 'case') this.showEditSuccess(createdMode === 'student' ? 'Student and case created.' : 'Case created.');
      if (this.route.snapshot?.queryParamMap?.get('edit') === '1' && this.canEditCases) this.beginEdit(detail.caseId);
      if (!detail.studentName) this.loadStudentIdentity(detail);
      this.loadRelated(1);
      const pages = this.navigationState.read<{ invoices: number; documents: number; activity: number }>(`case-pages:${detail.caseId}`);
      this.loadInvoices(pages?.invoices ?? 1);
      this.loadDocuments(pages?.documents ?? 1);
      this.loadActivity(pages?.activity ?? 1);
    });
  }

  private prepareCreation(source?: StudentCaseDetail): void {
    if (!this.canEditCases || this.editLoading || this.editing) return;
    this.creationSourceCaseId = source?.caseId ?? '';
    this.currentId = '';
    this.case = {
      caseId: '', caseNumber: '', userId: source?.userId ?? '', studentId: source?.studentId ?? '',
      studentReference: source?.studentReference ?? '', studentName: source?.studentName ?? '',
      studentEmail: source?.studentEmail ?? '', studentMobile: source?.studentMobile ?? null,
      studentPhone: source?.studentPhone ?? null, title: null, courseName: null,
      advisorId: source?.advisorId ?? null, advisorName: source?.advisorName ?? null,
      status: 'pre_sale', currentStage: 'documents_requested', openedOn: null,
      createdAt: '', updatedAt: '', recordVersion: 0, advisors: [], colleges: [],
    };
    this.loading = false;
    this.documents = { documents: [], discovery: [], discoveryRequested: false, total: 0, page: 1, limit: 25 };
    this.invoices = { invoices: [], total: 0, page: 1, limit: 25 };
    this.activity = { activity: [], page: 1, limit: 25 };
    if (source) this.loadRelated(1);
    this.beginEdit('');
  }

  beginEdit(caseId: string): void {
    if (!this.canEditCases || this.editLoading || this.saving) return;
    if (caseId !== this.case?.caseId) {
      void this.router.navigate(['/manager/students/cases', caseId], { queryParams: { edit: '1' } });
      return;
    }
    this.editError = this.editSuccess = '';
    this.editLoading = true;
    forkJoin({ edit: this.api.caseEditOptions(), workflow: this.api.caseWorkflowOptions() })
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: ({ edit, workflow }) => {
          if (caseId !== this.currentId || !this.case) return;
          this.editOptions = edit;
          this.workflowOptions = workflow;
          this.editForm.reset({
            studentName: this.studentName,
            studentEmail: this.studentEmail ?? '',
            mobile: this.case.studentMobile ?? '', phone: this.case.studentPhone ?? '',
            courseName: this.case.courseName ?? '',
            collegeId: this.case.colleges.find(item => item.isPrimary)?.collegeId ?? '',
            advisorId: this.case.advisorId ?? '',
            status: this.case.status, currentStage: this.case.currentStage,
          });
          this.editing = true;
          this.editLoading = false;
        },
        error: () => { this.editLoading = false; this.showEditError('Edit options could not be loaded. Try again.'); },
      });
  }

  onStatusChange(): void {
    const current = this.editForm.controls.currentStage.value;
    if (!this.stageOptions.some(item => item.value === current)) {
      this.editForm.controls.currentStage.setValue(this.stageOptions[0]?.value ?? '');
    }
    if(this.creationMode)this.loadDocumentRequirements();
  }

  loadDocumentRequirements():void{
    if(!this.creationMode)return;
    const status=this.editForm.controls.status.value||this.case?.status;
    if(!status)return;
    const request=++this.requirementRequest;
    this.requirementsLoading=true;this.requirementsError='';this.draftDocumentRequirements=[];
    this.api.documentRequirements(status).pipe(takeUntil(this.destroy$)).subscribe({
      next:result=>{if(request===this.requirementRequest){this.draftDocumentRequirements=result.requirements;this.requirementsLoading=false;}},
      error:()=>{if(request===this.requirementRequest){this.requirementsLoading=false;this.requirementsError='Document requirements could not be loaded.';}},
    });
  }

  cancelEdit(): void {
    if (this.saving) return;
    if (this.creationMode) {
      void this.router.navigate(this.creationSourceCaseId ? ['/manager/students/cases', this.creationSourceCaseId] : ['/manager/students']);
      return;
    }
    this.editing = false;
    this.editError = '';
    void this.router.navigate([], { relativeTo: this.route, queryParams: { edit: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  saveEdit(): void {
    if (!this.canEditCases || !this.case || !this.editing || this.saving) return;
    if (this.editForm.invalid || !this.stageOptions.some(item => item.value === this.editForm.controls.currentStage.value)) {
      this.editForm.markAllAsTouched();
      this.showEditError('Complete the required fields and choose a valid stage for the status.');
      return;
    }
    if (this.creationMode) { this.saveCreation(); return; }
    const id = this.case.caseId;
    const value = this.editForm.getRawValue();
    this.saving = true;
    this.editError = '';
    this.api.updateCase(id, {
      recordVersion: this.case.recordVersion,
      studentName: value.studentName.trim(), studentEmail: value.studentEmail.trim(), mobile: value.mobile.trim() || null, phone: value.phone.trim() || null,
      courseName: value.courseName.trim() || null,
      collegeId: value.collegeId || null, advisorId: value.advisorId || null,
      status: value.status, currentStage: value.currentStage,
    }, crypto.randomUUID()).pipe(takeUntil(this.destroy$)).subscribe({
      next: result => {
        if (id !== this.currentId) return;
        const college = this.editOptions?.colleges.find(item => item.collegeId === value.collegeId);
        const advisor = this.editOptions?.advisors.find(item => item.advisorId === value.advisorId);
        const detail: StudentCaseDetail = {
          ...this.case!, studentName: value.studentName.trim(), studentEmail: value.studentEmail.trim(),
          studentMobile: value.mobile.trim() || null, studentPhone: value.phone.trim() || null,
          courseName: value.courseName.trim() || null,
          status: value.status as StudentCaseStatus, currentStage: value.currentStage,
          advisorName: advisor?.name ?? null,
          advisorId: advisor?.advisorId ?? null,
          colleges: college ? [{ collegeId: college.collegeId, name: college.name, isPrimary: true }] : [],
          recordVersion: result.recordVersion, updatedAt: new Date().toISOString(),
        };
        this.case = detail;
        this.relatedCases = this.relatedCases.map(item => item.caseId === id
          ? { ...item, status: detail.status, currentStage: detail.currentStage } : item);
        this.saving = false;
        this.editing = false;
        this.showEditSuccess('Case saved.');
        this.loadActivity(1);
        this.loadDocuments(1,true);
        void this.router.navigate([], { relativeTo: this.route, queryParams: { edit: null }, queryParamsHandling: 'merge', replaceUrl: true });
      },
      error: error => {
        this.saving = false;
        this.showEditError(error?.status === 409
          ? (error?.error?.message === 'Student email is already in use.' ? 'That email address is already in use.' : 'This case changed. Reload the page before saving again.')
          : 'The case could not be saved. Please try again.');
      },
    });
  }

  private saveCreation(): void {
    const value = this.editForm.getRawValue();
    const shared = { courseName: value.courseName.trim() || null, collegeId: value.collegeId || null,
      advisorId: value.advisorId || null, status: value.status, currentStage: value.currentStage };
    const payload = this.creationMode === 'student'
      ? { ...shared, studentName: value.studentName.trim(), studentEmail: value.studentEmail.trim(),
          mobile: value.mobile.trim() || null, phone: value.phone.trim() || null }
      : { ...shared, userId: this.case!.userId };
    const fingerprint = JSON.stringify(payload);
    if (this.creationRequest?.fingerprint !== fingerprint) this.creationRequest = { fingerprint, key: crypto.randomUUID() };
    const key = this.creationRequest!.key;
    const request = this.creationMode === 'student'
      ? this.api.createStudentWithCase(payload as Parameters<StudentOperationsService['createStudentWithCase']>[0], key)
      : this.api.createCase(payload as Parameters<StudentOperationsService['createCase']>[0], key);
    this.saving = true; this.editError = '';
    request.pipe(takeUntil(this.destroy$)).subscribe({
      next: result => {
        // Keep the draft disabled until navigation; a failed navigation can
        // safely replay the exact idempotent save rather than create twice.
        void this.router.navigate(['/manager/students/cases', result.caseId], {state:{createdCaseMode:this.creationMode}}).then(navigated => {
          if (!navigated) { this.saving = false; this.showEditError('Saved successfully. Try Save again to open the case.'); }
        }).catch(() => { this.saving = false; this.showEditError('Saved successfully. Try Save again to open the case.'); });
      },
      error: error => {
        this.saving = false;
        this.showEditError(error?.status === 409 ? 'That email or student identifier is already in use, or the save request changed. Review the details and try again.' : 'The student or case could not be saved. Please try again.');
      },
    });
  }

  ngOnDestroy(): void {
    this.stopDocumentPolling();
    this.pendingPreview?.close();
    this.pendingPreview = null;
    this.destroy$.next();
    this.destroy$.complete();
  }

  private showEditError(message: string): void {
    this.editSuccess = '';
    this.editError = message;
  }

  private showEditSuccess(message: string): void {
    this.editError = '';
    this.editSuccess = message;
  }

  closeEditToast(): void {
    this.editError = this.editSuccess = '';
  }

  statusLabel(status: StudentCaseStatus): string {
    return CASE_STATUS_LABELS[status];
  }
  stageLabel(stage: string): string {
    return caseStageLabel(stage);
  }
  invoiceStatusLabel(status: string): string {
    if (status.toUpperCase() === 'AUTHORISED') return 'Awaiting';
    return xeroInvoiceStatusLabel(status);
  }
  invoiceDisplayNumber(invoice: StudentCaseInvoices['invoices'][number]): string {
    if (invoice.invoiceNumber) return invoice.invoiceNumber;
    if (invoice.type === 'RECEIVE-OVERPAYMENT') return 'Overpayment';
    if (invoice.type === 'RECEIVE-PREPAYMENT') return 'Prepayment';
    if (invoice.type === 'ACCRECCREDIT') return 'Credit note';
    return 'Unnumbered invoice';
  }
  dateLabel(value: string | null): string {
    if (!value) return '—';
    const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
    return Number.isFinite(date.getTime())
      ? new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
      : '—';
  }
  dateTimeLabel(value: string): string {
    const date = new Date(value);
    return Number.isFinite(date.getTime())
      ? new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date)
      : '—';
  }
  moneyLabel(value: string | null | undefined, currency: string | null | undefined): string {
    const amount = Number(value);
    if (value == null || !currency || !Number.isFinite(amount)) return '—';
    try { return new Intl.NumberFormat('en-AU', { style: 'currency', currency }).format(amount); }
    catch { return '—'; }
  }
  fileSize(bytes: number): string {
    return bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(1)} MB`;
  }
  previewMimeType(document: StudentCaseDocuments['documents'][number]): string | null {
    const type = document.mimeType.toLowerCase().split(';', 1)[0].trim();
    return ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(type) ? type : null;
  }

  private loadStudentIdentity(detail: StudentCaseDetail): void {
    const id = this.currentId;
    this.api.studentRegister({ page: 1, limit: 25, q: detail.studentReference }).pipe(takeUntil(this.destroy$)).subscribe({
      next: result => {
        if (id !== this.currentId) return;
        const student = result.students.find(row => row.userId === detail.userId && row.studentReference === detail.studentReference);
        if (student) this.studentIdentity = { legalName: student.legalName, email: student.email };
      },
      error: () => { /* The authorized case remains viewable without a register match. */ },
    });
  }

  loadRelated(page: number): void {
    if (!this.case || this.loadingRelated || page < 1) return;
    const id = this.currentId;
    this.loadingRelated = true;
    this.relatedError = '';
    this.api.casesForStudent(this.case.userId, page).pipe(takeUntil(this.destroy$)).subscribe({
      next: result => {
        if (id !== this.currentId) return;
        const seen = new Set(this.relatedCases.map(item => item.caseId));
        this.relatedCases = [...this.relatedCases, ...result.cases.filter(item => !seen.has(item.caseId))];
        this.relatedTotal = result.total;
        this.relatedPage = page;
        this.loadingRelated = false;
      },
      error: () => { if (id === this.currentId) { this.relatedError = 'Related cases could not be loaded.'; this.loadingRelated = false; } },
    });
  }
  loadInvoices(page: number): void {
    if (!this.case || this.loadingInvoices || page < 1) return;
    const id = this.currentId;
    this.loadingInvoices = true;
    this.invoiceError = '';
    this.api.caseInvoices(id, page).pipe(takeUntil(this.destroy$)).subscribe({
      next: result => { if (id === this.currentId) {
        this.loadingInvoices = false;
        const last = Math.max(1, Math.ceil(result.total / result.limit));
        if (result.page > last) { this.loadInvoices(last); return; }
        this.invoices = result; this.rememberCasePage('invoices', result.page);
      } },
      error: () => { if (id === this.currentId) { this.invoiceError = 'Invoices could not be loaded.'; this.loadingInvoices = false; } },
    });
  }
  loadDocuments(page: number,force=false): void {
    if (!this.case || (this.loadingDocuments&&!force) || page < 1) return;
    if(force)this.documentPollCount=0;
    this.stopDocumentPolling();
    const id = this.currentId;
    const request=++this.documentRequest;
    this.loadingDocuments = true;
    this.documentError = '';
    this.api.caseDocuments(id, page).pipe(takeUntil(this.destroy$)).subscribe({
      next: result => { if (id === this.currentId && request===this.documentRequest) {
        this.loadingDocuments = false;
        const last = Math.max(1, Math.ceil(result.total / result.limit));
        if (result.page > last) { this.loadDocuments(last); return; }
        const analysisFinished=this.documents?.analysisPending&&!result.analysisPending;
        const analysisChanged=this.documents?.documents.some(previous=>result.documents.some(current=>current.documentId===previous.documentId&&current.analysisStatus!==previous.analysisStatus));
        this.documents = result; this.rememberCasePage('documents', result.page);
        if(force||analysisFinished||analysisChanged)this.checklistRefresh++;
        if(analysisFinished||analysisChanged){this.loadActivity(1);this.refreshCaseSummary();}
        this.scheduleDocumentPoll();
      } },
      error: () => { if (id === this.currentId && request===this.documentRequest) { this.documentError = 'Documents could not be loaded.'; this.loadingDocuments = false; } },
    });
  }
  loadActivity(page: number): void {
    if (!this.case || this.loadingActivity || page < 1) return;
    const id = this.currentId;
    this.loadingActivity = true;
    this.activityError = '';
    this.api.caseActivity(id, page).pipe(takeUntil(this.destroy$)).subscribe({
      next: result => { if (id === this.currentId) { this.activity = result; this.loadingActivity = false; this.rememberCasePage('activity', result.page); } },
      error: () => { if (id === this.currentId) { this.activityError = 'Activity could not be loaded.'; this.loadingActivity = false; } },
    });
  }
  checklistRefresh=0;

  refreshCaseSummary():void{
    if(!this.case||this.editing||this.saving||this.creationMode)return;
    const id=this.currentId;this.api.caseDetail(id).pipe(takeUntil(this.destroy$)).subscribe({next:value=>{
      if(id===this.currentId&&!this.editing&&!this.saving)this.case=value;
    },error:()=>{}});
  }

  download(document: StudentCaseDocuments['documents'][number]): void {
    if (!this.case || this.downloadingId || this.viewingId) return;
    const id = this.currentId;
    this.downloadingId = document.documentId;
    this.downloadError = '';
    this.api.caseDocumentContent(id, document.documentId).pipe(takeUntil(this.destroy$)).subscribe({
      next: blob => {
        if (id !== this.currentId) return;
        const url = URL.createObjectURL(blob);
        const link = window.document.createElement('a');
        link.href = url;
        link.download = document.fileName.replace(/[\\/\r\n]/g, '_');
        window.document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.downloadingId = null;
      },
      error: () => { if (id === this.currentId) { this.downloadError = 'The document could not be downloaded. Try again.'; this.downloadingId = null; } },
    });
  }

  view(document: StudentCaseDocuments['documents'][number]): void {
    const type = this.previewMimeType(document);
    if (!this.case || !type || this.downloadingId || this.viewingId) return;
    // Open synchronously with the click so browser popup blockers allow the preview.
    const preview = window.open('about:blank', '_blank');
    if (!preview) {
      this.downloadError = 'The preview could not open. Allow pop-ups for this site or download the document.';
      return;
    }
    preview.opener = null;
    this.pendingPreview = preview;
    const id = this.currentId;
    this.viewingId = document.documentId;
    this.downloadError = '';
    this.api.caseDocumentContent(id, document.documentId).pipe(takeUntil(this.destroy$)).subscribe({
      next: blob => {
        if (id !== this.currentId || preview.closed) {
          preview.close();
          if (this.pendingPreview === preview) this.pendingPreview = null;
          if (id === this.currentId) this.viewingId = null;
          return;
        }
        let url: string | null = null;
        try {
          const previewUrl = URL.createObjectURL(blob.slice(0, blob.size, type));
          url = previewUrl;
          preview.location.href = previewUrl;
          setTimeout(() => URL.revokeObjectURL(previewUrl), 5 * 60 * 1000);
        } catch {
          if (url) URL.revokeObjectURL(url);
          preview.close();
          this.downloadError = 'The document could not be previewed. Try downloading it instead.';
        }
        if (this.pendingPreview === preview) this.pendingPreview = null;
        this.viewingId = null;
      },
      error: () => {
        preview.close();
        if (this.pendingPreview === preview) this.pendingPreview = null;
        if (id === this.currentId) {
          this.downloadError = 'The document could not be previewed. Try downloading it instead.';
          this.viewingId = null;
        }
      },
    });
  }

  private rememberCasePage(kind: 'invoices' | 'documents' | 'activity', page: number): void {
    const key = `case-pages:${this.currentId}`;
    this.navigationState.save(key, { ...this.navigationState.read<Partial<Record<'invoices' | 'documents' | 'activity', number>>>(key), [kind]: page });
  }

  private reset(): void {
    this.stopDocumentPolling();
    this.documentPollCount = 0;
    this.pendingPreview?.close();
    this.pendingPreview = null;
    this.case = null;
    this.editing = this.editLoading = this.saving = false;
    this.editOptions = this.workflowOptions = null;
    this.editError = this.editSuccess = '';
    this.studentIdentity = null;
    this.relatedCases = [];
    this.relatedTotal = 0;
    this.relatedPage = 0;
    this.invoices = null;
    this.documents = null;
    this.draftDocumentRequirements=[];this.requirementsLoading=false;this.requirementsError='';this.requirementRequest++;this.documentRequest++;
    this.activity = null;
    this.error = this.invoiceError = this.documentError = this.activityError = this.relatedError = this.downloadError = '';
    this.loading = true;
    this.loadingRelated = this.loadingInvoices = this.loadingDocuments = this.loadingActivity = false;
    this.downloadingId = null;
    this.viewingId = null;
  }
}
