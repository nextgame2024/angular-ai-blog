import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { TownPlannerV2Result } from './townplanner_v2.state';

export const TownPlannerV2Actions = createActionGroup({
  source: 'TownPlannerV2',
  events: {
    'Set Address Query': props<{ query: string }>(),

    'Lookup Property': props<{ address: string }>(),
    'Lookup Property Success': props<{ result: TownPlannerV2Result }>(),
    'Lookup Property Failure': props<{ error: string }>(),

    Clear: emptyProps(),
  },
});
