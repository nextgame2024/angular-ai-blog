import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Actions, ofType } from '@ngrx/effects';
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
  private closeAfterSave = false;
  private currentPage = 1;
  private canLoadMore = false;
  private isLoading = false;
  dismissedErrors = new Set<string>();
  codeConflict = false;
  codeConflictMessage = 'A code with this name already exists.';
  isConfirmModalOpen = false;
  confirmModalTitle = '';
  confirmModalMessage = '';
  confirmModalConfirmLabel = 'Continue';
  confirmModalCancelLabel = 'Cancel';
  confirmModalShowCancel = false;
  confirmModalTone: 'info' | 'warning' | 'danger' = 'info';
  private confirmModalConfirmAction: (() => void) | null = null;
  private confirmModalCancelAction: (() => void) | null = null;

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
    quantity: [0, [Validators.min(0)]],
    unit: [''],
    notes: [''],
    status: ['active', [Validators.required]],
  });

  constructor(
    private store: Store,
    private fb: FormBuilder,
    private actions$: Actions,
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

    this.actions$
      .pipe(
        ofType(
          ManagerMaterialsActions.saveMaterialSuccess,
          ManagerMaterialsActions.saveMaterialFailure,
        ),
        takeUntil(this.destroy$),
      )
      .subscribe((action) => {
        if (action.type === ManagerMaterialsActions.saveMaterialFailure.type) {
          const err = (action as ReturnType<typeof ManagerMaterialsActions.saveMaterialFailure>)
            ?.error;
          this.codeConflict =
            typeof err === 'string' &&
            err.toLowerCase().includes('code with this name already exists');
        }
        if (action.type === ManagerMaterialsActions.saveMaterialSuccess.type) {
          this.codeConflict = false;
        }
        if (!this.closeAfterSave) return;
        this.closeAfterSave = false;
        if (action.type === ManagerMaterialsActions.saveMaterialSuccess.type) {
          this.closeForm();
        }
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
        quantity: m.quantity ?? 0,
        unit: m.unit ?? '',
        notes: m.notes ?? '',
        status: m.status ?? 'active',
      });
      this.codeConflict = false;
    });

    this.materialForm
      .get('code')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.codeConflict) this.codeConflict = false;
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

  trackByMaterial = (_: number, m: BmMaterial) => m.materialId;

  openCreate(): void {
    this.materialForm.reset({
      material_name: '',
      code: '',
      category: '',
      type: '',
      quantity: 0,
      unit: '',
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

    payload.quantity = Number(payload.quantity ?? 0);
    if (Number.isNaN(payload.quantity)) payload.quantity = 0;

    this.store.dispatch(ManagerMaterialsActions.saveMaterial({ payload }));
  }

  saveMaterialAndClose(): void {
    if (this.materialForm.invalid) {
      this.materialForm.markAllAsTouched();
      return;
    }
    this.closeAfterSave = true;
    this.saveMaterial();
  }

  removeMaterial(m: BmMaterial): void {
    const hasProjects = !!m.hasProjects;
    const title = hasProjects ? 'Archive Material?' : 'Delete Material?';
    const message = hasProjects
      ? `Are you sure you want to archive "${m.materialName}"?`
      : `Are you sure you want to delete "${m.materialName}"?`;
    this.openConfirmModal({
      title,
      message,
      tone: hasProjects ? 'warning' : 'danger',
      confirmLabel: hasProjects ? 'Archive' : 'Delete',
      onConfirm: () =>
        this.store.dispatch(
          ManagerMaterialsActions.removeMaterial({ materialId: m.materialId }),
        ),
    });
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

  private openConfirmModal(options: {
    title: string;
    message: string;
    tone?: 'info' | 'warning' | 'danger';
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel?: () => void;
  }): void {
    this.confirmModalTitle = options.title;
    this.confirmModalMessage = options.message;
    this.confirmModalTone = options.tone ?? 'info';
    this.confirmModalConfirmLabel = options.confirmLabel ?? 'Continue';
    this.confirmModalCancelLabel = options.cancelLabel ?? 'Cancel';
    this.confirmModalShowCancel = true;
    this.confirmModalConfirmAction = options.onConfirm;
    this.confirmModalCancelAction = options.onCancel ?? null;
    this.isConfirmModalOpen = true;
  }

  onConfirmModalConfirm(): void {
    const action = this.confirmModalConfirmAction;
    this.closeConfirmModal();
    action?.();
  }

  onConfirmModalCancel(): void {
    const action = this.confirmModalCancelAction;
    this.closeConfirmModal();
    action?.();
  }

  onConfirmModalBackdrop(): void {
    if (this.confirmModalShowCancel) {
      this.onConfirmModalCancel();
    } else {
      this.onConfirmModalConfirm();
    }
  }

  private closeConfirmModal(): void {
    this.isConfirmModalOpen = false;
    this.confirmModalConfirmAction = null;
    this.confirmModalCancelAction = null;
  }
}
