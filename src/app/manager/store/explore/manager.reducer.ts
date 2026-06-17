import { createReducer, on } from '@ngrx/store';

import { ManagerExploreActions } from './manager.actions';
import { initialManagerExploreState } from './manager.state';

export const MANAGER_EXPLORE_FEATURE_KEY = 'managerExplore';

export const managerExploreReducer = createReducer(
  initialManagerExploreState,

  on(ManagerExploreActions.setExploreSearchQuery, (state, { query }) => ({
    ...state,
    exploreSearchQuery: query,
  })),

  on(ManagerExploreActions.loadExploreVideos, (state, { page }) => ({
    ...state,
    exploreLoading: true,
    exploreError: null,
    explorePage: page,
  })),

  on(ManagerExploreActions.loadExploreVideosSuccess, (state, { result }) => ({
    ...state,
    exploreLoading: false,
    exploreVideos:
      result.page > 1
        ? [
            ...state.exploreVideos,
            ...(result.items ?? []).filter(
              (video) =>
                !state.exploreVideos.some(
                  (existingVideo) => existingVideo.videoId === video.videoId,
                ),
            ),
          ]
        : (result.items ?? []),
    explorePage: result.page,
    exploreLimit: result.limit,
    exploreTotal: result.total,
  })),

  on(ManagerExploreActions.loadExploreVideosFailure, (state, { error }) => ({
    ...state,
    exploreLoading: false,
    exploreError: error,
  })),

  on(ManagerExploreActions.resetExploreState, () => initialManagerExploreState),
);
