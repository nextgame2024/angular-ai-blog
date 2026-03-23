import type { BmNavigationLink } from '../../types/navigation.links.interface';

export type NavigationLinksViewMode = 'list' | 'form';

export interface ManagerNavigationLinksState {
  navigationLinksSearchQuery: string;

  navigationLinks: BmNavigationLink[];
  navigationLinksLoading: boolean;
  navigationLinksError: string | null;
  navigationLinksPage: number;
  navigationLinksLimit: number;
  navigationLinksTotal: number;

  navigationLinksViewMode: NavigationLinksViewMode;
  editingNavigationLinkId: string | null;
}

export const initialManagerNavigationLinksState: ManagerNavigationLinksState = {
  navigationLinksSearchQuery: '',

  navigationLinks: [],
  navigationLinksLoading: false,
  navigationLinksError: null,
  navigationLinksPage: 1,
  navigationLinksLimit: 20,
  navigationLinksTotal: 0,

  navigationLinksViewMode: 'list',
  editingNavigationLinkId: null,
};
