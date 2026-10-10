import { CommonModule } from '@angular/common';
import {
  AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject,
} from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, forkJoin, map, takeUntil } from 'rxjs';
import { ManagerService } from '../../services/manager.service';
import {
  ManagerSelectComponent, type ManagerSelectOption,
} from '../../components/shared/manager-select/manager-select.component';
import { StudentOperationsService } from '../student-operations.service';
import type {
  StudentOperationsStudentDetail,
  StudentOperationsStudentList,
  StudentOperationsStudentSummary,
  StudentOperationsStudentWrite,
  StudentOperationsWorkspace,
  XeroConnectionSummary,
  XeroStudentInvoice,
  XeroStudentInvoiceDetail,
  XeroStudentInvoiceResult,
  XeroStudentInvoiceSort,
  XeroStudentSyncStatus,
} from '../student-operations.types';

@Component({
  selector: 'app-student-operations-students-page',
  imports: [CommonModule, ReactiveFormsModule, RouterModule, ManagerSelectComponent],
  templateUrl: './student-operations-students.page.html',
  styleUrls: ['./student-operations-students.page.css'],
})
export class StudentOperationsStudentsPageComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly api = inject(StudentOperationsService);
  private readonly managerApi = inject(ManagerService);
  private readonly fb = inject(FormBuilder);
  private readonly destroy$ = new Subject<void>();
  private observer?: IntersectionObserver;
  private syncPollTimer: ReturnType<typeof setTimeout> | null = null;
  private syncPollAttempt = 0;
  private syncPollStartedAt = 0;
  private readonly syncPollMaxDurationMs = 15 * 60 * 1000;
  private requestVersion = 0;
  private invoiceRequestVersion = 0;
  private saveRequestKey = '';
  private saveFingerprint = '';
  private reviewingXeroContactId: string | null = null;
  private formToastTimer: ReturnType<typeof setTimeout> | null = null;
  private formToastCloseTimer: ReturnType<typeof setTimeout> | null = null;

  @ViewChild('studentsList') studentsList?: ElementRef<HTMLElement>;
  @ViewChild('infiniteSentinel') infiniteSentinel?: ElementRef<HTMLElement>;

  readonly search = new FormControl('', { nonNullable: true });
  readonly status = new FormControl('', { nonNullable: true });
  readonly advisor = new FormControl('', { nonNullable: true });
  readonly college = new FormControl('', { nonNullable: true });
  readonly invoicePageSize = new FormControl('25', { nonNullable: true });
  readonly pageSize = 20;
  readonly statusOptions: ManagerSelectOption[] = [
    { value: '', label: 'All statuses' },
    { value: 'active', label: 'Active' },
    { value: 'action_required', label: 'Action required' },
    { value: 'on_hold', label: 'On hold' },
    { value: 'completed', label: 'Completed' },
    { value: 'archived', label: 'Archived' },
  ];
  readonly formStatusOptions: ManagerSelectOption[] = this.statusOptions.slice(1);
  readonly invoicePageSizeOptions: ManagerSelectOption[] = [
    { value: '25', label: '25 per page' },
    { value: '50', label: '50 per page' },
    { value: '100', label: '100 per page' },
  ];
  readonly stageOptions: ManagerSelectOption[] = [
    { value: 'new_application', label: 'New application' },
    { value: 'pre_payment_audit', label: 'Pre-payment audit' },
    { value: 'student_payment_received', label: 'Student payment received' },
    { value: 'reconciliation', label: 'Reconciliation' },
    { value: 'cover_letter', label: 'Cover letter' },
    { value: 'college_payment', label: 'College payment' },
    { value: 'collections', label: 'Collections' },
    { value: 'commission_recovery', label: 'Commission recovery' },
    { value: 'completed', label: 'Completed' },
  ];
  readonly advisorFilterOptions: ManagerSelectOption[] = [
    { value: '', label: 'All assignments' },
    { value: 'assigned', label: 'Assigned' },
    { value: 'unassigned', label: 'Unassigned' },
    { value: 'me', label: 'Assigned to me' },
  ];
  advisorOptions: ManagerSelectOption[] = [{ value: '', label: 'Unassigned' }];

  readonly studentForm = this.fb.group({
    studentReference: ['', [Validators.required, Validators.maxLength(80), Validators.pattern(/^[A-Za-z0-9._\/-]+$/)]],
    legalName: ['', [Validators.required, Validators.maxLength(200)]],
    preferredName: ['', [Validators.maxLength(200)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(320)]],
    currentStage: ['new_application', Validators.required],
    status: ['active', Validators.required],
    advisorIdentityUserId: [''],
    collegeName: ['', [Validators.maxLength(200)]],
  });

  workspace: StudentOperationsWorkspace | null = null;
  students: StudentOperationsStudentSummary[] = [];
  editingStudent: StudentOperationsStudentDetail | null = null;
  viewMode: 'list' | 'form' = 'list';
  page = 1;
  total = 0;
  loadingInitial = true;
  loadingMore = false;
  loadingForm = false;
  saving = false;
  error = '';
  formError = '';
  formToastMessage: string | null = null;
  formToastClosing = false;
  privacyNoteVisible = true;
  summary = { totalStudents: 0, activeStudents: 0, newApplications: 0, actionRequired: 0, onHold: 0 };
  xeroConnection: XeroConnectionSummary | null = null;
  xeroInvoices: XeroStudentInvoiceResult | null = null;
  selectedXeroInvoice: XeroStudentInvoiceDetail | null = null;
  loadingInvoiceDetail = false;
  invoiceDetailError = '';
  xeroSync: XeroStudentSyncStatus | null = null;
  invoiceSort: XeroStudentInvoiceSort = 'date';
  invoiceSortDirection: 'asc' | 'desc' = 'desc';
  loadingInvoices = false;
  loadingXeroContext = true;
  loadingXero = false;
  xeroError = '';
  xeroNotice = '';

  get hasMore(): boolean { return this.students.length < this.total; }
  get canManage(): boolean {
    return this.workspace?.role === 'chief_executive' || this.workspace?.role === 'operations';
  }
  get isChiefExecutive(): boolean { return this.workspace?.role === 'chief_executive'; }
  get xeroNeedsReconnect(): boolean {
    return Boolean(this.xeroConnection?.missingStudentDiscoveryScopes?.length);
  }
  get invoicePageStart(): number {
    if (!this.xeroInvoices?.total) return 0;
    return (this.xeroInvoices.page - 1) * this.xeroInvoices.limit + 1;
  }
  get invoicePageEnd(): number {
    if (!this.xeroInvoices) return 0;
    return Math.min(this.xeroInvoices.page * this.xeroInvoices.limit, this.xeroInvoices.total);
  }
  get xeroRunActive(): boolean {
    return this.xeroSync?.latestRun?.status === 'queued' || this.xeroSync?.latestRun?.status === 'processing';
  }
  get xeroSyncProgress(): string {
    const run = this.xeroSync?.latestRun;
    if (!run || run.status === 'queued') return 'Waiting for the background worker.';
    const progress: string[] = [];
    if (run.contactCount > 0) progress.push(`${run.contactCount} contacts`);
    if (run.invoiceCount > 0) progress.push(`${run.invoiceCount} invoices`);
    return progress.length
      ? `Refreshing in the background · ${progress.join(' and ')} processed.`
      : 'Refreshing in the background. Existing records remain available.';
  }

  ngOnInit(): void {
    this.loadInitial();
    this.search.valueChanges.pipe(
      debounceTime(250), distinctUntilChanged(), takeUntil(this.destroy$),
    ).subscribe(() => {
      this.resetAndLoad();
      if (this.xeroConnection) this.loadXeroInvoices(1);
    });
    this.status.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.resetAndLoad());
    this.advisor.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.resetAndLoad());
    this.college.valueChanges.pipe(
      debounceTime(250), distinctUntilChanged(), takeUntil(this.destroy$),
    ).subscribe(() => this.resetAndLoad());
    this.invoicePageSize.valueChanges.pipe(
      distinctUntilChanged(), takeUntil(this.destroy$),
    ).subscribe(() => this.loadXeroInvoices(1));
  }

  ngAfterViewInit(): void { queueMicrotask(() => this.setupInfiniteScroll()); }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    if (this.syncPollTimer) clearTimeout(this.syncPollTimer);
    this.clearFormToastTimers();
    this.destroy$.next();
    this.destroy$.complete();
  }

  retry(): void { this.workspace ? this.resetAndLoad() : this.loadInitial(); }
  clearSearch(): void { this.search.setValue(''); }
  dismissPrivacyNote(): void { this.privacyNoteVisible = false; }

  formatLabel(value: string): string {
    return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  formatMoney(value: number | null, currencyCode: string | null): string {
    if (value === null) return '—';
    return new Intl.NumberFormat('en-AU', {
      style: 'currency', currency: currencyCode || 'AUD', maximumFractionDigits: 2,
    }).format(value);
  }

  formatDate(value: string | null): string {
    if (!value) return '—';
    return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
      .format(new Date(`${value}T00:00:00Z`));
  }

  sortXeroInvoices(sort: XeroStudentInvoiceSort): void {
    if (this.invoiceSort === sort) {
      this.invoiceSortDirection = this.invoiceSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.invoiceSort = sort;
      this.invoiceSortDirection = sort === 'date' || sort === 'dueDate' ? 'desc' : 'asc';
    }
    this.loadXeroInvoices(1);
  }

  invoiceSortAria(sort: XeroStudentInvoiceSort): 'ascending' | 'descending' | 'none' {
    if (this.invoiceSort !== sort) return 'none';
    return this.invoiceSortDirection === 'asc' ? 'ascending' : 'descending';
  }

  goToInvoicePage(page: number): void {
    if (!this.xeroInvoices || this.loadingInvoices) return;
    const target = Math.max(1, Math.min(page, this.xeroInvoices.totalPages || 1));
    if (target !== this.xeroInvoices.page) this.loadXeroInvoices(target);
  }

  openInvoiceDetail(invoice: XeroStudentInvoice): void {
    if (!this.xeroConnection || this.loadingInvoiceDetail) return;
    this.loadingInvoiceDetail = true;
    this.invoiceDetailError = '';
    this.selectedXeroInvoice = null;
    this.api.xeroStudentInvoice(this.xeroConnection.connectionId, invoice.xeroInvoiceId)
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: (detail) => {
          this.selectedXeroInvoice = detail;
          this.loadingInvoiceDetail = false;
        },
        error: () => {
          this.invoiceDetailError = 'The stored invoice details could not be loaded.';
          this.loadingInvoiceDetail = false;
        },
      });
  }

  closeInvoiceDetail(): void {
    this.selectedXeroInvoice = null;
    this.invoiceDetailError = '';
    this.loadingInvoiceDetail = false;
  }

  refreshStudentsFromXero(): void {
    if (!this.isChiefExecutive || this.loadingXero || this.xeroNeedsReconnect || !this.xeroConnection) return;
    this.loadingXero = true;
    this.xeroError = '';
    this.xeroNotice = '';
    this.api.refreshXeroStudents(this.xeroConnection.connectionId)
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: (run) => {
          this.xeroSync = {
            configured: true,
            organisationRole: 'trust',
            lastSuccessfulSyncAt: this.xeroSync?.lastSuccessfulSyncAt ?? null,
            lastFullSyncAt: this.xeroSync?.lastFullSyncAt ?? null,
            lastErrorCode: null,
            nextScheduledSyncAt: this.xeroSync?.nextScheduledSyncAt ?? null,
            latestRun: run,
          };
          this.pollXeroSync(true);
        },
        error: (error) => {
          this.loadingXero = false;
          this.xeroError = this.writeError(error, 'The Xero refresh could not be queued.');
        },
      });
  }

  formatSyncTime(value: string | null): string {
    if (!value) return 'Never synchronized';
    return new Intl.DateTimeFormat('en-AU', {
      day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
    }).format(new Date(value));
  }

  reviewXeroInvoice(candidate: XeroStudentInvoice): void {
    if (!this.canManage) return;
    this.openCreate();
    this.reviewingXeroContactId = candidate.xeroContactId;
    const fallbackReference = `XERO-${candidate.xeroContactId.replaceAll('-', '').slice(0, 12).toUpperCase()}`;
    this.studentForm.patchValue({
      studentReference: candidate.suggestedStudentReference || fallbackReference,
      legalName: candidate.studentName,
      email: candidate.studentEmail || '',
      collegeName: candidate.reference || '',
      currentStage: 'new_application',
      status: 'active',
    });
  }

  openCreate(): void {
    if (!this.canManage) return;
    this.viewMode = 'form';
    this.editingStudent = null;
    this.reviewingXeroContactId = null;
    this.formError = '';
    this.studentForm.reset({
      studentReference: '', legalName: '', preferredName: '', email: '',
      currentStage: 'new_application', status: 'active', advisorIdentityUserId: '', collegeName: '',
    });
    this.resetSaveRequest();
    this.loadAdvisors();
  }

  openEdit(student: StudentOperationsStudentSummary): void {
    if (!this.canManage) return;
    this.viewMode = 'form';
    this.reviewingXeroContactId = null;
    this.loadingForm = true;
    this.formError = '';
    forkJoin({
      student: this.api.student(student.studentId),
      advisors: this.advisorLookup(),
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: ({ student, advisors }) => {
        this.editingStudent = student;
        this.advisorOptions = advisors;
        this.studentForm.reset({
          studentReference: student.studentReference,
          legalName: student.legalName,
          preferredName: student.preferredName ?? '',
          email: student.email,
          currentStage: student.currentStage,
          status: student.status,
          advisorIdentityUserId: student.advisorIdentityUserId ?? '',
          collegeName: student.collegeName ?? '',
        });
        this.resetSaveRequest();
        this.loadingForm = false;
      },
      error: (error) => {
        this.loadingForm = false;
        this.formError = this.writeError(error, 'The student could not be loaded.');
      },
    });
  }

  cancelForm(): void {
    if (this.saving) return;
    this.viewMode = 'list';
    this.editingStudent = null;
    this.reviewingXeroContactId = null;
    this.formError = '';
  }

  saveStudent(): void {
    if (!this.canManage || this.saving) return;
    this.studentForm.markAllAsTouched();
    if (this.studentForm.invalid) {
      this.showFormToast('Please complete the required student fields and check their format before using Save & Finish.');
      return;
    }
    const raw = this.studentForm.getRawValue();
    const value: StudentOperationsStudentWrite = {
      studentReference: raw.studentReference!.trim(),
      legalName: raw.legalName!.trim(),
      preferredName: raw.preferredName?.trim() || null,
      email: raw.email!.trim().toLowerCase(),
      currentStage: raw.currentStage!,
      status: raw.status!,
      advisorIdentityUserId: raw.advisorIdentityUserId || null,
      collegeName: raw.collegeName?.trim() || null,
    };
    if (!this.editingStudent && this.reviewingXeroContactId && this.xeroConnection) {
      value.xeroCandidateSource = {
        connectionId: this.xeroConnection.connectionId,
        contactId: this.reviewingXeroContactId,
      };
    }
    const fingerprint = JSON.stringify({ id: this.editingStudent?.studentId ?? null, value });
    if (!this.saveRequestKey || this.saveFingerprint !== fingerprint) {
      this.saveRequestKey = crypto.randomUUID();
      this.saveFingerprint = fingerprint;
    }
    this.saving = true;
    this.formError = '';
    const request = this.editingStudent
      ? this.api.updateStudent(
        this.editingStudent.studentId,
        { ...value, recordVersion: this.editingStudent.recordVersion },
        this.saveRequestKey,
      )
      : this.api.createStudent(value, this.saveRequestKey);
    request.pipe(takeUntil(this.destroy$)).subscribe({
      next: (student) => {
        this.saving = false;
        if (this.reviewingXeroContactId) this.loadXeroInvoices(this.xeroInvoices?.page ?? 1);
        this.viewMode = 'list';
        this.editingStudent = null;
        this.reviewingXeroContactId = null;
        this.resetSaveRequest();
        this.resetAndLoad();
      },
      error: (error) => {
        this.saving = false;
        this.formError = this.writeError(error, 'The student could not be saved.');
      },
    });
  }

  private loadInitial(): void {
    const version = ++this.requestVersion;
    this.loadingInitial = true;
    this.error = '';
    forkJoin({
      workspace: this.api.workspace(),
      result: this.api.students(this.query(1)),
      dashboard: this.api.dashboard(),
    })
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: ({ workspace, result, dashboard }) => {
          if (version !== this.requestVersion) return;
          this.workspace = workspace;
          this.summary = dashboard.summary;
          this.applyResult(result, true);
          if (workspace.role === 'chief_executive') this.loadXeroContext();
          else this.loadingXeroContext = false;
        },
        error: (error) => this.handleError(error, version),
      });
  }

  private loadPage(page: number, reset: boolean): void {
    const version = ++this.requestVersion;
    if (reset) this.loadingInitial = true;
    else this.loadingMore = true;
    this.error = '';
    this.api.students(this.query(page)).pipe(takeUntil(this.destroy$)).subscribe({
      next: (result) => {
        if (version !== this.requestVersion) return;
        this.applyResult(result, reset);
      },
      error: (error) => this.handleError(error, version),
    });
  }

  private applyResult(result: StudentOperationsStudentList, reset: boolean): void {
    const next = reset ? result.students : [...this.students, ...result.students];
    this.students = Array.from(new Map(next.map((student) => [student.studentId, student])).values());
    this.page = result.page;
    this.total = result.total;
    this.loadingInitial = false;
    this.loadingMore = false;
  }

  private handleError(error: any, version: number): void {
    if (version !== this.requestVersion) return;
    this.loadingInitial = false;
    this.loadingMore = false;
    this.loadingXeroContext = false;
    this.error = Number(error?.status) === 403
      ? 'This account does not have Student Operations workspace access.'
      : 'The student register could not be loaded.';
  }

  private loadAdvisors(): void {
    this.loadingForm = true;
    this.advisorLookup().pipe(takeUntil(this.destroy$)).subscribe({
      next: (options) => { this.advisorOptions = options; this.loadingForm = false; },
      error: (error) => {
        this.loadingForm = false;
        this.formError = this.writeError(error, 'Advisor assignments could not be loaded.');
      },
    });
  }

  private loadXeroContext(): void {
    this.loadingXeroContext = true;
    this.api.xeroStatus().pipe(takeUntil(this.destroy$)).subscribe({
      next: (status) => {
        const active = status.connections.filter((connection) => connection.status === 'active');
        this.xeroConnection = active.find((connection) => connection.organisationRole === 'trust')
          ?? (active.length === 1 ? active[0]! : null);
        if (!this.xeroConnection && active.length > 1) {
          this.xeroError = 'Choose the Trust organisation in Company before refreshing student data.';
        }
        if (this.xeroConnection && !this.xeroNeedsReconnect) {
          this.loadXeroSyncStatus();
          this.loadXeroInvoices(1);
        } else {
          this.loadingXeroContext = false;
        }
      },
      error: () => {
        this.loadingXeroContext = false;
        this.xeroError = 'Xero connection status could not be loaded.';
      },
    });
  }

  private loadXeroSyncStatus(): void {
    if (!this.xeroConnection) return;
    this.api.xeroStudentSyncStatus(this.xeroConnection.connectionId)
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: (status) => {
          this.xeroSync = status;
          const state = status.latestRun?.status;
          if (state === 'queued' || state === 'processing') {
            this.loadingXero = true;
            this.pollXeroSync(true);
          } else {
            this.loadingXero = false;
            this.xeroError = state === 'failed' ? this.xeroSyncFailureMessage(status) : '';
          }
        },
        error: () => { this.xeroError = 'Xero synchronization status could not be loaded.'; },
      });
  }

  private pollXeroSync(reset = false): void {
    if (!this.xeroConnection) return;
    if (this.syncPollTimer) clearTimeout(this.syncPollTimer);
    if (reset) {
      this.syncPollAttempt = 0;
      this.syncPollStartedAt = Date.now();
      this.xeroNotice = '';
    }
    if (Date.now() - this.syncPollStartedAt >= this.syncPollMaxDurationMs) {
      this.syncPollTimer = null;
      this.loadingXero = false;
      this.xeroNotice = 'The refresh is still running. You can leave this page and check its progress later.';
      return;
    }
    const delay = Math.min(2000 * (2 ** Math.floor(this.syncPollAttempt / 2)), 15_000);
    this.syncPollAttempt += 1;
    this.syncPollTimer = setTimeout(() => {
      this.syncPollTimer = null;
      if (!this.xeroConnection) return;
      this.api.xeroStudentSyncStatus(this.xeroConnection.connectionId)
        .pipe(takeUntil(this.destroy$)).subscribe({
          next: (status) => {
            this.xeroSync = status;
            const state = status.latestRun?.status;
            if (state === 'queued' || state === 'processing') {
              this.pollXeroSync();
              return;
            }
            this.loadingXero = false;
            if (state === 'failed') {
              this.xeroError = this.xeroSyncFailureMessage(status);
              return;
            }
            this.xeroError = '';
            this.xeroNotice = '';
            this.loadXeroInvoices(this.xeroInvoices?.page ?? 1);
          },
          error: () => {
            this.loadingXero = false;
            this.xeroError = 'Xero synchronization status could not be refreshed.';
          },
        });
    }, delay);
  }

  private xeroSyncFailureMessage(status: XeroStudentSyncStatus): string {
    if (status.lastErrorCode === 'xero_unavailable' || status.lastErrorCode === 'xero_rate_limited') {
      const retry = status.nextScheduledSyncAt
        ? ` An automatic retry is scheduled for ${new Intl.DateTimeFormat('en-AU', {
          day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
        }).format(new Date(status.nextScheduledSyncAt))}.`
        : ' An automatic retry has been scheduled.';
      return `Xero is temporarily unavailable.${retry} Existing student information remains available.`;
    }
    if (status.lastErrorCode === 'xero_authorization_rejected') {
      return 'The Xero authorization requires attention. Reconnect the TRUST organisation from Company.';
    }
    return 'The Xero refresh failed. Existing student information remains available.';
  }

  private loadXeroInvoices(page: number): void {
    if (!this.xeroConnection || this.xeroNeedsReconnect) return;
    const version = ++this.invoiceRequestVersion;
    this.loadingInvoices = true;
    this.api.xeroStudentInvoices(this.xeroConnection.connectionId, {
      page,
      limit: Number(this.invoicePageSize.value),
      q: this.search.value.trim() || undefined,
      sort: this.invoiceSort,
      direction: this.invoiceSortDirection,
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (result) => {
        if (version !== this.invoiceRequestVersion) return;
        this.xeroInvoices = result;
        this.loadingInvoices = false;
        this.loadingXeroContext = false;
      },
      error: () => {
        if (version !== this.invoiceRequestVersion) return;
        this.loadingInvoices = false;
        this.loadingXeroContext = false;
        this.xeroError = 'Stored Xero invoices could not be loaded.';
      },
    });
  }

  private advisorLookup() {
    return forkJoin({
      users: this.managerApi.listUsers({ page: 1, limit: 100, status: 'active' }),
      advisors: this.api.advisors(),
    }).pipe(map(({ users, advisors }) => {
      const allowed = new Set(advisors.advisorIdentityUserIds);
      return [
        { value: '', label: 'Unassigned' },
        ...users.items
          .filter((user) => allowed.has(user.id))
          .sort((left, right) => (left.name || left.email).localeCompare(right.name || right.email))
          .map((user) => ({ value: user.id, label: user.name || user.email })),
      ];
    }));
  }

  private resetAndLoad(): void {
    this.page = 1;
    this.students = [];
    this.total = 0;
    this.loadPage(1, true);
  }

  private tryLoadMore(): void {
    if (this.loadingInitial || this.loadingMore || !this.hasMore || this.error) return;
    this.loadPage(this.page + 1, false);
  }

  private query(page: number) {
    return {
      page, limit: this.pageSize,
      q: this.search.value.trim() || undefined,
      status: this.status.value || undefined,
      advisor: this.advisor.value || undefined,
      college: this.college.value.trim() || undefined,
    };
  }

  private setupInfiniteScroll(): void {
    const sentinel = this.infiniteSentinel?.nativeElement;
    const list = this.studentsList?.nativeElement;
    if (!sentinel || !list) return;
    this.observer?.disconnect();
    this.observer = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) this.tryLoadMore(); },
      { root: list.closest('.content') as HTMLElement | null, rootMargin: '200px 0px', threshold: 0.1 },
    );
    this.observer.observe(sentinel);
  }

  private resetSaveRequest(): void {
    this.saveRequestKey = '';
    this.saveFingerprint = '';
  }

  private showFormToast(message: string): void {
    this.clearFormToastTimers();
    this.formToastMessage = message;
    this.formToastClosing = false;

    this.formToastTimer = window.setTimeout(() => {
      this.formToastClosing = true;
      this.formToastCloseTimer = window.setTimeout(() => {
        this.formToastMessage = null;
        this.formToastClosing = false;
      }, 220);
    }, 3200);
  }

  private clearFormToastTimers(): void {
    if (this.formToastTimer) {
      clearTimeout(this.formToastTimer);
      this.formToastTimer = null;
    }
    if (this.formToastCloseTimer) {
      clearTimeout(this.formToastCloseTimer);
      this.formToastCloseTimer = null;
    }
  }

  private writeError(error: any, fallback: string): string {
    const message = error?.error?.message;
    return typeof message === 'string' && message.trim() ? message : fallback;
  }
}
