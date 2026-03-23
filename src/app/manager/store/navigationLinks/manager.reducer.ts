import { createReducer, on } from '@ngrx/store';
import { ManagerNavigationLinksActions } from './manager.actions';
import { initialManagerNavigationLinksState } from './manager.state';
import type { BmNavigationLink } from '../../types/navigation.links.interface';

export const MANAGER_NAVIGATION_LINKS_FEATURE_KEY = 'managerNavigationLinks';

export const managerNavigationLinksReducer = createReducer(
  initialManagerNavigationLinksState,

  on(
    ManagerNavigationLinksActions.setNavigationLinksSearchQuery,
    (state, { query }) => ({
      ...state,
      navigationLinksSearchQuery: query,
    }),
  ),

  on(ManagerNavigationLinksActions.loadNavigationLinks, (state, { page }) => ({
    ...state,
    navigationLinksLoading: true,
    navigationLinksError: null,
    navigationLinksPage: page,
  })),

  on(
    ManagerNavigationLinksActions.loadNavigationLinksSuccess,
    (state, { result }) => ({
      ...state,
      navigationLinksLoading: false,
      navigationLinks:
        result.page > 1
          ? [
              ...state.navigationLinks,
              ...(result.items ?? []).filter(
                (link) =>
                  !state.navigationLinks.some(
                    (existing) =>
                      existing.navigationLinkId === link.navigationLinkId,
                  ),
              ),
            ]
          : (result.items ?? []),
      navigationLinksPage: result.page,
      navigationLinksLimit: result.limit,
      navigationLinksTotal: result.total,
    }),
  ),

  on(
    ManagerNavigationLinksActions.loadNavigationLinksFailure,
    (state, { error }) => ({
      ...state,
      navigationLinksLoading: false,
      navigationLinksError: error,
    }),
  ),

  on(ManagerNavigationLinksActions.openNavigationLinkCreate, (state) => ({
    ...state,
    navigationLinksViewMode: 'form' as const,
    editingNavigationLinkId: null,
    navigationLinksError: null,
  })),

  on(
    ManagerNavigationLinksActions.openNavigationLinkEdit,
    (state, { navigationLinkId }) => ({
      ...state,
      navigationLinksViewMode: 'form' as const,
      editingNavigationLinkId: navigationLinkId,
      navigationLinksError: null,
    }),
  ),

  on(ManagerNavigationLinksActions.closeNavigationLinkForm, (state) => ({
    ...state,
    navigationLinksViewMode: 'list' as const,
    editingNavigationLinkId: null,
    navigationLinksError: null,
  })),

  on(ManagerNavigationLinksActions.saveNavigationLink, (state) => ({
    ...state,
    navigationLinksLoading: true,
    navigationLinksError: null,
  })),

  on(
    ManagerNavigationLinksActions.saveNavigationLinkSuccess,
    (state, { navigationLink }) => {
      const idx = state.navigationLinks.findIndex(
        (row: BmNavigationLink) =>
          row.navigationLinkId === navigationLink.navigationLinkId,
      );
      const next = [...state.navigationLinks];

      if (idx >= 0) next[idx] = navigationLink;
      else next.unshift(navigationLink);

      return {
        ...state,
        navigationLinksLoading: false,
        navigationLinks: next,
        navigationLinksViewMode: 'list' as const,
        editingNavigationLinkId: null,
      };
    },
  ),

  on(
    ManagerNavigationLinksActions.saveNavigationLinkFailure,
    (state, { error }) => ({
      ...state,
      navigationLinksLoading: false,
      navigationLinksError: error,
    }),
  ),

  on(ManagerNavigationLinksActions.syncNavigationLabels, (state) => ({
    ...state,
    navigationLinksLoading: true,
    navigationLinksError: null,
  })),

  on(
    ManagerNavigationLinksActions.syncNavigationLabelsSuccess,
    (state, { result }) => ({
      ...state,
      navigationLinksLoading: false,
      navigationLinks:
        state.navigationLinksViewMode === 'form'
          ? result.navigationLinks
          : state.navigationLinks,
      navigationLinksViewMode: 'list' as const,
      editingNavigationLinkId: null,
    }),
  ),

  on(
    ManagerNavigationLinksActions.syncNavigationLabelsFailure,
    (state, { error }) => ({
      ...state,
      navigationLinksLoading: false,
      navigationLinksError: error,
    }),
  ),

  on(ManagerNavigationLinksActions.removeNavigationLink, (state) => ({
    ...state,
    navigationLinksLoading: true,
    navigationLinksError: null,
  })),

  on(
    ManagerNavigationLinksActions.removeNavigationLinkSuccess,
    (state, { navigationLinkId }) => ({
      ...state,
      navigationLinksLoading: false,
      navigationLinks: state.navigationLinks.filter(
        (item) => item.navigationLinkId !== navigationLinkId,
      ),
      navigationLinksTotal: Math.max(0, state.navigationLinksTotal - 1),
    }),
  ),

  on(
    ManagerNavigationLinksActions.removeNavigationLinkFailure,
    (state, { error }) => ({
      ...state,
      navigationLinksLoading: false,
      navigationLinksError: error,
    }),
  ),
);
