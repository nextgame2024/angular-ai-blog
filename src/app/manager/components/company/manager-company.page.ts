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
import { combineLatest, Observable, Subject, of } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  map,
  startWith,
  switchMap,
  take,
  takeUntil,
} from 'rxjs/operators';

import { ManagerCompanyActions } from '../../store/company/manager.actions';
import {
  selectManagerEditingCompany,
  selectManagerCompanies,
  selectManagerCompaniesError,
  selectManagerCompaniesLoading,
  selectManagerCompanySearchQuery,
  selectManagerCompaniesTotal,
  selectManagerCompaniesPage,
  selectManagerCompaniesViewMode,
} from '../../store/company/manager.selectors';

import type { BmCompany } from '../../types/company.interface';
import { ManagerSelectComponent } from '../shared/manager-select/manager-select.component';
import { TownPlannerV2Service } from '../../../townplanner/services/townplanner_v2.service';
import { TownPlannerV2AddressSuggestion } from '../../../townplanner/store/townplanner_v2.state';
import { selectCurrentUser } from '../../../auth/store/reducers';
import type { CurrentUserInterface } from '../../../shared/types/currentUser.interface';
import { AvatarUploadService } from '../../../settings/components/settings/services/avatar-upload.service';

@Component({
  selector: 'app-manager-company-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, ManagerSelectComponent],
  templateUrl: './manager-company.page.html',
  styleUrls: ['./manager-company.page.css'],
})
export class ManagerCompanyPageComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private readonly superAdminId = 'c2dad143-077c-4082-92f0-47805601db3b';

  loading$ = this.store.select(selectManagerCompaniesLoading);
  error$ = this.store.select(selectManagerCompaniesError);
  companiesRaw$ = this.store.select(selectManagerCompanies);
  total$ = this.store.select(selectManagerCompaniesTotal);
  viewMode$ = this.store.select(selectManagerCompaniesViewMode);
  editingCompany$ = this.store.select(selectManagerEditingCompany);
  page$ = this.store.select(selectManagerCompaniesPage);

  searchQuery$ = this.store.select(selectManagerCompanySearchQuery);
  searchCtrl: FormControl<string>;
  filteredCompanies$!: Observable<BmCompany[]>;
  canLoadMore$!: Observable<boolean>;
  currentUser: CurrentUserInterface | null = null;
  isSuperAdmin = false;

  private infiniteObserver?: IntersectionObserver;
  private isLoadingMore = false;
  private closeAfterSave = false;
  private currentPage = 1;
  private canLoadMore = false;
  private isLoading = false;
  dismissedErrors = new Set<string>();

  addressSuggestions: TownPlannerV2AddressSuggestion[] = [];
  showAddressSuggestions = false;
  addressActiveIndex = -1;
  private addressSessionToken: string | null = null;
  private addressHasFocus = false;

  statusOptions = [
    { value: 'active', label: 'active' },
    { value: 'archived', label: 'archived' },
  ];

  defaultLogo = '/assets/sophiaAi-logo.svg';
  logoPreviewUrl: string | null = null;
  selectedLogoFile?: File;
  isUploadingLogo = false;
  logoUploadError: string | null = null;

  @ViewChild('companiesList') companiesListRef?: ElementRef<HTMLElement>;
  @ViewChild('infiniteSentinel') infiniteSentinelRef?: ElementRef<HTMLElement>;

  companyForm = this.fb.group({
    company_name: ['', [Validators.required, Validators.maxLength(140)]],
    legal_name: [''],
    trading_name: [''],
    abn: [''],
    address: [''],
    email: ['', [Validators.email]],
    phone: [''],
    tel: [''],
    cel: [''],
    status: ['active', [Validators.required]],
    logo_url: [''],
  });

  constructor(
    private store: Store,
    private fb: FormBuilder,
    private actions$: Actions,
    private townPlanner: TownPlannerV2Service,
    private avatarUpload: AvatarUploadService,
  ) {
    this.searchCtrl = this.fb.control('', { nonNullable: true });

    this.filteredCompanies$ = combineLatest([
      this.companiesRaw$,
      this.searchCtrl.valueChanges.pipe(startWith('')),
    ]).pipe(
      map(([companies, query]) => {
        const q = (query || '').trim().toLowerCase();
        if (!q) return companies;
        return companies.filter((c) => {
          return (
            c.companyName?.toLowerCase().includes(q) ||
            c.legalName?.toLowerCase().includes(q) ||
            c.tradingName?.toLowerCase().includes(q) ||
            c.abn?.toLowerCase().includes(q) ||
            c.email?.toLowerCase().includes(q)
          );
        });
      }),
    );

    this.canLoadMore$ = combineLatest([
      this.total$,
      this.companiesRaw$,
      this.loading$,
    ]).pipe(
      map(
        ([total, companies, loading]) =>
          !loading && companies.length < total,
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
          ManagerCompanyActions.saveCompanySuccess,
          ManagerCompanyActions.saveCompanyFailure,
        ),
        takeUntil(this.destroy$),
      )
      .subscribe((action) => {
        if (action.type === ManagerCompanyActions.saveCompanySuccess.type) {
          if (!this.isSuperAdmin) {
            this.store.dispatch(
              ManagerCompanyActions.openCompanyEdit({
                companyId: action.company.companyId,
              }),
            );
            return;
          }
          if (this.closeAfterSave) {
            this.closeAfterSave = false;
            this.closeForm();
          }
          return;
        }
        if (this.closeAfterSave) this.closeAfterSave = false;
      });
  }

  ngOnInit(): void {
    this.store.dispatch(ManagerCompanyActions.loadCompanies({ page: 1 }));

    this.store
      .select(selectCurrentUser)
      .pipe(takeUntil(this.destroy$))
      .subscribe((user) => {
        this.currentUser = user ?? null;
        this.isSuperAdmin = user?.id === this.superAdminId;
        if (this.isSuperAdmin) {
          this.store.dispatch(ManagerCompanyActions.closeCompanyForm());
          this.store.dispatch(ManagerCompanyActions.loadCompanies({ page: 1 }));
        }
      });

    this.searchQuery$.pipe(takeUntil(this.destroy$)).subscribe((query) => {
      if (this.searchCtrl.value !== (query || '')) {
        this.searchCtrl.setValue(query || '', { emitEvent: false });
      }
      this.store.dispatch(ManagerCompanyActions.loadCompanies({ page: 1 }));
    });

    this.searchCtrl.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        takeUntil(this.destroy$),
      )
      .subscribe((query) =>
        this.store.dispatch(
          ManagerCompanyActions.setCompanySearchQuery({
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

    this.editingCompany$.pipe(takeUntil(this.destroy$)).subscribe((c) => {
      if (!c) return;

      this.resetLogoState();
      this.companyForm.patchValue({
        company_name: c.companyName ?? '',
        legal_name: c.legalName ?? '',
        trading_name: c.tradingName ?? '',
        abn: c.abn ?? '',
        address: c.address ?? '',
        email: c.email ?? '',
        phone: c.phone ?? '',
        tel: c.tel ?? '',
        cel: c.cel ?? '',
        status: c.status ?? 'active',
        logo_url: c.logoUrl ?? '',
      });
    });

    this.actions$
      .pipe(
        ofType(ManagerCompanyActions.loadCompaniesSuccess),
        takeUntil(this.destroy$),
      )
      .subscribe(({ result }) => {
        if (!this.currentUser || this.isSuperAdmin) return;
        const first = result.items?.[0];
        if (first) {
          this.store.dispatch(
            ManagerCompanyActions.openCompanyEdit({
              companyId: first.companyId,
            }),
          );
        }
      });

    this.setupAddressAutocomplete();
  }

  ngOnDestroy(): void {
    this.infiniteObserver?.disconnect();
    this.destroy$.next();
    this.destroy$.complete();
    this.revokeLogoPreview();
  }

  dismissError(message: string): void {
    if (message) this.dismissedErrors.add(message);
  }

  isErrorDismissed(message: string | null | undefined): boolean {
    return message ? this.dismissedErrors.has(message) : false;
  }

  trackByCompany = (_: number, c: BmCompany) => c.companyId;

  openCreate(): void {
    if (!this.isSuperAdmin) return;
    this.resetLogoState();
    this.companyForm.reset({
      company_name: '',
      legal_name: '',
      trading_name: '',
      abn: '',
      address: '',
      email: '',
      phone: '',
      tel: '',
      cel: '',
      status: 'active',
      logo_url: '',
    });

    this.store.dispatch(ManagerCompanyActions.openCompanyCreate());
  }

  openEdit(c: BmCompany): void {
    this.store.dispatch(
      ManagerCompanyActions.openCompanyEdit({ companyId: c.companyId }),
    );
  }

  closeForm(): void {
    if (!this.isSuperAdmin) return;
    this.store.dispatch(ManagerCompanyActions.closeCompanyForm());
  }

  saveCompany(): void {
    if (this.companyForm.invalid) {
      this.companyForm.markAllAsTouched();
      return;
    }

    const payload: any = this.companyForm.getRawValue();

    delete payload.company_id;
    delete payload.companyId;
    delete payload.owner_user_id;
    delete payload.ownerUserId;

    this.store.dispatch(ManagerCompanyActions.saveCompany({ payload }));
  }

  saveCompanyAndClose(): void {
    if (this.companyForm.invalid) {
      this.companyForm.markAllAsTouched();
      return;
    }
    this.closeAfterSave = true;
    this.saveCompany();
  }

  archiveCompany(c: BmCompany): void {
    if (!this.isSuperAdmin) return;
    const ok = window.confirm(
      `Archive company "${c.companyName}"?\n\nThis is a soft-delete (status = archived).`,
    );
    if (!ok) return;

    this.store.dispatch(
      ManagerCompanyActions.archiveCompany({ companyId: c.companyId }),
    );
  }

  get logoSrc(): string {
    return this.logoPreviewUrl || this.companyForm.controls.logo_url.value || this.defaultLogo;
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) return;

    if (file.size > 5_000_000) {
      this.logoUploadError = 'Image is too large. Max size is 5 MB.';
      input.value = '';
      return;
    }

    this.selectedLogoFile = file;
    this.revokeLogoPreview();
    this.logoPreviewUrl = URL.createObjectURL(file);
    this.logoUploadError = null;

    this.uploadLogo();
  }

  uploadLogo(): void {
    if (!this.selectedLogoFile || this.isUploadingLogo) return;
    this.isUploadingLogo = true;
    this.avatarUpload
      .uploadViaPresigned(this.selectedLogoFile, 'public/company-logos')
      .subscribe({
        next: ({ url }) => {
          this.companyForm.controls.logo_url.setValue(url);
          this.revokeLogoPreview();
          this.selectedLogoFile = undefined;
          this.isUploadingLogo = false;
        },
        error: (err) => {
          this.isUploadingLogo = false;
          const raw =
            err?.error?.error ||
            err?.error ||
            err?.message ||
            'Failed to upload image';
          this.logoUploadError =
            typeof raw === 'string' && raw.includes('EntityTooLarge')
              ? 'Image is too large. Max size is 5 MB.'
              : raw;
        },
      });
  }

  private revokeLogoPreview(): void {
    if (this.logoPreviewUrl) {
      URL.revokeObjectURL(this.logoPreviewUrl);
      this.logoPreviewUrl = null;
    }
  }

  private resetLogoState(): void {
    this.revokeLogoPreview();
    this.selectedLogoFile = undefined;
    this.logoUploadError = null;
    this.isUploadingLogo = false;
  }

  onAddressFocus(): void {
    this.addressHasFocus = true;
    const current = (this.companyForm.controls.address.value || '').trim();
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
    } else if (event.key === 'Enter') {
      if (this.addressActiveIndex >= 0) {
        event.preventDefault();
        this.onAddressSelect(this.addressSuggestions[this.addressActiveIndex]);
      }
    } else if (event.key === 'Escape') {
      this.showAddressSuggestions = false;
      this.addressActiveIndex = -1;
    }
  }

  onAddressSelect(suggestion: TownPlannerV2AddressSuggestion): void {
    this.companyForm.controls.address.setValue(suggestion.description, {
      emitEvent: false,
    });
    this.addressSuggestions = [];
    this.showAddressSuggestions = false;
    this.addressActiveIndex = -1;

    const token = this.addressSessionToken;
    this.addressSessionToken = null;

    this.townPlanner
      .getPlaceDetails(suggestion.placeId, token)
      .pipe(take(1))
      .subscribe((details) => {
        const next =
          details?.formattedAddress || suggestion.description || '';
        if (next) {
          this.companyForm.controls.address.setValue(next, {
            emitEvent: false,
          });
        }
      });
  }

  private setupAddressAutocomplete(): void {
    this.companyForm.controls.address.valueChanges
      .pipe(
        debounceTime(200),
        distinctUntilChanged(),
        switchMap((query) => {
          const q = (query || '').toString().trim();
          if (!this.addressHasFocus) {
            this.addressSuggestions = [];
            this.showAddressSuggestions = false;
            this.addressActiveIndex = -1;
            return of([]);
          }
          if (q.length < 3) {
            this.addressSuggestions = [];
            this.showAddressSuggestions = false;
            this.addressActiveIndex = -1;
            return of([]);
          }

          if (!this.addressSessionToken) {
            this.addressSessionToken = this.createSessionToken();
          }

          return this.townPlanner.suggestAddresses(q, this.addressSessionToken);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe((sugs) => {
        this.addressSuggestions = sugs || [];
        const shouldShow =
          this.addressHasFocus && this.addressSuggestions.length > 0;
        this.showAddressSuggestions = shouldShow;
        this.addressActiveIndex = shouldShow ? 0 : -1;
      });
  }

  private createSessionToken(): string {
    const cryptoObj = globalThis.crypto as Crypto | undefined;
    if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
    return Math.random().toString(36).slice(2);
  }

  private setupInfiniteScroll(): void {
    const sentinel = this.infiniteSentinelRef?.nativeElement;
    const list = this.companiesListRef?.nativeElement;
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
      ManagerCompanyActions.loadCompanies({ page: this.currentPage + 1 }),
    );
  }
}
