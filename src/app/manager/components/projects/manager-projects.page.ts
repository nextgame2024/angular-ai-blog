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
import { debounceTime, distinctUntilChanged, map, takeUntil } from 'rxjs/operators';

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
import { ManagerMaterialsService } from '../../services/manager.materials.service';
import { ManagerLaborService } from '../../services/manager.labor.service';
import { ManagerPricingService } from '../../services/manager.pricing.service';
import type { ManagerSelectOption } from '../shared/manager-select/manager-select.component';

@Component({
  selector: 'app-manager-projects-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, ManagerSelectComponent],
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
    { value: 'suspended', label: 'Suspended' },
    { value: 'pending_approval', label: 'Pending approval' },
    { value: 'approved', label: 'Approved' },
    { value: 'finished', label: 'Finished' },
  ];

  clientOptions: ManagerSelectOption[] = [];
  pricingOptions: ManagerSelectOption[] = [];
  materialOptions: ManagerSelectOption[] = [];
  laborOptions: ManagerSelectOption[] = [];
  clientsCatalog: { clientId: string; clientName: string }[] = [];
  clientSearchCtrl: FormControl<string>;
  clientSuggestions: { clientId: string; clientName: string }[] = [];
  showClientSuggestions = false;
  clientActiveIndex = -1;

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
    default_pricing: new FormControl<boolean>(true, { nonNullable: true }),
    pricing_profile_id: new FormControl<string | null>(null),
  });

  projectMaterialForm = this.fb.group({
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

  @ViewChild('projectsList') projectsListRef?: ElementRef<HTMLElement>;
  @ViewChild('infiniteSentinel') infiniteSentinelRef?: ElementRef<HTMLElement>;

  private currentPage = 1;
  private canLoadMore = false;

  constructor(
    private store: Store,
    private fb: FormBuilder,
    private managerService: ManagerService,
    private materialsService: ManagerMaterialsService,
    private laborService: ManagerLaborService,
    private pricingService: ManagerPricingService,
  ) {
    this.searchCtrl = new FormControl('', { nonNullable: true });
    this.clientSearchCtrl = new FormControl('', { nonNullable: true });
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

    this.editingProject$.pipe(takeUntil(this.destroy$)).subscribe((project) => {
      if (project) {
        this.projectForm.reset({
          client_id: project.clientId,
          project_name: project.projectName,
          description: project.description ?? '',
          status: project.status ?? 'to_do',
          default_pricing: project.defaultPricing ?? true,
          pricing_profile_id: project.pricingProfileId ?? null,
        });
        this.clientSearchCtrl.setValue(project.clientName || '', {
          emitEvent: false,
        });
      } else {
        this.projectForm.reset({
          client_id: '',
          project_name: '',
          description: '',
          status: 'to_do',
          default_pricing: true,
          pricing_profile_id: null,
        });
        this.clientSearchCtrl.setValue('', { emitEvent: false });
      }
    });

    this.editingMaterial$.pipe(takeUntil(this.destroy$)).subscribe((mat) => {
      this.editingMaterial = mat;
      if (mat) {
        this.projectMaterialForm.reset({
          material_id: mat.materialId,
          quantity: mat.quantity ?? 1,
          unit_cost_override: mat.unitCostOverride ?? null,
          sell_cost_override: mat.sellCostOverride ?? null,
          notes: mat.notes ?? '',
        });
      } else {
        this.projectMaterialForm.reset({
          material_id: '',
          quantity: 1,
          unit_cost_override: null,
          sell_cost_override: null,
          notes: '',
        });
      }
    });

    this.editingLabor$.pipe(takeUntil(this.destroy$)).subscribe((labor) => {
      this.editingLabor = labor;
      if (labor) {
        this.projectLaborForm.reset({
          labor_id: labor.laborId,
          quantity: labor.quantity ?? 1,
          unit_cost_override: labor.unitCostOverride ?? null,
          sell_cost_override: labor.sellCostOverride ?? null,
          notes: labor.notes ?? '',
        });
      } else {
        this.projectLaborForm.reset({
          labor_id: '',
          quantity: 1,
          unit_cost_override: null,
          sell_cost_override: null,
          notes: '',
        });
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
    const useDefaultPricing = !!payload.default_pricing;
    payload.default_pricing = !useDefaultPricing;
    if (!useDefaultPricing) {
      payload.pricing_profile_id = null;
    }

    this.store.dispatch(ManagerProjectsActions.saveProject({ payload }));
  }

  get isDefaultPricing(): boolean {
    return !!this.projectForm.get('default_pricing')?.value;
  }

  get isPricingProfileDisabled(): boolean {
    return !this.isDefaultPricing;
  }

  setDefaultPricing(value: boolean): void {
    this.projectForm.controls.default_pricing.setValue(value);
    if (!value) {
      this.projectForm.controls.pricing_profile_id.setValue(null);
    }
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
        ManagerProjectsActions.loadProjectLabor({ projectId: project.projectId }),
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

  saveProjectMaterial(project: BmProject, editing?: BmProjectMaterial | null): void {
    if (this.projectMaterialForm.invalid) {
      this.projectMaterialForm.markAllAsTouched();
      return;
    }

    const payload: any = this.projectMaterialForm.getRawValue();
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
    const ok = window.confirm(`Remove labor "${labor.laborName}" from this project?`);
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
          const match = this.clientsCatalog.find((c) => c.clientId === currentId);
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

    this.materialsService
      .listMaterials({ page: 1, limit: 200 })
      .pipe(takeUntil(this.destroy$))
      .subscribe((res) => {
        this.materialOptions = (res?.items ?? []).map((m) => ({
          value: m.materialId,
          label: m.materialName,
        }));
      });

    this.laborService
      .listLabor({ page: 1, limit: 200 })
      .pipe(takeUntil(this.destroy$))
      .subscribe((res) => {
        this.laborOptions = (res?.items ?? []).map((l) => ({
          value: l.laborId,
          label: l.laborName,
        }));
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
