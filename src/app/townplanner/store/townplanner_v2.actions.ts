import { createActionGroup, emptyProps, props } from '@ngrx/store';
import {
  TownPlannerV2AddressSuggestion,
  TownPlannerV2Result,
} from './townplanner_v2.state';

export const TownPlannerV2Actions = createActionGroup({
  source: 'TownPlannerV2',
  events: {
    'Set Address Query': props<{
      query: string;
      sessionToken?: string | null;
    }>(),

    'Suggest Addresses': props<{
      input: string;
      sessionToken?: string | null;
    }>(),
    'Suggest Addresses Success': props<{
      suggestions: TownPlannerV2AddressSuggestion[];
    }>(),
    'Suggest Addresses Failure': props<{ error: string }>(),
    'Clear Suggestions': emptyProps(),

    'Select Suggestion': props<{
      suggestion: TownPlannerV2AddressSuggestion;
      sessionToken?: string | null;
    }>(),

    'Load Place Details': props<{
      placeId: string;
      addressLabel?: string;
      sessionToken?: string | null;
    }>(),
    'Load Place Details Success': props<{ result: TownPlannerV2Result }>(),
    'Load Place Details Failure': props<{ error: string }>(),

    // Report generation
    'Generate Report': emptyProps(),
    'Generate Report Running': props<{ token: string }>(),
    'Generate Report Ready': props<{ token: string; pdfUrl: string }>(),
    'Generate Report Failure': props<{ error: string }>(),
    'Clear Report': emptyProps(),

    Clear: emptyProps(),
  },
});
