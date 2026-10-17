import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Subject, catchError, distinctUntilChanged, map, of, switchMap, takeUntil } from 'rxjs';
import { ManagerListLoaderComponent } from '../components/shared/manager-list-loader/manager-list-loader.component';
import { StudentOperationsService } from '../student-operations/student-operations.service';
import { CASE_STATUS_LABELS, CASE_WORKFLOW_STAGES, IMPORTED_CASE_STAGE, caseStageLabel } from '../student-operations/student-case-workflow';
import { xeroInvoiceStatusLabel } from '../student-operations/xero-invoice-display';
import type {
  StudentCaseActivity, StudentCaseDetail, StudentCaseDocuments, StudentCaseInvoices,
  StudentCaseList, StudentCaseStatus, StudentRegisterRow,
} from '../student-operations/student-operations.types';

@Component({
  selector: 'app-manager-case-view',
  imports: [CommonModule, RouterModule, ManagerListLoaderComponent],
  templateUrl: './manager-case-view.page.html',
  styleUrls: ['./manager-case-view.page.css'],
})
export class ManagerCaseViewPageComponent implements OnInit, OnDestroy {
  private readonly api = inject(StudentOperationsService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy$ = new Subject<void>();

  readonly Math = Math;
  case: StudentCaseDetail | null = null;
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
  loadingRelated = false;
  loadingInvoices = false;
  loadingDocuments = false;
  loadingActivity = false;
  private currentId = '';

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
  get studentPhoneHref(): string | null {
    const phone = this.studentPhone?.replace(/[^\d+]/g, '') ?? '';
    return /\d/.test(phone) ? `tel:${phone}` : null;
  }
  get workflowStages(): ReadonlyArray<{ value: string; label: string }> {
    return this.case?.currentStage === IMPORTED_CASE_STAGE.value
      ? [IMPORTED_CASE_STAGE, ...CASE_WORKFLOW_STAGES] : CASE_WORKFLOW_STAGES;
  }
  get canLoadRelated(): boolean { return this.relatedCases.length < this.relatedTotal; }
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
      if (!detail.studentName) this.loadStudentIdentity(detail);
      this.loadRelated(1);
      this.loadInvoices(1);
      this.loadDocuments(1);
      this.loadActivity(1);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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
    if (!this.case || this.downloadingId) return;
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

  private reset(): void {
    this.case = null;
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
  }
}
