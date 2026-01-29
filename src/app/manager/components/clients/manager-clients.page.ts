import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Store } from '@ngrx/store';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

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
export class ManagerClientsPageComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  loading$ = this.store.select(selectManagerClientsLoading);
  error$ = this.store.select(selectManagerClientsError);
  clients$ = this.store.select(selectManagerClients);
  total$ = this.store.select(selectManagerClientsTotal);
  viewMode$ = this.store.select(selectManagerClientsViewMode);
  editingClient$ = this.store.select(selectManagerEditingClient);

  page$ = this.store.select(selectManagerClientsPage);
  limit$ = this.store.select(selectManagerClientsLimit);

  // Tabs + Contacts
  tab$ = this.store.select(selectManagerClientFormTab);

  contacts$ = this.store.select(selectManagerContacts);
  contactsLoading$ = this.store.select(selectManagerContactsLoading);
  contactsError$ = this.store.select(selectManagerContactsError);
  contactsViewMode$ = this.store.select(selectManagerContactsViewMode);
  editingContact$ = this.store.select(selectManagerEditingContact);

  private lastContactsClientId: string | null = null;

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

  constructor(private store: Store, private fb: FormBuilder) {}

  ngOnInit(): void {
    // Initial clients list load
    this.store.dispatch(ManagerActions.loadClients({ page: 1 }));

    // Reload when search query changes (simple v1 behavior)
    this.store
      .select(selectManagerSearchQuery)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() =>
        this.store.dispatch(ManagerActions.loadClients({ page: 1 }))
      );

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

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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
