import { createReducer, on } from '@ngrx/store';
import { TownPlannerV2Actions } from './townplanner_v2.actions';
import {
  initialTownPlannerV2State,
  TownPlannerV2State,
} from './townplanner_v2.state';

export const TOWNPLANNER_V2_FEATURE_KEY = 'townplannerV2';

export const townPlannerV2Reducer = createReducer<TownPlannerV2State>(
  initialTownPlannerV2State,

  on(TownPlannerV2Actions.setAddressQuery, (state, { query }) => ({
    ...state,
    addressQuery: query,
  })),

  on(TownPlannerV2Actions.lookupProperty, (state) => ({
    ...state,
    status: 'loading',
    error: null,
    selected: null,
  })),

  on(TownPlannerV2Actions.lookupPropertySuccess, (state, { result }) => ({
    ...state,
    status: 'success',
    selected: result,
    error: null,
  })),

  on(TownPlannerV2Actions.lookupPropertyFailure, (state, { error }) => ({
    ...state,
    status: 'error',
    error,
  })),

  on(TownPlannerV2Actions.clear, () => ({
    ...initialTownPlannerV2State,
  }))
);
