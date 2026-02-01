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

import { ManagerPricingActions } from '../../store/pricing/manager.actions';
import {
  selectManagerEditingPricingProfile,
  selectManagerPricingError,
  selectManagerPricingLoading,
  selectManagerPricingPage,
  selectManagerPricingProfiles,
  selectManagerPricingSearchQuery,
  selectManagerPricingTotal,
  selectManagerPricingViewMode,
} from '../../store/pricing/manager.selectors';

import type { BmPricingProfile } from '../../types/pricing.interface';

@Component({
  selector: 'app-manager-pricing-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './manager-pricing.page.html',
  styleUrls: ['./manager-pricing.page.css'],
})
export class ManagerPricingPageComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  loading$ = this.store.select(selectManagerPricingLoading);
  error$ = this.store.select(selectManagerPricingError);
  pricingRaw$ = this.store.select(selectManagerPricingProfiles);
  total$ = this.store.select(selectManagerPricingTotal);
  viewMode$ = this.store.select(selectManagerPricingViewMode);
  editingPricing$ = this.store.select(selectManagerEditingPricingProfile);
  page$ = this.store.select(selectManagerPricingPage);

  searchQuery$ = this.store.select(selectManagerPricingSearchQuery);
  searchCtrl: FormControl<string>;
  filteredPricing$!: Observable<BmPricingProfile[]>;
  canLoadMore$!: Observable<boolean>;

  private infiniteObserver?: IntersectionObserver;
  private isLoadingMore = false;
  private currentPage = 1;
  private canLoadMore = false;
  private isLoading = false;

  @ViewChild('pricingList') pricingListRef?: ElementRef<HTMLElement>;
  @ViewChild('infiniteSentinel') infiniteSentinelRef?: ElementRef<HTMLElement>;

  pricingForm = this.fb.group({
    profile_name: ['', [Validators.required, Validators.maxLength(120)]],
    material_markup: [0, [Validators.min(0)]],
    labor_markup: [0, [Validators.min(0)]],
    gst_rate: [10, [Validators.min(0)]],
    status: ['active', [Validators.required]],
  });

  constructor(
    private store: Store,
    private fb: FormBuilder,
  ) {
    this.searchCtrl = this.fb.control('', { nonNullable: true });

    this.filteredPricing$ = combineLatest([
      this.pricingRaw$,
      this.searchCtrl.valueChanges.pipe(startWith('')),
    ]).pipe(
      map(([profiles, query]) => {
        const q = (query || '').trim().toLowerCase();
        if (!q) return profiles;
        return profiles.filter((p) =>
          p.profileName?.toLowerCase().includes(q),
        );
      }),
    );

    this.canLoadMore$ = combineLatest([
      this.total$,
      this.pricingRaw$,
      this.loading$,
    ]).pipe(
      map(([total, profiles, loading]) => !loading && profiles.length < total),
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
    this.store.dispatch(ManagerPricingActions.loadPricingProfiles({ page: 1 }));

    this.searchQuery$.pipe(takeUntil(this.destroy$)).subscribe((query) => {
      if (this.searchCtrl.value !== (query || '')) {
        this.searchCtrl.setValue(query || '', { emitEvent: false });
      }
      this.store.dispatch(ManagerPricingActions.loadPricingProfiles({ page: 1 }));
    });

    this.searchCtrl.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        takeUntil(this.destroy$),
      )
      .subscribe((query) =>
        this.store.dispatch(
          ManagerPricingActions.setPricingSearchQuery({ query: query || '' }),
        ),
      );

    this.viewMode$
      .pipe(takeUntil(this.destroy$))
      .subscribe((mode) => {
        if (mode !== 'list') return;
        setTimeout(() => this.setupInfiniteScroll(), 0);
      });

    this.editingPricing$.pipe(takeUntil(this.destroy$)).subscribe((p) => {
      if (!p) return;

      this.pricingForm.patchValue({
        profile_name: p.profileName ?? '',
        material_markup: this.toPercent(p.materialMarkup),
        labor_markup: this.toPercent(p.laborMarkup),
        gst_rate: this.toPercent(p.gstRate),
        status: p.status ?? 'active',
      });
    });
  }

  ngOnDestroy(): void {
    this.infiniteObserver?.disconnect();
    this.destroy$.next();
    this.destroy$.complete();
  }

  trackByPricing = (_: number, p: BmPricingProfile) => p.pricingProfileId;

  openCreate(): void {
    this.pricingForm.reset({
      profile_name: '',
      material_markup: 0,
      labor_markup: 0,
      gst_rate: 10,
      status: 'active',
    });

    this.store.dispatch(ManagerPricingActions.openPricingCreate());
  }

  openEdit(p: BmPricingProfile): void {
    this.store.dispatch(
      ManagerPricingActions.openPricingEdit({ pricingProfileId: p.pricingProfileId }),
    );
  }

  closeForm(): void {
    this.store.dispatch(ManagerPricingActions.closePricingForm());
  }

  savePricing(): void {
    if (this.pricingForm.invalid) {
      this.pricingForm.markAllAsTouched();
      return;
    }

    const payload: any = this.pricingForm.getRawValue();

    if (payload.material_markup !== null && payload.material_markup !== '') {
      payload.material_markup = this.fromPercent(payload.material_markup);
    }
    if (payload.labor_markup !== null && payload.labor_markup !== '') {
      payload.labor_markup = this.fromPercent(payload.labor_markup);
    }
    if (payload.gst_rate !== null && payload.gst_rate !== '') {
      payload.gst_rate = this.fromPercent(payload.gst_rate);
    }

    delete payload.company_id;
    delete payload.companyId;
    delete payload.pricing_profile_id;
    delete payload.pricingProfileId;

    this.store.dispatch(ManagerPricingActions.savePricingProfile({ payload }));
  }

  archivePricing(p: BmPricingProfile): void {
    const ok = window.confirm(
      `Archive pricing profile "${p.profileName}"?\n\nThis is a soft-delete (status = archived).`,
    );
    if (!ok) return;

    this.store.dispatch(
      ManagerPricingActions.archivePricingProfile({
        pricingProfileId: p.pricingProfileId,
      }),
    );
  }

  private setupInfiniteScroll(): void {
    const sentinel = this.infiniteSentinelRef?.nativeElement;
    const list = this.pricingListRef?.nativeElement;
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
      ManagerPricingActions.loadPricingProfiles({ page: this.currentPage + 1 }),
    );
  }

  formatPercent(value?: number | null): string {
    if (value === null || value === undefined) return '—';
    const pct = value * 100;
    const rounded = Math.round((pct + Number.EPSILON) * 100) / 100;
    return String(rounded);
  }

  private toPercent(value?: number | null): number {
    if (value === null || value === undefined) return 0;
    return Math.round(value * 10000) / 100;
  }

  private fromPercent(value: number): number {
    if (Number.isNaN(value)) return 0;
    return value / 100;
  }
}
