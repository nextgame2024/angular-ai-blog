import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
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
import { combineLatest, forkJoin, Observable, of, Subject } from 'rxjs';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  map,
  startWith,
  takeUntil,
} from 'rxjs/operators';

import { ManagerNavigationLinksActions } from '../../store/navigationLinks/manager.actions';
import {
  selectManagerNavigationLinks,
  selectManagerNavigationLinksError,
  selectManagerNavigationLinksLoading,
  selectManagerNavigationLinksPage,
  selectManagerNavigationLinksSearchQuery,
  selectManagerNavigationLinksTotal,
} from '../../store/navigationLinks/manager.selectors';
import type { BmCompany } from '../../types/company.interface';
import {
  HEADER_NAVIGATION_LABEL_OPTIONS,
  MENU_NAVIGATION_LABEL_OPTIONS,
  NAVIGATION_TYPE_OPTIONS,
  SOPHIA_ADMIN_MODULE_OPTIONS,
  type BmNavigationLink,
  type NavigationLabelOption,
  type NavigationType,
} from '../../types/navigation.links.interface';
import { ManagerCompanyService } from '../../services/manager.company.service';
import { NavigationLinksProjectsService } from '../../services/navigation.links.projects.service';
import { ManagerService } from '../../services/manager.service';
import { ManagerSelectComponent } from '../shared/manager-select/manager-select.component';
import { selectCurrentUser } from '../../../auth/store/reducers';
import type { CurrentUserInterface } from '../../../shared/types/currentUser.interface';

export function normalizeSophiaAdminHeaderSelection(
  labels: Iterable<string>,
  moduleCount: number,
  isSuperAdmin: boolean,
  navigationType: NavigationType,
  sophiaAdminLabel = 'Sophia Ai admin',
): Set<string> {
  const normalized = new Set(labels);
  if (
    isSuperAdmin &&
    navigationType === 'header' &&
    normalized.has(sophiaAdminLabel) &&
    moduleCount === 0
  ) {
    normalized.delete(sophiaAdminLabel);
  }
  return normalized;
}

export const ALL_ACTIVE_USERS_VALUE = '__all_active_users__';

export function canConfigurePlatformAdmin(
  isSuperAdmin: boolean,
  operatorCompanyId: string | null | undefined,
  selectedCompanyId: string | null | undefined,
): boolean {
  return Boolean(
    isSuperAdmin && operatorCompanyId && selectedCompanyId === operatorCompanyId,
  );
}

export function withAllActiveUsersOption(
  options: Array<{ value: string; label: string }>,
): Array<{ value: string; label: string }> {
  if (!options.length) return [];
  return [
    {
      value: ALL_ACTIVE_USERS_VALUE,
      label: `All active users (${options.length})`,
    },
    ...options,
  ];
}

@Component({
    selector: 'app-manager-navigation-links-page',
    imports: [CommonModule, ReactiveFormsModule, RouterModule, ManagerSelectComponent],
    templateUrl: './manager-navigation-links.page.html',
    styleUrls: ['./manager-navigation-links.page.css']
})
export class ManagerNavigationLinksPageComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private readonly superAdminId = 'c2dad143-077c-4082-92f0-47805601db3b';
  private labelsLoadToken = 0;
  readonly sophiaAdminLabel = 'Sophia Ai admin';

  loading$ = this.store.select(selectManagerNavigationLinksLoading);
  error$ = this.store.select(selectManagerNavigationLinksError);
  navigationLinksRaw$ = this.store.select(selectManagerNavigationLinks);
  total$ = this.store.select(selectManagerNavigationLinksTotal);
  page$ = this.store.select(selectManagerNavigationLinksPage);
  searchQuery$ = this.store.select(selectManagerNavigationLinksSearchQuery);

  searchCtrl: FormControl<string>;
  filteredNavigationLinks$!: Observable<BmNavigationLink[]>;
  canLoadMore$!: Observable<boolean>;

  currentUser: CurrentUserInterface | null = null;
  isSuperAdmin = false;

  companies: BmCompany[] = [];
  companyOptions: Array<{ value: string; label: string }> = [];
  navigationTypeOptions = NAVIGATION_TYPE_OPTIONS;
  navigationLabelOptions: NavigationLabelOption[] = HEADER_NAVIGATION_LABEL_OPTIONS;
  sophiaAdminModuleOptions = SOPHIA_ADMIN_MODULE_OPTIONS;
  userOptions: Array<{ value: string; label: string }> = [];
  private activeUserOptions: Array<{ value: string; label: string }> = [];

  selectedNavigationLabels = new Set<string>();
  selectedSophiaAdminModules = new Set<string>();
  labelsLoading = false;
  labelsDropdownOpen = false;
  modulesDropdownOpen = false;
  private sophiaAdminSelectionDirty = false;

  private infiniteObserver?: IntersectionObserver;
  private isLoadingMore = false;
  private currentPage = 1;
  private canLoadMore = false;
  private isLoading = false;

  dismissedErrors = new Set<string>();

  @ViewChild('navigationLinksList') navigationLinksListRef?: ElementRef<HTMLElement>;
  @ViewChild('infiniteSentinel') infiniteSentinelRef?: ElementRef<HTMLElement>;

  navigationLinkForm = this.fb.group({
    company_id: [''],
    navigation_type: ['header', [Validators.required]],
    target_user_id: [''],
  });

  constructor(
    private store: Store,
    private fb: FormBuilder,
    private companyApi: ManagerCompanyService,
    private navigationLinksApi: NavigationLinksProjectsService,
    private managerApi: ManagerService,
  ) {
    this.searchCtrl = this.fb.control('', { nonNullable: true });

    this.filteredNavigationLinks$ = combineLatest([
      this.navigationLinksRaw$,
      this.searchCtrl.valueChanges.pipe(startWith('')),
    ]).pipe(
      map(([navigationLinks, query]) => {
        const q = (query || '').trim().toLowerCase();
        if (!q) return navigationLinks;
        return navigationLinks.filter((item) => {
          return (
            item.navigationLabel?.toLowerCase().includes(q) ||
            item.navigationType?.toLowerCase().includes(q) ||
            item.companyName?.toLowerCase().includes(q)
          );
        });
      }),
    );

    this.canLoadMore$ = combineLatest([
      this.total$,
      this.navigationLinksRaw$,
      this.loading$,
    ]).pipe(
      map(
        ([total, navigationLinks, loading]) =>
          !loading && navigationLinks.length < total,
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
    this.store.dispatch(
      ManagerNavigationLinksActions.loadNavigationLinks({ page: 1 }),
    );

    this.store
      .select(selectCurrentUser)
      .pipe(takeUntil(this.destroy$))
      .subscribe((user) => {
        this.currentUser = user ?? null;
        this.isSuperAdmin = user?.id === this.superAdminId;
        this.syncCompanyControl();
        this.applyNavigationType(
          (this.navigationLinkForm.get('navigation_type')?.value as NavigationType) || 'header',
        );

        if (this.isSuperAdmin) {
          this.loadCompanyOptions();
        } else {
          this.loadUserOptions();
        }
      });

    this.searchQuery$.pipe(takeUntil(this.destroy$)).subscribe((query) => {
      if (this.searchCtrl.value !== (query || '')) {
        this.searchCtrl.setValue(query || '', { emitEvent: false });
      }
      this.store.dispatch(
        ManagerNavigationLinksActions.loadNavigationLinks({ page: 1 }),
      );
    });

    this.searchCtrl.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        takeUntil(this.destroy$),
      )
      .subscribe((query) =>
        this.store.dispatch(
          ManagerNavigationLinksActions.setNavigationLinksSearchQuery({
            query: query || '',
          }),
        ),
      );

    this.navigationLinkForm
      .get('navigation_type')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((value) => {
        this.applyNavigationType((value as NavigationType | null) ?? 'header');
        this.reloadAssignedLabels();
      });

    this.navigationLinkForm
      .get('company_id')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.isSuperAdmin) {
          this.applyNavigationType(
            (this.navigationLinkForm.get('navigation_type')?.value as NavigationType) || 'header',
          );
          this.loadUserOptions();
        }
      });

    this.navigationLinkForm
      .get('target_user_id')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe(() => this.reloadAssignedLabels());

    this.applyNavigationType('header');
    setTimeout(() => this.setupInfiniteScroll(), 0);
  }

  ngOnDestroy(): void {
    this.infiniteObserver?.disconnect();
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (!target.closest('.labels-multiselect')) {
      this.labelsDropdownOpen = false;
      this.modulesDropdownOpen = false;
    }
  }

  dismissError(message: string): void {
    if (message) this.dismissedErrors.add(message);
  }

  isErrorDismissed(message: string | null | undefined): boolean {
    return message ? this.dismissedErrors.has(message) : false;
  }

  trackByNavigationLink = (_: number, item: BmNavigationLink) =>
    item.navigationLinkId;

  trackByLabel = (_: number, option: NavigationLabelOption) => option.value;

  private getAllowedNavigationLabelSet(
    type: NavigationType | null | undefined,
  ): Set<string> {
    const nextType: NavigationType = type === 'menu' ? 'menu' : 'header';
    const options =
      nextType === 'menu'
        ? MENU_NAVIGATION_LABEL_OPTIONS
        : HEADER_NAVIGATION_LABEL_OPTIONS;

    return new Set(
      options
        .filter(
          (option) => this.canConfigureSophiaAdmin || option.value !== this.sophiaAdminLabel,
        )
        .map((option) => option.value),
    );
  }

  private sanitizeSelectedNavigationLabels(
    labels: Iterable<string>,
    type: NavigationType | null | undefined,
  ): Set<string> {
    const allowedLabels = this.getAllowedNavigationLabelSet(type);
    const sanitizedLabels = new Set<string>();

    for (const label of labels) {
      if (!allowedLabels.has(label)) continue;
      sanitizedLabels.add(label);
    }

    return sanitizedLabels;
  }

  get selectedLabelsCount(): number {
    return this.selectedNavigationLabels.size;
  }

  get selectedLabelsSummary(): string {
    if (this.labelsLoading) return 'Loading labels...';
    const selected = Array.from(this.selectedNavigationLabels);
    if (!selected.length) return 'Select labels';
    if (selected.length === 1) return selected[0];
    return `${selected[0]} + ${selected.length - 1} more`;
  }

  toggleLabelsDropdown(event?: MouseEvent): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.labelsLoading) return;
    this.labelsDropdownOpen = !this.labelsDropdownOpen;
  }

  isLabelSelected(label: string): boolean {
    return this.selectedNavigationLabels.has(label);
  }

  toggleLabel(label: string): void {
    if (this.selectedNavigationLabels.has(label)) {
      this.selectedNavigationLabels.delete(label);
    } else {
      this.selectedNavigationLabels.add(label);
    }
    this.selectedNavigationLabels = new Set(this.selectedNavigationLabels);
    if (label === this.sophiaAdminLabel) this.sophiaAdminSelectionDirty = true;
  }

  get areAllLabelsSelected(): boolean {
    return (
      this.navigationLabelOptions.length > 0 &&
      this.navigationLabelOptions.every((option) =>
        this.selectedNavigationLabels.has(option.value),
      )
    );
  }

  toggleAllLabels(): void {
    const selectAll = !this.areAllLabelsSelected;
    this.selectedNavigationLabels = selectAll
      ? new Set(this.navigationLabelOptions.map((option) => option.value))
      : new Set<string>();
    if (
      this.navigationLabelOptions.some(
        (option) => option.value === this.sophiaAdminLabel,
      )
    ) {
      this.sophiaAdminSelectionDirty = true;
    }
  }

  get isHeaderType(): boolean {
    return this.navigationLinkForm.get('navigation_type')?.value === 'header';
  }

  get canConfigureSophiaAdmin(): boolean {
    return canConfigurePlatformAdmin(
      this.isSuperAdmin,
      this.currentUser?.companyId,
      this.navigationLinkForm.get('company_id')?.value,
    );
  }

  get sophiaAdminSelected(): boolean {
    return this.selectedNavigationLabels.has(this.sophiaAdminLabel);
  }

  get selectedModulesSummary(): string {
    const selected = this.sophiaAdminModuleOptions.filter((option) =>
      this.selectedSophiaAdminModules.has(option.value),
    );
    if (!selected.length) return 'Select modules';
    if (selected.length === 1) return selected[0].label;
    return `${selected[0].label} + ${selected.length - 1} more`;
  }

  toggleModulesDropdown(event?: MouseEvent): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (!this.sophiaAdminSelected) return;
    this.modulesDropdownOpen = !this.modulesDropdownOpen;
  }

  isModuleSelected(moduleId: string): boolean {
    return this.selectedSophiaAdminModules.has(moduleId);
  }

  toggleModule(moduleId: string): void {
    if (this.selectedSophiaAdminModules.has(moduleId)) {
      this.selectedSophiaAdminModules.delete(moduleId);
    } else {
      this.selectedSophiaAdminModules.add(moduleId);
    }
    this.selectedSophiaAdminModules = new Set(this.selectedSophiaAdminModules);
    this.sophiaAdminSelectionDirty = true;
  }

  get areAllModulesSelected(): boolean {
    return (
      this.sophiaAdminModuleOptions.length > 0 &&
      this.sophiaAdminModuleOptions.every((option) =>
        this.selectedSophiaAdminModules.has(option.value),
      )
    );
  }

  toggleAllModules(): void {
    this.selectedSophiaAdminModules = this.areAllModulesSelected
      ? new Set<string>()
      : new Set(this.sophiaAdminModuleOptions.map((option) => option.value));
    this.sophiaAdminSelectionDirty = true;
  }

  get allActiveUsersSelected(): boolean {
    return (
      this.navigationLinkForm.get('target_user_id')?.value ===
      ALL_ACTIVE_USERS_VALUE
    );
  }

  saveNavigationLink(): void {
    if (this.navigationLinkForm.invalid) {
      this.navigationLinkForm.markAllAsTouched();
      return;
    }

    const raw = this.navigationLinkForm.getRawValue();
    const navigationType = (raw.navigation_type || 'header') as NavigationType;
    const selectedNavigationLabels = normalizeSophiaAdminHeaderSelection(
      this.sanitizeSelectedNavigationLabels(
        this.selectedNavigationLabels,
        navigationType,
      ),
      this.selectedSophiaAdminModules.size,
      this.canConfigureSophiaAdmin,
      navigationType,
      this.sophiaAdminLabel,
    );

    this.selectedNavigationLabels = selectedNavigationLabels;

    const payload: any = {
      navigation_type: navigationType,
      navigation_labels: Array.from(selectedNavigationLabels),
    };

    if (this.isSuperAdmin) {
      payload.company_id = raw.company_id || null;
      if (!payload.company_id) {
        this.navigationLinkForm.get('company_id')?.markAsTouched();
        return;
      }
      if (this.canConfigureSophiaAdmin && navigationType === 'header') {
        payload.sophia_admin_modules = Array.from(
          this.selectedSophiaAdminModules,
        );
        if (raw.target_user_id === ALL_ACTIVE_USERS_VALUE) {
          if (this.sophiaAdminSelectionDirty) {
            payload.target_user_ids = this.activeUserOptions.map(
              (option) => option.value,
            );
          }
        } else {
          payload.target_user_id = raw.target_user_id || null;
        }
        if (selectedNavigationLabels.has(this.sophiaAdminLabel)) {
          if (!payload.target_user_id && !payload.target_user_ids?.length) {
            this.navigationLinkForm.get('target_user_id')?.markAsTouched();
            return;
          }
        }
      }
    }

    this.store.dispatch(
      ManagerNavigationLinksActions.syncNavigationLabels({ payload }),
    );
    this.labelsDropdownOpen = false;
    this.modulesDropdownOpen = false;
  }

  private syncCompanyControl(): void {
    const companyControl = this.navigationLinkForm.get('company_id');
    if (!companyControl) return;

    if (this.isSuperAdmin) {
      companyControl.setValidators([Validators.required]);
    } else {
      companyControl.clearValidators();
      companyControl.setValue('', { emitEvent: false });
    }

    companyControl.updateValueAndValidity({ emitEvent: false });
  }

  private loadCompanyOptions(): void {
    this.companyApi
      .listCompanies({ page: 1, limit: 100 })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.companies = result.items ?? [];
          this.companyOptions = this.companies.map((company) => ({
            value: company.companyId,
            label: company.companyName || company.companyId,
          }));

          if (!this.navigationLinkForm.get('company_id')?.value) {
            this.navigationLinkForm.patchValue(
              { company_id: this.companyOptions[0]?.value ?? '' },
              { emitEvent: false },
            );
          }
          this.applyNavigationType(
            (this.navigationLinkForm.get('navigation_type')?.value as NavigationType) || 'header',
          );
          this.loadUserOptions();
        },
        error: () => {
          this.companies = [];
          this.companyOptions = [];
          this.selectedNavigationLabels.clear();
          this.selectedSophiaAdminModules.clear();
        },
      });
  }

  private applyNavigationType(type: NavigationType | null): void {
    const nextType: NavigationType = type === 'menu' ? 'menu' : 'header';
    this.navigationLabelOptions =
      nextType === 'menu'
        ? MENU_NAVIGATION_LABEL_OPTIONS
        : HEADER_NAVIGATION_LABEL_OPTIONS.filter(
            (option) =>
              this.canConfigureSophiaAdmin || option.value !== this.sophiaAdminLabel,
          );

    this.selectedNavigationLabels = this.sanitizeSelectedNavigationLabels(
      this.selectedNavigationLabels,
      nextType,
    );
  }

  private reloadAssignedLabels(): void {
    const navigationType =
      (this.navigationLinkForm.get('navigation_type')?.value as NavigationType) ||
      'header';

    const companyId = this.isSuperAdmin
      ? this.navigationLinkForm.get('company_id')?.value || ''
      : undefined;
    const targetUserId = this.canConfigureSophiaAdmin
      ? this.navigationLinkForm.get('target_user_id')?.value || ''
      : '';
    const allUsersSelected = targetUserId === ALL_ACTIVE_USERS_VALUE;
    this.sophiaAdminSelectionDirty = false;

    if (this.isSuperAdmin && !companyId) {
      this.selectedNavigationLabels.clear();
      this.labelsLoading = false;
      return;
    }

    const token = ++this.labelsLoadToken;
    this.labelsLoading = true;

    const links$ = this.navigationLinksApi.listNavigationLinks({
        page: 1,
        limit: 500,
        navigationType,
        companyId: companyId || undefined,
      });
    const entitlement$ =
      this.canConfigureSophiaAdmin &&
      navigationType === 'header' &&
      companyId &&
      targetUserId &&
      !allUsersSelected
        ? this.navigationLinksApi
            .getSophiaAdminEntitlement(companyId, targetUserId)
            .pipe(catchError(() => of(null)))
        : of(null);

    forkJoin({ links: links$, entitlement: entitlement$ })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ links: result, entitlement }) => {
          if (token !== this.labelsLoadToken) return;

          const selected = new Set<string>();
          for (const item of result.items || []) {
            if (item.navigationType !== navigationType) continue;
            if (item.active === false) continue;
            selected.add(item.navigationLabel);
          }
          if (entitlement?.enabled) selected.add(this.sophiaAdminLabel);

          this.selectedNavigationLabels = this.sanitizeSelectedNavigationLabels(
            selected,
            navigationType,
          );
          this.selectedSophiaAdminModules = new Set(
            allUsersSelected ? [] : entitlement?.modules ?? [],
          );
          this.labelsLoading = false;
        },
        error: () => {
          if (token !== this.labelsLoadToken) return;
          this.selectedNavigationLabels.clear();
          this.selectedSophiaAdminModules.clear();
          this.labelsLoading = false;
        },
      });
  }

  private loadUserOptions(): void {
    const companyId = this.navigationLinkForm.get('company_id')?.value || '';
    if (!this.canConfigureSophiaAdmin || !companyId) {
      this.userOptions = [];
      this.activeUserOptions = [];
      this.navigationLinkForm
        .get('target_user_id')
        ?.setValue('', { emitEvent: false });
      this.reloadAssignedLabels();
      return;
    }

    this.managerApi
      .listUsers({ page: 1, limit: 100, companyId, status: 'active' })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.activeUserOptions = (result.items ?? []).map((user) => ({
            value: user.id,
            label: `${user.name || user.username} (${user.email})`,
          }));
          this.userOptions = withAllActiveUsersOption(this.activeUserOptions);
          const current = this.navigationLinkForm.get('target_user_id')?.value;
          const next = this.userOptions.some(
            (option) => option.value === current,
          )
            ? current || ''
            : this.activeUserOptions[0]?.value || '';
          this.navigationLinkForm.get('target_user_id')?.setValue(next);
          if (!next) this.reloadAssignedLabels();
        },
        error: () => {
          this.userOptions = [];
          this.activeUserOptions = [];
          this.navigationLinkForm.get('target_user_id')?.setValue('');
        },
      });
  }

  private setupInfiniteScroll(): void {
    const sentinel = this.infiniteSentinelRef?.nativeElement;
    const list = this.navigationLinksListRef?.nativeElement;
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
      ManagerNavigationLinksActions.loadNavigationLinks({
        page: this.currentPage + 1,
      }),
    );
  }
}
