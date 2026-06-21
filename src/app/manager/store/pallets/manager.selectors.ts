import { createFeatureSelector, createSelector } from '@ngrx/store';
import { MANAGER_PALLETS_FEATURE_KEY } from './manager.reducer';
import type { ManagerPalletsState } from './manager.state';

export const selectManagerPalletsState =
  createFeatureSelector<ManagerPalletsState>(MANAGER_PALLETS_FEATURE_KEY);

export const selectManagerPalletsActiveTab = createSelector(
  selectManagerPalletsState,
  (s) => s.activeTab,
);
export const selectManagerPalletsSearchQuery = createSelector(
  selectManagerPalletsState,
  (s) => s.searchQuery,
);
export const selectManagerPalletsContext = createSelector(
  selectManagerPalletsState,
  (s) => s.context,
);
export const selectManagerPalletsOnSite = createSelector(
  selectManagerPalletsState,
  (s) => s.onSite,
);
export const selectManagerPalletsSent = createSelector(
  selectManagerPalletsState,
  (s) => s.sent,
);
export const selectManagerPalletsIncoming = createSelector(
  selectManagerPalletsState,
  (s) => s.incoming,
);
export const selectManagerPalletsLoading = createSelector(
  selectManagerPalletsState,
  (s) => s.loading,
);
export const selectManagerPalletsError = createSelector(
  selectManagerPalletsState,
  (s) => s.error,
);
export const selectManagerPalletsOnSitePage = createSelector(
  selectManagerPalletsState,
  (s) => s.onSitePage,
);
export const selectManagerPalletsOnSiteTotal = createSelector(
  selectManagerPalletsState,
  (s) => s.onSiteTotal,
);
export const selectManagerPalletsSentPage = createSelector(
  selectManagerPalletsState,
  (s) => s.sentPage,
);
export const selectManagerPalletsSentTotal = createSelector(
  selectManagerPalletsState,
  (s) => s.sentTotal,
);
export const selectManagerPalletsIncomingPage = createSelector(
  selectManagerPalletsState,
  (s) => s.incomingPage,
);
export const selectManagerPalletsIncomingTotal = createSelector(
  selectManagerPalletsState,
  (s) => s.incomingTotal,
);
