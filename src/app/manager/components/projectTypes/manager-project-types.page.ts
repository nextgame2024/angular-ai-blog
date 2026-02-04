import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
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

import { ManagerProjectTypesActions } from '../../store/projectTypes/manager.actions';
import {
  selectManagerEditingProjectType,
  selectManagerEditingProjectTypeLabor,
  selectManagerEditingProjectTypeMaterial,
  selectManagerProjectTypeFormTab,
  selectManagerProjectTypeLabor,
  selectManagerProjectTypeLaborError,
  selectManagerProjectTypeLaborLoading,
  selectManagerProjectTypeLaborViewMode,
  selectManagerProjectTypeMaterials,
  selectManagerProjectTypeMaterialsError,
  selectManagerProjectTypeMaterialsLoading,
  selectManagerProjectTypeMaterialsViewMode,
  selectManagerProjectTypes,
  selectManagerProjectTypesError,
  selectManagerProjectTypesLimit,
  selectManagerProjectTypesLoading,
  selectManagerProjectTypesPage,
  selectManagerProjectTypesSearchQuery,
  selectManagerProjectTypesTotal,
  selectManagerProjectTypesViewMode,
} from '../../store/projectTypes/manager.selectors';
import type {
  BmProjectType,
  BmProjectTypeLabor,
  BmProjectTypeMaterial,
} from '../../types/project.types.interface';
import { ProjectTypeFormTab } from '../../store/projectTypes/manager.state';
import { ManagerSelectComponent } from '../shared/manager-select/manager-select.component';
import type { ManagerSelectOption } from '../shared/manager-select/manager-select.component';
import { ManagerLaborService } from '../../services/manager.labor.service';
import { ManagerSuppliersService } from '../../services/manager.suppliers.service';
import type { BmLabor } from '../../types/labor.interface';
import type { BmSupplier, BmSupplierMaterial } from '../../types/suppliers.interface';

@Component({
  selector: 'app-manager-project-types-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, ManagerSelectComponent],
  templateUrl: './manager-project-types.page.html',
  styleUrls: ['./manager-project-types.page.css'],
})
export class ManagerProjectTypesPageComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private infiniteObserver?: IntersectionObserver;
  private isLoadingMore = false;
  private isLoading = false;

  loading$ = this.store.select(selectManagerProjectTypesLoading);
  error$ = this.store.select(selectManagerProjectTypesError);
  projectTypesRaw$ = this.store.select(selectManagerProjectTypes);
  total$ = this.store.select(selectManagerProjectTypesTotal);
  viewMode$ = this.store.select(selectManagerProjectTypesViewMode);
  editingProjectType$ = this.store.select(selectManagerEditingProjectType);

  page$ = this.store.select(selectManagerProjectTypesPage);
  limit$ = this.store.select(selectManagerProjectTypesLimit);
  searchQuery$ = this.store.select(selectManagerProjectTypesSearchQuery);

  tab$ = this.store.select(selectManagerProjectTypeFormTab);

  materials$ = this.store.select(selectManagerProjectTypeMaterials);
  materialsLoading$ = this.store.select(selectManagerProjectTypeMaterialsLoading);
  materialsError$ = this.store.select(selectManagerProjectTypeMaterialsError);
  materialsViewMode$ = this.store.select(selectManagerProjectTypeMaterialsViewMode);
  editingMaterial$ = this.store.select(selectManagerEditingProjectTypeMaterial);

  labor$ = this.store.select(selectManagerProjectTypeLabor);
  laborLoading$ = this.store.select(selectManagerProjectTypeLaborLoading);
  laborError$ = this.store.select(selectManagerProjectTypeLaborError);
  laborViewMode$ = this.store.select(selectManagerProjectTypeLaborViewMode);
  editingLabor$ = this.store.select(selectManagerEditingProjectTypeLabor);
  editingMaterialValue: BmProjectTypeMaterial | null = null;
  editingLaborValue: BmProjectTypeLabor | null = null;

  searchCtrl: FormControl<string>;
  canLoadMore$!: Observable<boolean>;
  private currentPage = 1;
  private canLoadMore = false;
  dismissedErrors = new Set<string>();
  dismissedWarnings = new Set<string>();
  private closeAfterSave = false;

  statusOptions: ManagerSelectOption[] = [
    { value: 'active', label: 'active' },
    { value: 'archived', label: 'archived' },
  ];

  materialOptions: ManagerSelectOption[] = [];
  laborOptions: ManagerSelectOption[] = [];
  supplierOptions: ManagerSelectOption[] = [];
  laborCatalog: { laborId: string; laborName: string; unitCost?: number | null; sellCost?: number | null }[] = [];
  laborSearchCtrl: FormControl<string>;
  laborSuggestions: { laborId: string; laborName: string; unitCost?: number | null; sellCost?: number | null }[] = [];
  showLaborSuggestions = false;
  laborActiveIndex = -1;
  suppliersCatalog: { supplierId: string; supplierName: string }[] = [];
  supplierMaterialsCatalog: {
    materialId: string;
    materialName: string;
    materialCode?: string | null;
    unitCost?: number | null;
    sellCost?: number | null;
  }[] = [];
  supplierSearchCtrl: FormControl<string>;
  materialSearchCtrl: FormControl<string>;
  supplierSuggestions: { supplierId: string; supplierName: string }[] = [];
  materialSuggestions: {
    materialId: string;
    materialName: string;
    materialCode?: string | null;
    unitCost?: number | null;
    sellCost?: number | null;
  }[] = [];
  showSupplierSuggestions = false;
  showMaterialSuggestions = false;
  supplierActiveIndex = -1;
  materialActiveIndex = -1;
  selectedSupplierId: string | null = null;

  @ViewChild('listHeader') listHeaderRef?: ElementRef<HTMLElement>;
  @ViewChild('projectTypesList') projectTypesListRef?: ElementRef<HTMLElement>;
  @ViewChild('infiniteSentinel') infiniteSentinelRef?: ElementRef<HTMLElement>;

  projectTypeForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    notes: [''],
    status: ['active', [Validators.required]],
  });

  projectTypeMaterialForm = this.fb.group({
    supplier_id: [null as string | null],
    material_id: [null as string | null, [Validators.required]],
    quantity: [1],
    unit_cost_override: [null as number | null],
    sell_cost_override: [null as number | null],
    notes: [''],
  });

  projectTypeLaborForm = this.fb.group({
    labor_id: [null as string | null, [Validators.required]],
    quantity: [1],
    unit_cost_override: [null as number | null],
    sell_cost_override: [null as number | null],
    notes: [''],
  });

  constructor(
    private store: Store,
    private fb: FormBuilder,
    private actions$: Actions,
    private laborApi: ManagerLaborService,
    private suppliersApi: ManagerSuppliersService,
  ) {
    this.searchCtrl = this.fb.control('', { nonNullable: true });
    this.supplierSearchCtrl = this.fb.control('', { nonNullable: true });
    this.materialSearchCtrl = this.fb.control('', { nonNullable: true });
    this.laborSearchCtrl = this.fb.control('', { nonNullable: true });

    this.canLoadMore$ = combineLatest([
      this.total$,
      this.projectTypesRaw$,
      this.loading$,
    ]).pipe(
      map(([total, items, loading]) => !loading && items.length < total),
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
          ManagerProjectTypesActions.saveProjectTypeSuccess,
          ManagerProjectTypesActions.saveProjectTypeFailure,
        ),
        takeUntil(this.destroy$),
      )
      .subscribe((action) => {
        if (!this.closeAfterSave) return;
        this.closeAfterSave = false;
        if (action.type === ManagerProjectTypesActions.saveProjectTypeSuccess.type) {
          this.closeForm();
        }
      });
  }

  ngOnInit(): void {
    this.store.dispatch(ManagerProjectTypesActions.loadProjectTypes({ page: 1 }));

    this.searchQuery$.pipe(takeUntil(this.destroy$)).subscribe((query) => {
      if (this.searchCtrl.value !== (query || '')) {
        this.searchCtrl.setValue(query || '', { emitEvent: false });
      }
      this.store.dispatch(ManagerProjectTypesActions.loadProjectTypes({ page: 1 }));
    });

    this.searchCtrl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((query) =>
        this.store.dispatch(
          ManagerProjectTypesActions.setProjectTypesSearchQuery({
            query: query || '',
          }),
        ),
      );

    this.viewMode$.pipe(takeUntil(this.destroy$)).subscribe((mode) => {
      if (mode !== 'list') return;
      setTimeout(() => this.setupInfiniteScroll(), 0);
    });

    this.editingProjectType$.pipe(takeUntil(this.destroy$)).subscribe((pt) => {
      if (!pt) return;
      this.projectTypeForm.patchValue({
        name: pt.name ?? '',
        notes: pt.notes ?? '',
        status: pt.status ?? 'active',
      });
    });

    this.editingMaterial$.pipe(takeUntil(this.destroy$)).subscribe((m) => {
      this.editingMaterialValue = m ?? null;
      if (m) {
        this.projectTypeMaterialForm.patchValue({
          supplier_id: m.supplierId ?? null,
          material_id: m.materialId ?? null,
          quantity: m.quantity ?? 1,
          unit_cost_override: this.formatMoney(m.unitCostOverride ?? null),
          sell_cost_override: this.formatMoney(m.sellCostOverride ?? null),
          notes: m.notes ?? '',
        });
        this.selectedSupplierId = m.supplierId ?? null;
        const supplierName =
          m.supplierName ||
          this.suppliersCatalog.find((s) => s.supplierId === m.supplierId)
            ?.supplierName ||
          '';
        this.supplierSearchCtrl.setValue(supplierName, { emitEvent: false });
        this.materialSearchCtrl.setValue(m.materialName || '', {
          emitEvent: false,
        });
        if (m.supplierId) {
          this.loadSupplierMaterials(m.supplierId);
        } else {
          this.supplierMaterialsCatalog = [];
        }
      } else {
        this.projectTypeMaterialForm.reset({
          supplier_id: null,
          material_id: null,
          quantity: 1,
          unit_cost_override: null,
          sell_cost_override: null,
          notes: '',
        });
        this.selectedSupplierId = null;
        this.supplierSearchCtrl.setValue('', { emitEvent: false });
        this.materialSearchCtrl.setValue('', { emitEvent: false });
      }
    });

    this.editingLabor$.pipe(takeUntil(this.destroy$)).subscribe((l) => {
      this.editingLaborValue = l ?? null;
      if (l) {
        this.projectTypeLaborForm.patchValue({
          labor_id: l.laborId ?? null,
          quantity: l.quantity ?? 1,
          unit_cost_override: this.formatMoney(l.unitCostOverride ?? null),
          sell_cost_override: this.formatMoney(l.sellCostOverride ?? null),
          notes: l.notes ?? '',
        });
        this.laborSearchCtrl.setValue(l.laborName || '', {
          emitEvent: false,
        });
      } else {
        this.projectTypeLaborForm.reset({
          labor_id: null,
          quantity: 1,
          unit_cost_override: null,
          sell_cost_override: null,
          notes: '',
        });
        this.laborSearchCtrl.setValue('', { emitEvent: false });
      }
    });

    this.loadReferenceData();
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

  dismissWarning(message: string): void {
    if (message) this.dismissedWarnings.add(message);
  }

  isWarningDismissed(message: string): boolean {
    return this.dismissedWarnings.has(message);
  }

  trackByProjectType = (_: number, pt: BmProjectType) => pt.projectTypeId;
  trackByMaterial = (_: number, m: BmProjectTypeMaterial) => m.materialId;
  trackByLabor = (_: number, l: BmProjectTypeLabor) => l.laborId;

  openCreate(): void {
    this.projectTypeForm.reset({
      name: '',
      notes: '',
      status: 'active',
    });
    this.store.dispatch(ManagerProjectTypesActions.openProjectTypeCreate());
  }

  openEdit(pt: BmProjectType): void {
    this.store.dispatch(
      ManagerProjectTypesActions.openProjectTypeEdit({
        projectTypeId: pt.projectTypeId,
      }),
    );
  }

  closeForm(): void {
    this.store.dispatch(ManagerProjectTypesActions.closeProjectTypeForm());
  }

  setTab(tab: ProjectTypeFormTab, projectTypeId?: string | null): void {
    this.store.dispatch(ManagerProjectTypesActions.setProjectTypeFormTab({ tab }));
    if (!projectTypeId) return;
    if (tab === 'materials') {
      this.store.dispatch(
        ManagerProjectTypesActions.loadProjectTypeMaterials({ projectTypeId }),
      );
    }
    if (tab === 'labor') {
      this.store.dispatch(
        ManagerProjectTypesActions.loadProjectTypeLabor({ projectTypeId }),
      );
    }
  }

  saveProjectType(closeOnSuccess = false): void {
    if (this.projectTypeForm.invalid) {
      this.projectTypeForm.markAllAsTouched();
      return;
    }

    const payload: any = this.projectTypeForm.getRawValue();
    delete payload.company_id;
    delete payload.companyId;
    delete payload.project_type_id;
    delete payload.projectTypeId;

    this.store.dispatch(
      ManagerProjectTypesActions.saveProjectType({ payload, closeOnSuccess }),
    );
  }

  saveProjectTypeAndClose(): void {
    this.closeAfterSave = true;
    this.saveProjectType(true);
  }

  archiveProjectType(pt: BmProjectType): void {
    const ok = window.confirm(
      `Archive project type "${pt.name}"?\n\nThis is a soft-delete (status = archived).`,
    );
    if (!ok) return;
    this.store.dispatch(
      ManagerProjectTypesActions.archiveProjectType({
        projectTypeId: pt.projectTypeId,
      }),
    );
  }

  openMaterialCreate(): void {
    this.projectTypeMaterialForm.reset({
      supplier_id: null,
      material_id: null,
      quantity: 1,
      unit_cost_override: null,
      sell_cost_override: null,
      notes: '',
    });
    this.selectedSupplierId = null;
    this.supplierSearchCtrl.setValue('', { emitEvent: false });
    this.materialSearchCtrl.setValue('', { emitEvent: false });
    this.store.dispatch(ManagerProjectTypesActions.openProjectTypeMaterialCreate());
  }

  openMaterialEdit(m: BmProjectTypeMaterial): void {
    this.store.dispatch(
      ManagerProjectTypesActions.openProjectTypeMaterialEdit({
        materialId: m.materialId,
      }),
    );
  }

  closeMaterialForm(): void {
    this.store.dispatch(ManagerProjectTypesActions.closeProjectTypeMaterialForm());
  }

  saveProjectTypeMaterial(projectTypeId: string, editing?: BmProjectTypeMaterial | null): void {
    if (this.projectTypeMaterialForm.invalid) {
      this.projectTypeMaterialForm.markAllAsTouched();
      return;
    }
    const payload: any = this.projectTypeMaterialForm.getRawValue();
    const materialId = payload.material_id;
    if (!materialId && !editing?.materialId) return;
    this.store.dispatch(
      ManagerProjectTypesActions.saveProjectTypeMaterial({
        projectTypeId,
        materialId: editing?.materialId ?? null,
        payload,
      }),
    );
  }

  removeProjectTypeMaterial(projectTypeId: string, m: BmProjectTypeMaterial): void {
    const ok = window.confirm(`Remove material "${m.materialName}"?`);
    if (!ok) return;
    this.store.dispatch(
      ManagerProjectTypesActions.removeProjectTypeMaterial({
        projectTypeId,
        materialId: m.materialId,
      }),
    );
  }

  openLaborCreate(): void {
    this.projectTypeLaborForm.reset({
      labor_id: null,
      quantity: 1,
      unit_cost_override: null,
      sell_cost_override: null,
      notes: '',
    });
    this.laborSearchCtrl.setValue('', { emitEvent: false });
    this.store.dispatch(ManagerProjectTypesActions.openProjectTypeLaborCreate());
  }

  openLaborEdit(l: BmProjectTypeLabor): void {
    this.store.dispatch(
      ManagerProjectTypesActions.openProjectTypeLaborEdit({
        laborId: l.laborId,
      }),
    );
  }

  closeLaborForm(): void {
    this.store.dispatch(ManagerProjectTypesActions.closeProjectTypeLaborForm());
  }

  saveProjectTypeLabor(projectTypeId: string, editing?: BmProjectTypeLabor | null): void {
    if (this.projectTypeLaborForm.invalid) {
      this.projectTypeLaborForm.markAllAsTouched();
      return;
    }
    const payload: any = this.projectTypeLaborForm.getRawValue();
    const laborId = payload.labor_id;
    if (!laborId && !editing?.laborId) return;
    this.store.dispatch(
      ManagerProjectTypesActions.saveProjectTypeLabor({
        projectTypeId,
        laborId: editing?.laborId ?? null,
        payload,
      }),
    );
  }

  removeProjectTypeLabor(projectTypeId: string, l: BmProjectTypeLabor): void {
    const ok = window.confirm(`Remove labor "${l.laborName}"?`);
    if (!ok) return;
    this.store.dispatch(
      ManagerProjectTypesActions.removeProjectTypeLabor({
        projectTypeId,
        laborId: l.laborId,
      }),
    );
  }

  formatQuantity(value: number | null | undefined): string | null {
    if (value === null || value === undefined) return null;
    return Number.isInteger(value) ? String(value) : String(value);
  }

  formatMoney(value?: number | null): number | null {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    if (Number.isNaN(num)) return null;
    return Math.round(num * 100) / 100;
  }

  private loadReferenceData(): void {
    this.suppliersApi
      .listSuppliers({ page: 1, limit: 200, status: 'active' })
      .pipe(takeUntil(this.destroy$))
      .subscribe((res) => {
        this.suppliersCatalog = (res.items ?? []).map((s: BmSupplier) => ({
          supplierId: s.supplierId,
          supplierName: s.supplierName,
        }));
        const currentSupplierId = this.projectTypeMaterialForm.controls.supplier_id.value;
        if (currentSupplierId && !this.supplierSearchCtrl.value) {
          const match = this.suppliersCatalog.find(
            (s) => s.supplierId === currentSupplierId,
          );
          if (match) {
            this.supplierSearchCtrl.setValue(match.supplierName, {
              emitEvent: false,
            });
          }
        }
      });

    this.laborApi
      .listLabor({ page: 1, limit: 200 })
      .pipe(takeUntil(this.destroy$))
      .subscribe((res) => {
        this.laborCatalog = (res?.items ?? []).map((l: BmLabor) => ({
          laborId: l.laborId,
          laborName: l.laborName,
          unitCost: l.unitCost ?? null,
          sellCost: l.sellCost ?? null,
        }));
        this.laborOptions = this.laborCatalog.map((l) => ({
          value: l.laborId,
          label: l.laborName,
        }));
        const currentLaborId = this.projectTypeLaborForm.controls.labor_id.value;
        if (currentLaborId && !this.laborSearchCtrl.value) {
          const match = this.laborCatalog.find((l) => l.laborId === currentLaborId);
          if (match) {
            this.laborSearchCtrl.setValue(match.laborName, { emitEvent: false });
          }
        }
      });
  }

  private updateSupplierSuggestions(query: string): void {
    const term = query.trim().toLowerCase();
    if (!term) {
      this.supplierSuggestions = [];
      this.showSupplierSuggestions = false;
      this.supplierActiveIndex = -1;
      return;
    }
    const results = this.suppliersCatalog.filter((s) =>
      (s.supplierName || '').toLowerCase().includes(term),
    );
    this.supplierSuggestions = results.slice(0, 8);
    this.showSupplierSuggestions = this.supplierSuggestions.length > 0;
    this.supplierActiveIndex = this.supplierSuggestions.length ? 0 : -1;
  }

  onSupplierQueryInput(value: string | null): void {
    this.updateSupplierSuggestions(value || '');
    this.selectedSupplierId = null;
    this.projectTypeMaterialForm.controls.supplier_id.setValue(null);
    this.supplierMaterialsCatalog = [];
    this.materialSuggestions = [];
    this.showMaterialSuggestions = false;
    this.projectTypeMaterialForm.controls.material_id.setValue(null);
    this.projectTypeMaterialForm.controls.unit_cost_override.setValue(null, {
      emitEvent: false,
    });
    this.projectTypeMaterialForm.controls.sell_cost_override.setValue(null, {
      emitEvent: false,
    });
  }

  onSupplierQueryFocus(): void {
    const query = (this.supplierSearchCtrl.value || '').trim();
    if (query.length) {
      this.updateSupplierSuggestions(query);
    }
    this.showSupplierSuggestions = this.supplierSuggestions.length > 0;
  }

  onSupplierQueryBlur(): void {
    window.setTimeout(() => {
      if (!this.selectedSupplierId) {
        const query = (this.supplierSearchCtrl.value || '').trim().toLowerCase();
        if (query.length) {
          const exact = this.suppliersCatalog.find(
            (s) => (s.supplierName || '').toLowerCase() === query,
          );
          if (exact) {
            this.onSupplierSelect(exact);
          }
        }
      }
      this.showSupplierSuggestions = false;
      this.supplierActiveIndex = -1;
    }, 150);
  }

  onSupplierQueryKeydown(event: KeyboardEvent): void {
    if (!this.showSupplierSuggestions || !this.supplierSuggestions.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.supplierActiveIndex = Math.min(
        this.supplierActiveIndex + 1,
        this.supplierSuggestions.length - 1,
      );
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.supplierActiveIndex = Math.max(this.supplierActiveIndex - 1, 0);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const current = this.supplierSuggestions[this.supplierActiveIndex];
      if (current) this.onSupplierSelect(current);
    } else if (event.key === 'Escape') {
      this.showSupplierSuggestions = false;
      this.supplierActiveIndex = -1;
    }
  }

  onSupplierSelect(supplier: { supplierId: string; supplierName: string }): void {
    this.selectedSupplierId = supplier.supplierId;
    this.projectTypeMaterialForm.controls.supplier_id.setValue(supplier.supplierId);
    this.supplierSearchCtrl.setValue(supplier.supplierName, { emitEvent: false });
    this.supplierSuggestions = [];
    this.showSupplierSuggestions = false;
    this.supplierActiveIndex = -1;
    this.loadSupplierMaterials(supplier.supplierId);
    this.materialSearchCtrl.setValue('', { emitEvent: false });
    this.projectTypeMaterialForm.controls.material_id.setValue(null);
    this.projectTypeMaterialForm.controls.unit_cost_override.setValue(null, {
      emitEvent: false,
    });
    this.projectTypeMaterialForm.controls.sell_cost_override.setValue(null, {
      emitEvent: false,
    });
  }

  private updateMaterialSuggestions(query: string): void {
    if (!this.selectedSupplierId) {
      this.materialSuggestions = [];
      this.materialActiveIndex = -1;
      return;
    }
    const term = query.trim().toLowerCase();
    if (!term) {
      this.materialSuggestions = [];
      this.materialActiveIndex = -1;
      return;
    }
    const results = this.supplierMaterialsCatalog.filter((m) => {
      const name = m.materialName?.toLowerCase() || '';
      const code = (m.materialCode || '').toLowerCase();
      return name.includes(term) || code.includes(term);
    });
    this.materialSuggestions = results.slice(0, 8);
    this.materialActiveIndex = this.materialSuggestions.length ? 0 : -1;
  }

  onMaterialQueryInput(value: string | null): void {
    const query = value || '';
    this.updateMaterialSuggestions(query);
    this.showMaterialSuggestions =
      query.trim().length > 0 && this.materialSuggestions.length > 0;
    this.projectTypeMaterialForm.controls.material_id.setValue(null);
    if (!value) {
      this.projectTypeMaterialForm.controls.unit_cost_override.setValue(null, {
        emitEvent: false,
      });
      this.projectTypeMaterialForm.controls.sell_cost_override.setValue(null, {
        emitEvent: false,
      });
    }
  }

  onMaterialQueryFocus(): void {
    const query = (this.materialSearchCtrl.value || '').trim();
    if (query.length) {
      this.updateMaterialSuggestions(query);
    }
    this.showMaterialSuggestions =
      query.length > 0 && this.materialSuggestions.length > 0;
  }

  onMaterialQueryBlur(): void {
    window.setTimeout(() => {
      this.showMaterialSuggestions = false;
      this.materialActiveIndex = -1;
    }, 150);
  }

  onMaterialQueryKeydown(event: KeyboardEvent): void {
    if (!this.showMaterialSuggestions || !this.materialSuggestions.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.materialActiveIndex = Math.min(
        this.materialActiveIndex + 1,
        this.materialSuggestions.length - 1,
      );
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.materialActiveIndex = Math.max(this.materialActiveIndex - 1, 0);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const current = this.materialSuggestions[this.materialActiveIndex];
      if (current) this.onMaterialSelect(current);
    } else if (event.key === 'Escape') {
      this.showMaterialSuggestions = false;
      this.materialActiveIndex = -1;
    }
  }

  onMaterialSelect(material: {
    materialId: string;
    materialName: string;
    unitCost?: number | null;
    sellCost?: number | null;
  }): void {
    this.projectTypeMaterialForm.controls.material_id.setValue(material.materialId);
    this.materialSearchCtrl.setValue(material.materialName, { emitEvent: false });
    this.projectTypeMaterialForm.controls.unit_cost_override.setValue(
      this.formatMoney(material.unitCost ?? null),
      { emitEvent: false },
    );
    this.projectTypeMaterialForm.controls.sell_cost_override.setValue(
      this.formatMoney(material.sellCost ?? null),
      { emitEvent: false },
    );
    this.showMaterialSuggestions = false;
    this.materialActiveIndex = -1;
  }

  private updateLaborSuggestions(query: string): void {
    const term = query.trim().toLowerCase();
    if (!term) {
      this.laborSuggestions = [];
      this.showLaborSuggestions = false;
      this.laborActiveIndex = -1;
      return;
    }
    const results = this.laborCatalog.filter((l) =>
      (l.laborName || '').toLowerCase().includes(term),
    );
    this.laborSuggestions = results.slice(0, 8);
    this.showLaborSuggestions = this.laborSuggestions.length > 0;
    this.laborActiveIndex = this.laborSuggestions.length ? 0 : -1;
  }

  onLaborQueryInput(value: string | null): void {
    this.updateLaborSuggestions(value || '');
    this.projectTypeLaborForm.controls.labor_id.setValue(null);
    if (!value) {
      this.projectTypeLaborForm.controls.unit_cost_override.setValue(null, {
        emitEvent: false,
      });
      this.projectTypeLaborForm.controls.sell_cost_override.setValue(null, {
        emitEvent: false,
      });
    }
  }

  onLaborQueryFocus(): void {
    const query = (this.laborSearchCtrl.value || '').trim();
    if (query.length) {
      this.updateLaborSuggestions(query);
    }
    this.showLaborSuggestions = this.laborSuggestions.length > 0;
  }

  onLaborQueryBlur(): void {
    window.setTimeout(() => {
      this.showLaborSuggestions = false;
      this.laborActiveIndex = -1;
    }, 150);
  }

  onLaborQueryKeydown(event: KeyboardEvent): void {
    if (!this.showLaborSuggestions || !this.laborSuggestions.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.laborActiveIndex = Math.min(
        this.laborActiveIndex + 1,
        this.laborSuggestions.length - 1,
      );
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.laborActiveIndex = Math.max(this.laborActiveIndex - 1, 0);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const current = this.laborSuggestions[this.laborActiveIndex];
      if (current) this.onLaborSelect(current);
    } else if (event.key === 'Escape') {
      this.showLaborSuggestions = false;
      this.laborActiveIndex = -1;
    }
  }

  onLaborSelect(labor: {
    laborId: string;
    laborName: string;
    unitCost?: number | null;
    sellCost?: number | null;
  }): void {
    this.projectTypeLaborForm.controls.labor_id.setValue(labor.laborId);
    this.laborSearchCtrl.setValue(labor.laborName, { emitEvent: false });
    this.projectTypeLaborForm.controls.unit_cost_override.setValue(
      this.formatMoney(labor.unitCost ?? null),
      { emitEvent: false },
    );
    this.projectTypeLaborForm.controls.sell_cost_override.setValue(
      this.formatMoney(labor.sellCost ?? null),
      { emitEvent: false },
    );
    this.showLaborSuggestions = false;
    this.laborActiveIndex = -1;
  }

  private loadSupplierMaterials(supplierId: string): void {
    this.suppliersApi
      .listSupplierMaterials(supplierId, { page: 1, limit: 200 })
      .pipe(takeUntil(this.destroy$))
      .subscribe((res) => {
        this.supplierMaterialsCatalog = (res?.materials ?? []).map(
          (m: BmSupplierMaterial) => ({
            materialId: m.materialId,
            materialName: m.materialName ?? '',
            materialCode: m.materialCode ?? null,
            unitCost: m.unitCost ?? null,
            sellCost: m.sellCost ?? null,
          }),
        );
        const query = (this.materialSearchCtrl.value || '').trim();
        if (query.length) {
          this.updateMaterialSuggestions(query);
        }
      });
  }

  private setupInfiniteScroll(): void {
    const sentinel = this.infiniteSentinelRef?.nativeElement;
    const list = this.projectTypesListRef?.nativeElement;
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
      ManagerProjectTypesActions.loadProjectTypes({ page: this.currentPage + 1 }),
    );
  }
}
