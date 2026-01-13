import { createReducer, on } from '@ngrx/store';
import { TownPlannerV2Actions } from './townplanner_v2.actions';
import {
  initialTownPlannerV2State,
  TownPlannerV2State,
} from './townplanner_v2.state';

export const TOWNPLANNER_V2_FEATURE_KEY = 'townplannerV2';

export const townPlannerV2Reducer = createReducer<TownPlannerV2State>(
  initialTownPlannerV2State,

  on(
    TownPlannerV2Actions.setAddressQuery,
    (state, { query, sessionToken }) => ({
      ...state,
      addressQuery: query,
      sessionToken: sessionToken ?? state.sessionToken,
    })
  ),

  on(TownPlannerV2Actions.suggestAddresses, (state) => ({
    ...state,
    suggestionsStatus: 'loading',
  })),

  on(
    TownPlannerV2Actions.suggestAddressesSuccess,
    (state, { suggestions }) => ({
      ...state,
      suggestionsStatus: 'success',
      suggestions,
    })
  ),

  on(TownPlannerV2Actions.suggestAddressesFailure, (state, { error }) => ({
    ...state,
    suggestionsStatus: 'error',
    error,
    suggestions: [],
  })),

  on(TownPlannerV2Actions.clearSuggestions, (state) => ({
    ...state,
    suggestionsStatus: 'idle',
    suggestions: [],
  })),

  on(
    TownPlannerV2Actions.selectSuggestion,
    (state, { suggestion, sessionToken }) => ({
      ...state,
      addressQuery: suggestion.description,
      sessionToken: sessionToken ?? state.sessionToken,
      suggestions: [],
      suggestionsStatus: 'idle',
      status: 'loading',
      error: null,
    })
  ),

  on(TownPlannerV2Actions.loadPlaceDetails, (state) => ({
    ...state,
    status: 'loading',
    error: null,
  })),

  on(TownPlannerV2Actions.loadPlaceDetailsSuccess, (state, { result }) => ({
    ...state,
    status: 'success',
    selected: result,
    error: null,
  })),

  on(TownPlannerV2Actions.loadPlaceDetailsFailure, (state, { error }) => ({
    ...state,
    status: 'error',
    error,
  })),

  on(TownPlannerV2Actions.clear, () => ({
    ...initialTownPlannerV2State,
  }))
);
