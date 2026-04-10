import { createReducer, on } from '@ngrx/store';
import { ManagerPricingActions } from './manager.actions';
import { initialManagerPricingState } from './manager.state';
import type { BmPricingProfile } from '../../types/pricing.interface';

export const MANAGER_PRICING_FEATURE_KEY = 'managerPricing';

function isArchived(profile: BmPricingProfile): boolean {
  return (profile.status ?? 'active') === 'archived';
}

function sortPricingProfiles(items: BmPricingProfile[]): BmPricingProfile[] {
  return [...items].sort((a, b) => {
    if (isArchived(a) !== isArchived(b)) return isArchived(a) ? 1 : -1;

    const nameA = (a.profileName ?? '').trim().toLowerCase();
    const nameB = (b.profileName ?? '').trim().toLowerCase();
    if (nameA !== nameB) return nameA.localeCompare(nameB);

    const createdA = Date.parse(a.createdAt ?? '');
    const createdB = Date.parse(b.createdAt ?? '');
    if (Number.isFinite(createdA) && Number.isFinite(createdB)) {
      return createdB - createdA;
    }
    return 0;
  });
}

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
    if (idx >= 0) {
      const previous = next[idx];
      next[idx] = {
        ...previous,
        ...pricingProfile,
        hasProjects: pricingProfile.hasProjects ?? previous.hasProjects ?? false,
      };
    } else {
      next.push({
        ...pricingProfile,
        hasProjects: pricingProfile.hasProjects ?? false,
      });
    }

    return {
      ...state,
      pricingLoading: false,
      pricingProfiles: sortPricingProfiles(next),
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
        pricingProfiles: sortPricingProfiles(pricingProfiles),
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
