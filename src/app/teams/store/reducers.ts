/**
 * Teams Reducer + Selectors (NgRx)
 * --------------------------------
 * WHAT IS THIS FILE?
 * A reducer is a pure function that takes the current state and an action,
 * and returns a new state. It never mutates the existing state.
 *
 * WHY DO WE NEED REDUCERS?
 * - Single source of truth for the Teams feature state.
 * - Immutable updates make state predictable and easy to debug/time-travel.
 *
 * SELECTORS:
 * - Selectors read small slices of the feature state for components to use.
 */

import { createFeature, createReducer, on } from '@ngrx/store';
import { teamsActions } from './actions';
import { TeamInterface } from '../types/team.interface';

export interface TeamsState {
  isLoading: boolean; // spinner for list (load/reorder), also useful for global UX
  error: string | null; // last error message (optional)
  list: TeamInterface[]; // the teams
}

const initialState: TeamsState = {
  isLoading: false,
  error: null,
  list: [],
};

const feature = createFeature({
  name: 'teams', // feature key used when registering in routes.providers (provideState)
  reducer: createReducer(
    initialState,

    // ----- LOAD -----
    on(teamsActions.load, (state) => ({
      ...state,
      isLoading: true,
      error: null,
    })),
    on(teamsActions.loadSuccess, (state, { teams }) => ({
      ...state,
      isLoading: false,
      list: teams,
    })),
    on(teamsActions.loadFailure, (state, { error }) => ({
      ...state,
      isLoading: false,
      error,
    })),

    // ----- CREATE -----
    on(teamsActions.createSuccess, (state, { team }) => ({
      ...state,
      // append to the end; server may return with proper displayOrder as well
      list: [...state.list, team],
    })),
    on(teamsActions.createFailure, (state, { error }) => ({
      ...state,
      error,
    })),

    // ----- UPDATE -----
    on(teamsActions.updateSuccess, (state, { team }) => ({
      ...state,
      list: state.list.map((t) => (t.id === team.id ? team : t)),
    })),
    on(teamsActions.updateFailure, (state, { error }) => ({
      ...state,
      error,
    })),

    // ----- DELETE -----
    on(teamsActions.deleteSuccess, (state, { id }) => ({
      ...state,
      list: state.list.filter((t) => t.id !== id),
    })),
    on(teamsActions.deleteFailure, (state, { error }) => ({
      ...state,
      error,
    })),

    // ----- REORDER -----
    // The server returns the newly ordered list; we replace our list with it.
    on(teamsActions.reorder, (state) => ({
      ...state,
      isLoading: true,
      error: null,
    })),
    on(teamsActions.reorderSuccess, (state, { teams }) => ({
      ...state,
      isLoading: false,
      list: teams,
    })),
    on(teamsActions.reorderFailure, (state, { error }) => ({
      ...state,
      isLoading: false,
      error,
    }))
  ),
});

// Export feature key, reducer (for provideState), and selectors for components
export const {
  name: teamsFeatureKey,
  reducer: teamsReducer,
  selectIsLoading,
  selectError,
  selectList: selectTeams, // selector to get the array for components
} = feature;
