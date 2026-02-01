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

import { ManagerMaterialsActions } from '../../store/materials/manager.actions';
import {
  selectManagerEditingMaterial,
  selectManagerMaterials,
  selectManagerMaterialsError,
  selectManagerMaterialsLoading,
  selectManagerMaterialsSearchQuery,
  selectManagerMaterialsTotal,
  selectManagerMaterialsPage,
  selectManagerMaterialsViewMode,
} from '../../store/materials/manager.selectors';

import type { BmMaterial } from '../../types/materials.interface';
import { ManagerSelectComponent } from '../shared/manager-select/manager-select.component';

@Component({
  selector: 'app-manager-materials-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, ManagerSelectComponent],
  templateUrl: './manager-materials.page.html',
  styleUrls: ['./manager-materials.page.css'],
})
export class ManagerMaterialsPageComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  loading$ = this.store.select(selectManagerMaterialsLoading);
  error$ = this.store.select(selectManagerMaterialsError);
  materialsRaw$ = this.store.select(selectManagerMaterials);
  total$ = this.store.select(selectManagerMaterialsTotal);
  viewMode$ = this.store.select(selectManagerMaterialsViewMode);
  editingMaterial$ = this.store.select(selectManagerEditingMaterial);
  page$ = this.store.select(selectManagerMaterialsPage);

  searchQuery$ = this.store.select(selectManagerMaterialsSearchQuery);
  searchCtrl: FormControl<string>;
  filteredMaterials$!: Observable<BmMaterial[]>;
  canLoadMore$!: Observable<boolean>;

  private infiniteObserver?: IntersectionObserver;
  private isLoadingMore = false;
  private currentPage = 1;
  private canLoadMore = false;
  private isLoading = false;

  statusOptions = [
    { value: 'active', label: 'active' },
    { value: 'archived', label: 'archived' },
  ];

  @ViewChild('materialsList') materialsListRef?: ElementRef<HTMLElement>;
  @ViewChild('infiniteSentinel') infiniteSentinelRef?: ElementRef<HTMLElement>;

  materialForm = this.fb.group({
    material_name: ['', [Validators.required, Validators.maxLength(140)]],
    code: [''],
    category: [''],
    type: [''],
    notes: [''],
    status: ['active', [Validators.required]],
  });

  constructor(
    private store: Store,
    private fb: FormBuilder,
  ) {
    this.searchCtrl = this.fb.control('', { nonNullable: true });

    this.filteredMaterials$ = combineLatest([
      this.materialsRaw$,
      this.searchCtrl.valueChanges.pipe(startWith('')),
    ]).pipe(
      map(([materials, query]) => {
        const q = (query || '').trim().toLowerCase();
        if (!q) return materials;
        return materials.filter((m) => {
          return (
            m.materialName?.toLowerCase().includes(q) ||
            m.code?.toLowerCase().includes(q) ||
            m.category?.toLowerCase().includes(q) ||
            m.type?.toLowerCase().includes(q)
          );
        });
      }),
    );

    this.canLoadMore$ = combineLatest([
      this.total$,
      this.materialsRaw$,
      this.loading$,
    ]).pipe(
      map(
        ([total, materials, loading]) =>
          !loading && materials.length < total,
      ),
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
    this.store.dispatch(ManagerMaterialsActions.loadMaterials({ page: 1 }));

    this.searchQuery$.pipe(takeUntil(this.destroy$)).subscribe((query) => {
      if (this.searchCtrl.value !== (query || '')) {
        this.searchCtrl.setValue(query || '', { emitEvent: false });
      }
      this.store.dispatch(ManagerMaterialsActions.loadMaterials({ page: 1 }));
    });

    this.searchCtrl.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        takeUntil(this.destroy$),
      )
      .subscribe((query) =>
        this.store.dispatch(
          ManagerMaterialsActions.setMaterialsSearchQuery({
            query: query || '',
          }),
        ),
      );

    this.viewMode$
      .pipe(takeUntil(this.destroy$))
      .subscribe((mode) => {
        if (mode !== 'list') return;
        setTimeout(() => this.setupInfiniteScroll(), 0);
      });

    this.editingMaterial$.pipe(takeUntil(this.destroy$)).subscribe((m) => {
      if (!m) return;

      this.materialForm.patchValue({
        material_name: m.materialName ?? '',
        code: m.code ?? '',
        category: m.category ?? '',
        type: m.type ?? '',
        notes: m.notes ?? '',
        status: m.status ?? 'active',
      });
    });
  }

  ngOnDestroy(): void {
    this.infiniteObserver?.disconnect();
    this.destroy$.next();
    this.destroy$.complete();
  }

  trackByMaterial = (_: number, m: BmMaterial) => m.materialId;

  openCreate(): void {
    this.materialForm.reset({
      material_name: '',
      code: '',
      category: '',
      type: '',
      notes: '',
      status: 'active',
    });

    this.store.dispatch(ManagerMaterialsActions.openMaterialCreate());
  }

  openEdit(m: BmMaterial): void {
    this.store.dispatch(
      ManagerMaterialsActions.openMaterialEdit({ materialId: m.materialId }),
    );
  }

  closeForm(): void {
    this.store.dispatch(ManagerMaterialsActions.closeMaterialForm());
  }

  saveMaterial(): void {
    if (this.materialForm.invalid) {
      this.materialForm.markAllAsTouched();
      return;
    }

    const payload: any = this.materialForm.getRawValue();

    delete payload.company_id;
    delete payload.companyId;
    delete payload.material_id;
    delete payload.materialId;

    this.store.dispatch(ManagerMaterialsActions.saveMaterial({ payload }));
  }

  archiveMaterial(m: BmMaterial): void {
    const ok = window.confirm(
      `Archive material "${m.materialName}"?\n\nThis is a soft-delete (status = archived).`,
    );
    if (!ok) return;

    this.store.dispatch(
      ManagerMaterialsActions.archiveMaterial({ materialId: m.materialId }),
    );
  }

  private setupInfiniteScroll(): void {
    const sentinel = this.infiniteSentinelRef?.nativeElement;
    const list = this.materialsListRef?.nativeElement;
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
    this.store.dispatch(
      ManagerMaterialsActions.loadMaterials({ page: this.currentPage + 1 }),
    );
  }
}
