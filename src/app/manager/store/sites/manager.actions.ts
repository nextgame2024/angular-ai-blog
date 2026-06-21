import { createActionGroup, emptyProps, props } from '@ngrx/store';
import type { BmSite, PagedResult } from '../../types/sites.interface';

export const ManagerSitesActions = createActionGroup({
  source: 'Manager Sites',
  events: {
    'Set Sites Search Query': props<{ query: string }>(),
    'Load Sites': props<{ page: number }>(),
    'Load Sites Success': props<{ result: PagedResult<BmSite> }>(),
    'Load Sites Failure': props<{ error: string }>(),
    'Open Site Create': emptyProps(),
    'Open Site Edit': props<{ siteId: string }>(),
    'Close Site Form': emptyProps(),
    'Save Site': props<{ payload: any }>(),
    'Save Site Success': props<{ site: BmSite }>(),
    'Save Site Failure': props<{ error: string }>(),
    'Remove Site': props<{ siteId: string }>(),
    'Remove Site Success': props<{ siteId: string }>(),
    'Remove Site Failure': props<{ error: string }>(),
  },
});
