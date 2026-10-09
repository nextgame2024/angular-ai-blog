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
  private requestVersion = 0;
  private saveRequestKey = '';
  private saveFingerprint = '';
  private formToastTimer: ReturnType<typeof setTimeout> | null = null;
  private formToastCloseTimer: ReturnType<typeof setTimeout> | null = null;

  @ViewChild('studentsList') studentsList?: ElementRef<HTMLElement>;
  @ViewChild('infiniteSentinel') infiniteSentinel?: ElementRef<HTMLElement>;

  readonly search = new FormControl('', { nonNullable: true });
  readonly status = new FormControl('', { nonNullable: true });
  readonly advisor = new FormControl('', { nonNullable: true });
  readonly college = new FormControl('', { nonNullable: true });
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

  get hasMore(): boolean { return this.students.length < this.total; }
  get canManage(): boolean {
    return this.workspace?.role === 'chief_executive' || this.workspace?.role === 'operations';
  }

  ngOnInit(): void {
    this.loadInitial();
    this.search.valueChanges.pipe(
      debounceTime(250), distinctUntilChanged(), takeUntil(this.destroy$),
    ).subscribe(() => this.resetAndLoad());
    this.status.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.resetAndLoad());
    this.advisor.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.resetAndLoad());
    this.college.valueChanges.pipe(
      debounceTime(250), distinctUntilChanged(), takeUntil(this.destroy$),
    ).subscribe(() => this.resetAndLoad());
  }

  ngAfterViewInit(): void { queueMicrotask(() => this.setupInfiniteScroll()); }

  ngOnDestroy(): void {
    this.observer?.disconnect();
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

  openCreate(): void {
    if (!this.canManage) return;
    this.viewMode = 'form';
    this.editingStudent = null;
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
      next: () => {
        this.saving = false;
        this.viewMode = 'list';
        this.editingStudent = null;
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
    forkJoin({ workspace: this.api.workspace(), result: this.api.students(this.query(1)) })
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: ({ workspace, result }) => {
          if (version !== this.requestVersion) return;
          this.workspace = workspace;
          this.applyResult(result, true);
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
