import { createFeatureSelector, createSelector } from '@ngrx/store';
import { MANAGER_NAVIGATION_LINKS_FEATURE_KEY } from './manager.reducer';
import { ManagerNavigationLinksState } from './manager.state';
import type { BmNavigationLink } from '../../types/navigation.links.interface';

export const selectManagerNavigationLinksState =
  createFeatureSelector<ManagerNavigationLinksState>(
    MANAGER_NAVIGATION_LINKS_FEATURE_KEY,
  );

export const selectManagerNavigationLinksSearchQuery = createSelector(
  selectManagerNavigationLinksState,
  (s) => s.navigationLinksSearchQuery,
);

export const selectManagerNavigationLinks = createSelector(
  selectManagerNavigationLinksState,
  (s) => s.navigationLinks,
);

export const selectManagerNavigationLinksLoading = createSelector(
  selectManagerNavigationLinksState,
  (s) => s.navigationLinksLoading,
);

export const selectManagerNavigationLinksError = createSelector(
  selectManagerNavigationLinksState,
  (s) => s.navigationLinksError,
);

export const selectManagerNavigationLinksTotal = createSelector(
  selectManagerNavigationLinksState,
  (s) => s.navigationLinksTotal,
);

export const selectManagerNavigationLinksPage = createSelector(
  selectManagerNavigationLinksState,
  (s) => s.navigationLinksPage,
);

export const selectManagerNavigationLinksViewMode = createSelector(
  selectManagerNavigationLinksState,
  (s) => s.navigationLinksViewMode,
);

export const selectManagerEditingNavigationLink = createSelector(
  selectManagerNavigationLinksState,
  (s) => {
    if (!s.editingNavigationLinkId) return null;
    return (
      s.navigationLinks.find(
        (item: BmNavigationLink) =>
          item.navigationLinkId === s.editingNavigationLinkId,
      ) ?? null
    );
  },
);
