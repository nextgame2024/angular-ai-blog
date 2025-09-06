import { createFeature, createReducer, on } from '@ngrx/store';
import { followActions, Profile } from './actions';

export const followFeatureKey = 'follow';

export interface FollowState {
  isSubmitting: boolean;
  suggestionsLoading: boolean;
  suggestions: Profile[];
  error: any | null;
}

const initialState: FollowState = {
  isSubmitting: false,
  suggestionsLoading: false,
  suggestions: [],
  error: null,
};

const reducer = createReducer(
  initialState,

  // follow/unfollow
  on(followActions.follow, followActions.unfollow, (state) => ({
    ...state,
    isSubmitting: true,
    error: null,
  })),
  on(
    followActions.followSuccess,
    followActions.unfollowSuccess,
    (state, { profile }) => ({
      ...state,
      isSubmitting: false,
      error: null,
      // reflect status in suggestions if present
      suggestions: state.suggestions.map((p) =>
        p.username === profile.username ? profile : p
      ),
    })
  ),
  on(
    followActions.followFailure,
    followActions.unfollowFailure,
    (state, { error }) => ({
      ...state,
      isSubmitting: false,
      error,
    })
  ),

  // suggestions
  on(followActions.loadSuggestions, (state) => ({
    ...state,
    suggestionsLoading: true,
    error: null,
  })),
  on(followActions.loadSuggestionsSuccess, (state, { profiles }) => ({
    ...state,
    suggestionsLoading: false,
    suggestions: profiles,
    error: null,
  })),
  on(followActions.loadSuggestionsFailure, (state, { error }) => ({
    ...state,
    suggestionsLoading: false,
    error,
  })),
  on(followActions.clearSuggestions, (state) => ({
    ...state,
    suggestions: [],
  }))
);

export const followFeature = createFeature({
  name: followFeatureKey,
  reducer,
});

export const {
  name: _featureName,
  reducer: followReducer,
  selectFollowState,
  selectIsSubmitting,
  selectSuggestions,
  selectSuggestionsLoading,
  selectError,
} = followFeature;
