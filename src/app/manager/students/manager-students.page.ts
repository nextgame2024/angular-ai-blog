import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DatePickerModule } from 'primeng/datepicker';
import {
  BehaviorSubject, Subject, catchError, debounceTime, distinctUntilChanged,
  of, switchMap, takeUntil,
} from 'rxjs';
import {
  ManagerSelectComponent, type ManagerSelectOption,
} from '../components/shared/manager-select/manager-select.component';
import { ManagerListLoaderComponent } from '../components/shared/manager-list-loader/manager-list-loader.component';
import { StudentOperationsService } from '../student-operations/student-operations.service';
import type {
  StudentOperationsWorkspace, StudentRegisterQuery, StudentRegisterResult,
  StudentRegisterRow, StudentRegisterSort, StudentRegisterStatus,
} from '../student-operations/student-operations.types';

type PeriodPreset = 'all' | 'last30' | 'last90' | 'thisYear' | 'custom';
type QueryState = StudentRegisterQuery & { revision: number };

@Component({
  selector: 'app-manager-students-page',
  imports: [CommonModule, ReactiveFormsModule, RouterModule, ManagerSelectComponent, ManagerListLoaderComponent, DatePickerModule],
  templateUrl: './manager-students.page.html',
  styleUrls: ['./manager-students.page.css'],
})
export class ManagerStudentsPageComponent implements OnInit, OnDestroy {
  private readonly api = inject(StudentOperationsService);
  private readonly destroy$ = new Subject<void>();
  private readonly query$ = new BehaviorSubject<QueryState>({
    page: 1, limit: 25, sortBy: 'name', sortDir: 'asc', revision: 0,
  });

  readonly search = new FormControl('', { nonNullable: true });
  readonly status = new FormControl('', { nonNullable: true });
  readonly advisor = new FormControl('', { nonNullable: true });
  readonly period = new FormControl<PeriodPreset>('all', { nonNullable: true });
  readonly dateRange = new FormControl<Date[] | null>(null);
  readonly pageSize = new FormControl('25', { nonNullable: true });
  readonly today = new Date();
  readonly statusOptions: ManagerSelectOption[] = [
    { value: '', label: 'All status' },
    { value: 'healthy', label: 'Healthy' },
    { value: 'action_required', label: 'Action Required' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'no_vigente', label: 'No Vigente' },
    { value: 'not_started', label: 'Not started' },
  ];
  readonly periodOptions: ManagerSelectOption[] = [
    { value: 'all', label: 'All time' },
    { value: 'last30', label: 'Last 30 days' },
    { value: 'last90', label: 'Last 90 days' },
    { value: 'thisYear', label: 'This year' },
    { value: 'custom', label: 'Custom range' },
  ];
  readonly pageSizeOptions: ManagerSelectOption[] = [
    { value: '25', label: '25 per page' },
    { value: '50', label: '50 per page' },
    { value: '100', label: '100 per page' },
  ];
  advisorOptions: ManagerSelectOption[] = [{ value: '', label: 'All advisors' }];
  workspace: StudentOperationsWorkspace | null = null;
  result: StudentRegisterResult | null = null;
  loading = true;
  sectionsCollapsed = false;
  error = '';
  dateError = '';
  private appliedFrom = '';
  private appliedTo = '';

  get rows(): StudentRegisterRow[] { return this.result?.students ?? []; }
  get currentPage(): number { return this.query$.value.page; }
  get limit(): number { return this.query$.value.limit; }
  get total(): number { return this.result?.total ?? 0; }
  get totalPages(): number { return Math.max(1, Math.ceil(this.total / this.limit)); }
  get pageStart(): number { return this.total ? (this.currentPage - 1) * this.limit + 1 : 0; }
  get pageEnd(): number { return Math.min(this.currentPage * this.limit, this.total); }
  get canManage(): boolean {
    return this.workspace?.role === 'chief_executive' || this.workspace?.role === 'operations';
  }
  get attentionActive(): boolean { return Boolean(this.query$.value.attentionThisWeek); }
  get sortBy(): StudentRegisterSort { return this.query$.value.sortBy ?? 'name'; }
  get sortDir(): 'asc' | 'desc' { return this.query$.value.sortDir ?? 'asc'; }

  ngOnInit(): void {
    this.api.workspace().pipe(takeUntil(this.destroy$)).subscribe({
      next: (workspace) => { this.workspace = workspace; },
      error: () => { this.workspace = null; },
    });
    this.query$.pipe(
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
      switchMap((query) => {
        this.loading = true;
        this.error = '';
        return this.api.studentRegister(query).pipe(
          catchError(() => {
            this.error = 'Student records could not be loaded. Try again.';
            return of(null);
          }),
        );
      }),
      takeUntil(this.destroy$),
    ).subscribe((result) => {
      this.loading = false;
      if (!result) return;
      this.result = result;
      this.advisorOptions = [
        { value: '', label: 'All advisors' },
        ...result.options.advisors.map((item) => ({ value: item.name, label: item.name })),
      ];
    });
    this.search.valueChanges.pipe(
      debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$),
    ).subscribe((value) => this.patchQuery({ q: value.trim() || undefined, page: 1 }));
    this.status.valueChanges.pipe(distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((value) => this.patchQuery({
        status: (value || undefined) as StudentRegisterStatus | undefined,
        attentionThisWeek: undefined, page: 1,
      }));
    this.advisor.valueChanges.pipe(distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((value) => this.patchQuery({ advisorName: value || undefined, page: 1 }));
    this.pageSize.valueChanges.pipe(distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((value) => this.patchQuery({ limit: Number(value), page: 1 }));
    this.period.valueChanges.pipe(distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((value) => this.applyPreset(value));
    this.dateRange.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((value) => this.applyDateRange(value));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  retry(): void { this.patchQuery({ revision: this.query$.value.revision + 1 }); }
  clearSearch(): void { this.search.setValue(''); }
  clearAttention(): void { this.patchQuery({ attentionThisWeek: undefined, page: 1 }); }
  viewAttention(): void {
    this.status.setValue('', { emitEvent: false });
    this.patchQuery({ status: undefined, attentionThisWeek: true, page: 1 });
  }
  goToPage(page: number): void {
    if (this.loading || page < 1 || page > this.totalPages || page === this.currentPage) return;
    this.patchQuery({ page });
  }
  sort(column: StudentRegisterSort): void {
    this.patchQuery({
      sortBy: column,
      sortDir: this.sortBy === column && this.sortDir === 'asc' ? 'desc' : 'asc',
      page: 1,
    });
  }
  sortAria(column: StudentRegisterSort): 'ascending' | 'descending' | 'none' {
    return this.sortBy !== column ? 'none' : this.sortDir === 'asc' ? 'ascending' : 'descending';
  }
  initials(name: string): string {
    return name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]?.toUpperCase() ?? '').join('') || '?';
  }
  avatarTone(name: string): number {
    return [...name].reduce((sum, character) => sum + character.charCodeAt(0), 0) % 4;
  }
  statusLabel(status: StudentRegisterStatus): string {
    return this.statusOptions.find((item) => item.value === status)?.label ?? status;
  }
  stageLabel(stage: string | null): string {
    if (!stage) return '—';
    return stage.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
  dateLabel(isoDate: string | null): string {
    if (!isoDate) return '—';
    const date = new Date(`${isoDate.slice(0, 10)}T00:00:00`);
    return Number.isFinite(date.getTime())
      ? new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
      : '—';
  }
  moneyLabel(payment: StudentRegisterRow['nextPayment']): string {
    if (!payment || payment.amount === undefined || !payment.currency) return 'Amount restricted';
    const amount = Number(payment.amount);
    if (!Number.isFinite(amount)) return '—';
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: payment.currency }).format(amount);
  }

  private patchQuery(patch: Partial<QueryState>): void {
    this.query$.next({ ...this.query$.value, ...patch });
  }

  private applyPreset(preset: PeriodPreset): void {
    if (preset === 'custom') return;
    this.dateError = '';
    if (preset === 'all') {
      this.dateRange.setValue(null, { emitEvent: false });
      this.setDates('', '');
      return;
    }
    const end = new Date();
    const start = new Date(end);
    if (preset === 'last30') start.setDate(end.getDate() - 29);
    if (preset === 'last90') start.setDate(end.getDate() - 89);
    if (preset === 'thisYear') start.setMonth(0, 1);
    this.dateRange.setValue([start, end], { emitEvent: false });
    this.setDates(this.localDate(start), this.localDate(end));
  }

  private applyDateRange(range: Date[] | null): void {
    if (!range?.length) {
      this.dateError = '';
      this.period.setValue('all', { emitEvent: false });
      this.setDates('', '');
      return;
    }
    const [start, end] = range;
    if (!start || !end) return; // A half-selected range never reaches the API.
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start > end) {
      this.dateError = 'Choose a valid start and end date.';
      return;
    }
    this.dateError = '';
    this.period.setValue('custom', { emitEvent: false });
    this.setDates(this.localDate(start), this.localDate(end));
  }

  private setDates(from: string, to: string): void {
    if (from === this.appliedFrom && to === this.appliedTo) return;
    this.appliedFrom = from;
    this.appliedTo = to;
    this.patchQuery({ from: from || undefined, to: to || undefined, page: 1 });
  }

  private localDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}
