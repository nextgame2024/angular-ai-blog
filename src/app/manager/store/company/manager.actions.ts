import { createActionGroup, emptyProps, props } from '@ngrx/store';
import type { BmCompany, PagedResult } from '../../types/company.interface';

export const ManagerCompanyActions = createActionGroup({
  source: 'Manager Company',
  events: {
    'Set Company Search Query': props<{ query: string }>(),

    'Load Companies': props<{ page: number }>(),
    'Load Companies Success': props<{ result: PagedResult<BmCompany> }>(),
    'Load Companies Failure': props<{ error: string }>(),

    'Open Company Create': emptyProps(),
    'Open Company Edit': props<{ companyId: string }>(),
    'Close Company Form': emptyProps(),

    'Save Company': props<{ payload: any }>(),
    'Save Company Success': props<{ company: BmCompany }>(),
    'Save Company Failure': props<{ error: string }>(),

    'Archive Company': props<{ companyId: string }>(),
    'Archive Company Success': props<{ companyId: string }>(),
    'Archive Company Failure': props<{ error: string }>(),
  },
});
