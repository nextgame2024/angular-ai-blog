import type { BmPalletMovement, PalletsContext } from '../../types/pallets.interface';
import type { BmSite } from '../../types/sites.interface';
import type { PalletsTab } from './manager.actions';

export interface ManagerPalletsState {
  activeTab: PalletsTab;
  searchQuery: string;
  context: PalletsContext;
  onSite: BmSite[];
  onSitePage: number;
  onSiteLimit: number;
  onSiteTotal: number;
  sent: BmPalletMovement[];
  sentPage: number;
  sentLimit: number;
  sentTotal: number;
  incoming: BmPalletMovement[];
  incomingPage: number;
  incomingLimit: number;
  incomingTotal: number;
  loading: boolean;
  error: string | null;
}

export const initialManagerPalletsState: ManagerPalletsState = {
  activeTab: 'onSite',
  searchQuery: '',
  context: { originSite: null, destinationSites: [] },
  onSite: [],
  onSitePage: 1,
  onSiteLimit: 20,
  onSiteTotal: 0,
  sent: [],
  sentPage: 1,
  sentLimit: 20,
  sentTotal: 0,
  incoming: [],
  incomingPage: 1,
  incomingLimit: 20,
  incomingTotal: 0,
  loading: false,
  error: null,
};
