import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
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
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { combineLatest, Observable, Subject, of } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  map,
  switchMap,
  take,
  takeUntil,
} from 'rxjs/operators';

import { ManagerSuppliersActions } from '../../store/suppliers/manager.actions';
import {
  selectManagerEditingSupplier,
  selectManagerEditingSupplierContact,
  selectManagerEditingSupplierMaterial,
  selectManagerSupplierContacts,
  selectManagerSupplierContactsError,
  selectManagerSupplierContactsLoading,
  selectManagerSupplierContactsPage,
  selectManagerSupplierContactsTotal,
  selectManagerSupplierContactsViewMode,
  selectManagerSupplierFormTab,
  selectManagerSupplierMaterials,
  selectManagerSupplierMaterialsError,
  selectManagerSupplierMaterialsLoading,
  selectManagerSupplierMaterialsPage,
  selectManagerSupplierMaterialsSearchQuery,
  selectManagerSupplierMaterialsTotal,
  selectManagerSupplierMaterialsViewMode,
  selectManagerSuppliers,
  selectManagerSuppliersError,
  selectManagerSuppliersLoading,
  selectManagerSuppliersPage,
  selectManagerSuppliersSearchQuery,
  selectManagerSuppliersTotal,
  selectManagerSuppliersViewMode,
} from '../../store/suppliers/manager.selectors';

import { ManagerMaterialsService } from '../../services/manager.materials.service';
import { TownPlannerV2Service } from '../../../townplanner/services/townplanner_v2.service';
import { TownPlannerV2AddressSuggestion } from '../../../townplanner/store/townplanner_v2.state';
import { ManagerSelectComponent } from '../shared/manager-select/manager-select.component';
import type { BmMaterial } from '../../types/materials.interface';
import type {
  BmSupplier,
  BmSupplierContact,
  BmSupplierMaterial,
} from '../../types/suppliers.interface';
import type { SupplierFormTab } from '../../store/suppliers/manager.state';

@Component({
    selector: 'app-manager-suppliers-page',
    imports: [CommonModule, ReactiveFormsModule, RouterModule, ManagerSelectComponent],
    templateUrl: './manager-suppliers.page.html',
    styleUrls: ['./manager-suppliers.page.css']
})
export class ManagerSuppliersPageComponent
  implements OnInit, OnDestroy, AfterViewInit
{
  private destroy$ = new Subject<void>();
  private infiniteObserver?: IntersectionObserver;
  private contactsInfiniteObserver?: IntersectionObserver;
  private materialsInfiniteObserver?: IntersectionObserver;
  private isLoadingMore = false;
  private isLoadingMoreContacts = false;
  private isLoadingMoreMaterials = false;
  private closeAfterSave = false;
  private closeAfterContactSave = false;
  private closeAfterMaterialSave = false;
  private saveContactAfterSupplierSaveAndClose = false;
  private saveMaterialAfterSupplierSaveAndClose = false;
  private pendingContactPayloadAfterSupplierSave: any = null;
  private pendingMaterialPayloadAfterSupplierSave: any = null;

  loading$ = this.store.select(selectManagerSuppliersLoading);
  error$ = this.store.select(selectManagerSuppliersError);
  suppliersRaw$ = this.store.select(selectManagerSuppliers);
  total$ = this.store.select(selectManagerSuppliersTotal);
  viewMode$ = this.store.select(selectManagerSuppliersViewMode);
  editingSupplier$ = this.store.select(selectManagerEditingSupplier);

  page$ = this.store.select(selectManagerSuppliersPage);
  searchQuery$ = this.store.select(selectManagerSuppliersSearchQuery);

  // Tabs + nested
  tab$ = this.store.select(selectManagerSupplierFormTab);

  contacts$ = this.store.select(selectManagerSupplierContacts);
  contactsLoading$ = this.store.select(selectManagerSupplierContactsLoading);
  contactsError$ = this.store.select(selectManagerSupplierContactsError);
  contactsViewMode$ = this.store.select(selectManagerSupplierContactsViewMode);
  editingContact$ = this.store.select(selectManagerEditingSupplierContact);
  contactsPage$ = this.store.select(selectManagerSupplierContactsPage);
  contactsTotal$ = this.store.select(selectManagerSupplierContactsTotal);

  materials$ = this.store.select(selectManagerSupplierMaterials);
  materialsLoading$ = this.store.select(selectManagerSupplierMaterialsLoading);
  materialsError$ = this.store.select(selectManagerSupplierMaterialsError);
  materialsViewMode$ = this.store.select(selectManagerSupplierMaterialsViewMode);
  editingMaterial$ = this.store.select(selectManagerEditingSupplierMaterial);
  materialsPage$ = this.store.select(selectManagerSupplierMaterialsPage);
  materialsTotal$ = this.store.select(selectManagerSupplierMaterialsTotal);
  materialsSearchQuery$ = this.store.select(
    selectManagerSupplierMaterialsSearchQuery,
  );

  searchCtrl: FormControl<string>;
  materialsSearchCtrl: FormControl<string>;
  canLoadMore$!: Observable<boolean>;
  contactsCanLoadMore$!: Observable<boolean>;
  materialsCanLoadMore$!: Observable<boolean>;

  @ViewChild('listHeader') listHeaderRef?: ElementRef<HTMLElement>;
  @ViewChild('suppliersList') suppliersListRef?: ElementRef<HTMLElement>;
  @ViewChild('infiniteSentinel') infiniteSentinelRef?: ElementRef<HTMLElement>;
  @ViewChild('contactsList') contactsListRef?: ElementRef<HTMLElement>;
  @ViewChild('contactsInfiniteSentinel')
  contactsInfiniteSentinelRef?: ElementRef<HTMLElement>;
  @ViewChild('materialsList') materialsListRef?: ElementRef<HTMLElement>;
  @ViewChild('materialsInfiniteSentinel')
  materialsInfiniteSentinelRef?: ElementRef<HTMLElement>;

  private currentPage = 1;
  private canLoadMore = false;
  private isLoading = false;
  private currentContactsPage = 1;
  private canLoadMoreContacts = false;
  private isLoadingContacts = false;
  private currentMaterialsPage = 1;
  private currentTabValue: SupplierFormTab = 'details';
  private canLoadMoreMaterials = false;
  private isLoadingMaterials = false;
  dismissedErrors = new Set<string>();
  dismissedWarnings = new Set<string>();
  formToastMessage: string | null = null;
  formToastClosing = false;
  private formToastTimer: ReturnType<typeof setTimeout> | null = null;
  private formToastCloseTimer: ReturnType<typeof setTimeout> | null = null;
  isConfirmModalOpen = false;
  confirmModalTitle = '';
  confirmModalMessage = '';
  confirmModalConfirmLabel = 'Continue';
  confirmModalCancelLabel = 'Cancel';
  confirmModalShowCancel = false;
  confirmModalTone: 'info' | 'warning' | 'danger' = 'info';
  private confirmModalConfirmAction: (() => void) | null = null;
  private confirmModalCancelAction: (() => void) | null = null;

  materialsCatalog: BmMaterial[] = [];
  private materialsMap = new Map<string, BmMaterial>();
  materialSearchCtrl: FormControl<string>;
  materialSuggestions: BmMaterial[] = [];
  showMaterialSuggestions = false;
  materialActiveIndex = -1;

  addressSuggestions: TownPlannerV2AddressSuggestion[] = [];
  showAddressSuggestions = false;
  addressActiveIndex = -1;
  private addressSessionToken: string | null = null;
  private addressHasFocus = false;

  statusOptions = [
    { value: 'active', label: 'active' },
    { value: 'archived', label: 'archived' },
  ];

  supplierForm = this.fb.group({
    supplier_name: ['', [Validators.required, Validators.maxLength(140)]],
    address: [''],
    email: ['', [Validators.email]],
    cel: [''],
    tel: [''],
    notes: [''],
    status: ['active'],
  });

  contactForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    role_title: [''],
    email: ['', [Validators.email]],
    cel: [''],
    tel: [''],
  });

  supplierMaterialForm = this.fb.group({
    material_id: ['', [Validators.required]],
    supplier_sku: [''],
    lead_time_days: [null as number | null, [Validators.min(0)]],
    unit_cost: [null as string | null, [Validators.min(0)]],
    sell_cost: [null as string | null, [Validators.min(0)]],
  });

  constructor(
    private store: Store,
    private fb: FormBuilder,
    private materialsApi: ManagerMaterialsService,
    private townPlanner: TownPlannerV2Service,
    private actions$: Actions,
  ) {
    this.searchCtrl = this.fb.control('', { nonNullable: true });
    this.materialsSearchCtrl = this.fb.control('', { nonNullable: true });
    this.materialSearchCtrl = this.fb.control('', { nonNullable: true });

    this.canLoadMore$ = combineLatest([
      this.total$,
      this.suppliersRaw$,
      this.loading$,
    ]).pipe(
      map(([total, suppliers, loading]) => !loading && suppliers.length < total),
    );
    this.contactsCanLoadMore$ = combineLatest([
      this.contactsTotal$,
      this.contacts$,
      this.contactsLoading$,
    ]).pipe(
      map(
        ([total, contacts, loading]) =>
          !loading && contacts.length < total,
      ),
    );
    this.materialsCanLoadMore$ = combineLatest([
      this.materialsTotal$,
      this.materials$,
      this.materialsLoading$,
    ]).pipe(
      map(
        ([total, materials, loading]) =>
          !loading && materials.length < total,
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
    this.contactsPage$
      .pipe(takeUntil(this.destroy$))
      .subscribe((page) => {
        this.currentContactsPage = page || 1;
      });
    this.contactsCanLoadMore$
      .pipe(takeUntil(this.destroy$))
      .subscribe((canLoad) => {
        this.canLoadMoreContacts = canLoad;
      });
    this.contactsLoading$
      .pipe(takeUntil(this.destroy$))
      .subscribe((loading) => {
        this.isLoadingContacts = loading;
        if (!loading) this.isLoadingMoreContacts = false;
      });
    this.materialsPage$
      .pipe(takeUntil(this.destroy$))
      .subscribe((page) => {
        this.currentMaterialsPage = page || 1;
      });
    this.materialsCanLoadMore$
      .pipe(takeUntil(this.destroy$))
      .subscribe((canLoad) => {
        this.canLoadMoreMaterials = canLoad;
      });
    this.materialsLoading$
      .pipe(takeUntil(this.destroy$))
      .subscribe((loading) => {
        this.isLoadingMaterials = loading;
        if (!loading) this.isLoadingMoreMaterials = false;
      });

    this.actions$
      .pipe(
        ofType(
          ManagerSuppliersActions.saveSupplierSuccess,
          ManagerSuppliersActions.saveSupplierFailure,
        ),
        takeUntil(this.destroy$),
      )
      .subscribe((action) => {
        if (action.type === ManagerSuppliersActions.saveSupplierSuccess.type) {
          if (this.dispatchNextPendingChildSave(action.supplier.supplierId)) return;
        } else {
          if (this.closeAfterSave || this.hasPendingContactSave() || this.hasPendingMaterialSave()) {
            this.showFormToast(
              (action as { error?: string })?.error ||
                'Could not save supplier details. Please review required fields and try again.',
            );
          }
          this.clearPendingChildSaves();
        }

        if (!this.closeAfterSave) return;
        this.closeAfterSave = false;
        if (action.type === ManagerSuppliersActions.saveSupplierSuccess.type) {
          this.store.dispatch(ManagerSuppliersActions.closeSupplierForm());
        }
      });

    this.actions$
      .pipe(
        ofType(
          ManagerSuppliersActions.saveSupplierContactSuccess,
          ManagerSuppliersActions.saveSupplierContactFailure,
        ),
        takeUntil(this.destroy$),
      )
      .subscribe((action) => {
        if (!this.closeAfterContactSave) return;
        this.closeAfterContactSave = false;
        if (action.type !== ManagerSuppliersActions.saveSupplierContactSuccess.type) {
          this.showFormToast(
            (action as { error?: string })?.error ||
              'Could not save contact. Please review required fields and try again.',
          );
          this.clearPendingChildSaves();
          return;
        }

        this.store
          .select(selectManagerEditingSupplier)
          .pipe(take(1))
          .subscribe((supplier) => {
            const supplierId = supplier?.supplierId ?? null;
            if (supplierId && this.dispatchNextPendingChildSave(supplierId)) return;
            this.store.dispatch(ManagerSuppliersActions.closeSupplierForm());
          });
      });

    this.actions$
      .pipe(
        ofType(
          ManagerSuppliersActions.saveSupplierMaterialSuccess,
          ManagerSuppliersActions.saveSupplierMaterialFailure,
        ),
        takeUntil(this.destroy$),
      )
      .subscribe((action) => {
        if (!this.closeAfterMaterialSave) return;
        this.closeAfterMaterialSave = false;
        if (action.type !== ManagerSuppliersActions.saveSupplierMaterialSuccess.type) {
          this.showFormToast(
            (action as { error?: string })?.error ||
              'Could not save material. Please review required fields and try again.',
          );
          this.clearPendingChildSaves();
          return;
        }

        this.store
          .select(selectManagerEditingSupplier)
          .pipe(take(1))
          .subscribe((supplier) => {
            const supplierId = supplier?.supplierId ?? null;
            if (supplierId && this.dispatchNextPendingChildSave(supplierId)) return;
            this.store.dispatch(ManagerSuppliersActions.closeSupplierForm());
          });
      });
  }

  ngOnInit(): void {
    this.store.dispatch(ManagerSuppliersActions.loadSuppliers({ page: 1 }));

    this.searchQuery$.pipe(takeUntil(this.destroy$)).subscribe((query) => {
      if (this.searchCtrl.value !== (query || '')) {
        this.searchCtrl.setValue(query || '', { emitEvent: false });
      }
      this.store.dispatch(ManagerSuppliersActions.loadSuppliers({ page: 1 }));
    });

    this.searchCtrl.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        takeUntil(this.destroy$),
      )
      .subscribe((query) =>
        this.store.dispatch(
          ManagerSuppliersActions.setSuppliersSearchQuery({ query: query || '' }),
        ),
      );

    this.materialsSearchQuery$
      .pipe(takeUntil(this.destroy$))
      .subscribe((query) => {
        if (this.materialsSearchCtrl.value !== (query || '')) {
          this.materialsSearchCtrl.setValue(query || '', { emitEvent: false });
        }
        if (this.currentTabValue !== 'materials') return;
        this.store
          .select(selectManagerEditingSupplier)
          .pipe(take(1))
          .subscribe((supplier) => {
            if (!supplier?.supplierId) return;
            this.store.dispatch(
              ManagerSuppliersActions.loadSupplierMaterials({
                supplierId: supplier.supplierId,
                page: 1,
              }),
            );
          });
      });

    this.materialsSearchCtrl.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        takeUntil(this.destroy$),
      )
      .subscribe((query) =>
        this.store.dispatch(
          ManagerSuppliersActions.setSupplierMaterialsSearchQuery({
            query: query || '',
          }),
        ),
      );

    this.viewMode$
      .pipe(takeUntil(this.destroy$))
      .subscribe((mode) => {
        if (mode !== 'list') return;
        setTimeout(() => this.updateHeaderOffset(), 0);
        setTimeout(() => this.setupInfiniteScroll(), 0);
      });

    this.tab$.pipe(takeUntil(this.destroy$)).subscribe((tab) => {
      this.currentTabValue = tab;
      if (tab === 'contacts') {
        setTimeout(() => this.setupContactsInfiniteScroll(), 0);
      }
      if (tab === 'materials') {
        setTimeout(() => this.setupMaterialsInfiniteScroll(), 0);
      }
    });

    this.editingSupplier$
      .pipe(takeUntil(this.destroy$))
      .subscribe((s: BmSupplier | null) => {
        if (!s) return;
        this.supplierForm.patchValue({
          supplier_name: s.supplierName ?? '',
          address: s.address ?? '',
          email: s.email ?? '',
          cel: s.cel ?? '',
          tel: s.tel ?? '',
          notes: s.notes ?? '',
          status: s.status ?? 'active',
        });
      });

    this.editingContact$
      .pipe(takeUntil(this.destroy$))
      .subscribe((ct: BmSupplierContact | null) => {
        if (!ct) return;
        this.contactForm.patchValue({
          name: ct.name ?? '',
          role_title: ct.roleTitle ?? '',
          email: ct.email ?? '',
          cel: ct.cel ?? '',
          tel: ct.tel ?? '',
        });
      });

    this.editingMaterial$
      .pipe(takeUntil(this.destroy$))
      .subscribe((sm: BmSupplierMaterial | null) => {
        if (!sm) return;
        this.supplierMaterialForm.patchValue({
          material_id: sm.materialId ?? '',
          supplier_sku: sm.supplierSku ?? '',
          lead_time_days: sm.leadTimeDays ?? null,
          unit_cost: this.formatMoneyInput(sm.unitCost),
          sell_cost: this.formatMoneyInput(sm.sellCost),
        });
        const name = this.getMaterialName(sm.materialId);
        if (name) {
          this.materialSearchCtrl.setValue(name, { emitEvent: false });
        }
      });

    this.loadMaterialsCatalog();
    this.setupAddressAutocomplete();
  }

  ngAfterViewInit(): void {
    this.updateHeaderOffset();
    this.setupInfiniteScroll();
  }

  ngOnDestroy(): void {
    this.infiniteObserver?.disconnect();
    this.contactsInfiniteObserver?.disconnect();
    this.materialsInfiniteObserver?.disconnect();
    this.clearFormToastTimers();
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

  isWarningDismissed(message: string | null | undefined): boolean {
    return message ? this.dismissedWarnings.has(message) : false;
  }

  @HostListener('window:resize')
  onResize(): void {
    this.updateHeaderOffset();
    this.setupInfiniteScroll();
  }

  trackBySupplier = (_: number, s: BmSupplier) => s.supplierId;
  trackByContact = (_: number, c: BmSupplierContact) => c.contactId;
  trackBySupplierMaterial = (_: number, m: BmSupplierMaterial) => m.materialId;

  openCreate(): void {
    this.currentTabValue = 'details';
    this.supplierForm.reset({
      supplier_name: '',
      address: '',
      email: '',
      cel: '',
      tel: '',
      notes: '',
      status: 'active',
    });
    this.store.dispatch(ManagerSuppliersActions.openSupplierCreate());
  }

  openEdit(s: BmSupplier): void {
    this.currentTabValue = 'details';
    this.store.dispatch(ManagerSuppliersActions.openSupplierEdit({ supplierId: s.supplierId }));
  }

  closeForm(): void {
    this.currentTabValue = 'details';
    this.store.dispatch(ManagerSuppliersActions.closeSupplierForm());
  }

  saveSupplier(): void {
    if (this.supplierForm.invalid) {
      this.supplierForm.markAllAsTouched();
      return;
    }

    const payload: any = this.supplierForm.getRawValue();
    delete payload.company_id;
    delete payload.companyId;
    delete payload.supplier_id;
    delete payload.supplierId;

    this.store.dispatch(ManagerSuppliersActions.saveSupplier({ payload }));
  }

  saveSupplierAndClose(): void {
    if (this.supplierForm.invalid) {
      this.supplierForm.markAllAsTouched();
      this.showFormToast('Please complete required supplier fields before using Save & Finish.');
      return;
    }

    combineLatest([
      this.contactsViewMode$.pipe(take(1)),
      this.materialsViewMode$.pipe(take(1)),
      this.store.select(selectManagerEditingSupplier).pipe(take(1)),
    ]).subscribe(([contactsMode, materialsMode, supplier]) => {
      let contactPayload: any | null = null;
      let materialPayload: any | null = null;

      if (contactsMode === 'form') {
        if (this.contactForm.invalid) {
          this.contactForm.markAllAsTouched();
          this.showFormToast('Please complete required contact fields before using Save & Finish.');
          this.currentTabValue = 'contacts';
          this.store.dispatch(
            ManagerSuppliersActions.setSupplierFormTab({ tab: 'contacts' }),
          );
          return;
        }
        contactPayload = this.contactForm.getRawValue();
      }

      if (materialsMode === 'form') {
        materialPayload = this.buildSupplierMaterialPayload();
        if (!materialPayload) {
          this.showFormToast('Please complete required material fields before using Save & Finish.');
          this.currentTabValue = 'materials';
          this.store.dispatch(
            ManagerSuppliersActions.setSupplierFormTab({ tab: 'materials' }),
          );
          return;
        }
      }

      this.closeAfterSave = false;
      this.closeAfterContactSave = false;
      this.closeAfterMaterialSave = false;
      this.saveContactAfterSupplierSaveAndClose = !!contactPayload;
      this.saveMaterialAfterSupplierSaveAndClose = !!materialPayload;
      this.pendingContactPayloadAfterSupplierSave = contactPayload;
      this.pendingMaterialPayloadAfterSupplierSave = materialPayload;

      const hasPendingChildren =
        this.hasPendingContactSave() || this.hasPendingMaterialSave();

      if (!hasPendingChildren) {
        this.closeAfterSave = true;
        this.saveSupplier();
        return;
      }

      const supplierId = supplier?.supplierId ?? null;
      if (!supplierId || this.supplierForm.dirty) {
        this.saveSupplier();
        return;
      }

      if (this.dispatchNextPendingChildSave(supplierId)) return;
      this.closeAfterSave = true;
      this.saveSupplier();
    });
  }

  removeSupplier(s: BmSupplier): void {
    if (this.isArchiveActionDisabled(s)) return;

    const hasProjects = !!s.hasProjects;
    const title = hasProjects ? 'Archive Supplier?' : 'Delete Supplier?';
    const message = hasProjects
      ? `"${s.supplierName}" supplier is linked to existing processes, so it cannot be deleted. Would you like to archive it instead?`
      : `Are you sure you want to delete "${s.supplierName}"?`;
    this.openConfirmModal({
      title,
      message,
      tone: hasProjects ? 'warning' : 'danger',
      confirmLabel: hasProjects ? 'Archive' : 'Delete',
      onConfirm: () =>
        this.store.dispatch(
          ManagerSuppliersActions.removeSupplier({ supplierId: s.supplierId }),
        ),
    });
  }

  isArchiveActionDisabled(s: BmSupplier): boolean {
    return (s.status ?? 'active') === 'archived';
  }

  // Tabs
  setTab(tab: SupplierFormTab, supplier: BmSupplier | null): void {
    if (tab !== 'details' && !supplier?.supplierId) return;

    this.currentTabValue = tab;
    this.store.dispatch(ManagerSuppliersActions.setSupplierFormTab({ tab }));

    if (tab === 'contacts' && supplier?.supplierId) {
      this.store.dispatch(
        ManagerSuppliersActions.loadSupplierContacts({
          supplierId: supplier.supplierId,
          page: 1,
        }),
      );
    }

    if (tab === 'materials' && supplier?.supplierId) {
      this.store.dispatch(
        ManagerSuppliersActions.loadSupplierMaterials({
          supplierId: supplier.supplierId,
          page: 1,
        }),
      );
    }
  }

  // Contacts
  openContactCreate(): void {
    this.contactForm.reset({
      name: '',
      role_title: '',
      email: '',
      cel: '',
      tel: '',
    });
    this.store.dispatch(ManagerSuppliersActions.openSupplierContactCreate());
  }

  openContactEdit(contact: BmSupplierContact): void {
    this.store.dispatch(
      ManagerSuppliersActions.openSupplierContactEdit({ contactId: contact.contactId }),
    );
  }

  cancelContactForm(): void {
    this.store.dispatch(ManagerSuppliersActions.closeSupplierContactForm());
  }

  saveContact(supplier: BmSupplier): void {
    if (!supplier?.supplierId) return;
    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      return;
    }

    const payload = this.contactForm.getRawValue();

    this.store.dispatch(
      ManagerSuppliersActions.saveSupplierContact({
        supplierId: supplier.supplierId,
        payload,
      }),
    );
  }

  deleteContact(supplier: BmSupplier, contact: BmSupplierContact): void {
    this.openConfirmModal({
      title: 'Delete Contact?',
      message: `Are you sure you want to delete "${contact.name}"?`,
      tone: 'danger',
      confirmLabel: 'Delete',
      onConfirm: () =>
        this.store.dispatch(
          ManagerSuppliersActions.deleteSupplierContact({
            supplierId: supplier.supplierId,
            contactId: contact.contactId,
          }),
        ),
    });
  }

  // Supplier materials
  openMaterialCreate(): void {
    this.supplierMaterialForm.reset({
      material_id: '',
      supplier_sku: '',
      lead_time_days: null,
      unit_cost: null,
      sell_cost: null,
    });
    this.materialSearchCtrl.setValue('', { emitEvent: false });
    this.store.dispatch(ManagerSuppliersActions.openSupplierMaterialCreate());
  }

  openMaterialEdit(material: BmSupplierMaterial): void {
    this.store.dispatch(
      ManagerSuppliersActions.openSupplierMaterialEdit({ materialId: material.materialId }),
    );
  }

  cancelMaterialForm(): void {
    this.store.dispatch(ManagerSuppliersActions.closeSupplierMaterialForm());
  }

  saveSupplierMaterial(): void {
    const payload = this.buildSupplierMaterialPayload();
    if (!payload) return;

    this.store
      .select(selectManagerEditingSupplier)
      .pipe(take(1))
      .subscribe((supplier) => {
        if (!supplier?.supplierId) return;
        this.store.dispatch(
          ManagerSuppliersActions.saveSupplierMaterial({
            supplierId: supplier.supplierId,
            payload,
          }),
        );
      });
  }

  private buildSupplierMaterialPayload(): any | null {
    if (!this.supplierMaterialForm.controls.material_id.value) {
      const match = this.resolveMaterialSelection();
      if (match) this.onMaterialSelect(match);
    }
    if (this.supplierMaterialForm.invalid) {
      this.supplierMaterialForm.markAllAsTouched();
      return null;
    }

    const payload: any = this.supplierMaterialForm.getRawValue();
    if (payload.lead_time_days !== null && payload.lead_time_days !== '') {
      payload.lead_time_days = Number(payload.lead_time_days);
    }
    if (payload.unit_cost !== null && payload.unit_cost !== '') {
      payload.unit_cost = this.formatMoney(payload.unit_cost);
    }
    if (payload.sell_cost !== null && payload.sell_cost !== '') {
      payload.sell_cost = this.formatMoney(payload.sell_cost);
    }
    return payload;
  }

  private hasPendingContactSave(): boolean {
    return (
      this.saveContactAfterSupplierSaveAndClose &&
      this.pendingContactPayloadAfterSupplierSave !== null
    );
  }

  private hasPendingMaterialSave(): boolean {
    return (
      this.saveMaterialAfterSupplierSaveAndClose &&
      this.pendingMaterialPayloadAfterSupplierSave !== null
    );
  }

  private clearPendingChildSaves(): void {
    this.saveContactAfterSupplierSaveAndClose = false;
    this.saveMaterialAfterSupplierSaveAndClose = false;
    this.pendingContactPayloadAfterSupplierSave = null;
    this.pendingMaterialPayloadAfterSupplierSave = null;
  }

  private dispatchNextPendingChildSave(supplierId: string): boolean {
    if (this.hasPendingContactSave()) {
      const payload = this.pendingContactPayloadAfterSupplierSave;
      this.pendingContactPayloadAfterSupplierSave = null;
      this.saveContactAfterSupplierSaveAndClose = false;
      this.closeAfterContactSave = true;
      this.store.dispatch(
        ManagerSuppliersActions.saveSupplierContact({
          supplierId,
          payload,
        }),
      );
      return true;
    }

    if (this.hasPendingMaterialSave()) {
      const payload = this.pendingMaterialPayloadAfterSupplierSave;
      this.pendingMaterialPayloadAfterSupplierSave = null;
      this.saveMaterialAfterSupplierSaveAndClose = false;
      this.closeAfterMaterialSave = true;
      this.store.dispatch(
        ManagerSuppliersActions.saveSupplierMaterial({
          supplierId,
          payload,
        }),
      );
      return true;
    }

    return false;
  }

  private showFormToast(message: string): void {
    this.clearFormToastTimers();
    this.formToastMessage = message;
    this.formToastClosing = false;

    this.formToastTimer = window.setTimeout(() => {
      this.formToastClosing = true;
      this.formToastCloseTimer = window.setTimeout(() => {
        this.formToastMessage = null;
        this.formToastClosing = false;
      }, 220);
    }, 3200);
  }

  private clearFormToastTimers(): void {
    if (this.formToastTimer) {
      clearTimeout(this.formToastTimer);
      this.formToastTimer = null;
    }
    if (this.formToastCloseTimer) {
      clearTimeout(this.formToastCloseTimer);
      this.formToastCloseTimer = null;
    }
  }

  removeSupplierMaterial(supplier: BmSupplier, material: BmSupplierMaterial): void {
    this.openConfirmModal({
      title: 'Delete Material?',
      message: `Are you sure you want to delete this material from the supplier?`,
      tone: 'danger',
      confirmLabel: 'Delete',
      onConfirm: () =>
        this.store.dispatch(
          ManagerSuppliersActions.removeSupplierMaterial({
            supplierId: supplier.supplierId,
            materialId: material.materialId,
          }),
        ),
    });
  }

  getMaterialName(materialId?: string | null): string {
    if (!materialId) return '—';
    return this.materialsMap.get(materialId)?.materialName || materialId;
  }

  getMaterialQuantity(materialId?: string | null, fallback?: number | null): number | null {
    if (fallback !== null && fallback !== undefined) return fallback;
    if (!materialId) return null;
    return this.materialsMap.get(materialId)?.quantity ?? null;
  }

  getMaterialUnit(materialId?: string | null, fallback?: string | null): string | null {
    if (fallback !== null && fallback !== undefined) return fallback;
    if (!materialId) return null;
    return this.materialsMap.get(materialId)?.unit ?? null;
  }

  getSelectedMaterialQuantity(): string {
    const materialId = this.supplierMaterialForm.controls.material_id.value || null;
    const quantity = this.getMaterialQuantity(materialId);
    if (quantity === null || quantity === undefined) return '';
    return String(quantity);
  }

  getSelectedMaterialUnit(): string {
    const materialId = this.supplierMaterialForm.controls.material_id.value || null;
    const unit = this.getMaterialUnit(materialId);
    return unit ?? '';
  }

  private formatMoney(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    if (Number.isNaN(num)) return null;
    return Math.round(num * 100) / 100;
  }

  private formatMoneyInput(value: number | string | null | undefined): string | null {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    if (Number.isNaN(num)) return null;
    return num.toFixed(2);
  }

  formatMoneyControl(controlName: 'unit_cost' | 'sell_cost'): void {
    const control = this.supplierMaterialForm.controls[controlName];
    const formatted = this.formatMoneyInput(control.value);
    control.setValue(formatted, { emitEvent: false });
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
      if (!this.supplierMaterialForm.controls.material_id.value) {
        const match = this.resolveMaterialSelection();
        if (match) {
          this.onMaterialSelect(match);
        }
      }
      this.showMaterialSuggestions = false;
      this.materialActiveIndex = -1;
    }, 120);
  }

  onMaterialQueryKeydown(event: KeyboardEvent): void {
    if (!this.materialSuggestions.length) return;

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
      if (this.materialActiveIndex >= 0) {
        event.preventDefault();
        this.onMaterialSelect(this.materialSuggestions[this.materialActiveIndex]);
      }
    } else if (event.key === 'Escape') {
      this.showMaterialSuggestions = false;
      this.materialActiveIndex = -1;
    }
  }

  onMaterialQueryInput(value: string): void {
    const query = (value || '').trim();
    this.supplierMaterialForm.controls.material_id.setValue('');
    this.updateMaterialSuggestions(query);
    this.showMaterialSuggestions = query.length > 0 && this.materialSuggestions.length > 0;
  }

  onMaterialSelect(material: BmMaterial): void {
    this.supplierMaterialForm.controls.material_id.setValue(material.materialId);
    this.materialSearchCtrl.setValue(material.materialName, { emitEvent: false });
    this.materialSuggestions = [];
    this.showMaterialSuggestions = false;
    this.materialActiveIndex = -1;
  }

  onAddressFocus(): void {
    this.addressHasFocus = true;
    const current = (this.supplierForm.controls.address.value || '').trim();
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
    this.supplierForm.controls.address.setValue(suggestion.description, {
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
          this.supplierForm.controls.address.setValue(next, {
            emitEvent: false,
          });
        }
      });
  }

  private loadMaterialsCatalog(): void {
    this.materialsApi
      .listMaterials({ page: 1, limit: 200 })
      .pipe(takeUntil(this.destroy$))
      .subscribe((res) => {
        this.materialsCatalog = res.items ?? [];
        this.materialsMap = new Map(
          this.materialsCatalog.map((m) => [m.materialId, m]),
        );
        const currentId = this.supplierMaterialForm.controls.material_id.value;
        if (currentId) {
          const name = this.getMaterialName(currentId);
          if (name) this.materialSearchCtrl.setValue(name, { emitEvent: false });
        }
      });
  }

  private updateMaterialSuggestions(query: string): void {
    const q = query.toLowerCase();
    if (!q) {
      this.materialSuggestions = [];
      this.materialActiveIndex = -1;
      return;
    }
    this.materialSuggestions = this.materialsCatalog
      .filter(
        (m) =>
          m.materialName?.toLowerCase().includes(q) ||
          m.code?.toLowerCase().includes(q),
      )
      .slice(0, 12);
    this.materialActiveIndex = this.materialSuggestions.length ? 0 : -1;
  }

  private resolveMaterialSelection(): BmMaterial | null {
    const query = (this.materialSearchCtrl.value || '').trim().toLowerCase();
    if (!query) return null;
    return (
      this.materialsCatalog.find(
        (m) => m.materialName?.toLowerCase() === query,
      ) ??
      this.materialsCatalog.find((m) => m.code?.toLowerCase() === query) ??
      null
    );
  }

  private setupAddressAutocomplete(): void {
    this.supplierForm.controls.address.valueChanges
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

  private updateHeaderOffset(): void {
    const header = this.listHeaderRef?.nativeElement;
    const list = this.suppliersListRef?.nativeElement;
    if (!header || !list) return;

    const height = Math.ceil(header.getBoundingClientRect().height);
    list.style.setProperty('--list-header-height', `${height}px`);
  }

  private setupInfiniteScroll(): void {
    const sentinel = this.infiniteSentinelRef?.nativeElement;
    const list = this.suppliersListRef?.nativeElement;
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
    this.store.dispatch(ManagerSuppliersActions.loadSuppliers({ page: this.currentPage + 1 }));
  }

  private setupContactsInfiniteScroll(): void {
    const sentinel = this.contactsInfiniteSentinelRef?.nativeElement;
    const list = this.contactsListRef?.nativeElement;
    if (!sentinel || !list) return;

    this.contactsInfiniteObserver?.disconnect();

    const scrollRoot = list.closest('.content') as HTMLElement | null;

    this.contactsInfiniteObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        this.tryLoadMoreContacts();
      },
      {
        root: scrollRoot,
        rootMargin: '200px 0px',
        threshold: 0.1,
      },
    );

    this.contactsInfiniteObserver.observe(sentinel);
  }

  private tryLoadMoreContacts(): void {
    if (
      !this.canLoadMoreContacts ||
      this.isLoadingContacts ||
      this.isLoadingMoreContacts
    )
      return;
    this.isLoadingMoreContacts = true;
    this.store
      .select(selectManagerEditingSupplier)
      .pipe(take(1))
      .subscribe((supplier) => {
        if (!supplier?.supplierId) return;
        this.store.dispatch(
          ManagerSuppliersActions.loadSupplierContacts({
            supplierId: supplier.supplierId,
            page: this.currentContactsPage + 1,
          }),
        );
      });
  }

  private setupMaterialsInfiniteScroll(): void {
    const sentinel = this.materialsInfiniteSentinelRef?.nativeElement;
    const list = this.materialsListRef?.nativeElement;
    if (!sentinel || !list) return;

    this.materialsInfiniteObserver?.disconnect();

    const scrollRoot = list.closest('.content') as HTMLElement | null;

    this.materialsInfiniteObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        this.tryLoadMoreMaterials();
      },
      {
        root: scrollRoot,
        rootMargin: '200px 0px',
        threshold: 0.1,
      },
    );

    this.materialsInfiniteObserver.observe(sentinel);
  }

  private tryLoadMoreMaterials(): void {
    if (
      !this.canLoadMoreMaterials ||
      this.isLoadingMaterials ||
      this.isLoadingMoreMaterials
    )
      return;
    this.isLoadingMoreMaterials = true;
    this.store
      .select(selectManagerEditingSupplier)
      .pipe(take(1))
      .subscribe((supplier) => {
        if (!supplier?.supplierId) return;
        this.store.dispatch(
          ManagerSuppliersActions.loadSupplierMaterials({
            supplierId: supplier.supplierId,
            page: this.currentMaterialsPage + 1,
          }),
        );
      });
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
    this.confirmModalTitle = options.title;
    this.confirmModalMessage = options.message;
    this.confirmModalTone = options.tone ?? 'info';
    this.confirmModalConfirmLabel = options.confirmLabel ?? 'Continue';
    this.confirmModalCancelLabel = options.cancelLabel ?? 'Cancel';
    this.confirmModalShowCancel = true;
    this.confirmModalConfirmAction = options.onConfirm;
    this.confirmModalCancelAction = options.onCancel ?? null;
    this.isConfirmModalOpen = true;
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
    if (this.confirmModalShowCancel) {
      this.onConfirmModalCancel();
    } else {
      this.onConfirmModalConfirm();
    }
  }

  private closeConfirmModal(): void {
    this.isConfirmModalOpen = false;
    this.confirmModalConfirmAction = null;
    this.confirmModalCancelAction = null;
  }
}
