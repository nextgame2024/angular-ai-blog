import { createFeatureSelector, createSelector } from '@ngrx/store';

import { MANAGER_EXPLORE_FEATURE_KEY } from './manager.reducer';
import type { ManagerExploreState } from './manager.state';

export const selectManagerExploreState =
  createFeatureSelector<ManagerExploreState>(MANAGER_EXPLORE_FEATURE_KEY);

export const selectManagerExploreSearchQuery = createSelector(
  selectManagerExploreState,
  (state) => state.exploreSearchQuery,
);

export const selectManagerExploreVideos = createSelector(
  selectManagerExploreState,
  (state) => state.exploreVideos,
);

export const selectManagerExploreLoading = createSelector(
  selectManagerExploreState,
  (state) => state.exploreLoading,
);

export const selectManagerExploreError = createSelector(
  selectManagerExploreState,
  (state) => state.exploreError,
);

export const selectManagerExplorePage = createSelector(
  selectManagerExploreState,
  (state) => state.explorePage,
);

export const selectManagerExploreLimit = createSelector(
  selectManagerExploreState,
  (state) => state.exploreLimit,
);

export const selectManagerExploreTotal = createSelector(
  selectManagerExploreState,
  (state) => state.exploreTotal,
);
