import { createFeatureSelector, createSelector } from '@ngrx/store';
import { MANAGER_PRICING_FEATURE_KEY } from './manager.reducer';
import { ManagerPricingState } from './manager.state';
import type { BmPricingProfile } from '../../types/pricing.interface';

export const selectManagerPricingState =
  createFeatureSelector<ManagerPricingState>(MANAGER_PRICING_FEATURE_KEY);

export const selectManagerPricingSearchQuery = createSelector(
  selectManagerPricingState,
  (s) => s.pricingSearchQuery,
);

export const selectManagerPricingProfiles = createSelector(
  selectManagerPricingState,
  (s) => s.pricingProfiles,
);
export const selectManagerPricingLoading = createSelector(
  selectManagerPricingState,
  (s) => s.pricingLoading,
);
export const selectManagerPricingError = createSelector(
  selectManagerPricingState,
  (s) => s.pricingError,
);
export const selectManagerPricingTotal = createSelector(
  selectManagerPricingState,
  (s) => s.pricingTotal,
);
export const selectManagerPricingPage = createSelector(
  selectManagerPricingState,
  (s) => s.pricingPage,
);
export const selectManagerPricingLimit = createSelector(
  selectManagerPricingState,
  (s) => s.pricingLimit,
);
export const selectManagerPricingViewMode = createSelector(
  selectManagerPricingState,
  (s) => s.pricingViewMode,
);

export const selectManagerEditingPricingProfile = createSelector(
  selectManagerPricingState,
  (s) => {
    if (!s.editingPricingProfileId) return null;
    return (
      s.pricingProfiles.find(
        (p: BmPricingProfile) =>
          p.pricingProfileId === s.editingPricingProfileId,
      ) ?? null
    );
  },
);
