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

export const selectSuggestions = createSelector(
  selectTownPlannerV2State,
  (s) => s.suggestions
);

export const selectSuggestionsStatus = createSelector(
  selectTownPlannerV2State,
  (s) => s.suggestionsStatus
);

// Report selectors
export const selectReportStatus = createSelector(
  selectTownPlannerV2State,
  (s) => s.reportStatus
);

export const selectReportGenerating = createSelector(
  selectReportStatus,
  (st) => st === 'running'
);

export const selectReportError = createSelector(
  selectTownPlannerV2State,
  (s) => s.reportError
);

export const selectReportPdfUrl = createSelector(
  selectTownPlannerV2State,
  (s) => s.reportPdfUrl
);

// Blocking overlay should appear for BOTH:
// - loading place details
// - generating report
export const selectTownPlannerV2Loading = createSelector(
  selectTownPlannerV2State,
  (s) => s.status === 'loading' || s.reportStatus === 'running'
);
