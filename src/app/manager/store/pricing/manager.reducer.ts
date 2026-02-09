import { createReducer, on } from '@ngrx/store';
import { ManagerPricingActions } from './manager.actions';
import { initialManagerPricingState } from './manager.state';
import type { BmPricingProfile } from '../../types/pricing.interface';

export const MANAGER_PRICING_FEATURE_KEY = 'managerPricing';

export const managerPricingReducer = createReducer(
  initialManagerPricingState,

  on(ManagerPricingActions.setPricingSearchQuery, (state, { query }) => ({
    ...state,
    pricingSearchQuery: query,
  })),

  on(ManagerPricingActions.loadPricingProfiles, (state, { page }) => ({
    ...state,
    pricingLoading: true,
    pricingError: null,
    pricingPage: page,
  })),

  on(ManagerPricingActions.loadPricingProfilesSuccess, (state, { result }) => ({
    ...state,
    pricingLoading: false,
    pricingProfiles:
      result.page > 1
        ? [
            ...state.pricingProfiles,
            ...(result.items ?? []).filter(
              (p) =>
                !state.pricingProfiles.some(
                  (existing) => existing.pricingProfileId === p.pricingProfileId,
                ),
            ),
          ]
        : (result.items ?? []),
    pricingPage: result.page,
    pricingLimit: result.limit,
    pricingTotal: result.total,
  })),

  on(ManagerPricingActions.loadPricingProfilesFailure, (state, { error }) => ({
    ...state,
    pricingLoading: false,
    pricingError: error,
  })),

  on(ManagerPricingActions.openPricingCreate, (state) => ({
    ...state,
    pricingViewMode: 'form' as const,
    editingPricingProfileId: null,
    pricingError: null,
  })),

  on(ManagerPricingActions.openPricingEdit, (state, { pricingProfileId }) => ({
    ...state,
    pricingViewMode: 'form' as const,
    editingPricingProfileId: pricingProfileId,
    pricingError: null,
  })),

  on(ManagerPricingActions.closePricingForm, (state) => ({
    ...state,
    pricingViewMode: 'list' as const,
    editingPricingProfileId: null,
  })),

  on(ManagerPricingActions.savePricingProfile, (state) => ({
    ...state,
    pricingLoading: true,
    pricingError: null,
  })),

  on(ManagerPricingActions.savePricingProfileSuccess, (state, { pricingProfile }) => {
    const idx = state.pricingProfiles.findIndex(
      (p) => p.pricingProfileId === pricingProfile.pricingProfileId,
    );
    const next = [...state.pricingProfiles];

    if (idx >= 0) next[idx] = pricingProfile;
    else next.unshift(pricingProfile);

    return {
      ...state,
      pricingLoading: false,
      pricingProfiles: next,
      pricingViewMode: 'list' as const,
      editingPricingProfileId: null,
    };
  }),

  on(ManagerPricingActions.savePricingProfileFailure, (state, { error }) => ({
    ...state,
    pricingLoading: false,
    pricingError: error,
  })),

  on(ManagerPricingActions.removePricingProfile, (state) => ({
    ...state,
    pricingLoading: true,
    pricingError: null,
  })),

  on(
    ManagerPricingActions.removePricingProfileSuccess,
    (state, { pricingProfileId, action }) => {
      const isDeleted = action === 'deleted';
      const pricingProfiles = isDeleted
        ? state.pricingProfiles.filter(
            (p) => p.pricingProfileId !== pricingProfileId,
          )
        : state.pricingProfiles.map((p: BmPricingProfile) =>
            p.pricingProfileId === pricingProfileId
              ? { ...p, status: 'archived' }
              : p,
          );
      return {
        ...state,
        pricingLoading: false,
        pricingProfiles,
        pricingTotal: isDeleted ? Math.max(state.pricingTotal - 1, 0) : state.pricingTotal,
      };
    },
  ),

  on(ManagerPricingActions.removePricingProfileFailure, (state, { error }) => ({
    ...state,
    pricingLoading: false,
    pricingError: error,
  })),
);
