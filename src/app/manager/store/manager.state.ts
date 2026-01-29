import { BmClient, BmClientContact } from '../services/manager.service';

export type ClientsViewMode = 'list' | 'form';
export type ClientFormTab = 'details' | 'contacts';
export type ContactsViewMode = 'list' | 'form';

export interface ManagerState {
  searchQuery: string;

  // Clients
  clients: BmClient[];
  clientsLoading: boolean;
  clientsError: string | null;
  clientsPage: number;
  clientsLimit: number;
  clientsTotal: number;

  clientsViewMode: ClientsViewMode;
  editingClientId: string | null;

  // Client form UI
  clientFormTab: ClientFormTab;

  // Contacts (nested under client)
  contacts: BmClientContact[];
  contactsLoading: boolean;
  contactsError: string | null;

  contactsViewMode: ContactsViewMode;
  editingContactId: string | null;
}

export const initialManagerState: ManagerState = {
  searchQuery: '',

  clients: [],
  clientsLoading: false,
  clientsError: null,
  clientsPage: 1,
  clientsLimit: 20,
  clientsTotal: 0,

  clientsViewMode: 'list',
  editingClientId: null,

  clientFormTab: 'details',

  contacts: [],
  contactsLoading: false,
  contactsError: null,
  contactsViewMode: 'list',
  editingContactId: null,
};
