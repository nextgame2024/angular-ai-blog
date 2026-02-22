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

      // reset report state when selecting a new property
      reportStatus: 'idle',
      reportRequested: false,
      reportToken: null,
      reportPdfUrl: null,
      reportError: null,
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

  // Background pre-generation reducers
  on(TownPlannerV2Actions.primeReportRunning, (state, { token }) => ({
    ...state,
    reportStatus: 'running',
    reportRequested: false,
    reportToken: token,
    reportError: null,
    reportPdfUrl: null,
  })),

  on(TownPlannerV2Actions.primeReportReady, (state, { token, pdfUrl }) => ({
    ...state,
    reportStatus: 'ready',
    reportRequested: false,
    reportToken: token,
    reportPdfUrl: pdfUrl,
    reportError: null,
  })),

  on(TownPlannerV2Actions.primeReportFailure, (state, { error }) => ({
    ...state,
    reportStatus: 'failed',
    reportRequested: false,
    reportError: error,
  })),

  // Report generation reducers
  on(TownPlannerV2Actions.generateReport, (state) => ({
    ...state,
    reportRequested: true,
    reportError: null,
  })),

  on(TownPlannerV2Actions.generateReportRunning, (state, { token }) => ({
    ...state,
    reportStatus: 'running',
    reportRequested: true,
    reportToken: token,
    reportError: null,
    reportPdfUrl: null,
  })),

  on(TownPlannerV2Actions.generateReportReady, (state, { token, pdfUrl }) => ({
    ...state,
    reportStatus: 'ready',
    reportRequested: true,
    reportToken: token,
    reportPdfUrl: pdfUrl,
    reportError: null,
  })),

  on(TownPlannerV2Actions.generateReportFailure, (state, { error }) => ({
    ...state,
    reportStatus: 'failed',
    reportRequested: true,
    reportError: error,
  })),

  on(TownPlannerV2Actions.clearReport, (state) => ({
    ...state,
    reportStatus: 'idle',
    reportRequested: false,
    reportToken: null,
    reportPdfUrl: null,
    reportError: null,
  })),

  on(TownPlannerV2Actions.clear, () => ({
    ...initialTownPlannerV2State,
  }))
);
