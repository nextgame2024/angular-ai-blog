import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
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
import { debounceTime, distinctUntilChanged, startWith } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';

import { ManagerLaborActions } from '../../store/labor/manager.actions';
import {
  selectManagerEditingLabor,
  selectManagerLabor,
  selectManagerLaborDailyRate,
  selectManagerLaborDailyRateSaving,
  selectManagerLaborError,
  selectManagerLaborLoading,
  selectManagerLaborPage,
  selectManagerLaborSearchQuery,
  selectManagerLaborTotal,
  selectManagerLaborViewMode,
} from '../../store/labor/manager.selectors';

import type { BmLabor } from '../../types/labor.interface';
import { ManagerSelectComponent } from '../shared/manager-select/manager-select.component';

@Component({
  selector: 'app-manager-labor-page',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    ManagerSelectComponent,
  ],
  templateUrl: './manager-labor.page.html',
  styleUrls: ['./manager-labor.page.css'],
})
export class ManagerLaborPageComponent {
  private readonly store = inject(Store);
  private readonly fb = inject(FormBuilder);
  private readonly actions$ = inject(Actions);

  private dailyRateToastHideTimer: ReturnType<typeof setTimeout> | null = null;
  private dailyRateToastRemoveTimer: ReturnType<typeof setTimeout> | null =
    null;
  private infiniteObserver: IntersectionObserver | null = null;

  private readonly currentDailyRate$$ = signal(0);
  private readonly previousSearchQuery$$ = signal<string | null>(null);
  private readonly closeAfterSave$$ = signal(false);

  readonly loading$$ = toSignal(this.store.select(selectManagerLaborLoading), {
    initialValue: false,
  });
  readonly error$$ = toSignal(this.store.select(selectManagerLaborError), {
    initialValue: null,
  });
  readonly laborRaw$$ = toSignal(this.store.select(selectManagerLabor), {
    initialValue: [] as BmLabor[],
  });
  readonly dailyRate$$ = toSignal(
    this.store.select(selectManagerLaborDailyRate),
    {
      initialValue: 0,
    },
  );
  readonly dailyRateSaving$$ = toSignal(
    this.store.select(selectManagerLaborDailyRateSaving),
    { initialValue: false },
  );
  readonly total$$ = toSignal(this.store.select(selectManagerLaborTotal), {
    initialValue: 0,
  });
  readonly viewMode$$ = toSignal(
    this.store.select(selectManagerLaborViewMode),
    {
      initialValue: 'list',
    },
  );
  readonly editingLabor$$ = toSignal(
    this.store.select(selectManagerEditingLabor),
    {
      initialValue: null,
    },
  );
  readonly page$$ = toSignal(this.store.select(selectManagerLaborPage), {
    initialValue: 1,
  });
  readonly searchQuery$$ = toSignal(
    this.store.select(selectManagerLaborSearchQuery),
    { initialValue: '' },
  );

  readonly searchCtrl = new FormControl<string>('', { nonNullable: true });
  readonly dailyRateCtrl = new FormControl<string>('0.00', {
    nonNullable: true,
  });

  private readonly searchValue$$ = toSignal(
    this.searchCtrl.valueChanges.pipe(startWith(this.searchCtrl.value)),
    { initialValue: this.searchCtrl.value },
  );

  readonly filteredLabor$$ = computed(() => {
    const labor = this.laborRaw$$();
    const query = (this.searchValue$$() || '').trim().toLowerCase();
    if (!query) return labor;
    return labor.filter((l) => l.laborName?.toLowerCase().includes(query));
  });

  readonly canLoadMore$$ = computed(() => {
    const total = this.total$$();
    if (!total) return false;
    return !this.loading$$() && this.laborRaw$$().length < total;
  });

  readonly isLoadingMore$$ = signal(false);
  readonly dismissedErrors$$ = signal<Set<string>>(new Set());
  readonly isConfirmModalOpen$$ = signal(false);
  readonly confirmModalTitle$$ = signal('');
  readonly confirmModalMessage$$ = signal('');
  readonly confirmModalConfirmLabel$$ = signal('Continue');
  readonly confirmModalCancelLabel$$ = signal('Cancel');
  readonly confirmModalShowCancel$$ = signal(false);
  readonly confirmModalTone$$ = signal<'info' | 'warning' | 'danger'>('info');
  private confirmModalConfirmAction: (() => void) | null = null;
  private confirmModalCancelAction: (() => void) | null = null;
  readonly dailyRateToastVisible$$ = signal(false);
  readonly dailyRateToastClosing$$ = signal(false);
  readonly dailyRateToastTone$$ = signal<'success' | 'error'>('success');
  readonly dailyRateToastMessage$$ = signal('');

  readonly statusOptions = [
    { value: 'active', label: 'active' },
    { value: 'archived', label: 'archived' },
  ];

  readonly unitTypeOptions = [
    { value: 'hour', label: 'hour' },
    { value: 'day', label: 'day' },
    { value: 'week', label: 'week' },
    { value: 'month', label: 'month' },
    { value: 'project', label: 'project' },
  ];

  readonly laborListRef$$ = viewChild<ElementRef<HTMLElement>>('laborList');
  readonly infiniteSentinelRef$$ =
    viewChild<ElementRef<HTMLElement>>('infiniteSentinel');

  readonly laborForm = this.fb.group({
    labor_name: ['', [Validators.required, Validators.maxLength(140)]],
    unit_type: ['hour'],
    unit_cost: [
      null as string | null,
      [Validators.required, Validators.min(0)],
    ],
    sell_cost: [null as string | null, [Validators.min(0)]],
    unit_productivity: [null as number | null, [Validators.min(0)]],
    productivity_unit: ['m²/hr'],
    status: ['active', [Validators.required]],
  });

  private readonly initEffect = effect((onCleanup) => {
    this.store.dispatch(ManagerLaborActions.loadDailyRate());

    onCleanup(() => {
      this.infiniteObserver?.disconnect();
      this.infiniteObserver = null;
      this.clearDailyRateToastTimers();
    });
  });

  private readonly searchQueryEffect = effect(() => {
    const next = this.searchQuery$$() || '';
    if (this.searchCtrl.value !== next) {
      this.searchCtrl.setValue(next, { emitEvent: false });
    }

    const previous = this.previousSearchQuery$$();
    if (previous !== next) {
      this.previousSearchQuery$$.set(next);
      this.store.dispatch(ManagerLaborActions.loadLabor({ page: 1 }));
    }
  });

  private readonly searchInputEffect = effect((onCleanup) => {
    const sub = this.searchCtrl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged())
      .subscribe((query) => {
        this.store.dispatch(
          ManagerLaborActions.setLaborSearchQuery({ query: query || '' }),
        );
      });

    onCleanup(() => sub.unsubscribe());
  });

  private readonly dailyRateEffect = effect(() => {
    const normalized = this.normalizeDailyRate(this.dailyRate$$()) ?? 0;
    this.currentDailyRate$$.set(normalized);
    const formatted = this.formatMoneyInput(normalized) ?? '0.00';
    if (this.dailyRateCtrl.value !== formatted) {
      this.dailyRateCtrl.setValue(formatted, { emitEvent: false });
    }
  });

  private readonly dailyRateInputEffect = effect((onCleanup) => {
    const sub = this.dailyRateCtrl.valueChanges
      .pipe(debounceTime(600), distinctUntilChanged())
      .subscribe((value) => {
        const nextRate = this.normalizeDailyRate(value);
        if (nextRate === null) return;
        if (Math.abs(nextRate - this.currentDailyRate$$()) < 0.0001) return;
        this.store.dispatch(
          ManagerLaborActions.updateDailyRate({ dailyRate: nextRate }),
        );
      });

    onCleanup(() => sub.unsubscribe());
  });

  private readonly viewModeEffect = effect(() => {
    const mode = this.viewMode$$();
    if (mode !== 'list') {
      this.infiniteObserver?.disconnect();
      return;
    }

    setTimeout(() => this.setupInfiniteScroll(), 0);
  });

  private readonly editingLaborEffect = effect(() => {
    const labor = this.editingLabor$$();
    if (!labor) return;

    this.laborForm.patchValue({
      labor_name: labor.laborName ?? '',
      unit_type: labor.unitType ?? 'hour',
      unit_cost: this.formatMoneyInput(labor.unitCost),
      sell_cost: this.formatMoneyInput(labor.sellCost),
      unit_productivity:
        labor.unitProductivity === null || labor.unitProductivity === undefined
          ? null
          : this.toInt(labor.unitProductivity),
      productivity_unit: labor.productivityUnit ?? '',
      status: labor.status ?? 'active',
    });
  });

  private readonly loadingEffect = effect(() => {
    if (!this.loading$$()) {
      this.isLoadingMore$$.set(false);
    }
  });

  private readonly saveLaborEffect = effect((onCleanup) => {
    const sub = this.actions$
      .pipe(
        ofType(
          ManagerLaborActions.saveLaborSuccess,
          ManagerLaborActions.saveLaborFailure,
        ),
      )
      .subscribe((action) => {
        if (!this.closeAfterSave$$()) return;
        this.closeAfterSave$$.set(false);
        if (action.type === ManagerLaborActions.saveLaborSuccess.type) {
          this.closeForm();
        }
      });

    onCleanup(() => sub.unsubscribe());
  });

  private readonly dailyRateActionEffect = effect((onCleanup) => {
    const sub = this.actions$
      .pipe(
        ofType(
          ManagerLaborActions.updateDailyRateSuccess,
          ManagerLaborActions.updateDailyRateFailure,
        ),
      )
      .subscribe((action) => {
        if (action.type === ManagerLaborActions.updateDailyRateSuccess.type) {
          this.showDailyRateToast(
            'Hourly rate updated successfully.',
            'success',
          );
          return;
        }

        const failure = action as { error?: string };
        this.showDailyRateToast(
          failure?.error || 'Unable to update hourly rate.',
          'error',
        );
      });

    onCleanup(() => sub.unsubscribe());
  });

  dismissError(message: string): void {
    if (!message) return;
    this.dismissedErrors$$.update((current) => {
      const next = new Set(current);
      next.add(message);
      return next;
    });
  }

  isErrorDismissed(message: string | null | undefined): boolean {
    return message ? this.dismissedErrors$$().has(message) : false;
  }

  readonly trackByLabor = (_: number, l: BmLabor) => l.laborId;

  openCreate(): void {
    this.laborForm.reset({
      labor_name: '',
      unit_type: 'hour',
      unit_cost: null,
      sell_cost: null,
      unit_productivity: null,
      productivity_unit: 'm²/hr',
      status: 'active',
    });

    this.store.dispatch(ManagerLaborActions.openLaborCreate());
  }

  openEdit(l: BmLabor): void {
    this.store.dispatch(
      ManagerLaborActions.openLaborEdit({ laborId: l.laborId }),
    );
  }

  closeForm(): void {
    this.store.dispatch(ManagerLaborActions.closeLaborForm());
  }

  saveLabor(): void {
    if (this.laborForm.invalid) {
      this.laborForm.markAllAsTouched();
      return;
    }

    const payload = {
      ...this.laborForm.getRawValue(),
    } as {
      labor_name: string;
      unit_type: string;
      unit_cost: number | string | null;
      sell_cost: number | string | null;
      unit_productivity: number | string | null;
      productivity_unit: string;
      status: string;
      [key: string]: unknown;
    };

    if (payload.unit_cost !== null && payload.unit_cost !== '') {
      payload.unit_cost = this.formatMoney(payload.unit_cost);
    }
    if (payload.sell_cost !== null && payload.sell_cost !== '') {
      payload.sell_cost = this.formatMoney(payload.sell_cost);
    }
    if (
      payload.unit_productivity !== null &&
      payload.unit_productivity !== ''
    ) {
      payload.unit_productivity = Number(payload.unit_productivity);
    }

    delete payload['company_id'];
    delete payload['companyId'];
    delete payload['labor_id'];
    delete payload['laborId'];

    this.store.dispatch(ManagerLaborActions.saveLabor({ payload }));
  }

  saveLaborAndClose(): void {
    if (this.laborForm.invalid) {
      this.laborForm.markAllAsTouched();
      return;
    }
    this.closeAfterSave$$.set(true);
    this.saveLabor();
  }

  removeLabor(l: BmLabor): void {
    if (this.isArchiveActionDisabled(l)) return;

    const hasProjects = !!l.hasProjects;
    const title = hasProjects ? 'Archive Labor?' : 'Delete Labor?';
    const message = hasProjects
      ? `"${l.laborName}" labor is linked to existing processes, so it cannot be deleted. Would you like to archive it instead?`
      : `Are you sure you want to delete "${l.laborName}"?`;
    this.openConfirmModal({
      title,
      message,
      tone: hasProjects ? 'warning' : 'danger',
      confirmLabel: hasProjects ? 'Archive' : 'Delete',
      onConfirm: () =>
        this.store.dispatch(
          ManagerLaborActions.removeLabor({ laborId: l.laborId }),
        ),
    });
  }

  isArchiveActionDisabled(l: BmLabor): boolean {
    return (l.status ?? 'active') === 'archived';
  }

  private setupInfiniteScroll(): void {
    const sentinel = this.infiniteSentinelRef$$()?.nativeElement;
    const list = this.laborListRef$$()?.nativeElement;
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
    if (!this.canLoadMore$$()) return;
    if (this.loading$$() || this.isLoadingMore$$()) return;

    this.isLoadingMore$$.set(true);
    const nextPage = (this.page$$() || 1) + 1;
    this.store.dispatch(ManagerLaborActions.loadLabor({ page: nextPage }));
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
    this.confirmModalTitle$$.set(options.title);
    this.confirmModalMessage$$.set(options.message);
    this.confirmModalTone$$.set(options.tone ?? 'info');
    this.confirmModalConfirmLabel$$.set(options.confirmLabel ?? 'Continue');
    this.confirmModalCancelLabel$$.set(options.cancelLabel ?? 'Cancel');
    this.confirmModalShowCancel$$.set(true);
    this.confirmModalConfirmAction = options.onConfirm;
    this.confirmModalCancelAction = options.onCancel ?? null;
    this.isConfirmModalOpen$$.set(true);
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
    if (this.confirmModalShowCancel$$()) {
      this.onConfirmModalCancel();
    } else {
      this.onConfirmModalConfirm();
    }
  }

  private closeConfirmModal(): void {
    this.isConfirmModalOpen$$.set(false);
    this.confirmModalConfirmAction = null;
    this.confirmModalCancelAction = null;
  }

  formatInt(value?: number | null): string {
    if (value === null || value === undefined) return '—';
    return String(this.toInt(value));
  }

  private toInt(value: number): number {
    if (Number.isNaN(value)) return 0;
    return Math.round(value);
  }

  private formatMoney(
    value: number | string | null | undefined,
  ): number | null {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    if (Number.isNaN(num)) return null;
    return Math.round(num * 100) / 100;
  }

  private formatMoneyInput(
    value: number | string | null | undefined,
  ): string | null {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    if (Number.isNaN(num)) return null;
    return num.toFixed(2);
  }

  formatMoneyControl(controlName: 'unit_cost' | 'sell_cost'): void {
    const control = this.laborForm.controls[controlName];
    const formatted = this.formatMoneyInput(control.value);
    control.setValue(formatted, { emitEvent: false });
  }

  onDailyRateBlur(): void {
    const normalized = this.normalizeDailyRate(this.dailyRateCtrl.value);
    this.dailyRateCtrl.setValue(
      this.formatMoneyInput(normalized ?? 0) ?? '0.00',
      { emitEvent: false },
    );
  }

  private normalizeDailyRate(
    value: string | number | null | undefined,
  ): number | null {
    if (value === null || value === undefined || value === '') return 0;
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) return null;
    return Math.round(num * 100) / 100;
  }

  private showDailyRateToast(message: string, tone: 'success' | 'error'): void {
    this.clearDailyRateToastTimers();

    this.dailyRateToastMessage$$.set(message);
    this.dailyRateToastTone$$.set(tone);
    this.dailyRateToastVisible$$.set(true);
    this.dailyRateToastClosing$$.set(false);

    this.dailyRateToastHideTimer = setTimeout(() => {
      this.dailyRateToastClosing$$.set(true);
    }, 2500);

    this.dailyRateToastRemoveTimer = setTimeout(() => {
      this.dailyRateToastVisible$$.set(false);
      this.dailyRateToastClosing$$.set(false);
    }, 3000);
  }

  private clearDailyRateToastTimers(): void {
    if (this.dailyRateToastHideTimer) {
      clearTimeout(this.dailyRateToastHideTimer);
      this.dailyRateToastHideTimer = null;
    }
    if (this.dailyRateToastRemoveTimer) {
      clearTimeout(this.dailyRateToastRemoveTimer);
      this.dailyRateToastRemoveTimer = null;
    }
  }
}
