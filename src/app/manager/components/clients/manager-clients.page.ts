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
import { Store } from '@ngrx/store';
import { combineLatest, Observable, Subject } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  map,
  takeUntil,
} from 'rxjs/operators';

import { ManagerActions } from '../../store/manager.actions';
import {
  selectManagerClients,
  selectManagerClientsError,
  selectManagerClientsLoading,
  selectManagerClientsTotal,
  selectManagerSearchQuery,
  selectManagerClientsViewMode,
  selectManagerEditingClient,
  selectManagerClientsPage,
  selectManagerClientsLimit,
  selectManagerClientFormTab,
  selectManagerContacts,
  selectManagerContactsLoading,
  selectManagerContactsError,
  selectManagerContactsViewMode,
  selectManagerEditingContact,
} from '../../store/manager.selectors';
import { BmClient, BmClientContact } from '../../services/manager.service';
import { ClientFormTab } from '../../store/manager.state';

@Component({
  selector: 'app-manager-clients-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './manager-clients.page.html',
  styleUrls: ['./manager-clients.page.css'],
})
export class ManagerClientsPageComponent
  implements OnInit, OnDestroy, AfterViewInit
{
  private destroy$ = new Subject<void>();
  private infiniteObserver?: IntersectionObserver;
  private isLoadingMore = false;

  loading$ = this.store.select(selectManagerClientsLoading);
  error$ = this.store.select(selectManagerClientsError);
  clientsRaw$ = this.store.select(selectManagerClients);
  total$ = this.store.select(selectManagerClientsTotal);
  viewMode$ = this.store.select(selectManagerClientsViewMode);
  editingClient$ = this.store.select(selectManagerEditingClient);

  page$ = this.store.select(selectManagerClientsPage);
  limit$ = this.store.select(selectManagerClientsLimit);
  searchQuery$ = this.store.select(selectManagerSearchQuery);

  // Tabs + Contacts
  tab$ = this.store.select(selectManagerClientFormTab);

  contacts$ = this.store.select(selectManagerContacts);
  contactsLoading$ = this.store.select(selectManagerContactsLoading);
  contactsError$ = this.store.select(selectManagerContactsError);
  contactsViewMode$ = this.store.select(selectManagerContactsViewMode);
  editingContact$ = this.store.select(selectManagerEditingContact);

  private lastContactsClientId: string | null = null;

  searchCtrl: FormControl<string>;
  canLoadMore$!: Observable<boolean>;

  @ViewChild('listHeader') listHeaderRef?: ElementRef<HTMLElement>;
  @ViewChild('clientsList') clientsListRef?: ElementRef<HTMLElement>;
  @ViewChild('infiniteSentinel') infiniteSentinelRef?: ElementRef<HTMLElement>;

  private currentPage = 1;
  private canLoadMore = false;
  private isLoading = false;

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

  constructor(private store: Store, private fb: FormBuilder) {
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
          ManagerActions.setSearchQuery({ query: query || '' })
        )
      );

    this.viewMode$
      .pipe(takeUntil(this.destroy$))
      .subscribe((mode) => {
        if (mode !== 'list') return;
        setTimeout(() => this.updateHeaderOffset(), 0);
        setTimeout(() => this.setupInfiniteScroll(), 0);
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
  }

  ngAfterViewInit(): void {
    this.updateHeaderOffset();
    this.setupInfiniteScroll();
  }

  ngOnDestroy(): void {
    this.infiniteObserver?.disconnect();
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
        ManagerActions.loadClientContacts({ clientId: client.clientId })
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
