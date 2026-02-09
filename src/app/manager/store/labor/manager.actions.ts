import { createActionGroup, emptyProps, props } from '@ngrx/store';
import type { BmLabor, PagedResult } from '../../types/labor.interface';

export const ManagerLaborActions = createActionGroup({
  source: 'Manager Labor',
  events: {
    'Set Labor Search Query': props<{ query: string }>(),

    'Load Labor': props<{ page: number }>(),
    'Load Labor Success': props<{ result: PagedResult<BmLabor> }>(),
    'Load Labor Failure': props<{ error: string }>(),

    'Open Labor Create': emptyProps(),
    'Open Labor Edit': props<{ laborId: string }>(),
    'Close Labor Form': emptyProps(),

    'Save Labor': props<{ payload: any }>(),
    'Save Labor Success': props<{ labor: BmLabor }>(),
    'Save Labor Failure': props<{ error: string }>(),

    'Remove Labor': props<{ laborId: string }>(),
    'Remove Labor Success': props<{
      laborId: string;
      action: 'archived' | 'deleted';
    }>(),
    'Remove Labor Failure': props<{ error: string }>(),
  },
});
