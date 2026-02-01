import type { BmPricingProfile } from '../../types/pricing.interface';

export type PricingViewMode = 'list' | 'form';

export interface ManagerPricingState {
  pricingSearchQuery: string;

  pricingProfiles: BmPricingProfile[];
  pricingLoading: boolean;
  pricingError: string | null;
  pricingPage: number;
  pricingLimit: number;
  pricingTotal: number;
  pricingViewMode: PricingViewMode;
  editingPricingProfileId: string | null;
}

export const initialManagerPricingState: ManagerPricingState = {
  pricingSearchQuery: '',

  pricingProfiles: [],
  pricingLoading: false,
  pricingError: null,
  pricingPage: 1,
  pricingLimit: 20,
  pricingTotal: 0,
  pricingViewMode: 'list',
  editingPricingProfileId: null,
};
