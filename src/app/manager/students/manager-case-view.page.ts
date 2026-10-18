import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject, catchError, distinctUntilChanged, forkJoin, map, of, switchMap, takeUntil } from 'rxjs';
import { ManagerListLoaderComponent } from '../components/shared/manager-list-loader/manager-list-loader.component';
import { ManagerSelectComponent, type ManagerSelectOption } from '../components/shared/manager-select/manager-select.component';
import { StudentOperationsService } from '../student-operations/student-operations.service';
import { CASE_STATUS_LABELS, CASE_WORKFLOW_STAGES, IMPORTED_CASE_STAGE, caseStageLabel } from '../student-operations/student-case-workflow';
import { xeroInvoiceStatusLabel } from '../student-operations/xero-invoice-display';
import type {
  StudentCaseActivity, StudentCaseDetail, StudentCaseDocuments, StudentCaseInvoices,
  StudentCaseList, StudentCaseStatus, StudentRegisterRow,
  StudentOperationsWorkspace,
  StudentCaseEditOptions, StudentCaseWorkflowOptions,
} from '../student-operations/student-operations.types';

@Component({
  selector: 'app-manager-case-view',
  imports: [CommonModule, RouterModule, ReactiveFormsModule, ManagerListLoaderComponent, ManagerSelectComponent],
  templateUrl: './manager-case-view.page.html',
  styleUrls: ['./manager-case-view.page.css'],
})
export class ManagerCaseViewPageComponent implements OnInit, OnDestroy {
  private readonly api = inject(StudentOperationsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();

  readonly Math = Math;
  case: StudentCaseDetail | null = null;
  workspace: StudentOperationsWorkspace | null = null;
  studentIdentity: Pick<StudentRegisterRow, 'legalName' | 'email'> | null = null;
  relatedCases: StudentCaseList['cases'] = [];
  relatedTotal = 0;
  relatedPage = 0;
  invoices: StudentCaseInvoices | null = null;
  documents: StudentCaseDocuments | null = null;
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
    collegeId: new FormControl<string | null>(null),
    advisorUserId: new FormControl<string | null>(null),
    status: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    currentStage: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
  loadingRelated = false;
  loadingInvoices = false;
  loadingDocuments = false;
  loadingActivity = false;
  private currentId = '';
  private pendingPreview: Window | null = null;
  private editErrorTimer: ReturnType<typeof setTimeout> | null = null;

  get primaryAdvisor(): string | null {
    return this.case?.advisors.find(item => item.isPrimary)?.name || this.case?.advisorName || null;
  }
  get primaryCollege(): string | null {
    return this.case?.colleges.find(item => item.isPrimary)?.name || null;
  }
  get studentName(): string {
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
    return [{ value: '', label: 'No advisor' }, ...(this.editOptions?.advisors.map(item => ({ value: item.userId, label: item.name })) ?? [])];
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

  ngOnInit(): void {
    this.editForm.controls.status.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.onStatusChange());
    this.api.workspace().pipe(takeUntil(this.destroy$)).subscribe({
      next: workspace => {
        this.workspace = workspace;
        if (this.case && this.route.snapshot?.queryParamMap?.get('edit') === '1' && this.canEditCases && !this.editing) this.beginEdit(this.case.caseId);
      },
      error: () => { this.workspace = null; },
    });
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
      if (this.route.snapshot?.queryParamMap?.get('edit') === '1' && this.canEditCases) this.beginEdit(detail.caseId);
      if (!detail.studentName) this.loadStudentIdentity(detail);
      this.loadRelated(1);
      this.loadInvoices(1);
      this.loadDocuments(1);
      this.loadActivity(1);
    });
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
            collegeId: this.case.colleges.find(item => item.isPrimary)?.collegeId ?? '',
            advisorUserId: this.case.advisors.find(item => item.isPrimary)?.userId ?? '',
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
  }

  cancelEdit(): void {
    if (this.saving) return;
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
    const id = this.case.caseId;
    const value = this.editForm.getRawValue();
    this.saving = true;
    this.editError = '';
    this.api.updateCase(id, {
      recordVersion: this.case.recordVersion,
      studentName: value.studentName.trim(), studentEmail: value.studentEmail.trim(), mobile: value.mobile.trim() || null, phone: value.phone.trim() || null,
      collegeId: value.collegeId || null, advisorUserId: value.advisorUserId || null,
      status: value.status, currentStage: value.currentStage,
    }, crypto.randomUUID()).pipe(takeUntil(this.destroy$)).subscribe({
      next: result => {
        if (id !== this.currentId) return;
        const college = this.editOptions?.colleges.find(item => item.collegeId === value.collegeId);
        const advisor = this.editOptions?.advisors.find(item => item.userId === value.advisorUserId);
        const detail: StudentCaseDetail = {
          ...this.case!, studentName: value.studentName.trim(), studentEmail: value.studentEmail.trim(),
          studentMobile: value.mobile.trim() || null, studentPhone: value.phone.trim() || null,
          status: value.status as StudentCaseStatus, currentStage: value.currentStage,
          advisorName: advisor?.name ?? null,
          advisors: advisor ? [{ userId: advisor.userId, name: advisor.name, isPrimary: true }] : [],
          colleges: college ? [{ collegeId: college.collegeId, name: college.name, isPrimary: true }] : [],
          recordVersion: result.recordVersion, updatedAt: new Date().toISOString(),
        };
        this.case = detail;
        this.relatedCases = this.relatedCases.map(item => item.caseId === id
          ? { ...item, status: detail.status, currentStage: detail.currentStage } : item);
        this.saving = false;
        this.editing = false;
        this.editSuccess = 'Case saved.';
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

  ngOnDestroy(): void {
    if (this.editErrorTimer) clearTimeout(this.editErrorTimer);
    this.pendingPreview?.close();
    this.pendingPreview = null;
    this.destroy$.next();
    this.destroy$.complete();
  }

  private showEditError(message: string): void {
    if (this.editErrorTimer) clearTimeout(this.editErrorTimer);
    this.editError = message;
    this.editErrorTimer = setTimeout(() => { this.editError = ''; this.editErrorTimer = null; }, 3500);
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
      next: result => { if (id === this.currentId) { this.invoices = result; this.loadingInvoices = false; } },
      error: () => { if (id === this.currentId) { this.invoiceError = 'Invoices could not be loaded.'; this.loadingInvoices = false; } },
    });
  }
  loadDocuments(page: number): void {
    if (!this.case || this.loadingDocuments || page < 1) return;
    const id = this.currentId;
    this.loadingDocuments = true;
    this.documentError = '';
    this.api.caseDocuments(id, page).pipe(takeUntil(this.destroy$)).subscribe({
      next: result => { if (id === this.currentId) { this.documents = result; this.loadingDocuments = false; } },
      error: () => { if (id === this.currentId) { this.documentError = 'Documents could not be loaded.'; this.loadingDocuments = false; } },
    });
  }
  loadActivity(page: number): void {
    if (!this.case || this.loadingActivity || page < 1) return;
    const id = this.currentId;
    this.loadingActivity = true;
    this.activityError = '';
    this.api.caseActivity(id, page).pipe(takeUntil(this.destroy$)).subscribe({
      next: result => { if (id === this.currentId) { this.activity = result; this.loadingActivity = false; } },
      error: () => { if (id === this.currentId) { this.activityError = 'Activity could not be loaded.'; this.loadingActivity = false; } },
    });
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

  private reset(): void {
    this.pendingPreview?.close();
    this.pendingPreview = null;
    if (this.editErrorTimer) clearTimeout(this.editErrorTimer);
    this.editErrorTimer = null;
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
    this.activity = null;
    this.error = this.invoiceError = this.documentError = this.activityError = this.relatedError = this.downloadError = '';
    this.loading = true;
    this.loadingRelated = this.loadingInvoices = this.loadingDocuments = this.loadingActivity = false;
    this.downloadingId = null;
    this.viewingId = null;
  }
}
