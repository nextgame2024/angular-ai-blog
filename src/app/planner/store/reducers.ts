import { createReducer, on } from '@ngrx/store';
import { PlannerState } from '../types/preAssessmentState.interface';
import * as PlannerActions from './actions';

export const plannerFeatureKey = 'planner';

export const initialState: PlannerState = {
  loading: false,
  error: null,
  result: null,
};

export const plannerReducer = createReducer(
  initialState,

  on(
    PlannerActions.createPreAssessmentAction,
    (state): PlannerState => ({
      ...state,
      loading: true,
      error: null,
    })
  ),

  on(
    PlannerActions.createPreAssessmentSuccessAction,
    (state, { result }): PlannerState => ({
      ...state,
      loading: false,
      result,
      error: null,
    })
  ),

  on(
    PlannerActions.createPreAssessmentFailureAction,
    (state, { error }): PlannerState => ({
      ...state,
      loading: false,
      error,
    })
  )
);
