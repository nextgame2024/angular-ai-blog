// src/app/townplanner/store/townplanner_v2.reducer.ts

import { createReducer, on } from '@ngrx/store';
import { TownPlannerV2Actions } from './townplanner_v2.actions';
import {
  initialTownPlannerV2State,
  TownPlannerV2State,
  TownPlannerV2Status,
} from './townplanner_v2.state';

export const TOWNPLANNER_V2_FEATURE_KEY = 'townplannerV2';

export const townPlannerV2Reducer = createReducer<TownPlannerV2State>(
  initialTownPlannerV2State,

  on(TownPlannerV2Actions.setAddressQuery, (state, { query }) => ({
    ...state,
    addressQuery: query ?? '',
  })),

  on(TownPlannerV2Actions.lookupProperty, (state) => ({
    ...state,
    status: 'loading' as TownPlannerV2Status,
    error: null,
  })),

  on(TownPlannerV2Actions.lookupPropertySuccess, (state, { result }) => ({
    ...state,
    status: 'success' as TownPlannerV2Status,
    selected: result,
    error: null,
  })),

  on(TownPlannerV2Actions.lookupPropertyFailure, (state, { error }) => ({
    ...state,
    status: 'error' as TownPlannerV2Status,
    error: error || 'Unable to lookup property',
  })),

  on(TownPlannerV2Actions.clear, () => initialTownPlannerV2State)
);
