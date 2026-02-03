import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
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
import { Store } from '@ngrx/store';
import { combineLatest, Observable, Subject } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  map,
  takeUntil,
} from 'rxjs/operators';

import { ManagerProjectsActions } from '../../store/projects/manager.actions';
import {
  selectManagerEditingProject,
  selectManagerEditingProjectLabor,
  selectManagerEditingProjectMaterial,
  selectManagerProjectFormTab,
  selectManagerProjectLabor,
  selectManagerProjectLaborError,
  selectManagerProjectLaborLoading,
  selectManagerProjectLaborViewMode,
  selectManagerProjectMaterials,
  selectManagerProjectMaterialsError,
  selectManagerProjectMaterialsLoading,
  selectManagerProjectMaterialsViewMode,
  selectManagerProjects,
  selectManagerProjectsError,
  selectManagerProjectsLimit,
  selectManagerProjectsLoading,
  selectManagerProjectsPage,
  selectManagerProjectsSearchQuery,
  selectManagerProjectsTotal,
  selectManagerProjectsViewMode,
} from '../../store/projects/manager.selectors';
import type {
  BmProject,
  BmProjectLabor,
  BmProjectMaterial,
} from '../../types/projects.interface';
import { ProjectFormTab } from '../../store/projects/manager.state';
import { ManagerSelectComponent } from '../shared/manager-select/manager-select.component';
import { ManagerService } from '../../services/manager.service';
import { ManagerSuppliersService } from '../../services/manager.suppliers.service';
import { ManagerLaborService } from '../../services/manager.labor.service';
import { ManagerPricingService } from '../../services/manager.pricing.service';
import type { ManagerSelectOption } from '../shared/manager-select/manager-select.component';

@Component({
  selector: 'app-manager-projects-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    ManagerSelectComponent,
  ],
  templateUrl: './manager-projects.page.html',
  styleUrls: ['./manager-projects.page.css'],
})
export class ManagerProjectsPageComponent
  implements OnInit, OnDestroy, AfterViewInit
{
  private destroy$ = new Subject<void>();
  private infiniteObserver?: IntersectionObserver;
  private isLoadingMore = false;
  private isLoading = false;

  loading$ = this.store.select(selectManagerProjectsLoading);
  error$ = this.store.select(selectManagerProjectsError);
  projectsRaw$ = this.store.select(selectManagerProjects);
  total$ = this.store.select(selectManagerProjectsTotal);
  viewMode$ = this.store.select(selectManagerProjectsViewMode);
  editingProject$ = this.store.select(selectManagerEditingProject);

  page$ = this.store.select(selectManagerProjectsPage);
  limit$ = this.store.select(selectManagerProjectsLimit);
  searchQuery$ = this.store.select(selectManagerProjectsSearchQuery);

  tab$ = this.store.select(selectManagerProjectFormTab);

  materials$ = this.store.select(selectManagerProjectMaterials);
  materialsLoading$ = this.store.select(selectManagerProjectMaterialsLoading);
  materialsError$ = this.store.select(selectManagerProjectMaterialsError);
  materialsViewMode$ = this.store.select(selectManagerProjectMaterialsViewMode);
  editingMaterial$ = this.store.select(selectManagerEditingProjectMaterial);

  labor$ = this.store.select(selectManagerProjectLabor);
  laborLoading$ = this.store.select(selectManagerProjectLaborLoading);
  laborError$ = this.store.select(selectManagerProjectLaborError);
  laborViewMode$ = this.store.select(selectManagerProjectLaborViewMode);
  editingLabor$ = this.store.select(selectManagerEditingProjectLabor);

  searchCtrl: FormControl<string>;
  canLoadMore$!: Observable<boolean>;

  statusOptions: ManagerSelectOption[] = [
    { value: 'to_do', label: 'To do' },
    { value: 'in_progress', label: 'In progress' },
    { value: 'done', label: 'Done' },
    { value: 'on_hold', label: 'On hold' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  clientOptions: ManagerSelectOption[] = [];
  pricingOptions: ManagerSelectOption[] = [];
  materialOptions: ManagerSelectOption[] = [];
  laborOptions: ManagerSelectOption[] = [];
  laborCatalog: { laborId: string; laborName: string; unitCost?: number | null; sellCost?: number | null }[] = [];
  laborSearchCtrl: FormControl<string>;
  laborSuggestions: { laborId: string; laborName: string; unitCost?: number | null; sellCost?: number | null }[] = [];
  showLaborSuggestions = false;
  laborActiveIndex = -1;
  clientsCatalog: { clientId: string; clientName: string }[] = [];
  suppliersCatalog: { supplierId: string; supplierName: string }[] = [];
  supplierMaterialsCatalog: {
    materialId: string;
    materialName: string;
    materialCode?: string | null;
    unitCost?: number | null;
    sellCost?: number | null;
  }[] = [];
  clientSearchCtrl: FormControl<string>;
  supplierSearchCtrl: FormControl<string>;
  materialSearchCtrl: FormControl<string>;
  clientSuggestions: { clientId: string; clientName: string }[] = [];
  supplierSuggestions: { supplierId: string; supplierName: string }[] = [];
  materialSuggestions: {
    materialId: string;
    materialName: string;
    materialCode?: string | null;
    unitCost?: number | null;
    sellCost?: number | null;
  }[] = [];
  showClientSuggestions = false;
  showSupplierSuggestions = false;
  showMaterialSuggestions = false;
  clientActiveIndex = -1;
  supplierActiveIndex = -1;
  materialActiveIndex = -1;
  selectedSupplierId: string | null = null;
  useDefaultPricing = true;

  projectForm = this.fb.group({
    client_id: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    project_name: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    description: new FormControl<string>('', { nonNullable: true }),
    status: new FormControl<string>('to_do', { nonNullable: true }),
    default_pricing: new FormControl<boolean>(false, { nonNullable: true }),
    pricing_profile_id: new FormControl<string | null>(null),
  });

  projectMaterialForm = this.fb.group({
    supplier_id: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    material_id: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    quantity: new FormControl<number>(1, {
      nonNullable: true,
      validators: [Validators.min(0)],
    }),
    unit_cost_override: new FormControl<number | null>(null),
    sell_cost_override: new FormControl<number | null>(null),
    notes: new FormControl<string>('', { nonNullable: true }),
  });

  projectLaborForm = this.fb.group({
    labor_id: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    quantity: new FormControl<number>(1, {
      nonNullable: true,
      validators: [Validators.min(0)],
    }),
    unit_cost_override: new FormControl<number | null>(null),
    sell_cost_override: new FormControl<number | null>(null),
    notes: new FormControl<string>('', { nonNullable: true }),
  });

  editingMaterial: BmProjectMaterial | null = null;
  editingLabor: BmProjectLabor | null = null;
  dismissedErrors = new Set<string>();
  dismissedWarnings = new Set<string>();

  @ViewChild('projectsList') projectsListRef?: ElementRef<HTMLElement>;
  @ViewChild('infiniteSentinel') infiniteSentinelRef?: ElementRef<HTMLElement>;

  private currentPage = 1;
  private canLoadMore = false;

  constructor(
    private store: Store,
    private fb: FormBuilder,
    private managerService: ManagerService,
    private laborService: ManagerLaborService,
    private pricingService: ManagerPricingService,
    private suppliersService: ManagerSuppliersService,
  ) {
    this.searchCtrl = new FormControl('', { nonNullable: true });
    this.clientSearchCtrl = new FormControl('', { nonNullable: true });
    this.supplierSearchCtrl = new FormControl('', { nonNullable: true });
    this.materialSearchCtrl = new FormControl('', { nonNullable: true });
    this.laborSearchCtrl = new FormControl('', { nonNullable: true });
  }

  ngOnInit(): void {
    this.store.dispatch(ManagerProjectsActions.loadProjects({ page: 1 }));

    this.searchCtrl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((value) => {
        this.store.dispatch(
          ManagerProjectsActions.setProjectsSearchQuery({ query: value || '' }),
        );
        this.store.dispatch(ManagerProjectsActions.loadProjects({ page: 1 }));
      });

    this.loading$.pipe(takeUntil(this.destroy$)).subscribe((loading) => {
      this.isLoading = loading;
      if (!loading) this.isLoadingMore = false;
    });


    this.page$.pipe(takeUntil(this.destroy$)).subscribe((page) => {
      this.currentPage = page;
    });

    this.canLoadMore$ = combineLatest([
      this.page$,
      this.limit$,
      this.total$,
    ]).pipe(map(([page, limit, total]) => page * limit < total));

    this.canLoadMore$.pipe(takeUntil(this.destroy$)).subscribe((can) => {
      this.canLoadMore = can;
    });

    this.projectForm.controls.pricing_profile_id.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((value) => {
        if (value && this.useDefaultPricing) {
          this.setDefaultPricing(false);
        }
      });

    this.editingProject$.pipe(takeUntil(this.destroy$)).subscribe((project) => {
      if (project) {
        this.projectForm.reset({
          client_id: project.clientId,
          project_name: project.projectName,
          description: project.description ?? '',
          status: project.status ?? 'to_do',
          default_pricing: project.defaultPricing ?? false,
          pricing_profile_id: project.pricingProfileId ?? null,
        });
        this.useDefaultPricing = project.defaultPricing ?? false;
        this.clientSearchCtrl.setValue(project.clientName || '', {
          emitEvent: false,
        });
      } else {
        this.projectForm.reset({
          client_id: '',
          project_name: '',
          description: '',
          status: 'to_do',
          default_pricing: false,
          pricing_profile_id: null,
        });
        this.useDefaultPricing = false;
        this.clientSearchCtrl.setValue('', { emitEvent: false });
      }
    });

    this.editingMaterial$.pipe(takeUntil(this.destroy$)).subscribe((mat) => {
      this.editingMaterial = mat;
      if (mat) {
        this.projectMaterialForm.reset({
          supplier_id: mat.supplierId ?? '',
          material_id: mat.materialId,
          quantity: this.formatInt(mat.quantity ?? 1) ?? 1,
          unit_cost_override: this.formatInt(mat.unitCostOverride ?? null),
          sell_cost_override: this.formatInt(mat.sellCostOverride ?? null),
          notes: mat.notes ?? '',
        });
        this.selectedSupplierId = mat.supplierId ?? null;
        const supplierName =
          mat.supplierName ||
          this.suppliersCatalog.find(
            (s) => s.supplierId === mat.supplierId,
          )?.supplierName ||
          '';
        this.supplierSearchCtrl.setValue(supplierName, { emitEvent: false });
        this.materialSearchCtrl.setValue(mat.materialName || '', {
          emitEvent: false,
        });
        if (mat.supplierId) {
          this.loadSupplierMaterials(mat.supplierId);
        } else {
          this.supplierMaterialsCatalog = [];
        }
      } else {
        this.projectMaterialForm.reset({
          supplier_id: '',
          material_id: '',
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

    this.editingLabor$.pipe(takeUntil(this.destroy$)).subscribe((labor) => {
      this.editingLabor = labor;
      if (labor) {
        this.projectLaborForm.reset({
          labor_id: labor.laborId,
          quantity: labor.quantity ?? 1,
          unit_cost_override: this.formatInt(labor.unitCostOverride ?? null),
          sell_cost_override: this.formatInt(labor.sellCostOverride ?? null),
          notes: labor.notes ?? '',
        });
        this.laborSearchCtrl.setValue(labor.laborName || '', {
          emitEvent: false,
        });
      } else {
        this.projectLaborForm.reset({
          labor_id: '',
          quantity: 1,
          unit_cost_override: null,
          sell_cost_override: null,
          notes: '',
        });
        this.laborSearchCtrl.setValue('', { emitEvent: false });
      }
    });

    this.loadSelectOptions();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.setupInfiniteScroll(), 0);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.infiniteObserver?.disconnect();
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

  isWarningDismissed(message: string | null | undefined): boolean {
    return message ? this.dismissedWarnings.has(message) : false;
  }

  openCreate(): void {
    this.store.dispatch(ManagerProjectsActions.openProjectCreate());
  }

  openEdit(project: BmProject): void {
    this.store.dispatch(
      ManagerProjectsActions.openProjectEdit({ projectId: project.projectId }),
    );
  }

  closeForm(): void {
    this.store.dispatch(ManagerProjectsActions.closeProjectForm());
  }

  saveProject(): void {
    if (this.projectForm.invalid) {
      this.projectForm.markAllAsTouched();
      return;
    }

    const payload: any = this.projectForm.getRawValue();
    const useDefaultPricing = this.useDefaultPricing;
    payload.default_pricing = useDefaultPricing;
    if (useDefaultPricing) {
      payload.pricing_profile_id = null;
    }

    this.store.dispatch(
      ManagerProjectsActions.saveProject({ payload, closeOnSuccess: false }),
    );
  }

  saveProjectAndClose(): void {
    if (this.projectForm.invalid) {
      this.projectForm.markAllAsTouched();
      return;
    }
    const payload: any = this.projectForm.getRawValue();
    const useDefaultPricing = this.useDefaultPricing;
    payload.default_pricing = useDefaultPricing;
    if (useDefaultPricing) {
      payload.pricing_profile_id = null;
    }

    this.store.dispatch(
      ManagerProjectsActions.saveProject({ payload, closeOnSuccess: true }),
    );
  }

  get isDefaultPricing(): boolean {
    return this.useDefaultPricing;
  }

  get isPricingProfileDisabled(): boolean {
    return this.isDefaultPricing;
  }

  setDefaultPricing(value: boolean): void {
    this.useDefaultPricing = value;
    this.projectForm.controls.default_pricing.setValue(value);
    if (value) {
      this.projectForm.controls.pricing_profile_id.setValue(null);
    }
  }

  formatInt(value?: number | null): number | null {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    if (Number.isNaN(num)) return null;
    return Math.round(num);
  }

  private updateMaterialSuggestions(query: string): void {
    if (!this.selectedSupplierId) {
      this.materialSuggestions = [];
      this.showMaterialSuggestions = false;
      this.materialActiveIndex = -1;
      return;
    }
    const term = query.trim().toLowerCase();
    if (!term) {
      this.materialSuggestions = [];
      this.showMaterialSuggestions = false;
      this.materialActiveIndex = -1;
      return;
    }
    const results = this.supplierMaterialsCatalog.filter((m) => {
      const name = m.materialName?.toLowerCase() || '';
      const code = (m.materialCode || '').toLowerCase();
      return name.includes(term) || code.includes(term);
    });
    this.materialSuggestions = results.slice(0, 8);
    this.showMaterialSuggestions = this.materialSuggestions.length > 0;
    this.materialActiveIndex = this.materialSuggestions.length ? 0 : -1;
  }

  onMaterialQueryInput(value: string | null): void {
    this.updateMaterialSuggestions(value || '');
    this.projectMaterialForm.controls.material_id.setValue('');
    if (!value) {
      this.projectMaterialForm.controls.unit_cost_override.setValue(null, {
        emitEvent: false,
      });
      this.projectMaterialForm.controls.sell_cost_override.setValue(null, {
        emitEvent: false,
      });
    }
  }

  onMaterialQueryFocus(): void {
    const query = (this.materialSearchCtrl.value || '').trim();
    if (query.length) {
      this.updateMaterialSuggestions(query);
    }
    this.showMaterialSuggestions = this.materialSuggestions.length > 0;
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
    this.projectMaterialForm.controls.material_id.setValue(material.materialId);
    this.materialSearchCtrl.setValue(material.materialName, {
      emitEvent: false,
    });
    this.projectMaterialForm.controls.unit_cost_override.setValue(
      this.formatInt(material.unitCost ?? null),
      { emitEvent: false },
    );
    this.projectMaterialForm.controls.sell_cost_override.setValue(
      this.formatInt(material.sellCost ?? null),
      { emitEvent: false },
    );
    this.showMaterialSuggestions = false;
    this.materialActiveIndex = -1;
  }

  formatStatus(status?: string | null): string {
    const match = this.statusOptions.find((opt) => opt.value === status);
    return match?.label ?? (status || 'To do');
  }

  onClientQueryFocus(): void {
    const query = (this.clientSearchCtrl.value || '').trim();
    if (query.length) {
      this.updateClientSuggestions(query);
    }
    this.showClientSuggestions = this.clientSuggestions.length > 0;
  }

  onClientQueryBlur(): void {
    window.setTimeout(() => {
      this.showClientSuggestions = false;
      this.clientActiveIndex = -1;
    }, 120);
  }

  onClientQueryKeydown(event: KeyboardEvent): void {
    if (!this.clientSuggestions.length) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.clientActiveIndex = Math.min(
        this.clientActiveIndex + 1,
        this.clientSuggestions.length - 1,
      );
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.clientActiveIndex = Math.max(this.clientActiveIndex - 1, 0);
    } else if (event.key === 'Enter') {
      if (this.clientActiveIndex >= 0) {
        event.preventDefault();
        this.onClientSelect(this.clientSuggestions[this.clientActiveIndex]);
      }
    } else if (event.key === 'Escape') {
      this.showClientSuggestions = false;
      this.clientActiveIndex = -1;
    }
  }

  onClientQueryInput(value: string): void {
    const query = (value || '').trim();
    this.projectForm.controls.client_id.setValue('');
    this.updateClientSuggestions(query);
    this.showClientSuggestions =
      query.length > 0 && this.clientSuggestions.length > 0;
  }

  onClientSelect(client: { clientId: string; clientName: string }): void {
    this.projectForm.controls.client_id.setValue(client.clientId);
    this.clientSearchCtrl.setValue(client.clientName, { emitEvent: false });
    this.clientSuggestions = [];
    this.showClientSuggestions = false;
    this.clientActiveIndex = -1;
  }

  private updateSupplierSuggestions(query: string): void {
    const term = query.trim().toLowerCase();
    if (!term) {
      this.supplierSuggestions = [];
      this.showSupplierSuggestions = false;
      this.supplierActiveIndex = -1;
      return;
    }
    const results = this.suppliersCatalog.filter((s) => {
      const name = s.supplierName?.toLowerCase() || '';
      return name.includes(term);
    });
    this.supplierSuggestions = results.slice(0, 8);
    this.showSupplierSuggestions = this.supplierSuggestions.length > 0;
    this.supplierActiveIndex = this.supplierSuggestions.length ? 0 : -1;
  }

  onSupplierQueryInput(value: string | null): void {
    this.updateSupplierSuggestions(value || '');
    this.selectedSupplierId = null;
    this.projectMaterialForm.controls.supplier_id.setValue('');
    this.supplierMaterialsCatalog = [];
    this.materialSuggestions = [];
    this.showMaterialSuggestions = false;
    this.projectMaterialForm.controls.material_id.setValue('');
    this.projectMaterialForm.controls.unit_cost_override.setValue(null, {
      emitEvent: false,
    });
    this.projectMaterialForm.controls.sell_cost_override.setValue(null, {
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
    this.projectMaterialForm.controls.supplier_id.setValue(supplier.supplierId);
    this.supplierSearchCtrl.setValue(supplier.supplierName, {
      emitEvent: false,
    });
    this.supplierSuggestions = [];
    this.showSupplierSuggestions = false;
    this.supplierActiveIndex = -1;
    this.loadSupplierMaterials(supplier.supplierId);
    this.materialSearchCtrl.setValue('', { emitEvent: false });
    this.projectMaterialForm.controls.material_id.setValue('');
    this.projectMaterialForm.controls.unit_cost_override.setValue(null, {
      emitEvent: false,
    });
    this.projectMaterialForm.controls.sell_cost_override.setValue(null, {
      emitEvent: false,
    });
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
    this.projectLaborForm.controls.labor_id.setValue('');
    if (!value) {
      this.projectLaborForm.controls.unit_cost_override.setValue(null, {
        emitEvent: false,
      });
      this.projectLaborForm.controls.sell_cost_override.setValue(null, {
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
    this.projectLaborForm.controls.labor_id.setValue(labor.laborId);
    this.laborSearchCtrl.setValue(labor.laborName, { emitEvent: false });
    this.projectLaborForm.controls.unit_cost_override.setValue(
      this.formatInt(labor.unitCost ?? null),
      { emitEvent: false },
    );
    this.projectLaborForm.controls.sell_cost_override.setValue(
      this.formatInt(labor.sellCost ?? null),
      { emitEvent: false },
    );
    this.showLaborSuggestions = false;
    this.laborActiveIndex = -1;
  }

  private loadSupplierMaterials(supplierId: string): void {
    this.suppliersService
      .listSupplierMaterials(supplierId, { page: 1, limit: 200 })
      .pipe(takeUntil(this.destroy$))
      .subscribe((res) => {
        this.supplierMaterialsCatalog = (res?.materials ?? []).map((m) => ({
          materialId: m.materialId,
          materialName: m.materialName || '',
          materialCode: m.materialCode ?? null,
          unitCost: m.unitCost ?? null,
          sellCost: m.sellCost ?? null,
        }));
        const query = (this.materialSearchCtrl.value || '').trim();
        if (query.length) {
          this.updateMaterialSuggestions(query);
        }
      });
  }

  archiveProject(project: BmProject): void {
    const ok = window.confirm(
      `Archive project "${project.projectName}"?\n\nThis will set status = cancelled.`,
    );
    if (!ok) return;

    this.store.dispatch(
      ManagerProjectsActions.archiveProject({ projectId: project.projectId }),
    );
  }

  setTab(tab: ProjectFormTab, project: BmProject | null): void {
    if (!project && tab !== 'details') return;

    this.store.dispatch(ManagerProjectsActions.setProjectFormTab({ tab }));

    if (tab === 'materials' && project) {
      this.store.dispatch(
        ManagerProjectsActions.loadProjectMaterials({
          projectId: project.projectId,
        }),
      );
    }

    if (tab === 'labor' && project) {
      this.store.dispatch(
        ManagerProjectsActions.loadProjectLabor({
          projectId: project.projectId,
        }),
      );
    }
  }

  openMaterialCreate(): void {
    this.store.dispatch(ManagerProjectsActions.openProjectMaterialCreate());
  }

  openMaterialEdit(material: BmProjectMaterial): void {
    this.store.dispatch(
      ManagerProjectsActions.openProjectMaterialEdit({
        materialId: material.materialId,
      }),
    );
  }

  closeMaterialForm(): void {
    this.store.dispatch(ManagerProjectsActions.closeProjectMaterialForm());
  }

  saveProjectMaterial(
    project: BmProject,
    editing?: BmProjectMaterial | null,
  ): void {
    if (this.projectMaterialForm.invalid) {
      this.projectMaterialForm.markAllAsTouched();
      return;
    }

    const payload: any = this.projectMaterialForm.getRawValue();
    payload.quantity = this.formatInt(payload.quantity ?? 0);
    if (payload.unit_cost_override !== null) {
      payload.unit_cost_override = this.formatInt(payload.unit_cost_override);
    }
    if (payload.sell_cost_override !== null) {
      payload.sell_cost_override = this.formatInt(payload.sell_cost_override);
    }
    const materialId = editing?.materialId || payload.material_id;
    delete payload.material_id;

    if (!materialId) return;

    this.store.dispatch(
      ManagerProjectsActions.saveProjectMaterial({
        projectId: project.projectId,
        materialId,
        payload,
      }),
    );
  }

  removeProjectMaterial(project: BmProject, material: BmProjectMaterial): void {
    const ok = window.confirm(
      `Remove material "${material.materialName}" from this project?`,
    );
    if (!ok) return;

    this.store.dispatch(
      ManagerProjectsActions.removeProjectMaterial({
        projectId: project.projectId,
        materialId: material.materialId,
      }),
    );
  }

  openLaborCreate(): void {
    this.store.dispatch(ManagerProjectsActions.openProjectLaborCreate());
  }

  openLaborEdit(labor: BmProjectLabor): void {
    this.store.dispatch(
      ManagerProjectsActions.openProjectLaborEdit({ laborId: labor.laborId }),
    );
  }

  closeLaborForm(): void {
    this.store.dispatch(ManagerProjectsActions.closeProjectLaborForm());
  }

  saveProjectLabor(project: BmProject, editing?: BmProjectLabor | null): void {
    if (this.projectLaborForm.invalid) {
      this.projectLaborForm.markAllAsTouched();
      return;
    }

    const payload: any = this.projectLaborForm.getRawValue();
    payload.quantity = this.formatInt(payload.quantity ?? 0);
    if (payload.unit_cost_override !== null) {
      payload.unit_cost_override = this.formatInt(payload.unit_cost_override);
    }
    if (payload.sell_cost_override !== null) {
      payload.sell_cost_override = this.formatInt(payload.sell_cost_override);
    }
    const laborId = editing?.laborId || payload.labor_id;
    delete payload.labor_id;

    if (!laborId) return;

    this.store.dispatch(
      ManagerProjectsActions.saveProjectLabor({
        projectId: project.projectId,
        laborId,
        payload,
      }),
    );
  }

  removeProjectLabor(project: BmProject, labor: BmProjectLabor): void {
    const ok = window.confirm(
      `Remove labor "${labor.laborName}" from this project?`,
    );
    if (!ok) return;

    this.store.dispatch(
      ManagerProjectsActions.removeProjectLabor({
        projectId: project.projectId,
        laborId: labor.laborId,
      }),
    );
  }

  trackByProject(_: number, item: BmProject): string {
    return item.projectId;
  }

  trackByMaterial(_: number, item: BmProjectMaterial): string {
    return item.materialId;
  }

  trackByLabor(_: number, item: BmProjectLabor): string {
    return item.laborId;
  }

  private loadSelectOptions(): void {
    this.managerService
      .listClients({ page: 1, limit: 200, status: 'active' })
      .pipe(takeUntil(this.destroy$))
      .subscribe((res) => {
        this.clientsCatalog = res?.clients ?? [];
        this.clientOptions = this.clientsCatalog.map((c) => ({
          value: c.clientId,
          label: c.clientName,
        }));
        const currentId = this.projectForm.controls.client_id.value;
        if (currentId) {
          const match = this.clientsCatalog.find(
            (c) => c.clientId === currentId,
          );
          if (match) {
            this.clientSearchCtrl.setValue(match.clientName, {
              emitEvent: false,
            });
          }
        }
      });

    this.pricingService
      .listPricingProfiles({ page: 1, limit: 200, status: 'active' })
      .pipe(takeUntil(this.destroy$))
      .subscribe((res) => {
        this.pricingOptions = (res?.items ?? []).map((p) => ({
          value: p.pricingProfileId,
          label: p.profileName,
        }));
      });

    this.suppliersService
      .listSuppliers({ page: 1, limit: 200, status: 'active' })
      .pipe(takeUntil(this.destroy$))
      .subscribe((res) => {
        this.suppliersCatalog = res?.items ?? [];
        const currentSupplierId =
          this.projectMaterialForm.controls.supplier_id.value;
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

    this.laborService
      .listLabor({ page: 1, limit: 200 })
      .pipe(takeUntil(this.destroy$))
      .subscribe((res) => {
        this.laborCatalog = (res?.items ?? []).map((l) => ({
          laborId: l.laborId,
          laborName: l.laborName,
          unitCost: l.unitCost ?? null,
          sellCost: l.sellCost ?? null,
        }));
        this.laborOptions = this.laborCatalog.map((l) => ({
          value: l.laborId,
          label: l.laborName,
        }));
        const currentLaborId = this.projectLaborForm.controls.labor_id.value;
        if (currentLaborId && !this.laborSearchCtrl.value) {
          const match = this.laborCatalog.find(
            (l) => l.laborId === currentLaborId,
          );
          if (match) {
            this.laborSearchCtrl.setValue(match.laborName, {
              emitEvent: false,
            });
          }
        }
      });
  }

  private setupInfiniteScroll(): void {
    const sentinel = this.infiniteSentinelRef?.nativeElement;
    const list = this.projectsListRef?.nativeElement;
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
      ManagerProjectsActions.loadProjects({ page: this.currentPage + 1 }),
    );
  }

  private updateClientSuggestions(query: string): void {
    const q = query.toLowerCase();
    if (!q) {
      this.clientSuggestions = [];
      this.clientActiveIndex = -1;
      return;
    }
    this.clientSuggestions = this.clientsCatalog
      .filter((c) => c.clientName?.toLowerCase().includes(q))
      .slice(0, 12);
    this.clientActiveIndex = this.clientSuggestions.length ? 0 : -1;
  }
}
