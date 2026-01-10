// src/app/townplanner/store/townplanner_v2.selectors.ts

import { createFeatureSelector, createSelector } from '@ngrx/store';
import { TOWNPLANNER_V2_FEATURE_KEY } from './townplanner_v2.reducer';
import { TownPlannerV2State } from './townplanner_v2.state';

export const selectTownPlannerV2State =
  createFeatureSelector<TownPlannerV2State>(TOWNPLANNER_V2_FEATURE_KEY);

export const selectAddressQuery = createSelector(
  selectTownPlannerV2State,
  (s) => s.addressQuery
);

export const selectSelected = createSelector(
  selectTownPlannerV2State,
  (s) => s.selected
);

export const selectStatus = createSelector(
  selectTownPlannerV2State,
  (s) => s.status
);

export const selectError = createSelector(
  selectTownPlannerV2State,
  (s) => s.error
);

// Convenience aliases (so you can import either style)
export const selectTownPlannerV2AddressQuery = selectAddressQuery;
export const selectTownPlannerV2Result = selectSelected;
export const selectTownPlannerV2Error = selectError;

export const selectTownPlannerV2Loading = createSelector(
  selectStatus,
  (status) => status === 'loading'
);
