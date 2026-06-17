import { createActionGroup, emptyProps, props } from '@ngrx/store';

import type { ExploreVideosResult } from '../../types/explore.interface';

export const ManagerExploreActions = createActionGroup({
  source: 'Manager Explore',
  events: {
    'Set Explore Search Query': props<{ query: string }>(),
    'Load Explore Videos': props<{ page: number }>(),
    'Load Explore Videos Success': props<{ result: ExploreVideosResult }>(),
    'Load Explore Videos Failure': props<{ error: string }>(),
    'Reset Explore State': emptyProps(),
  },
});
