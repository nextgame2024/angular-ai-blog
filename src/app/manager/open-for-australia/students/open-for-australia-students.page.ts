import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, forkJoin, takeUntil } from 'rxjs';
import { OpenForAustraliaService } from '../open-for-australia.service';
import type {
  OpenForAustraliaStudentSummary,
  OpenForAustraliaWorkspace,
} from '../open-for-australia.types';

@Component({
  selector: 'app-open-for-australia-students-page',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './open-for-australia-students.page.html',
  styleUrls: ['./open-for-australia-students.page.css'],
})
export class OpenForAustraliaStudentsPageComponent implements OnInit, OnDestroy {
  private readonly api = inject(OpenForAustraliaService);
  private readonly destroy$ = new Subject<void>();

  readonly search = new FormControl('', { nonNullable: true });
  readonly status = new FormControl('', { nonNullable: true });
  readonly advisor = new FormControl('', { nonNullable: true });
  readonly college = new FormControl('', { nonNullable: true });
  readonly pageSize = 20;

  workspace: OpenForAustraliaWorkspace | null = null;
  students: OpenForAustraliaStudentSummary[] = [];
  page = 1;
  total = 0;
  loading = true;
  error = '';

  ngOnInit(): void {
    this.load();
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

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    forkJoin({
      workspace: this.api.workspace(),
      result: this.api.students({
        page: this.page,
        limit: this.pageSize,
        q: this.search.value.trim() || undefined,
        status: this.status.value || undefined,
        advisor: this.advisor.value || undefined,
        college: this.college.value.trim() || undefined,
      }),
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: ({ workspace, result }) => {
        this.workspace = workspace;
        this.students = result.students;
        this.page = result.page;
        this.total = result.total;
        this.loading = false;
      },
      error: (error) => {
        this.students = [];
        this.total = 0;
        this.loading = false;
        this.error = Number(error?.status) === 403
          ? 'This account does not have Open For Australia workspace access.'
          : 'The student workspace could not be loaded.';
      },
    });
  }

  previousPage(): void {
    if (this.page <= 1) return;
    this.page -= 1;
    this.load();
  }

  nextPage(): void {
    if (this.page * this.pageSize >= this.total) return;
    this.page += 1;
    this.load();
  }

  formatLabel(value: string): string {
    return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  private resetAndLoad(): void {
    this.page = 1;
    this.load();
  }
}
