import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Store } from '@ngrx/store';
import { combineLatest, Observable, Subject } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  map,
  startWith,
  takeUntil,
} from 'rxjs/operators';

import { ManagerLaborActions } from '../../store/labor/manager.actions';
import {
  selectManagerEditingLabor,
  selectManagerLabor,
  selectManagerLaborError,
  selectManagerLaborLoading,
  selectManagerLaborPage,
  selectManagerLaborSearchQuery,
  selectManagerLaborTotal,
  selectManagerLaborViewMode,
} from '../../store/labor/manager.selectors';

import type { BmLabor } from '../../types/labor.interface';
import { ManagerSelectComponent } from '../shared/manager-select/manager-select.component';

@Component({
  selector: 'app-manager-labor-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, ManagerSelectComponent],
  templateUrl: './manager-labor.page.html',
  styleUrls: ['./manager-labor.page.css'],
})
export class ManagerLaborPageComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  loading$ = this.store.select(selectManagerLaborLoading);
  error$ = this.store.select(selectManagerLaborError);
  laborRaw$ = this.store.select(selectManagerLabor);
  total$ = this.store.select(selectManagerLaborTotal);
  viewMode$ = this.store.select(selectManagerLaborViewMode);
  editingLabor$ = this.store.select(selectManagerEditingLabor);
  page$ = this.store.select(selectManagerLaborPage);

  searchQuery$ = this.store.select(selectManagerLaborSearchQuery);
  searchCtrl: FormControl<string>;
  filteredLabor$!: Observable<BmLabor[]>;
  canLoadMore$!: Observable<boolean>;

  private infiniteObserver?: IntersectionObserver;
  private isLoadingMore = false;
  private currentPage = 1;
  private canLoadMore = false;
  private isLoading = false;
  dismissedErrors = new Set<string>();

  statusOptions = [
    { value: 'active', label: 'active' },
    { value: 'archived', label: 'archived' },
  ];

  unitTypeOptions = [
    { value: 'hour', label: 'hour' },
    { value: 'day', label: 'day' },
    { value: 'week', label: 'week' },
    { value: 'month', label: 'month' },
    { value: 'project', label: 'project' },
  ];

  @ViewChild('laborList') laborListRef?: ElementRef<HTMLElement>;
  @ViewChild('infiniteSentinel') infiniteSentinelRef?: ElementRef<HTMLElement>;

  laborForm = this.fb.group({
    labor_name: ['', [Validators.required, Validators.maxLength(140)]],
    unit_type: ['hour'],
    unit_cost: [null as number | null, [Validators.required, Validators.min(0)]],
    sell_cost: [null as number | null, [Validators.min(0)]],
    unit_productivity: [null as number | null, [Validators.min(0)]],
    productivity_unit: ['m²/hr'],
    status: ['active', [Validators.required]],
  });

  constructor(
    private store: Store,
    private fb: FormBuilder,
  ) {
    this.searchCtrl = this.fb.control('', { nonNullable: true });

    this.filteredLabor$ = combineLatest([
      this.laborRaw$,
      this.searchCtrl.valueChanges.pipe(startWith('')),
    ]).pipe(
      map(([labor, query]) => {
        const q = (query || '').trim().toLowerCase();
        if (!q) return labor;
        return labor.filter((l) =>
          l.laborName?.toLowerCase().includes(q),
        );
      }),
    );

    this.canLoadMore$ = combineLatest([
      this.total$,
      this.laborRaw$,
      this.loading$,
    ]).pipe(
      map(([total, labor, loading]) => !loading && labor.length < total),
    );
    this.page$.pipe(takeUntil(this.destroy$)).subscribe((page) => {
      this.currentPage = page || 1;
    });
    this.canLoadMore$.pipe(takeUntil(this.destroy$)).subscribe((canLoad) => {
      this.canLoadMore = canLoad;
    });
    this.loading$.pipe(takeUntil(this.destroy$)).subscribe((loading) => {
      this.isLoading = loading;
      if (!loading) this.isLoadingMore = false;
    });
  }

  ngOnInit(): void {
    this.store.dispatch(ManagerLaborActions.loadLabor({ page: 1 }));

    this.searchQuery$.pipe(takeUntil(this.destroy$)).subscribe((query) => {
      if (this.searchCtrl.value !== (query || '')) {
        this.searchCtrl.setValue(query || '', { emitEvent: false });
      }
      this.store.dispatch(ManagerLaborActions.loadLabor({ page: 1 }));
    });

    this.searchCtrl.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        takeUntil(this.destroy$),
      )
      .subscribe((query) =>
        this.store.dispatch(
          ManagerLaborActions.setLaborSearchQuery({ query: query || '' }),
        ),
      );

    this.viewMode$
      .pipe(takeUntil(this.destroy$))
      .subscribe((mode) => {
        if (mode !== 'list') return;
        setTimeout(() => this.setupInfiniteScroll(), 0);
      });

    this.editingLabor$.pipe(takeUntil(this.destroy$)).subscribe((l) => {
      if (!l) return;

      this.laborForm.patchValue({
        labor_name: l.laborName ?? '',
        unit_type: l.unitType ?? 'hour',
        unit_cost: this.toInt(l.unitCost),
        sell_cost: l.sellCost === null || l.sellCost === undefined ? null : this.toInt(l.sellCost),
        unit_productivity:
          l.unitProductivity === null || l.unitProductivity === undefined
            ? null
            : this.toInt(l.unitProductivity),
        productivity_unit: l.productivityUnit ?? '',
        status: l.status ?? 'active',
      });
    });
  }

  ngOnDestroy(): void {
    this.infiniteObserver?.disconnect();
    this.destroy$.next();
    this.destroy$.complete();
  }

  dismissError(message: string): void {
    if (message) this.dismissedErrors.add(message);
  }

  isErrorDismissed(message: string | null | undefined): boolean {
    return message ? this.dismissedErrors.has(message) : false;
  }

  trackByLabor = (_: number, l: BmLabor) => l.laborId;

  openCreate(): void {
    this.laborForm.reset({
      labor_name: '',
      unit_type: 'hour',
      unit_cost: null,
      sell_cost: null,
      unit_productivity: null,
      productivity_unit: 'm²/hr',
      status: 'active',
    });

    this.store.dispatch(ManagerLaborActions.openLaborCreate());
  }

  openEdit(l: BmLabor): void {
    this.store.dispatch(ManagerLaborActions.openLaborEdit({ laborId: l.laborId }));
  }

  closeForm(): void {
    this.store.dispatch(ManagerLaborActions.closeLaborForm());
  }

  saveLabor(): void {
    if (this.laborForm.invalid) {
      this.laborForm.markAllAsTouched();
      return;
    }

    const payload: any = this.laborForm.getRawValue();

    if (payload.unit_cost !== null && payload.unit_cost !== '') {
      payload.unit_cost = Number(payload.unit_cost);
    }
    if (payload.sell_cost !== null && payload.sell_cost !== '') {
      payload.sell_cost = Number(payload.sell_cost);
    }
    if (payload.unit_productivity !== null && payload.unit_productivity !== '') {
      payload.unit_productivity = Number(payload.unit_productivity);
    }

    delete payload.company_id;
    delete payload.companyId;
    delete payload.labor_id;
    delete payload.laborId;

    this.store.dispatch(ManagerLaborActions.saveLabor({ payload }));
  }

  archiveLabor(l: BmLabor): void {
    const ok = window.confirm(
      `Archive labor "${l.laborName}"?\n\nThis is a soft-delete (status = archived).`,
    );
    if (!ok) return;

    this.store.dispatch(ManagerLaborActions.archiveLabor({ laborId: l.laborId }));
  }

  private setupInfiniteScroll(): void {
    const sentinel = this.infiniteSentinelRef?.nativeElement;
    const list = this.laborListRef?.nativeElement;
    if (!sentinel || !list) return;

    this.infiniteObserver?.disconnect();

    const scrollRoot = list.closest('.content') as HTMLElement | null;

    this.infiniteObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        this.tryLoadMore();
      },
      {
        root: scrollRoot,
        rootMargin: '200px 0px',
        threshold: 0.1,
      },
    );

    this.infiniteObserver.observe(sentinel);
  }

  private tryLoadMore(): void {
    if (!this.canLoadMore || this.isLoading || this.isLoadingMore) return;
    this.isLoadingMore = true;
    this.store.dispatch(ManagerLaborActions.loadLabor({ page: this.currentPage + 1 }));
  }

  formatInt(value?: number | null): string {
    if (value === null || value === undefined) return '—';
    return String(this.toInt(value));
  }

  private toInt(value: number): number {
    if (Number.isNaN(value)) return 0;
    return Math.round(value);
  }
}
