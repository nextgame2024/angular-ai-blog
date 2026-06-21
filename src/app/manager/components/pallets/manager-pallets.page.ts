import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { combineLatest, Observable, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, map, take, takeUntil } from 'rxjs/operators';

import { ManagerPalletsActions, PalletsTab } from '../../store/pallets/manager.actions';
import {
  selectManagerPalletsActiveTab,
  selectManagerPalletsContext,
  selectManagerPalletsError,
  selectManagerPalletsIncoming,
  selectManagerPalletsIncomingPage,
  selectManagerPalletsIncomingTotal,
  selectManagerPalletsLoading,
  selectManagerPalletsOnSite,
  selectManagerPalletsOnSitePage,
  selectManagerPalletsOnSiteTotal,
  selectManagerPalletsSearchQuery,
  selectManagerPalletsSent,
  selectManagerPalletsSentPage,
  selectManagerPalletsSentTotal,
} from '../../store/pallets/manager.selectors';
import type { BmPalletMovement } from '../../types/pallets.interface';
import type { BmSite } from '../../types/sites.interface';
import { ManagerSelectComponent } from '../shared/manager-select/manager-select.component';

@Component({
  selector: 'app-manager-pallets-page',
  imports: [CommonModule, ReactiveFormsModule, RouterModule, ManagerSelectComponent],
  templateUrl: './manager-pallets.page.html',
  styleUrls: [
    '../clients/manager-clients.page.css',
    './manager-pallets.page.css',
  ],
})
export class ManagerPalletsPageComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private onSiteObserver?: IntersectionObserver;
  private sentObserver?: IntersectionObserver;
  private incomingObserver?: IntersectionObserver;
  private loadingMoreOnSite = false;
  private loadingMoreSent = false;
  private loadingMoreIncoming = false;
  private canLoadMoreOnSite = false;
  private canLoadMoreSent = false;
  private canLoadMoreIncoming = false;
  private isLoading = false;
  private currentOnSitePage = 1;
  private currentSentPage = 1;
  private currentIncomingPage = 1;

  activeTab$ = this.store.select(selectManagerPalletsActiveTab);
  context$ = this.store.select(selectManagerPalletsContext);
  onSite$ = this.store.select(selectManagerPalletsOnSite);
  sent$ = this.store.select(selectManagerPalletsSent);
  incoming$ = this.store.select(selectManagerPalletsIncoming);
  loading$ = this.store.select(selectManagerPalletsLoading);
  error$ = this.store.select(selectManagerPalletsError);
  searchQuery$ = this.store.select(selectManagerPalletsSearchQuery);
  onSitePage$ = this.store.select(selectManagerPalletsOnSitePage);
  sentPage$ = this.store.select(selectManagerPalletsSentPage);
  incomingPage$ = this.store.select(selectManagerPalletsIncomingPage);
  onSiteCanLoadMore$!: Observable<boolean>;
  sentCanLoadMore$!: Observable<boolean>;
  incomingCanLoadMore$!: Observable<boolean>;

  searchCtrl: FormControl<string>;
  dismissedErrors = new Set<string>();
  formMessage: string | null = null;

  moveForm = this.fb.group({
    origin_site_id: [{ value: '', disabled: true }, [Validators.required]],
    destination_site_id: ['', [Validators.required]],
    pallets: [1, [Validators.required, Validators.min(1)]],
  });

  destinationOptions: Array<{ value: string; label: string }> = [];

  isConfirmModalOpen = false;
  confirmModalTitle = '';
  confirmModalMessage = '';
  confirmModalConfirmLabel = 'Confirm';
  confirmModalCancelLabel = 'Cancel';
  confirmModalTone: 'info' | 'warning' | 'danger' = 'info';
  private confirmModalConfirmAction: (() => void) | null = null;

  @ViewChild('onSiteList') onSiteListRef?: ElementRef<HTMLElement>;
  @ViewChild('sentList') sentListRef?: ElementRef<HTMLElement>;
  @ViewChild('incomingList') incomingListRef?: ElementRef<HTMLElement>;
  @ViewChild('onSiteSentinel') onSiteSentinelRef?: ElementRef<HTMLElement>;
  @ViewChild('sentSentinel') sentSentinelRef?: ElementRef<HTMLElement>;
  @ViewChild('incomingSentinel') incomingSentinelRef?: ElementRef<HTMLElement>;

  constructor(
    private store: Store,
    private fb: FormBuilder,
    private actions$: Actions,
  ) {
    this.searchCtrl = this.fb.control('', { nonNullable: true });
    this.onSiteCanLoadMore$ = combineLatest([
      this.store.select(selectManagerPalletsOnSiteTotal),
      this.onSite$,
      this.loading$,
    ]).pipe(map(([total, items, loading]) => !loading && items.length < total));
    this.sentCanLoadMore$ = combineLatest([
      this.store.select(selectManagerPalletsSentTotal),
      this.sent$,
      this.loading$,
    ]).pipe(map(([total, items, loading]) => !loading && items.length < total));
    this.incomingCanLoadMore$ = combineLatest([
      this.store.select(selectManagerPalletsIncomingTotal),
      this.incoming$,
      this.loading$,
    ]).pipe(map(([total, items, loading]) => !loading && items.length < total));

    this.onSitePage$.pipe(takeUntil(this.destroy$)).subscribe((page) => {
      this.currentOnSitePage = page || 1;
    });
    this.sentPage$.pipe(takeUntil(this.destroy$)).subscribe((page) => {
      this.currentSentPage = page || 1;
    });
    this.incomingPage$.pipe(takeUntil(this.destroy$)).subscribe((page) => {
      this.currentIncomingPage = page || 1;
    });
    this.onSiteCanLoadMore$.pipe(takeUntil(this.destroy$)).subscribe((v) => {
      this.canLoadMoreOnSite = v;
    });
    this.sentCanLoadMore$.pipe(takeUntil(this.destroy$)).subscribe((v) => {
      this.canLoadMoreSent = v;
    });
    this.incomingCanLoadMore$.pipe(takeUntil(this.destroy$)).subscribe((v) => {
      this.canLoadMoreIncoming = v;
    });
    this.loading$.pipe(takeUntil(this.destroy$)).subscribe((loading) => {
      this.isLoading = loading;
      if (!loading) {
        this.loadingMoreOnSite = false;
        this.loadingMoreSent = false;
        this.loadingMoreIncoming = false;
      }
    });
    this.actions$
      .pipe(
        ofType(
          ManagerPalletsActions.movePalletsSuccess,
          ManagerPalletsActions.movePalletsFailure,
        ),
        takeUntil(this.destroy$),
      )
      .subscribe((action) => {
        if (action.type === ManagerPalletsActions.movePalletsSuccess.type) {
          this.formMessage = null;
          this.moveForm.patchValue({ destination_site_id: '', pallets: 1 });
          this.store.dispatch(ManagerPalletsActions.loadContext());
          this.store.dispatch(ManagerPalletsActions.loadOnSite({ page: 1 }));
          return;
        }
        this.formMessage =
          (action as ReturnType<typeof ManagerPalletsActions.movePalletsFailure>).error ||
          'Failed to move pallets';
      });
  }

  ngOnInit(): void {
    this.store.dispatch(ManagerPalletsActions.loadContext());
    this.store.dispatch(ManagerPalletsActions.loadOnSite({ page: 1 }));
    this.store.dispatch(ManagerPalletsActions.loadSent({ page: 1 }));
    this.store.dispatch(ManagerPalletsActions.loadIncoming({ page: 1 }));

    this.searchQuery$.pipe(takeUntil(this.destroy$)).subscribe((query) => {
      if (this.searchCtrl.value !== (query || '')) {
        this.searchCtrl.setValue(query || '', { emitEvent: false });
      }
      this.store.dispatch(ManagerPalletsActions.loadOnSite({ page: 1 }));
    });
    this.searchCtrl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((query) =>
        this.store.dispatch(
          ManagerPalletsActions.setSearchQuery({ query: query || '' }),
        ),
      );
    this.context$.pipe(takeUntil(this.destroy$)).subscribe((context) => {
      const originId = context.originSite?.siteId ?? '';
      this.moveForm.controls.origin_site_id.setValue(originId, {
        emitEvent: false,
      });
      this.destinationOptions = (context.destinationSites ?? []).map((site) => ({
        value: site.siteId,
        label: site.siteName,
      }));
    });
    this.activeTab$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      setTimeout(() => {
        this.setupOnSiteScroll();
        this.setupSentScroll();
        this.setupIncomingScroll();
      }, 0);
    });
  }

  ngOnDestroy(): void {
    this.onSiteObserver?.disconnect();
    this.sentObserver?.disconnect();
    this.incomingObserver?.disconnect();
    this.destroy$.next();
    this.destroy$.complete();
  }

  trackBySite = (_: number, site: BmSite) => site.siteId;
  trackByMovement = (_: number, movement: BmPalletMovement) => movement.palletId;

  dismissError(message: string): void {
    if (message) this.dismissedErrors.add(message);
  }
  isErrorDismissed(message: string | null | undefined): boolean {
    return message ? this.dismissedErrors.has(message) : false;
  }
  clearSearch(): void {
    this.searchCtrl.setValue('');
  }
  setTab(tab: PalletsTab): void {
    this.store.dispatch(ManagerPalletsActions.setActiveTab({ tab }));
  }

  sendPallets(originSite: BmSite | null | undefined): void {
    this.formMessage = null;
    if (!originSite?.siteId) {
      this.formMessage = 'No origin site is assigned to this user.';
      return;
    }
    if (this.moveForm.invalid) {
      this.moveForm.markAllAsTouched();
      return;
    }
    const raw = this.moveForm.getRawValue();
    const pallets = Number(raw.pallets ?? 0);
    if (pallets > Number(originSite.palletsOnsite ?? 0)) {
      this.formMessage = 'The origin site does not have enough pallets to move.';
      return;
    }
    this.store.dispatch(
      ManagerPalletsActions.movePallets({
        payload: {
          origin_site_id: originSite.siteId,
          destination_site_id: raw.destination_site_id,
          pallets,
        },
      }),
    );
  }

  deleteMovement(movement: BmPalletMovement): void {
    this.openConfirmModal({
      title: 'Delete Movement?',
      message: 'Are you sure you want to delete this movement?',
      tone: 'danger',
      confirmLabel: 'Confirm',
      onConfirm: () =>
        this.store.dispatch(
          ManagerPalletsActions.deleteMovement({ palletId: movement.palletId }),
        ),
    });
  }

  receiveMovement(movement: BmPalletMovement): void {
    this.openConfirmModal({
      title: 'Receive Pallets?',
      message: 'These pallets will be added to the site inventory.',
      tone: 'info',
      confirmLabel: 'Confirm',
      onConfirm: () =>
        this.store.dispatch(
          ManagerPalletsActions.receiveMovement({ palletId: movement.palletId }),
        ),
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

  private setupOnSiteScroll(): void {
    this.setupScroll(
      this.onSiteObserver,
      this.onSiteSentinelRef,
      this.onSiteListRef,
      (observer) => (this.onSiteObserver = observer),
      () => {
        if (!this.canLoadMoreOnSite || this.isLoading || this.loadingMoreOnSite) return;
        this.loadingMoreOnSite = true;
        this.store.dispatch(
          ManagerPalletsActions.loadOnSite({ page: this.currentOnSitePage + 1 }),
        );
      },
    );
  }

  private setupSentScroll(): void {
    this.setupScroll(
      this.sentObserver,
      this.sentSentinelRef,
      this.sentListRef,
      (observer) => (this.sentObserver = observer),
      () => {
        if (!this.canLoadMoreSent || this.isLoading || this.loadingMoreSent) return;
        this.loadingMoreSent = true;
        this.store.dispatch(
          ManagerPalletsActions.loadSent({ page: this.currentSentPage + 1 }),
        );
      },
    );
  }

  private setupIncomingScroll(): void {
    this.setupScroll(
      this.incomingObserver,
      this.incomingSentinelRef,
      this.incomingListRef,
      (observer) => (this.incomingObserver = observer),
      () => {
        if (
          !this.canLoadMoreIncoming ||
          this.isLoading ||
          this.loadingMoreIncoming
        ) {
          return;
        }
        this.loadingMoreIncoming = true;
        this.store.dispatch(
          ManagerPalletsActions.loadIncoming({
            page: this.currentIncomingPage + 1,
          }),
        );
      },
    );
  }

  private setupScroll(
    currentObserver: IntersectionObserver | undefined,
    sentinelRef: ElementRef<HTMLElement> | undefined,
    listRef: ElementRef<HTMLElement> | undefined,
    setObserver: (observer: IntersectionObserver) => void,
    onIntersect: () => void,
  ): void {
    const sentinel = sentinelRef?.nativeElement;
    const list = listRef?.nativeElement;
    if (!sentinel || !list) return;
    currentObserver?.disconnect();
    const scrollRoot = list.closest('.content') as HTMLElement | null;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        onIntersect();
      },
      { root: scrollRoot, rootMargin: '200px 0px', threshold: 0.1 },
    );
    observer.observe(sentinel);
    setObserver(observer);
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
