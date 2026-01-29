import { createFeatureSelector, createSelector } from '@ngrx/store';
import { MANAGER_FEATURE_KEY } from './manager.reducer';
import { ManagerState } from './manager.state';

export const selectManagerState =
  createFeatureSelector<ManagerState>(MANAGER_FEATURE_KEY);

export const selectManagerSearchQuery = createSelector(
  selectManagerState,
  (s) => s.searchQuery
);

// Clients
export const selectManagerClients = createSelector(
  selectManagerState,
  (s) => s.clients
);
export const selectManagerClientsLoading = createSelector(
  selectManagerState,
  (s) => s.clientsLoading
);
export const selectManagerClientsError = createSelector(
  selectManagerState,
  (s) => s.clientsError
);
export const selectManagerClientsTotal = createSelector(
  selectManagerState,
  (s) => s.clientsTotal
);
export const selectManagerClientsPage = createSelector(
  selectManagerState,
  (s) => s.clientsPage
);
export const selectManagerClientsLimit = createSelector(
  selectManagerState,
  (s) => s.clientsLimit
);
export const selectManagerClientsViewMode = createSelector(
  selectManagerState,
  (s) => s.clientsViewMode
);

export const selectManagerEditingClient = createSelector(
  selectManagerState,
  (s) => {
    if (!s.editingClientId) return null;
    return s.clients.find((c) => c.clientId === s.editingClientId) ?? null;
  }
);

// Client Form UI
export const selectManagerClientFormTab = createSelector(
  selectManagerState,
  (s) => s.clientFormTab
);

// Contacts
export const selectManagerContacts = createSelector(
  selectManagerState,
  (s) => s.contacts
);
export const selectManagerContactsLoading = createSelector(
  selectManagerState,
  (s) => s.contactsLoading
);
export const selectManagerContactsError = createSelector(
  selectManagerState,
  (s) => s.contactsError
);
export const selectManagerContactsViewMode = createSelector(
  selectManagerState,
  (s) => s.contactsViewMode
);

export const selectManagerEditingContact = createSelector(
  selectManagerState,
  (s) => {
    if (!s.editingContactId) return null;
    return s.contacts.find((c) => c.contactId === s.editingContactId) ?? null;
  }
);
