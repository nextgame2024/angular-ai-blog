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
import { HttpClient } from '@angular/common/http';
import { Store } from '@ngrx/store';
import { BehaviorSubject, combineLatest, Observable, Subject } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  map,
  startWith,
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
import type { BmPricingProfile } from '../../types/pricing.interface';
import { ProjectFormTab } from '../../store/projects/manager.state';
import { ManagerSelectComponent } from '../shared/manager-select/manager-select.component';
import { ManagerService } from '../../services/manager.service';
import { ManagerSuppliersService } from '../../services/manager.suppliers.service';
import { ManagerLaborService } from '../../services/manager.labor.service';
import { ManagerPricingService } from '../../services/manager.pricing.service';
import { ManagerProjectTypesService } from '../../services/manager.project.types.service';
import type { ManagerSelectOption } from '../shared/manager-select/manager-select.component';
import { ManagerProjectsService } from '../../services/manager.projects.service';
import { environment } from '../../../../environments/environment';

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
  isQuoteLoading = false;

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
  materialsCost$!: Observable<number>;
  laborCost$!: Observable<number>;
  netMaterialsCost$!: Observable<number>;
  netLaborCost$!: Observable<number>;
  private previewMaterials$ = new BehaviorSubject<BmProjectMaterial[]>([]);
  private previewLabor$ = new BehaviorSubject<BmProjectLabor[]>([]);

  statusOptions: ManagerSelectOption[] = [
    { value: 'to_do', label: 'To do' },
    { value: 'in_progress', label: 'In progress' },
    { value: 'quote_approved', label: 'Quote approved' },
    { value: 'invoice_process', label: 'Invoice process' },
    { value: 'done', label: 'Done' },
    { value: 'on_hold', label: 'On hold' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'archived', label: 'Archived' },
  ];

  clientOptions: ManagerSelectOption[] = [];
  pricingOptions: ManagerSelectOption[] = [];
  projectTypeOptions: ManagerSelectOption[] = [];
  private pricingProfiles$ = new BehaviorSubject<BmPricingProfile[]>([]);
  private defaultPricing$ = new BehaviorSubject<boolean>(false);
  private suppressStatusUpdate = false;
  private statusBeforeHold: string | null = null;
  private currentStatus: string | null = null;
  isStatusModalOpen = false;
  statusModalTitle = '';
  statusModalMessage = '';
  statusModalConfirmLabel = 'Continue';
  statusModalCancelLabel = 'Cancel';
  statusModalShowCancel = false;
  statusModalTone: 'info' | 'warning' | 'danger' = 'info';
  private statusModalConfirmAction: (() => void) | null = null;
  private statusModalCancelAction: (() => void) | null = null;
  materialOptions: ManagerSelectOption[] = [];
  laborOptions: ManagerSelectOption[] = [];
  laborCatalog: {
    laborId: string;
    laborName: string;
    unitType?: string | null;
    unitProductivity?: number | null;
    productivityUnit?: string | null;
    unitCost?: number | null;
    sellCost?: number | null;
  }[] = [];
  laborSearchCtrl: FormControl<string>;
  laborSuggestions: {
    laborId: string;
    laborName: string;
    unitType?: string | null;
    unitProductivity?: number | null;
    productivityUnit?: string | null;
    unitCost?: number | null;
    sellCost?: number | null;
  }[] = [];
  showLaborSuggestions = false;
  laborActiveIndex = -1;
  clientsCatalog: { clientId: string; clientName: string }[] = [];
  suppliersCatalog: { supplierId: string; supplierName: string }[] = [];
  supplierMaterialsCatalog: {
    materialId: string;
    materialName: string;
    materialCode?: string | null;
    unit?: string | null;
    quantity?: number | null;
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
    unit?: string | null;
    quantity?: number | null;
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
    project_type_id: new FormControl<string | null>(null),
    project_name: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    meters_required: new FormControl<number | null>(null),
    description: new FormControl<string>('', { nonNullable: true }),
    status: new FormControl<string>('to_do', { nonNullable: true }),
    cost_in_quote: new FormControl<boolean>(false, { nonNullable: true }),
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
    unit: new FormControl<string>('', { nonNullable: true }),
    coverage_ratio: new FormControl<string>('', { nonNullable: true }),
    coverage_unit: new FormControl<string>('', { nonNullable: true }),
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
    unit_type: new FormControl<string>('', { nonNullable: true }),
    unit_productivity: new FormControl<string>('', { nonNullable: true }),
    productivity_unit: new FormControl<string>('', { nonNullable: true }),
    unit_cost_override: new FormControl<number | null>(null),
    sell_cost_override: new FormControl<number | null>(null),
    notes: new FormControl<string>('', { nonNullable: true }),
  });

  editingProject: BmProject | null = null;
  editingMaterial: BmProjectMaterial | null = null;
  editingLabor: BmProjectLabor | null = null;
  dismissedErrors = new Set<string>();
  dismissedWarnings = new Set<string>();

  @ViewChild('projectsList') projectsListRef?: ElementRef<HTMLElement>;
  @ViewChild('infiniteSentinel') infiniteSentinelRef?: ElementRef<HTMLElement>;

  private currentPage = 1;
  private canLoadMore = false;
  private suppressProjectTypeApply = false;
  private lastProjectId: string | null = null;

  constructor(
    private store: Store,
    private fb: FormBuilder,
    private managerService: ManagerService,
    private projectsService: ManagerProjectsService,
    private laborService: ManagerLaborService,
    private pricingService: ManagerPricingService,
    private projectTypesService: ManagerProjectTypesService,
    private suppliersService: ManagerSuppliersService,
    private http: HttpClient,
  ) {
    this.searchCtrl = new FormControl('', { nonNullable: true });
    this.clientSearchCtrl = new FormControl('', { nonNullable: true });
    this.supplierSearchCtrl = new FormControl('', { nonNullable: true });
    this.materialSearchCtrl = new FormControl('', { nonNullable: true });
    this.laborSearchCtrl = new FormControl('', { nonNullable: true });
  }

  ngOnInit(): void {
    this.store.dispatch(ManagerProjectsActions.loadProjects({ page: 1 }));
    this.defaultPricing$.next(this.projectForm.controls.default_pricing.value);

    const pricingProfileId$ =
      this.projectForm.controls.pricing_profile_id.valueChanges.pipe(
        startWith(this.projectForm.controls.pricing_profile_id.value),
      );
    const projectTypeId$ =
      this.projectForm.controls.project_type_id.valueChanges.pipe(
        startWith(this.projectForm.controls.project_type_id.value),
      );
    const metersRequired$ =
      this.projectForm.controls.meters_required.valueChanges.pipe(
        startWith(this.projectForm.controls.meters_required.value),
      );

    this.materialsCost$ = combineLatest([
      this.materials$,
      this.previewMaterials$,
      this.editingProject$,
      this.defaultPricing$,
      pricingProfileId$,
      this.pricingProfiles$,
      projectTypeId$,
      metersRequired$,
    ]).pipe(
      map(
        ([
          materials,
          preview,
          project,
          useDefault,
          profileId,
          profiles,
          projectTypeId,
          metersRequired,
        ]) => {
        const effectiveProfileId =
          profileId || project?.pricingProfileId || null;
        const effectiveProjectTypeId =
          projectTypeId || project?.projectTypeId || null;
        const effectiveMetersRequired =
          metersRequired ?? project?.metersRequired ?? null;
        return this.calculateMaterialsCost(
          project ? materials : preview,
          useDefault,
          effectiveProfileId,
          profiles,
          effectiveProjectTypeId,
          effectiveMetersRequired,
        );
        },
      ),
    );

    this.laborCost$ = combineLatest([
      this.labor$,
      this.previewLabor$,
      this.editingProject$,
      this.defaultPricing$,
      pricingProfileId$,
      this.pricingProfiles$,
      projectTypeId$,
      metersRequired$,
    ]).pipe(
      map(
        ([
          labor,
          preview,
          project,
          useDefault,
          profileId,
          profiles,
          projectTypeId,
          metersRequired,
        ]) => {
        const effectiveProfileId =
          profileId || project?.pricingProfileId || null;
        const effectiveProjectTypeId =
          projectTypeId || project?.projectTypeId || null;
        const effectiveMetersRequired =
          metersRequired ?? project?.metersRequired ?? null;
        return this.calculateLaborCost(
          project ? labor : preview,
          useDefault,
          effectiveProfileId,
          profiles,
          effectiveProjectTypeId,
          effectiveMetersRequired,
        );
        },
      ),
    );

    this.netMaterialsCost$ = combineLatest([
      this.materials$,
      this.previewMaterials$,
      this.editingProject$,
      projectTypeId$,
      metersRequired$,
    ]).pipe(
      map(([materials, preview, project, projectTypeId, metersRequired]) => {
        const effectiveProjectTypeId =
          projectTypeId || project?.projectTypeId || null;
        const effectiveMetersRequired =
          metersRequired ?? project?.metersRequired ?? null;
        return this.calculateNetMaterialsCost(
          project ? materials : preview,
          effectiveProjectTypeId,
          effectiveMetersRequired,
        );
      }),
    );

    this.netLaborCost$ = combineLatest([
      this.labor$,
      this.previewLabor$,
      this.editingProject$,
      projectTypeId$,
      metersRequired$,
    ]).pipe(
      map(([labor, preview, project, projectTypeId, metersRequired]) => {
        const effectiveProjectTypeId =
          projectTypeId || project?.projectTypeId || null;
        const effectiveMetersRequired =
          metersRequired ?? project?.metersRequired ?? null;
        return this.calculateNetLaborCost(
          project ? labor : preview,
          effectiveProjectTypeId,
          effectiveMetersRequired,
        );
      }),
    );

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

    this.projectForm.controls.status.valueChanges
      .pipe(distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((nextStatus) => {
        if (this.suppressStatusUpdate) return;
        this.handleStatusChange(nextStatus);
      });

    this.projectForm.controls.project_type_id.valueChanges
      .pipe(distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((projectTypeId) => {
        if (this.suppressProjectTypeApply) return;
        const normalizedProjectTypeId = projectTypeId || null;
        const project = this.editingProject;
        if (project?.projectId && normalizedProjectTypeId) {
          this.applyProjectType(project.projectId, normalizedProjectTypeId);
          return;
        }
        if (!project?.projectId) {
          if (!normalizedProjectTypeId) {
            this.previewMaterials$.next([]);
            this.previewLabor$.next([]);
            return;
          }
          this.loadProjectTypePreview(normalizedProjectTypeId);
        }
      });

    this.editingProject$.pipe(takeUntil(this.destroy$)).subscribe((project) => {
      this.editingProject = project ?? null;
      if (project) {
        const hasProjectChanged = this.lastProjectId !== project.projectId;
        this.lastProjectId = project.projectId;
        if (hasProjectChanged || !this.projectForm.dirty) {
          this.suppressProjectTypeApply = true;
          this.suppressStatusUpdate = true;
          this.projectForm.reset({
            client_id: project.clientId,
            project_type_id: project.projectTypeId ?? null,
            project_name: project.projectName,
            meters_required: this.formatMoney(project.metersRequired ?? null),
            description: project.description ?? '',
          status: project.status ?? 'to_do',
          cost_in_quote: project.costInQuote ?? false,
          default_pricing: project.defaultPricing ?? false,
          pricing_profile_id: project.pricingProfileId ?? null,
          });
          this.useDefaultPricing = project.defaultPricing ?? false;
          this.defaultPricing$.next(this.useDefaultPricing);
          this.currentStatus = project.status ?? 'to_do';
          this.statusBeforeHold = project.statusBeforeHold ?? null;
          this.suppressStatusUpdate = false;
          // Ensure default pricing toggle + cost streams are in sync on first load.
          this.projectForm.controls.default_pricing.setValue(
            this.useDefaultPricing,
            { emitEvent: true },
          );
          if (this.useDefaultPricing) {
            this.projectForm.controls.pricing_profile_id.setValue(null, {
              emitEvent: true,
            });
          }
          this.clientSearchCtrl.setValue(project.clientName || '', {
            emitEvent: false,
          });
          this.suppressProjectTypeApply = false;
        }
        this.store.dispatch(
          ManagerProjectsActions.loadProjectMaterials({
            projectId: project.projectId,
          }),
        );
        this.store.dispatch(
          ManagerProjectsActions.loadProjectLabor({
            projectId: project.projectId,
          }),
        );
        this.previewMaterials$.next([]);
        this.previewLabor$.next([]);
      } else {
        this.lastProjectId = null;
        this.suppressStatusUpdate = true;
        this.projectForm.reset({
          client_id: '',
          project_type_id: null,
          project_name: '',
          meters_required: null,
          description: '',
          status: 'to_do',
          cost_in_quote: false,
          default_pricing: false,
          pricing_profile_id: null,
        });
        this.useDefaultPricing = false;
        this.defaultPricing$.next(false);
        this.currentStatus = 'to_do';
        this.statusBeforeHold = null;
        this.clientSearchCtrl.setValue('', { emitEvent: false });
        this.suppressStatusUpdate = false;
        this.previewMaterials$.next([]);
        this.previewLabor$.next([]);
      }
    });

    this.editingMaterial$.pipe(takeUntil(this.destroy$)).subscribe((mat) => {
      this.editingMaterial = mat;
      if (mat) {
        this.projectMaterialForm.reset({
          supplier_id: mat.supplierId ?? '',
          material_id: mat.materialId,
          unit: mat.unit ?? '',
          coverage_ratio: this.formatCoverageDisplay(mat.coverageRatio ?? null),
          coverage_unit: mat.coverageUnit ?? '',
          quantity: this.formatQuantity(mat.quantity ?? 1) ?? 1,
          unit_cost_override: this.formatMoney(mat.unitCostOverride ?? null),
          sell_cost_override: this.formatMoney(mat.sellCostOverride ?? null),
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
          unit: '',
          coverage_ratio: '',
          coverage_unit: '',
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
          unit_type: labor.unitType ?? '',
          unit_productivity: this.formatProductivityDisplay(
            labor.unitProductivity ?? null,
          ),
          productivity_unit: labor.productivityUnit ?? '',
          unit_cost_override: this.formatMoney(labor.unitCostOverride ?? null),
          sell_cost_override: this.formatMoney(labor.sellCostOverride ?? null),
          notes: labor.notes ?? '',
        });
        this.laborSearchCtrl.setValue(labor.laborName || '', {
          emitEvent: false,
        });
      } else {
        this.projectLaborForm.reset({
          labor_id: '',
          unit_type: '',
          unit_productivity: '',
          productivity_unit: '',
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
    if (payload.meters_required !== null && payload.meters_required !== undefined) {
      payload.meters_required = this.formatMoney(payload.meters_required);
    }
    if (!payload.project_type_id) {
      payload.project_type_id = null;
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
    if (payload.meters_required !== null && payload.meters_required !== undefined) {
      payload.meters_required = this.formatMoney(payload.meters_required);
    }
    if (!payload.project_type_id) {
      payload.project_type_id = null;
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
    this.defaultPricing$.next(value);
    this.projectForm.controls.default_pricing.setValue(value);
    if (value) {
      this.projectForm.controls.pricing_profile_id.setValue(null);
    }
  }

  get costInQuote(): boolean {
    return !!this.projectForm.controls.cost_in_quote.value;
  }

  formatQuantity(value?: number | null): number | null {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    if (Number.isNaN(num)) return null;
    return Math.round(num);
  }

  formatMoney(value?: number | null): number | null {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    if (Number.isNaN(num)) return null;
    return Math.round(num * 100) / 100;
  }

  private formatCoverage(
    value: number | string | null | undefined,
  ): number | null {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    if (Number.isNaN(num)) return null;
    return Math.round(num * 100) / 100;
  }

  private formatCoverageDisplay(
    value: number | string | null | undefined,
  ): string {
    if (value === null || value === undefined || value === '') return '';
    const num = Number(value);
    if (Number.isNaN(num)) return '';
    return num.toFixed(2);
  }

  formatCoverageControl(): void {
    const control = this.projectMaterialForm.controls.coverage_ratio;
    control.setValue(this.formatCoverageDisplay(control.value), {
      emitEvent: false,
    });
  }

  getCostPerUnit(): string {
    const qtyRaw = this.projectMaterialForm.controls.quantity.value;
    const unitCostRaw =
      this.projectMaterialForm.controls.unit_cost_override.value;
    const qty = Number(qtyRaw ?? 0);
    const unitCost = Number(unitCostRaw ?? 0);
    if (!qty || !Number.isFinite(qty) || !Number.isFinite(unitCost)) return '0.00';
    return (unitCost / qty).toFixed(2);
  }

  private formatProductivity(
    value: number | string | null | undefined,
  ): number | null {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    if (Number.isNaN(num)) return null;
    return Math.round(num * 100) / 100;
  }

  private formatProductivityDisplay(
    value: number | string | null | undefined,
  ): string {
    if (value === null || value === undefined || value === '') return '';
    const num = Number(value);
    if (Number.isNaN(num)) return '';
    return num.toFixed(2);
  }

  formatProductivityControl(): void {
    const control = this.projectLaborForm.controls.unit_productivity;
    control.setValue(this.formatProductivityDisplay(control.value), {
      emitEvent: false,
    });
  }

  private applyProjectType(projectId: string, projectTypeId: string): void {
    this.projectsService
      .updateProject(projectId, { project_type_id: projectTypeId })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res?.project) {
            this.store.dispatch(
              ManagerProjectsActions.saveProjectSuccess({
                project: res.project,
                closeOnSuccess: false,
              }),
            );
          }
          this.store.dispatch(
            ManagerProjectsActions.loadProjectMaterials({ projectId }),
          );
          this.store.dispatch(
            ManagerProjectsActions.loadProjectLabor({ projectId }),
          );
        },
      });
  }

  private loadProjectTypePreview(projectTypeId: string): void {
    this.projectTypesService
      .listProjectTypeMaterials(projectTypeId)
      .pipe(takeUntil(this.destroy$))
      .subscribe((res) => {
        const materials =
          res?.materials?.map((m) => ({
            projectId: 'preview',
            materialId: m.materialId,
            supplierId: m.supplierId ?? null,
            supplierName: m.supplierName ?? null,
            materialName: m.materialName || '',
            unit: m.unit ?? null,
            coverageRatio: m.coverageRatio ?? null,
            coverageUnit: m.coverageUnit ?? null,
            quantity: m.quantity ?? 1,
            unitCostOverride: m.unitCostOverride ?? null,
            sellCostOverride: m.sellCostOverride ?? null,
            notes: m.notes ?? null,
          })) ?? [];
        this.previewMaterials$.next(materials);
      });

    this.projectTypesService
      .listProjectTypeLabor(projectTypeId)
      .pipe(takeUntil(this.destroy$))
      .subscribe((res) => {
        const labor =
          res?.labor?.map((l) => ({
            projectId: 'preview',
            laborId: l.laborId,
            laborName: l.laborName || '',
            unitType: l.unitType ?? null,
            unitProductivity: l.unitProductivity ?? null,
            productivityUnit: l.productivityUnit ?? null,
            quantity: 1,
            unitCostOverride: l.unitCostOverride ?? null,
            sellCostOverride: l.sellCostOverride ?? null,
            notes: l.notes ?? null,
          })) ?? [];
        this.previewLabor$.next(labor);
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
    this.projectMaterialForm.controls.material_id.setValue('');
    this.projectMaterialForm.controls.quantity.setValue(1);
    if (!value) {
      this.projectMaterialForm.controls.unit_cost_override.setValue(null, {
        emitEvent: false,
      });
      this.projectMaterialForm.controls.sell_cost_override.setValue(null, {
        emitEvent: false,
      });
      this.projectMaterialForm.controls.unit.setValue('', { emitEvent: false });
      this.projectMaterialForm.controls.coverage_ratio.setValue('', {
        emitEvent: false,
      });
      this.projectMaterialForm.controls.coverage_unit.setValue('', {
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
    unit?: string | null;
    quantity?: number | null;
    unitCost?: number | null;
    sellCost?: number | null;
  }): void {
    this.projectMaterialForm.controls.material_id.setValue(material.materialId);
    this.materialSearchCtrl.setValue(material.materialName, {
      emitEvent: false,
    });
    this.projectMaterialForm.controls.unit_cost_override.setValue(
      this.formatMoney(material.unitCost ?? null),
      { emitEvent: false },
    );
    this.projectMaterialForm.controls.sell_cost_override.setValue(
      this.formatMoney(material.sellCost ?? null),
      { emitEvent: false },
    );
    if (material.unit !== null && material.unit !== undefined) {
      this.projectMaterialForm.controls.unit.setValue(material.unit);
    }
    if (material.quantity !== null && material.quantity !== undefined) {
      this.projectMaterialForm.controls.quantity.setValue(
        this.formatQuantity(material.quantity) ?? 1,
        { emitEvent: false },
      );
    }
    this.showMaterialSuggestions = false;
    this.materialActiveIndex = -1;
  }

  formatStatus(status?: string | null): string {
    const match = this.statusOptions.find((opt) => opt.value === status);
    return match?.label ?? (status || 'To do');
  }

  get statusSelectOptions(): ManagerSelectOption[] {
    const current =
      this.projectForm.controls.status.value ||
      this.currentStatus ||
      'to_do';
    const prevHold = this.statusBeforeHold;

    if (current === 'done' || current === 'cancelled') {
      return this.statusOptions;
    }

    if (current === 'on_hold') {
      if (prevHold) {
        return this.statusOptions.filter(
          (opt) =>
            opt.value === 'on_hold' ||
            opt.value === prevHold ||
            opt.value === 'cancelled',
        );
      }
      return this.statusOptions;
    }

    const allowedMap: Record<string, string[]> = {
      to_do: ['to_do', 'in_progress', 'quote_approved', 'on_hold', 'cancelled'],
      in_progress: ['in_progress', 'quote_approved', 'on_hold', 'cancelled'],
      quote_approved: [
        'quote_approved',
        'invoice_process',
        'on_hold',
        'cancelled',
      ],
      invoice_process: ['invoice_process', 'done', 'on_hold', 'cancelled'],
    };
    const allowed = allowedMap[current] ?? [current];
    return this.statusOptions.filter((opt) => allowed.includes(opt.value));
  }

  private handleStatusChange(nextStatus: string | null): void {
    if (!nextStatus) return;
    const current = this.currentStatus || nextStatus;
    if (current === nextStatus) return;

    const locked =
      current === 'done' || current === 'cancelled' || current === 'archived';
    if (locked) {
      this.openStatusInfoModal({
        title: 'Status Locked',
        message: 'Status cannot be changed once it is Done or Cancelled.',
        tone: 'warning',
        onConfirm: () => this.revertStatus(current),
      });
      return;
    }

    if (nextStatus === 'done' || nextStatus === 'cancelled') {
      const title =
        nextStatus === 'done' ? 'Mark As Done?' : 'Cancel Project?';
      this.openStatusConfirmModal({
        title,
        message: 'Once set, this status cannot be changed. Continue?',
        tone: 'danger',
        confirmLabel: 'Yes, continue',
        onConfirm: () => {
          this.statusBeforeHold = null;
          this.currentStatus = nextStatus;
        },
        onCancel: () => this.revertStatus(current),
      });
      return;
    }

    if (current === 'on_hold' && nextStatus !== 'on_hold') {
      if (
        nextStatus !== 'cancelled' &&
        this.statusBeforeHold &&
        nextStatus !== this.statusBeforeHold
      ) {
        this.openStatusInfoModal({
          title: 'Status Restricted',
          message: `Status can only return to ${this.formatStatus(
            this.statusBeforeHold,
          )} after On hold.`,
          tone: 'warning',
          onConfirm: () => this.revertStatus(current),
        });
        return;
      }
      this.statusBeforeHold = null;
      this.currentStatus = nextStatus;
      return;
    }

    if (nextStatus === 'on_hold' && current !== 'on_hold') {
      this.statusBeforeHold = current;
      this.currentStatus = nextStatus;
      return;
    }

    const allowedMap: Record<string, string[]> = {
      to_do: ['in_progress', 'quote_approved', 'on_hold', 'cancelled'],
      in_progress: ['quote_approved', 'on_hold', 'cancelled'],
      quote_approved: ['invoice_process', 'on_hold', 'cancelled'],
      invoice_process: ['done', 'on_hold', 'cancelled'],
    };
    const allowed = allowedMap[current] ?? [];
    if (!allowed.includes(nextStatus) && nextStatus !== current) {
      this.openStatusInfoModal({
        title: 'Invalid Transition',
        message: 'This status change is not allowed.',
        tone: 'warning',
        onConfirm: () => this.revertStatus(current),
      });
      return;
    }

    this.currentStatus = nextStatus;
  }

  private openStatusInfoModal(options: {
    title: string;
    message: string;
    tone?: 'info' | 'warning' | 'danger';
    confirmLabel?: string;
    onConfirm?: () => void;
  }): void {
    this.statusModalTitle = options.title;
    this.statusModalMessage = options.message;
    this.statusModalTone = options.tone ?? 'info';
    this.statusModalConfirmLabel = options.confirmLabel ?? 'OK';
    this.statusModalCancelLabel = 'Cancel';
    this.statusModalShowCancel = false;
    this.statusModalConfirmAction = options.onConfirm ?? null;
    this.statusModalCancelAction = null;
    this.isStatusModalOpen = true;
  }

  private openStatusConfirmModal(options: {
    title: string;
    message: string;
    tone?: 'info' | 'warning' | 'danger';
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel?: () => void;
  }): void {
    this.statusModalTitle = options.title;
    this.statusModalMessage = options.message;
    this.statusModalTone = options.tone ?? 'info';
    this.statusModalConfirmLabel = options.confirmLabel ?? 'Continue';
    this.statusModalCancelLabel = options.cancelLabel ?? 'Cancel';
    this.statusModalShowCancel = true;
    this.statusModalConfirmAction = options.onConfirm;
    this.statusModalCancelAction = options.onCancel ?? null;
    this.isStatusModalOpen = true;
  }

  onStatusModalConfirm(): void {
    const action = this.statusModalConfirmAction;
    this.closeStatusModal();
    if (action) {
      action();
    }
  }

  onStatusModalCancel(): void {
    const action = this.statusModalCancelAction;
    this.closeStatusModal();
    if (action) {
      action();
    }
  }

  onStatusModalBackdrop(): void {
    if (this.statusModalShowCancel) {
      this.onStatusModalCancel();
    } else {
      this.onStatusModalConfirm();
    }
  }

  private closeStatusModal(): void {
    this.isStatusModalOpen = false;
    this.statusModalConfirmAction = null;
    this.statusModalCancelAction = null;
  }

  private revertStatus(status: string): void {
    this.suppressStatusUpdate = true;
    this.projectForm.controls.status.setValue(status, { emitEvent: false });
    this.suppressStatusUpdate = false;
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
      const clientControl = this.projectForm.controls.client_id;
      if (!clientControl.value) {
        const query = (this.clientSearchCtrl.value || '').trim().toLowerCase();
        if (query.length) {
          const exact = this.clientsCatalog.find(
            (c) => (c.clientName || '').toLowerCase() === query,
          );
          if (exact) {
            this.onClientSelect(exact);
          } else {
            clientControl.setErrors({ invalidSelection: true });
            clientControl.markAsTouched();
          }
        }
      }
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
    const clientControl = this.projectForm.controls.client_id;
    clientControl.setValue('');
    if (clientControl.hasError('invalidSelection')) {
      clientControl.setErrors(null);
    }
    this.updateClientSuggestions(query);
    this.showClientSuggestions =
      query.length > 0 && this.clientSuggestions.length > 0;
  }

  onClientSelect(client: { clientId: string; clientName: string }): void {
    const clientControl = this.projectForm.controls.client_id;
    clientControl.setValue(client.clientId);
    if (clientControl.hasError('invalidSelection')) {
      clientControl.setErrors(null);
    }
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
    this.projectMaterialForm.controls.unit.setValue('', { emitEvent: false });
    this.projectMaterialForm.controls.coverage_ratio.setValue('', {
      emitEvent: false,
    });
    this.projectMaterialForm.controls.coverage_unit.setValue('', {
      emitEvent: false,
    });
    this.projectMaterialForm.controls.quantity.setValue(1, { emitEvent: false });
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
      this.projectLaborForm.controls.unit_type.setValue('', {
        emitEvent: false,
      });
      this.projectLaborForm.controls.unit_productivity.setValue('', {
        emitEvent: false,
      });
      this.projectLaborForm.controls.productivity_unit.setValue('', {
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
    unitType?: string | null;
    unitProductivity?: number | null;
    productivityUnit?: string | null;
    unitCost?: number | null;
    sellCost?: number | null;
  }): void {
    this.projectLaborForm.controls.labor_id.setValue(labor.laborId);
    this.laborSearchCtrl.setValue(labor.laborName, { emitEvent: false });
    this.projectLaborForm.controls.unit_cost_override.setValue(
      this.formatMoney(labor.unitCost ?? null),
      { emitEvent: false },
    );
    this.projectLaborForm.controls.sell_cost_override.setValue(
      this.formatMoney(labor.sellCost ?? null),
      { emitEvent: false },
    );
    if (labor.unitType !== null && labor.unitType !== undefined) {
      this.projectLaborForm.controls.unit_type.setValue(labor.unitType ?? '');
    }
    if (labor.unitProductivity !== null && labor.unitProductivity !== undefined) {
      this.projectLaborForm.controls.unit_productivity.setValue(
        this.formatProductivityDisplay(labor.unitProductivity ?? null),
        { emitEvent: false },
      );
    }
    if (labor.productivityUnit !== null && labor.productivityUnit !== undefined) {
      this.projectLaborForm.controls.productivity_unit.setValue(
        labor.productivityUnit ?? '',
        { emitEvent: false },
      );
    }
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
          unit: m.unit ?? null,
          quantity: m.quantity ?? null,
          unitCost: m.unitCost ?? null,
          sellCost: m.sellCost ?? null,
        }));
        const query = (this.materialSearchCtrl.value || '').trim();
        if (query.length) {
          this.updateMaterialSuggestions(query);
        }
      });
  }

  removeProject(project: BmProject): void {
    const hasProjects = !!project.hasProjects;
    this.openStatusConfirmModal({
      title: hasProjects ? 'Archive Project?' : 'Delete Project?',
      message: hasProjects
        ? `Are you sure you want to archive "${project.projectName}"?`
        : `Are you sure you want to delete "${project.projectName}"?`,
      tone: hasProjects ? 'warning' : 'danger',
      confirmLabel: hasProjects ? 'Archive' : 'Delete',
      onConfirm: () =>
        this.store.dispatch(
          ManagerProjectsActions.removeProject({ projectId: project.projectId }),
        ),
    });
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
    payload.quantity = this.formatQuantity(payload.quantity ?? 0);
    payload.coverage_ratio = this.formatCoverage(payload.coverage_ratio);
    if (payload.unit_cost_override !== null) {
      payload.unit_cost_override = this.formatMoney(payload.unit_cost_override);
    }
    if (payload.sell_cost_override !== null) {
      payload.sell_cost_override = this.formatMoney(payload.sell_cost_override);
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
    this.openStatusConfirmModal({
      title: 'Delete Material?',
      message: `Are you sure you want to delete "${material.materialName}"?`,
      tone: 'danger',
      confirmLabel: 'Delete',
      onConfirm: () =>
        this.store.dispatch(
          ManagerProjectsActions.removeProjectMaterial({
            projectId: project.projectId,
            materialId: material.materialId,
          }),
        ),
    });
  }

  openLaborCreate(): void {
    this.projectLaborForm.reset({
      labor_id: '',
      unit_type: '',
      unit_productivity: '',
      productivity_unit: '',
      unit_cost_override: null,
      sell_cost_override: null,
      notes: '',
    });
    this.laborSearchCtrl.setValue('', { emitEvent: false });
    this.laborSuggestions = [];
    this.showLaborSuggestions = false;
    this.laborActiveIndex = -1;
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

  quoteProject(project: BmProject | null): void {
    if (!project?.projectId) return;
    this.isQuoteLoading = true;
    this.projectsService
      .createDocumentFromProject(project.projectId, { type: 'quote' })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          const documentId = res?.document?.documentId;
          if (!documentId) {
            this.isQuoteLoading = false;
            return;
          }
          if (project.status !== 'quote_approved') {
            this.projectsService
              .updateProject(project.projectId, { status: 'quote_approved' })
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: (updateRes) => {
                  if (updateRes?.project) {
                    this.store.dispatch(
                      ManagerProjectsActions.saveProjectSuccess({
                        project: updateRes.project,
                        closeOnSuccess: false,
                      }),
                    );
                  }
                },
              });
          }
          this.openQuotePdf(documentId);
        },
        error: () => {
          this.isQuoteLoading = false;
        },
      });
  }

  invoiceProject(project: BmProject | null): void {
    if (!project?.projectId) return;
    if (project.status === 'quote_approved') {
      this.projectsService
        .updateProject(project.projectId, { status: 'invoice_process' })
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (res) => {
            if (res?.project) {
              this.store.dispatch(
                ManagerProjectsActions.saveProjectSuccess({
                  project: res.project,
                  closeOnSuccess: false,
                }),
              );
            }
          },
        });
    }
    this.isQuoteLoading = true;
    this.projectsService
      .createDocumentFromProject(project.projectId, { type: 'invoice' })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          const documentId = res?.document?.documentId;
          if (!documentId) {
            this.isQuoteLoading = false;
            return;
          }
          this.refreshProject(project.projectId);
          const pdfUrl = res?.document?.pdfUrl || res?.document?.pdf_url;
          if (pdfUrl) {
            window.open(pdfUrl, '_blank', 'noopener');
            this.isQuoteLoading = false;
            return;
          }
          this.openInvoicePdf(documentId);
        },
        error: () => {
          this.isQuoteLoading = false;
        },
      });
  }

  openStoredInvoice(project: BmProject | null): void {
    if (!project) return;
    const pdfUrl = project.invoicePdfUrl ?? null;
    if (pdfUrl) {
      window.open(pdfUrl, '_blank', 'noopener');
      return;
    }
    if (project.invoiceDocumentId) {
      this.openInvoicePdf(project.invoiceDocumentId);
    }
  }

  private refreshProject(projectId: string): void {
    this.projectsService
      .getProject(projectId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (!res?.project) return;
          this.store.dispatch(
            ManagerProjectsActions.saveProjectSuccess({
              project: res.project,
              closeOnSuccess: false,
            }),
          );
        },
      });
  }

  private openQuotePdf(documentId: string): void {
    const url = `${environment.apiUrl}/bm/documents/${documentId}/quote-pdf`;
    this.http
      .get(url, { responseType: 'blob' })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          const file = new Blob([blob], { type: 'application/pdf' });
          const objUrl = window.URL.createObjectURL(file);
          window.open(objUrl, '_blank', 'noopener');
          window.setTimeout(() => window.URL.revokeObjectURL(objUrl), 60_000);
        },
        error: () => {
          this.isQuoteLoading = false;
        },
        complete: () => {
          this.isQuoteLoading = false;
        },
      });
  }

  private openInvoicePdf(documentId: string): void {
    const url = `${environment.apiUrl}/bm/documents/${documentId}/invoice-pdf`;
    this.http
      .get(url, { responseType: 'blob' })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          const file = new Blob([blob], { type: 'application/pdf' });
          const objUrl = window.URL.createObjectURL(file);
          window.open(objUrl, '_blank', 'noopener');
          window.setTimeout(() => window.URL.revokeObjectURL(objUrl), 60_000);
        },
        error: () => {
          this.isQuoteLoading = false;
        },
        complete: () => {
          this.isQuoteLoading = false;
        },
      });
  }

  saveProjectLabor(project: BmProject, editing?: BmProjectLabor | null): void {
    if (this.projectLaborForm.invalid) {
      this.projectLaborForm.markAllAsTouched();
      return;
    }

    const payload: any = this.projectLaborForm.getRawValue();
    payload.unit_productivity = this.formatProductivity(
      payload.unit_productivity,
    );
    if (payload.unit_cost_override !== null) {
      payload.unit_cost_override = this.formatMoney(payload.unit_cost_override);
    }
    if (payload.sell_cost_override !== null) {
      payload.sell_cost_override = this.formatMoney(payload.sell_cost_override);
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
    this.openStatusConfirmModal({
      title: 'Delete Labor?',
      message: `Are you sure you want to delete "${labor.laborName}"?`,
      tone: 'danger',
      confirmLabel: 'Delete',
      onConfirm: () =>
        this.store.dispatch(
          ManagerProjectsActions.removeProjectLabor({
            projectId: project.projectId,
            laborId: labor.laborId,
          }),
        ),
    });
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
        const items = res?.items ?? [];
        this.pricingProfiles$.next(items);
        this.pricingOptions = items.map((p) => ({
          value: p.pricingProfileId,
          label: p.profileName,
        }));
        const current = this.projectForm.controls.pricing_profile_id.value;
        if (!current && !this.useDefaultPricing && this.editingProject?.pricingProfileId) {
          this.projectForm.controls.pricing_profile_id.setValue(
            this.editingProject.pricingProfileId,
            { emitEvent: false },
          );
        }
      });

    this.projectTypesService
      .listProjectTypes({ page: 1, limit: 200, status: 'active' })
      .pipe(takeUntil(this.destroy$))
      .subscribe((res) => {
        const items = res?.items ?? [];
        this.projectTypeOptions = [
          { value: '', label: 'Not Selected' },
          ...items.map((pt) => ({
            value: pt.projectTypeId,
            label: pt.name,
          })),
        ];
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
          unitType: l.unitType ?? null,
          unitProductivity: l.unitProductivity ?? null,
          productivityUnit: l.productivityUnit ?? null,
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

  private calculateMaterialsCost(
    materials: BmProjectMaterial[] | null | undefined,
    useDefaultPricing: boolean,
    pricingProfileId: string | null,
    profiles: BmPricingProfile[],
    projectTypeId: string | null,
    metersRequired: number | string | null,
  ): number {
    const items = materials ?? [];
    const useProjectTypeFormula = !!projectTypeId;
    const net = useProjectTypeFormula
      ? this.calculateCoverageNet(items, metersRequired)
      : items.reduce((sum, m) => {
          const qty = Number(m.quantity ?? 1);
          const cost = Number(m.unitCostOverride ?? 0);
          return sum + cost * qty;
        }, 0);
    const sellSum = items.reduce((sum, m) => {
      const qty = Number(m.quantity ?? 1);
      const cost = Number(m.sellCostOverride ?? 0);
      return sum + cost * qty;
    }, 0);
    if (useDefaultPricing) return sellSum;
    const profile = profiles.find((p) => p.pricingProfileId === pricingProfileId);
    const markup = Number(profile?.materialMarkup ?? 0);
    return net * (1 + markup);
  }

  private calculateNetMaterialsCost(
    materials: BmProjectMaterial[] | null | undefined,
    projectTypeId: string | null,
    metersRequired: number | string | null,
  ): number {
    const items = materials ?? [];
    if (projectTypeId) {
      return this.calculateCoverageNet(items, metersRequired);
    }
    return items.reduce((sum, m) => {
      const qty = Number(m.quantity ?? 1);
      const cost = Number(m.unitCostOverride ?? 0);
      return sum + cost * qty;
    }, 0);
  }

  private calculateCoverageNet(
    materials: BmProjectMaterial[],
    metersRequired: number | string | null,
  ): number {
    const meters = Number(metersRequired ?? 0);
    if (!Number.isFinite(meters) || meters <= 0) return 0;
    return materials.reduce((sum, m) => {
      const coverage = Number(m.coverageRatio ?? 0);
      if (!Number.isFinite(coverage) || coverage <= 0) return sum;
      const qty = Number(m.quantity ?? 1);
      const unitCost = Number(m.unitCostOverride ?? 0);
      if (!Number.isFinite(unitCost) || !Number.isFinite(qty) || qty <= 0) {
        return sum;
      }
      const costPerUnit = unitCost / qty;
      return sum + (meters / coverage) * costPerUnit;
    }, 0);
  }

  private calculateLaborCost(
    labor: BmProjectLabor[] | null | undefined,
    useDefaultPricing: boolean,
    pricingProfileId: string | null,
    profiles: BmPricingProfile[],
    projectTypeId: string | null,
    metersRequired: number | string | null,
  ): number {
    const items = labor ?? [];
    const useProjectTypeFormula = !!projectTypeId;
    const net = useProjectTypeFormula
      ? this.calculateProductivityNet(items, metersRequired)
      : items.reduce((sum, l) => {
          const qty = Number(l.quantity ?? 1);
          const cost = Number(l.unitCostOverride ?? 0);
          return sum + cost * qty;
        }, 0);
    const sellSum = items.reduce((sum, l) => {
      const qty = Number(l.quantity ?? 1);
      const cost = Number(l.sellCostOverride ?? 0);
      return sum + cost * qty;
    }, 0);
    if (useDefaultPricing) return sellSum;
    const profile = profiles.find((p) => p.pricingProfileId === pricingProfileId);
    const markup = Number(profile?.laborMarkup ?? 0);
    return net * (1 + markup);
  }

  private calculateNetLaborCost(
    labor: BmProjectLabor[] | null | undefined,
    projectTypeId: string | null,
    metersRequired: number | string | null,
  ): number {
    const items = labor ?? [];
    if (projectTypeId) {
      return this.calculateProductivityNet(items, metersRequired);
    }
    return items.reduce((sum, l) => {
      const qty = Number(l.quantity ?? 1);
      const cost = Number(l.unitCostOverride ?? 0);
      return sum + cost * qty;
    }, 0);
  }

  private calculateProductivityNet(
    labor: BmProjectLabor[],
    metersRequired: number | string | null,
  ): number {
    const meters = Number(metersRequired ?? 0);
    if (!Number.isFinite(meters) || meters <= 0) return 0;
    return labor.reduce((sum, l) => {
      const productivity = Number(l.unitProductivity ?? 0);
      if (!Number.isFinite(productivity) || productivity <= 0) return sum;
      const unitCost = Number(l.unitCostOverride ?? 0);
      if (!Number.isFinite(unitCost)) return sum;
      return sum + (meters / productivity) * unitCost;
    }, 0);
  }
}
