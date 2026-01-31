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

import { ManagerActions } from '../../store/manager.actions';
import {
  selectManagerClients,
  selectManagerClientsError,
  selectManagerClientsLoading,
  selectManagerClientsTotal,
  selectManagerClientsSearchQuery,
  selectManagerClientsViewMode,
  selectManagerEditingClient,
  selectManagerClientsPage,
  selectManagerClientsLimit,
  selectManagerClientFormTab,
  selectManagerContacts,
  selectManagerContactsLoading,
  selectManagerContactsError,
  selectManagerContactsViewMode,
  selectManagerContactsPage,
  selectManagerContactsLimit,
  selectManagerContactsTotal,
  selectManagerEditingContact,
} from '../../store/manager.selectors';
import { BmClient, BmClientContact } from '../../services/manager.service';
import { ClientFormTab } from '../../store/manager.state';
import { TownPlannerV2Service } from '../../../townplanner/services/townplanner_v2.service';
import { TownPlannerV2AddressSuggestion } from '../../../townplanner/store/townplanner_v2.state';

@Component({
  selector: 'app-manager-clients-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './manager-clients.page.html',
  styleUrls: ['./manager-clients.page.css'],
})
export class ManagerClientsPageComponent
  implements OnInit, OnDestroy, AfterViewInit
{
  private destroy$ = new Subject<void>();
  private infiniteObserver?: IntersectionObserver;
  private contactsInfiniteObserver?: IntersectionObserver;
  private isLoadingMore = false;
  private isLoadingMoreContacts = false;

  loading$ = this.store.select(selectManagerClientsLoading);
  error$ = this.store.select(selectManagerClientsError);
  clientsRaw$ = this.store.select(selectManagerClients);
  total$ = this.store.select(selectManagerClientsTotal);
  viewMode$ = this.store.select(selectManagerClientsViewMode);
  editingClient$ = this.store.select(selectManagerEditingClient);

  page$ = this.store.select(selectManagerClientsPage);
  limit$ = this.store.select(selectManagerClientsLimit);
  searchQuery$ = this.store.select(selectManagerClientsSearchQuery);

  // Tabs + Contacts
  tab$ = this.store.select(selectManagerClientFormTab);

  contacts$ = this.store.select(selectManagerContacts);
  contactsLoading$ = this.store.select(selectManagerContactsLoading);
  contactsError$ = this.store.select(selectManagerContactsError);
  contactsViewMode$ = this.store.select(selectManagerContactsViewMode);
  editingContact$ = this.store.select(selectManagerEditingContact);
  contactsPage$ = this.store.select(selectManagerContactsPage);
  contactsLimit$ = this.store.select(selectManagerContactsLimit);
  contactsTotal$ = this.store.select(selectManagerContactsTotal);

  private lastContactsClientId: string | null = null;

  searchCtrl: FormControl<string>;
  canLoadMore$!: Observable<boolean>;
  contactsCanLoadMore$!: Observable<boolean>;

  addressSuggestions: TownPlannerV2AddressSuggestion[] = [];
  showAddressSuggestions = false;
  addressActiveIndex = -1;
  private addressSessionToken: string | null = null;
  private addressHasFocus = false;

  @ViewChild('listHeader') listHeaderRef?: ElementRef<HTMLElement>;
  @ViewChild('clientsList') clientsListRef?: ElementRef<HTMLElement>;
  @ViewChild('infiniteSentinel') infiniteSentinelRef?: ElementRef<HTMLElement>;
  @ViewChild('contactsList') contactsListRef?: ElementRef<HTMLElement>;
  @ViewChild('contactsInfiniteSentinel')
  contactsInfiniteSentinelRef?: ElementRef<HTMLElement>;

  private currentPage = 1;
  private canLoadMore = false;
  private isLoading = false;
  private currentContactsPage = 1;
  private canLoadMoreContacts = false;
  private isLoadingContacts = false;

  clientForm = this.fb.group({
    client_name: ['', [Validators.required, Validators.maxLength(120)]],
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

  constructor(
    private store: Store,
    private fb: FormBuilder,
    private townPlanner: TownPlannerV2Service,
  ) {
    this.searchCtrl = this.fb.control('', { nonNullable: true });

    this.canLoadMore$ = combineLatest([
      this.total$,
      this.clientsRaw$,
      this.loading$,
    ]).pipe(
      map(
        ([total, clients, loading]) => !loading && clients.length < total
      )
    );
    this.contactsCanLoadMore$ = combineLatest([
      this.contactsTotal$,
      this.contacts$,
      this.contactsLoading$,
    ]).pipe(
      map(
        ([total, contacts, loading]) =>
          !loading && contacts.length < total
      )
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
  }

  ngOnInit(): void {
    // Initial clients list load
    this.store.dispatch(ManagerActions.loadClients({ page: 1 }));

    // Reload when search query changes (simple v1 behavior)
    this.searchQuery$.pipe(takeUntil(this.destroy$)).subscribe((query) => {
      if (this.searchCtrl.value !== (query || '')) {
        this.searchCtrl.setValue(query || '', { emitEvent: false });
      }
      this.store.dispatch(ManagerActions.loadClients({ page: 1 }));
    });

    this.searchCtrl.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe((query) =>
        this.store.dispatch(
          ManagerActions.setClientsSearchQuery({ query: query || '' })
        )
      );

    this.viewMode$
      .pipe(takeUntil(this.destroy$))
      .subscribe((mode) => {
        if (mode !== 'list') return;
        setTimeout(() => this.updateHeaderOffset(), 0);
        setTimeout(() => this.setupInfiniteScroll(), 0);
      });

    this.tab$.pipe(takeUntil(this.destroy$)).subscribe((tab) => {
      if (tab !== 'contacts') return;
      setTimeout(() => this.setupContactsInfiniteScroll(), 0);
    });

    this.contactsViewMode$
      .pipe(takeUntil(this.destroy$))
      .subscribe((mode) => {
        if (mode !== 'list') return;
        setTimeout(() => this.setupContactsInfiniteScroll(), 0);
      });

    // Patch client form when switching to edit
    this.editingClient$
      .pipe(takeUntil(this.destroy$))
      .subscribe((c: BmClient | null) => {
        if (!c) return;
        this.clientForm.patchValue({
          client_name: c.clientName ?? '',
          address: c.address ?? '',
          email: c.email ?? '',
          cel: c.cel ?? '',
          tel: c.tel ?? '',
          notes: c.notes ?? '',
          status: c.status ?? 'active',
        });
      });

    // Patch contact form when editing a contact
    this.editingContact$
      .pipe(takeUntil(this.destroy$))
      .subscribe((ct: BmClientContact | null) => {
        if (!ct) return;
        this.contactForm.patchValue({
          name: ct.name ?? '',
          role_title: ct.roleTitle ?? '',
          email: ct.email ?? '',
          cel: ct.cel ?? '',
          tel: ct.tel ?? '',
        });
      });

    // When tab becomes Contacts and client exists, load contacts
    this.tab$.pipe(takeUntil(this.destroy$)).subscribe((tab) => {
      if (tab !== 'contacts') return;

      let clientId: string | null = null;
      this.store
        .select(selectManagerEditingClient)
        .pipe(takeUntil(this.destroy$))
        .subscribe((c) => {
          clientId = c?.clientId ?? null;
        });

      // The subscription above runs async; safer to just dispatch load in a separate block:
      // We'll load on every Contacts tab entry when editing client exists, but prevent spam with lastContactsClientId.
    });

    // Safer combined subscription:
    this.store
      .select(selectManagerEditingClient)
      .pipe(takeUntil(this.destroy$))
      .subscribe((client) => {
        // If user is already on Contacts tab and client changes, reload.
        // (Handled in setTab too, but this covers create -> save -> contacts)
        if (client?.clientId && client.clientId !== this.lastContactsClientId) {
          // no-op unless user actually switches to contacts
        }
      });

    this.setupAddressAutocomplete();
  }

  ngAfterViewInit(): void {
    this.updateHeaderOffset();
    this.setupInfiniteScroll();
  }

  ngOnDestroy(): void {
    this.infiniteObserver?.disconnect();
    this.contactsInfiniteObserver?.disconnect();
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.updateHeaderOffset();
    this.setupInfiniteScroll();
  }

  trackByClient = (_: number, c: BmClient) => c.clientId;
  trackByContact = (_: number, c: BmClientContact) => c.contactId;

  // -------- Clients UI --------

  openCreate(): void {
    this.clientForm.reset({
      client_name: '',
      address: '',
      email: '',
      cel: '',
      tel: '',
      notes: '',
      status: 'active',
    });

    this.store.dispatch(ManagerActions.openClientCreate());
    this.store.dispatch(ManagerActions.setClientFormTab({ tab: 'details' }));
  }

  openEdit(c: BmClient): void {
    this.store.dispatch(
      ManagerActions.openClientEdit({ clientId: c.clientId })
    );
    this.store.dispatch(ManagerActions.setClientFormTab({ tab: 'details' }));
  }

  closeForm(): void {
    this.store.dispatch(ManagerActions.closeClientForm());
  }

  saveClient(): void {
    if (this.clientForm.invalid) {
      this.clientForm.markAllAsTouched();
      return;
    }

    const payload = this.clientForm.getRawValue();
    this.store.dispatch(ManagerActions.saveClient({ payload }));
  }

  archiveClient(c: BmClient): void {
    const ok = window.confirm(
      `Archive client "${c.clientName}"?\n\nThis will be a soft delete.`
    );
    if (!ok) return;

    this.store.dispatch(ManagerActions.archiveClient({ clientId: c.clientId }));
  }

  onAddressFocus(): void {
    this.addressHasFocus = true;
    const current = (this.clientForm.controls.address.value || '').trim();
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
        this.addressSuggestions.length - 1
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
    this.clientForm.controls.address.setValue(suggestion.description, {
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
          this.clientForm.controls.address.setValue(next, {
            emitEvent: false,
          });
        }
      });
  }

  private setupAddressAutocomplete(): void {
    this.clientForm.controls.address.valueChanges
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
        takeUntil(this.destroy$)
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

  // Pagination helpers
  nextPage(currentPage: number): void {
    this.store.dispatch(ManagerActions.loadClients({ page: currentPage + 1 }));
  }

  prevPage(currentPage: number): void {
    this.store.dispatch(
      ManagerActions.loadClients({ page: Math.max(1, currentPage - 1) })
    );
  }

  loadMore(currentPage: number | null | undefined): void {
    if (!currentPage) return;
    this.store.dispatch(ManagerActions.loadClients({ page: currentPage + 1 }));
  }

  clearSearch(): void {
    this.searchCtrl.setValue('');
  }

  private updateHeaderOffset(): void {
    const header = this.listHeaderRef?.nativeElement;
    const list = this.clientsListRef?.nativeElement;
    if (!header || !list) return;

    const height = Math.ceil(header.getBoundingClientRect().height);
    list.style.setProperty('--list-header-height', `${height}px`);
  }

  private setupInfiniteScroll(): void {
    const sentinel = this.infiniteSentinelRef?.nativeElement;
    const list = this.clientsListRef?.nativeElement;
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
      }
    );

    this.infiniteObserver.observe(sentinel);
  }

  private tryLoadMore(): void {
    if (!this.canLoadMore || this.isLoading || this.isLoadingMore) return;
    this.isLoadingMore = true;
    this.store.dispatch(
      ManagerActions.loadClients({ page: this.currentPage + 1 })
    );
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
      }
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
      .select(selectManagerEditingClient)
      .pipe(take(1))
      .subscribe((client) => {
        if (!client?.clientId) return;
        this.store.dispatch(
          ManagerActions.loadClientContacts({
            clientId: client.clientId,
            page: this.currentContactsPage + 1,
          })
        );
      });
  }

  // -------- Tabs --------

  setTab(tab: ClientFormTab, client: BmClient | null): void {
    // Contacts tab requires saved client
    if (tab === 'contacts' && !client?.clientId) return;

    this.store.dispatch(ManagerActions.setClientFormTab({ tab }));

    if (tab === 'contacts' && client?.clientId) {
      if (this.lastContactsClientId !== client.clientId) {
        this.lastContactsClientId = client.clientId;
      }
      this.store.dispatch(
        ManagerActions.loadClientContacts({ clientId: client.clientId, page: 1 })
      );
    }
  }

  // -------- Contacts CRUD --------

  openContactCreate(): void {
    this.contactForm.reset({
      name: '',
      role_title: '',
      email: '',
      cel: '',
      tel: '',
    });
    this.store.dispatch(ManagerActions.openContactCreate());
  }

  openContactEdit(contact: BmClientContact): void {
    this.store.dispatch(
      ManagerActions.openContactEdit({ contactId: contact.contactId })
    );
  }

  cancelContactForm(): void {
    this.store.dispatch(ManagerActions.closeContactForm());
  }

  saveContact(client: BmClient | null): void {
    if (!client?.clientId) return;

    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      return;
    }

    const payload = this.contactForm.getRawValue();
    this.store.dispatch(
      ManagerActions.saveContact({ clientId: client.clientId, payload })
    );
  }

  deleteContact(client: BmClient | null, contact: BmClientContact): void {
    if (!client?.clientId) return;

    const ok = window.confirm(`Delete contact "${contact.name}"?`);
    if (!ok) return;

    this.store.dispatch(
      ManagerActions.deleteContact({
        clientId: client.clientId,
        contactId: contact.contactId,
      })
    );
  }
}
