import { createActionGroup, emptyProps, props } from '@ngrx/store';
import type { BmMaterial, PagedResult } from '../../types/materials.interface';

export const ManagerMaterialsActions = createActionGroup({
  source: 'Manager Materials',
  events: {
    'Set Materials Search Query': props<{ query: string }>(),

    'Load Materials': props<{ page: number }>(),
    'Load Materials Success': props<{ result: PagedResult<BmMaterial> }>(),
    'Load Materials Failure': props<{ error: string }>(),

    'Open Material Create': emptyProps(),
    'Open Material Edit': props<{ materialId: string }>(),
    'Close Material Form': emptyProps(),

    'Save Material': props<{ payload: any }>(),
    'Save Material Success': props<{ material: BmMaterial }>(),
    'Save Material Failure': props<{ error: string }>(),

    'Remove Material': props<{ materialId: string }>(),
    'Remove Material Success': props<{
      materialId: string;
      action: 'archived' | 'deleted';
    }>(),
    'Remove Material Failure': props<{ error: string }>(),
  },
});
