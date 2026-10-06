import { CommonModule } from '@angular/common';
import {
  AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, forkJoin, takeUntil } from 'rxjs';
import {
  ManagerSelectComponent, type ManagerSelectOption,
} from '../../components/shared/manager-select/manager-select.component';
import { OpenForAustraliaService } from '../open-for-australia.service';
import type {
  OpenForAustraliaStudentList,
  OpenForAustraliaStudentSummary,
  OpenForAustraliaWorkspace,
} from '../open-for-australia.types';

@Component({
  selector: 'app-open-for-australia-students-page',
  imports: [CommonModule, ReactiveFormsModule, RouterModule, ManagerSelectComponent],
  templateUrl: './open-for-australia-students.page.html',
  styleUrls: ['./open-for-australia-students.page.css'],
})
export class OpenForAustraliaStudentsPageComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly api = inject(OpenForAustraliaService);
  private readonly destroy$ = new Subject<void>();
  private observer?: IntersectionObserver;
  private requestVersion = 0;

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
  readonly advisorOptions: ManagerSelectOption[] = [
    { value: '', label: 'All assignments' },
    { value: 'assigned', label: 'Assigned' },
    { value: 'unassigned', label: 'Unassigned' },
    { value: 'me', label: 'Assigned to me' },
  ];

  workspace: OpenForAustraliaWorkspace | null = null;
  students: OpenForAustraliaStudentSummary[] = [];
  page = 1;
  total = 0;
  loadingInitial = true;
  loadingMore = false;
  error = '';

  get hasMore(): boolean { return this.students.length < this.total; }

  ngOnInit(): void {
    this.loadInitial();
    this.search.valueChanges.pipe(
      debounceTime(250), distinctUntilChanged(), takeUntil(this.destroy$),
    ).subscribe(() => this.resetAndLoad());
    this.status.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe(() => this.resetAndLoad());
    this.advisor.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe(() => this.resetAndLoad());
    this.college.valueChanges.pipe(
      debounceTime(250), distinctUntilChanged(), takeUntil(this.destroy$),
    ).subscribe(() => this.resetAndLoad());
  }

  ngAfterViewInit(): void { queueMicrotask(() => this.setupInfiniteScroll()); }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.destroy$.next();
    this.destroy$.complete();
  }

  retry(): void { this.workspace ? this.resetAndLoad() : this.loadInitial(); }
  clearSearch(): void { this.search.setValue(''); }

  formatLabel(value: string): string {
    return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  private loadInitial(): void {
    const version = ++this.requestVersion;
    this.loadingInitial = true;
    this.error = '';
    forkJoin({
      workspace: this.api.workspace(), result: this.api.students(this.query(1)),
    }).pipe(takeUntil(this.destroy$)).subscribe({
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

  private applyResult(result: OpenForAustraliaStudentList, reset: boolean): void {
    const next = reset ? result.students : [...this.students, ...result.students];
    this.students = Array.from(
      new Map(next.map((student) => [student.studentId, student])).values(),
    );
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
      ? 'This account does not have Open For Australia workspace access.'
      : 'The student register could not be loaded.';
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
      {
        root: list.closest('.content') as HTMLElement | null,
        rootMargin: '200px 0px', threshold: 0.1,
      },
    );
    this.observer.observe(sentinel);
  }
}
