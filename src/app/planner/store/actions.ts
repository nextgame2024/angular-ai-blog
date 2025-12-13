import { createAction, props } from '@ngrx/store';
import {
  SiteDetails,
  ProposalDetails,
  PreAssessmentResult,
} from '../types/preAssessmentState.interface';

export const createPreAssessmentAction = createAction(
  '[Planner] Create pre-assessment',
  props<{ site: SiteDetails; proposal: ProposalDetails }>()
);

export const createPreAssessmentSuccessAction = createAction(
  '[Planner] Create pre-assessment success',
  props<{ result: PreAssessmentResult }>()
);

export const createPreAssessmentFailureAction = createAction(
  '[Planner] Create pre-assessment failure',
  props<{ error: string }>()
);
