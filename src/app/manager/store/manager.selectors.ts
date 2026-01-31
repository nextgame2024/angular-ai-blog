import { createFeatureSelector, createSelector } from '@ngrx/store';
import { MANAGER_FEATURE_KEY } from './manager.reducer';
import { ManagerState } from './manager.state';
import type { BmUser } from '../services/manager.service';

export const selectManagerState =
  createFeatureSelector<ManagerState>(MANAGER_FEATURE_KEY);

export const selectManagerSearchQuery = createSelector(
  selectManagerState,
  (s) => s.searchQuery,
);
export const selectManagerClientsSearchQuery = createSelector(
  selectManagerState,
  (s) => s.clientsSearchQuery,
);
export const selectManagerUsersSearchQuery = createSelector(
  selectManagerState,
  (s) => s.usersSearchQuery,
);

// Clients
export const selectManagerClients = createSelector(
  selectManagerState,
  (s) => s.clients,
);
export const selectManagerClientsLoading = createSelector(
  selectManagerState,
  (s) => s.clientsLoading,
);
export const selectManagerClientsError = createSelector(
  selectManagerState,
  (s) => s.clientsError,
);
export const selectManagerClientsTotal = createSelector(
  selectManagerState,
  (s) => s.clientsTotal,
);
export const selectManagerClientsPage = createSelector(
  selectManagerState,
  (s) => s.clientsPage,
);
export const selectManagerClientsLimit = createSelector(
  selectManagerState,
  (s) => s.clientsLimit,
);
export const selectManagerClientsViewMode = createSelector(
  selectManagerState,
  (s) => s.clientsViewMode,
);

export const selectManagerEditingClient = createSelector(
  selectManagerState,
  (s) => {
    if (!s.editingClientId) return null;
    return s.clients.find((c) => c.clientId === s.editingClientId) ?? null;
  },
);

// Client Form UI
export const selectManagerClientFormTab = createSelector(
  selectManagerState,
  (s) => s.clientFormTab,
);

// Contacts
export const selectManagerContacts = createSelector(
  selectManagerState,
  (s) => s.contacts,
);
export const selectManagerContactsLoading = createSelector(
  selectManagerState,
  (s) => s.contactsLoading,
);
export const selectManagerContactsError = createSelector(
  selectManagerState,
  (s) => s.contactsError,
);
export const selectManagerContactsViewMode = createSelector(
  selectManagerState,
  (s) => s.contactsViewMode,
);

export const selectManagerEditingContact = createSelector(
  selectManagerState,
  (s) => {
    if (!s.editingContactId) return null;
    return s.contacts.find((c) => c.contactId === s.editingContactId) ?? null;
  },
);

/* =========================
   Users selectors
========================= */
export const selectManagerUsers = createSelector(
  selectManagerState,
  (s) => s.users,
);
export const selectManagerUsersLoading = createSelector(
  selectManagerState,
  (s) => s.usersLoading,
);
export const selectManagerUsersError = createSelector(
  selectManagerState,
  (s) => s.usersError,
);
export const selectManagerUsersTotal = createSelector(
  selectManagerState,
  (s) => s.usersTotal,
);
export const selectManagerUsersPage = createSelector(
  selectManagerState,
  (s) => s.usersPage,
);
export const selectManagerUsersLimit = createSelector(
  selectManagerState,
  (s) => s.usersLimit,
);
export const selectManagerUsersViewMode = createSelector(
  selectManagerState,
  (s) => s.usersViewMode,
);

export const selectManagerEditingUser = createSelector(
  selectManagerState,
  (s) => {
    if (!s.editingUserId) return null;
    return s.users.find((u: BmUser) => u.id === s.editingUserId) ?? null;
  },
);
