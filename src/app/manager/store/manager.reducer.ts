import { createReducer, on } from '@ngrx/store';
import { ManagerActions } from './manager.actions';
import { initialManagerState } from './manager.state';
import type { BmClient, BmUser } from '../services/manager.service';

export const MANAGER_FEATURE_KEY = 'manager';

function isUserArchived(user: BmUser): boolean {
  return (user.status ?? 'active') === 'archived';
}

function sortUsers(items: BmUser[]): BmUser[] {
  return [...items].sort((a, b) => {
    if (isUserArchived(a) !== isUserArchived(b)) return isUserArchived(a) ? 1 : -1;

    const nameA = (a.name || a.username || '').trim().toLowerCase();
    const nameB = (b.name || b.username || '').trim().toLowerCase();
    if (nameA !== nameB) return nameA.localeCompare(nameB);

    const createdA = Date.parse(a.createdAt ?? '');
    const createdB = Date.parse(b.createdAt ?? '');
    if (Number.isFinite(createdA) && Number.isFinite(createdB)) {
      return createdB - createdA;
    }
    return 0;
  });
}

function isClientArchived(client: BmClient): boolean {
  return (client.status ?? 'active') === 'archived';
}

function sortClients(items: BmClient[]): BmClient[] {
  return [...items].sort((a, b) => {
    if (isClientArchived(a) !== isClientArchived(b)) {
      return isClientArchived(a) ? 1 : -1;
    }

    const nameA = (a.clientName || '').trim().toLowerCase();
    const nameB = (b.clientName || '').trim().toLowerCase();
    if (nameA !== nameB) return nameA.localeCompare(nameB);

    const createdA = Date.parse(a.createdAt ?? '');
    const createdB = Date.parse(b.createdAt ?? '');
    if (Number.isFinite(createdA) && Number.isFinite(createdB)) {
      return createdB - createdA;
    }
    return 0;
  });
}

export const managerReducer = createReducer(
  initialManagerState,

  // Search
  on(ManagerActions.setSearchQuery, (state, { query }) => ({
    ...state,
    searchQuery: query,
  })),
  on(ManagerActions.setClientsSearchQuery, (state, { query }) => ({
    ...state,
    clientsSearchQuery: query,
  })),
  on(ManagerActions.setUsersSearchQuery, (state, { query }) => ({
    ...state,
    usersSearchQuery: query,
  })),

  // Clients - load
  on(ManagerActions.loadClients, (state, { page }) => ({
    ...state,
    clientsLoading: true,
    clientsError: null,
    clientsPage: page,
  })),

  on(
    ManagerActions.loadClientsSuccess,
    (state, { clients, page, limit, total }) => ({
      ...state,
      clientsLoading: false,
      clients: sortClients(
        page > 1
          ? [
              ...state.clients,
              ...(clients ?? []).filter(
                (c) => !state.clients.some((p) => p.clientId === c.clientId),
              ),
            ]
          : (clients ?? []),
      ),
      clientsPage: page,
      clientsLimit: limit,
      clientsTotal: total,
    }),
  ),

  on(ManagerActions.loadClientsFailure, (state, { error }) => ({
    ...state,
    clientsLoading: false,
    clientsError: error,
  })),

  // Clients - form open/close
  on(ManagerActions.openClientCreate, (state) => ({
    ...state,
    clientsViewMode: 'form' as const,
    editingClientId: null,
    clientFormTab: 'details' as const,
    clientsError: null,

    // reset contacts UI (no client yet)
    contacts: [],
    contactsLoading: false,
    contactsError: null,
    contactsPage: 1,
    contactsLimit: 20,
    contactsTotal: 0,
    contactsViewMode: 'list' as const,
    editingContactId: null,
  })),

  on(ManagerActions.openClientEdit, (state, { clientId }) => ({
    ...state,
    clientsViewMode: 'form' as const,
    editingClientId: clientId,
    clientFormTab: 'details' as const,
    clientsError: null,

    contacts: [],
    contactsLoading: false,
    contactsError: null,
    contactsPage: 1,
    contactsLimit: 20,
    contactsTotal: 0,
    contactsViewMode: 'list' as const,
    editingContactId: null,
  })),

  on(ManagerActions.closeClientForm, (state) => ({
    ...state,
    clientsViewMode: 'list' as const,
    editingClientId: null,
    clientFormTab: 'details' as const,

    contacts: [],
    contactsLoading: false,
    contactsError: null,
    contactsPage: 1,
    contactsLimit: 20,
    contactsTotal: 0,
    contactsViewMode: 'list' as const,
    editingContactId: null,
  })),

  on(ManagerActions.setClientFormTab, (state, { tab }) => ({
    ...state,
    clientFormTab: tab,
  })),

  // Clients - save
  on(ManagerActions.saveClient, (state) => ({
    ...state,
    clientsLoading: true,
    clientsError: null,
  })),

  on(ManagerActions.saveClientSuccess, (state, { client }) => {
    const idx = state.clients.findIndex((c) => c.clientId === client.clientId);
    const next = [...state.clients];

    if (idx >= 0) {
      const prev = next[idx];
      next[idx] = {
        ...prev,
        ...client,
        hasProjects: client.hasProjects ?? prev.hasProjects ?? false,
      };
    } else {
      next.unshift({
        ...client,
        hasProjects: client.hasProjects ?? false,
      });
    }

    // Keep user in form so they can jump to Contacts after saving.
    return {
      ...state,
      clientsLoading: false,
      clients: sortClients(next),
      clientsViewMode: 'form' as const,
      editingClientId: client.clientId,
      clientFormTab: state.editingClientId
        ? state.clientFormTab
        : ('details' as const),
    };
  }),

  on(ManagerActions.saveClientFailure, (state, { error }) => ({
    ...state,
    clientsLoading: false,
    clientsError: error,
  })),

  // Clients - archive
  on(ManagerActions.archiveClient, (state) => ({
    ...state,
    clientsLoading: true,
    clientsError: null,
  })),

  on(ManagerActions.archiveClientSuccess, (state, { clientId }) => ({
    ...state,
    clientsLoading: false,
    clients: sortClients(
      state.clients.map((c) =>
        c.clientId === clientId ? { ...c, status: 'archived' } : c,
      ),
    ),
  })),

  on(ManagerActions.archiveClientFailure, (state, { error }) => ({
    ...state,
    clientsLoading: false,
    clientsError: error,
  })),

  // Contacts - load
  on(ManagerActions.loadClientContacts, (state, { page }) => ({
    ...state,
    contactsLoading: true,
    contactsError: null,
    contactsPage: page,
  })),

  on(
    ManagerActions.loadClientContactsSuccess,
    (state, { contacts, page, limit, total }) => ({
      ...state,
      contactsLoading: false,
      contacts:
        page > 1
          ? [
              ...state.contacts,
              ...(contacts ?? []).filter(
                (c) =>
                  !state.contacts.some(
                    (existing) => existing.contactId === c.contactId,
                  ),
              ),
            ]
          : (contacts ?? []),
      contactsPage: page,
      contactsLimit: limit,
      contactsTotal: total,
    }),
  ),

  on(ManagerActions.loadClientContactsFailure, (state, { error }) => ({
    ...state,
    contactsLoading: false,
    contactsError: error,
  })),

  // Contacts - form open/close
  on(ManagerActions.openContactCreate, (state) => ({
    ...state,
    contactsViewMode: 'form' as const,
    editingContactId: null,
    contactsError: null,
  })),

  on(ManagerActions.openContactEdit, (state, { contactId }) => ({
    ...state,
    contactsViewMode: 'form' as const,
    editingContactId: contactId,
    contactsError: null,
  })),

  on(ManagerActions.closeContactForm, (state) => ({
    ...state,
    contactsViewMode: 'list' as const,
    editingContactId: null,
    contactsError: null,
  })),

  // Contacts - save
  on(ManagerActions.saveContact, (state) => ({
    ...state,
    contactsLoading: true,
    contactsError: null,
  })),

  on(ManagerActions.saveContactSuccess, (state, { contact }) => {
    const idx = state.contacts.findIndex(
      (c) => c.contactId === contact.contactId,
    );
    const next = [...state.contacts];

    if (idx >= 0) next[idx] = contact;
    else next.unshift(contact);

    return {
      ...state,
      contactsLoading: false,
      contacts: next,
      contactsViewMode: 'list' as const,
      editingContactId: null,
    };
  }),

  on(ManagerActions.saveContactFailure, (state, { error }) => ({
    ...state,
    contactsLoading: false,
    contactsError: error,
  })),

  // Contacts - delete
  on(ManagerActions.deleteContact, (state) => ({
    ...state,
    contactsLoading: true,
    contactsError: null,
  })),

  on(ManagerActions.deleteContactSuccess, (state, { contactId }) => ({
    ...state,
    contactsLoading: false,
    contacts: state.contacts.filter((c) => c.contactId !== contactId),
  })),

  on(ManagerActions.deleteContactFailure, (state, { error }) => ({
    ...state,
    contactsLoading: false,
    contactsError: error,
  })),

  /* =========================
     Users - load
  ========================= */
  on(ManagerActions.loadUsers, (state, { page }) => ({
    ...state,
    usersLoading: true,
    usersError: null,
    usersPage: page,
  })),

  on(ManagerActions.loadUsersSuccess, (state, { result }) => ({
    ...state,
    usersLoading: false,
    users: sortUsers(
      result.page > 1
        ? [
            ...state.users,
            ...(result.items ?? []).filter(
              (u: BmUser) => !state.users.some((p) => p.id === u.id),
            ),
          ]
        : (result.items ?? []),
    ),
    usersPage: result.page,
    usersLimit: result.limit,
    usersTotal: result.total,
  })),

  on(ManagerActions.loadUsersFailure, (state, { error }) => ({
    ...state,
    usersLoading: false,
    usersError: error,
  })),

  // Users - form
  on(ManagerActions.openUserCreate, (state) => ({
    ...state,
    usersViewMode: 'form' as const,
    editingUserId: null,
    usersError: null,
  })),

  on(ManagerActions.openUserEdit, (state, { userId }) => ({
    ...state,
    usersViewMode: 'form' as const,
    editingUserId: userId,
    usersError: null,
  })),

  on(ManagerActions.closeUserForm, (state) => ({
    ...state,
    usersViewMode: 'list' as const,
    editingUserId: null,
  })),

  // Users - save
  on(ManagerActions.saveUser, (state) => ({
    ...state,
    usersLoading: true,
    usersError: null,
  })),

  on(ManagerActions.saveUserSuccess, (state, { user }) => {
    const idx = state.users.findIndex((u: BmUser) => u.id === user.id);
    const next = [...state.users];

    if (idx >= 0) {
      const prev = next[idx];
      next[idx] = {
        ...prev,
        ...user,
        hasProcesses: user.hasProcesses ?? prev.hasProcesses ?? false,
      };
    }
    else next.unshift(user);

    return {
      ...state,
      usersLoading: false,
      users: sortUsers(next),
      usersViewMode: 'list' as const,
      editingUserId: null,
    };
  }),

  on(ManagerActions.saveUserFailure, (state, { error }) => ({
    ...state,
    usersLoading: false,
    usersError: error,
  })),

  // Users - archive/delete
  on(ManagerActions.archiveUser, (state) => ({
    ...state,
    usersLoading: true,
    usersError: null,
  })),

  on(ManagerActions.archiveUserSuccess, (state, { userId, action }) => {
    const isDeleted = action === 'deleted';
    const users = isDeleted
      ? state.users.filter((u: BmUser) => u.id !== userId)
      : state.users.map((u: BmUser) =>
          u.id === userId ? { ...u, status: 'archived' } : u,
        );

    return {
      ...state,
      usersLoading: false,
      users: sortUsers(users),
      usersTotal: isDeleted ? Math.max(state.usersTotal - 1, 0) : state.usersTotal,
    };
  }),

  on(ManagerActions.archiveUserFailure, (state, { error }) => ({
    ...state,
    usersLoading: false,
    usersError: error,
  })),
);
