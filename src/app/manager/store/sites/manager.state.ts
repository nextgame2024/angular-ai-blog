import type { BmSite } from '../../types/sites.interface';

export type SitesViewMode = 'list' | 'form';

export interface ManagerSitesState {
  sitesSearchQuery: string;
  sites: BmSite[];
  sitesLoading: boolean;
  sitesError: string | null;
  sitesPage: number;
  sitesLimit: number;
  sitesTotal: number;
  sitesViewMode: SitesViewMode;
  editingSiteId: string | null;
}

export const initialManagerSitesState: ManagerSitesState = {
  sitesSearchQuery: '',
  sites: [],
  sitesLoading: false,
  sitesError: null,
  sitesPage: 1,
  sitesLimit: 20,
  sitesTotal: 0,
  sitesViewMode: 'list',
  editingSiteId: null,
};
