import { createActionGroup, emptyProps, props } from '@ngrx/store';
import type { BmPricingProfile, PagedResult } from '../../types/pricing.interface';

export const ManagerPricingActions = createActionGroup({
  source: 'Manager Pricing',
  events: {
    'Set Pricing Search Query': props<{ query: string }>(),

    'Load Pricing Profiles': props<{ page: number }>(),
    'Load Pricing Profiles Success': props<{ result: PagedResult<BmPricingProfile> }>(),
    'Load Pricing Profiles Failure': props<{ error: string }>(),

    'Open Pricing Create': emptyProps(),
    'Open Pricing Edit': props<{ pricingProfileId: string }>(),
    'Close Pricing Form': emptyProps(),

    'Save Pricing Profile': props<{ payload: any }>(),
    'Save Pricing Profile Success': props<{ pricingProfile: BmPricingProfile }>(),
    'Save Pricing Profile Failure': props<{ error: string }>(),

    'Remove Pricing Profile': props<{ pricingProfileId: string }>(),
    'Remove Pricing Profile Success': props<{
      pricingProfileId: string;
      action: 'archived' | 'deleted';
    }>(),
    'Remove Pricing Profile Failure': props<{ error: string }>(),
  },
});
