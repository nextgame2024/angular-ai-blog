import { createFeatureSelector, createSelector } from '@ngrx/store';
import { MANAGER_SITES_FEATURE_KEY } from './manager.reducer';
import type { ManagerSitesState } from './manager.state';

export const selectManagerSitesState =
  createFeatureSelector<ManagerSitesState>(MANAGER_SITES_FEATURE_KEY);

export const selectManagerSitesSearchQuery = createSelector(
  selectManagerSitesState,
  (s) => s.sitesSearchQuery,
);
export const selectManagerSites = createSelector(
  selectManagerSitesState,
  (s) => s.sites,
);
export const selectManagerSitesLoading = createSelector(
  selectManagerSitesState,
  (s) => s.sitesLoading,
);
export const selectManagerSitesError = createSelector(
  selectManagerSitesState,
  (s) => s.sitesError,
);
export const selectManagerSitesPage = createSelector(
  selectManagerSitesState,
  (s) => s.sitesPage,
);
export const selectManagerSitesTotal = createSelector(
  selectManagerSitesState,
  (s) => s.sitesTotal,
);
export const selectManagerSitesViewMode = createSelector(
  selectManagerSitesState,
  (s) => s.sitesViewMode,
);
export const selectManagerEditingSite = createSelector(
  selectManagerSitesState,
  (s) => s.sites.find((site) => site.siteId === s.editingSiteId) ?? null,
);
