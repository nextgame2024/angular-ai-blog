import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { combineLatest, Observable, Subject, of } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  map,
  switchMap,
  takeUntil,
} from 'rxjs/operators';

import { TownPlannerV2Service } from '../../../townplanner/services/townplanner_v2.service';
import type { TownPlannerV2AddressSuggestion } from '../../../townplanner/store/townplanner_v2.state';
import { ManagerSitesActions } from '../../store/sites/manager.actions';
import {
  selectManagerEditingSite,
  selectManagerSites,
  selectManagerSitesError,
  selectManagerSitesLoading,
  selectManagerSitesPage,
  selectManagerSitesSearchQuery,
  selectManagerSitesTotal,
  selectManagerSitesViewMode,
} from '../../store/sites/manager.selectors';
import type { BmSite } from '../../types/sites.interface';
import { ManagerSelectComponent } from '../shared/manager-select/manager-select.component';

@Component({
  selector: 'app-manager-sites-page',
  imports: [CommonModule, ReactiveFormsModule, RouterModule, ManagerSelectComponent],
  templateUrl: './manager-sites.page.html',
  styleUrls: [
    '../clients/manager-clients.page.css',
    './manager-sites.page.css',
  ],
})
export class ManagerSitesPageComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private infiniteObserver?: IntersectionObserver;
  private isLoadingMore = false;
  private closeAfterSave = false;
  private currentPage = 1;
  private canLoadMore = false;
  private isLoading = false;

  loading$ = this.store.select(selectManagerSitesLoading);
  error$ = this.store.select(selectManagerSitesError);
  sites$ = this.store.select(selectManagerSites);
  total$ = this.store.select(selectManagerSitesTotal);
  viewMode$ = this.store.select(selectManagerSitesViewMode);
  editingSite$ = this.store.select(selectManagerEditingSite);
  page$ = this.store.select(selectManagerSitesPage);
  searchQuery$ = this.store.select(selectManagerSitesSearchQuery);
  canLoadMore$!: Observable<boolean>;

  searchCtrl: FormControl<string>;
  dismissedErrors = new Set<string>();
  addressSuggestions: TownPlannerV2AddressSuggestion[] = [];
  showAddressSuggestions = false;
  addressActiveIndex = -1;
  private addressSessionToken: string | null = null;
  private addressHasFocus = false;

  isConfirmModalOpen = false;
  confirmModalTitle = '';
  confirmModalMessage = '';
  confirmModalConfirmLabel = 'Confirm';
  confirmModalCancelLabel = 'Cancel';
  confirmModalTone: 'info' | 'warning' | 'danger' = 'info';
  private confirmModalConfirmAction: (() => void) | null = null;

  statusOptions = [
    { value: 'active', label: 'active' },
    { value: 'archived', label: 'archived' },
  ];

  siteForm = this.fb.group({
    site_name: ['', [Validators.required, Validators.maxLength(140)]],
    administrator: ['', [Validators.maxLength(140)]],
    address: [''],
    email: ['', [Validators.email]],
    mobile: [''],
    pallets_onsite: [0, [Validators.min(0)]],
    status: ['active', [Validators.required]],
  });

  @ViewChild('sitesList') sitesListRef?: ElementRef<HTMLElement>;
  @ViewChild('infiniteSentinel') infiniteSentinelRef?: ElementRef<HTMLElement>;

  constructor(
    private store: Store,
    private fb: FormBuilder,
    private townPlanner: TownPlannerV2Service,
    private actions$: Actions,
  ) {
    this.searchCtrl = this.fb.control('', { nonNullable: true });
    this.canLoadMore$ = combineLatest([this.total$, this.sites$, this.loading$]).pipe(
      map(([total, sites, loading]) => !loading && sites.length < total),
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
          ManagerSitesActions.saveSiteSuccess,
          ManagerSitesActions.saveSiteFailure,
        ),
        takeUntil(this.destroy$),
      )
      .subscribe((action) => {
        if (!this.closeAfterSave) return;
        this.closeAfterSave = false;
        if (action.type === ManagerSitesActions.saveSiteSuccess.type) {
          this.closeForm();
        }
      });
  }

  ngOnInit(): void {
    this.store.dispatch(ManagerSitesActions.loadSites({ page: 1 }));
    this.searchQuery$.pipe(takeUntil(this.destroy$)).subscribe((query) => {
      if (this.searchCtrl.value !== (query || '')) {
        this.searchCtrl.setValue(query || '', { emitEvent: false });
      }
      this.store.dispatch(ManagerSitesActions.loadSites({ page: 1 }));
    });
    this.searchCtrl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((query) =>
        this.store.dispatch(
          ManagerSitesActions.setSitesSearchQuery({ query: query || '' }),
        ),
      );
    this.viewMode$.pipe(takeUntil(this.destroy$)).subscribe((mode) => {
      if (mode === 'list') setTimeout(() => this.setupInfiniteScroll(), 0);
    });
    this.editingSite$.pipe(takeUntil(this.destroy$)).subscribe((site) => {
      if (!site) return;
      this.siteForm.patchValue({
        site_name: site.siteName ?? '',
        administrator: site.administrator ?? '',
        address: site.address ?? '',
        email: site.email ?? '',
        mobile: site.mobile ?? '',
        pallets_onsite: Number(site.palletsOnsite ?? 0),
        status: site.status ?? 'active',
      });
    });
    this.setupAddressAutocomplete();
  }

  ngOnDestroy(): void {
    this.infiniteObserver?.disconnect();
    this.destroy$.next();
    this.destroy$.complete();
  }

  trackBySite = (_: number, site: BmSite) => site.siteId;
  dismissError(message: string): void {
    if (message) this.dismissedErrors.add(message);
  }
  isErrorDismissed(message: string | null | undefined): boolean {
    return message ? this.dismissedErrors.has(message) : false;
  }
  clearSearch(): void {
    this.searchCtrl.setValue('');
  }

  openCreate(): void {
    this.siteForm.reset({
      site_name: '',
      administrator: '',
      address: '',
      email: '',
      mobile: '',
      pallets_onsite: 0,
      status: 'active',
    });
    this.store.dispatch(ManagerSitesActions.openSiteCreate());
  }

  openEdit(site: BmSite): void {
    this.store.dispatch(ManagerSitesActions.openSiteEdit({ siteId: site.siteId }));
  }

  closeForm(): void {
    this.store.dispatch(ManagerSitesActions.closeSiteForm());
  }

  saveSite(): void {
    if (this.siteForm.invalid) {
      this.siteForm.markAllAsTouched();
      return;
    }
    const payload: any = this.siteForm.getRawValue();
    payload.pallets_onsite = Number(payload.pallets_onsite ?? 0);
    if (Number.isNaN(payload.pallets_onsite)) payload.pallets_onsite = 0;
    this.store.dispatch(ManagerSitesActions.saveSite({ payload }));
  }

  saveSiteAndClose(): void {
    this.closeAfterSave = true;
    this.saveSite();
  }

  removeSite(site: BmSite): void {
    if ((site.status ?? 'active') === 'archived') return;
    this.openConfirmModal({
      title: 'Archive Site?',
      message: `Archive site "${site.siteName}"?`,
      tone: 'warning',
      confirmLabel: 'Confirm',
      onConfirm: () =>
        this.store.dispatch(ManagerSitesActions.removeSite({ siteId: site.siteId })),
    });
  }

  onAddressFocus(): void {
    this.addressHasFocus = true;
    const current = (this.siteForm.controls.address.value || '').trim();
    if (current.length >= 3 && this.addressSuggestions.length) {
      this.showAddressSuggestions = true;
    }
  }

  onAddressBlur(): void {
    this.addressHasFocus = false;
    window.setTimeout(() => {
      this.showAddressSuggestions = false;
      this.addressActiveIndex = -1;
    }, 120);
  }

  onAddressKeydown(event: KeyboardEvent): void {
    if (!this.addressSuggestions.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.addressActiveIndex = Math.min(
        this.addressActiveIndex + 1,
        this.addressSuggestions.length - 1,
      );
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.addressActiveIndex = Math.max(this.addressActiveIndex - 1, 0);
    } else if (event.key === 'Enter' && this.addressActiveIndex >= 0) {
      event.preventDefault();
      this.onAddressSelect(this.addressSuggestions[this.addressActiveIndex]);
    } else if (event.key === 'Escape') {
      this.showAddressSuggestions = false;
      this.addressActiveIndex = -1;
    }
  }

  onAddressSelect(suggestion: TownPlannerV2AddressSuggestion): void {
    this.siteForm.controls.address.setValue(suggestion.description, {
      emitEvent: false,
    });
    this.addressSuggestions = [];
    this.showAddressSuggestions = false;
    this.addressActiveIndex = -1;
    const token = this.addressSessionToken;
    this.addressSessionToken = null;
    this.townPlanner
      .getPlaceDetails(suggestion.placeId, token)
      .pipe(takeUntil(this.destroy$))
      .subscribe((details) => {
        const next = details?.formattedAddress || suggestion.description || '';
        if (next) {
          this.siteForm.controls.address.setValue(next, { emitEvent: false });
        }
      });
  }

  onConfirmModalConfirm(): void {
    const action = this.confirmModalConfirmAction;
    this.closeConfirmModal();
    action?.();
  }
  onConfirmModalCancel(): void {
    this.closeConfirmModal();
  }
  onConfirmModalBackdrop(): void {
    this.onConfirmModalCancel();
  }

  private setupAddressAutocomplete(): void {
    this.siteForm.controls.address.valueChanges
      .pipe(
        debounceTime(200),
        distinctUntilChanged(),
        switchMap((query) => {
          const q = (query || '').toString().trim();
          if (!this.addressHasFocus || q.length < 3) {
            this.addressSuggestions = [];
            this.showAddressSuggestions = false;
            this.addressActiveIndex = -1;
            return of([]);
          }
          if (!this.addressSessionToken) this.addressSessionToken = this.createSessionToken();
          return this.townPlanner.suggestAddresses(q, this.addressSessionToken);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe((suggestions) => {
        this.addressSuggestions = suggestions || [];
        this.showAddressSuggestions = this.addressHasFocus && this.addressSuggestions.length > 0;
        this.addressActiveIndex = this.showAddressSuggestions ? 0 : -1;
      });
  }

  private createSessionToken(): string {
    const cryptoObj = globalThis.crypto as Crypto | undefined;
    if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
    return Math.random().toString(36).slice(2);
  }

  private setupInfiniteScroll(): void {
    const sentinel = this.infiniteSentinelRef?.nativeElement;
    const list = this.sitesListRef?.nativeElement;
    if (!sentinel || !list) return;
    this.infiniteObserver?.disconnect();
    const scrollRoot = list.closest('.content') as HTMLElement | null;
    this.infiniteObserver = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        this.tryLoadMore();
      },
      { root: scrollRoot, rootMargin: '200px 0px', threshold: 0.1 },
    );
    this.infiniteObserver.observe(sentinel);
  }

  private tryLoadMore(): void {
    if (!this.canLoadMore || this.isLoading || this.isLoadingMore) return;
    this.isLoadingMore = true;
    this.store.dispatch(ManagerSitesActions.loadSites({ page: this.currentPage + 1 }));
  }

  private openConfirmModal(options: {
    title: string;
    message: string;
    tone?: 'info' | 'warning' | 'danger';
    confirmLabel?: string;
    onConfirm: () => void;
  }): void {
    this.confirmModalTitle = options.title;
    this.confirmModalMessage = options.message;
    this.confirmModalTone = options.tone ?? 'info';
    this.confirmModalConfirmLabel = options.confirmLabel ?? 'Confirm';
    this.confirmModalConfirmAction = options.onConfirm;
    this.isConfirmModalOpen = true;
  }

  private closeConfirmModal(): void {
    this.isConfirmModalOpen = false;
    this.confirmModalConfirmAction = null;
  }
}
