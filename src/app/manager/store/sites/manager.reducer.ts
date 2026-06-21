import { createReducer, on } from '@ngrx/store';
import { ManagerSitesActions } from './manager.actions';
import { initialManagerSitesState } from './manager.state';
import type { BmSite } from '../../types/sites.interface';

export const MANAGER_SITES_FEATURE_KEY = 'managerSites';

function sortSites(items: BmSite[]): BmSite[] {
  return [...items].sort((a, b) => {
    const archivedDelta =
      Number((a.status ?? 'active') === 'archived') -
      Number((b.status ?? 'active') === 'archived');
    if (archivedDelta) return archivedDelta;
    return (a.siteName ?? '').localeCompare(b.siteName ?? '');
  });
}

export const managerSitesReducer = createReducer(
  initialManagerSitesState,
  on(ManagerSitesActions.setSitesSearchQuery, (state, { query }) => ({
    ...state,
    sitesSearchQuery: query,
  })),
  on(ManagerSitesActions.loadSites, (state, { page }) => ({
    ...state,
    sitesLoading: true,
    sitesError: null,
    sitesPage: page,
  })),
  on(ManagerSitesActions.loadSitesSuccess, (state, { result }) => ({
    ...state,
    sitesLoading: false,
    sites: sortSites(
      result.page > 1
        ? [
            ...state.sites,
            ...(result.items ?? []).filter(
              (site) =>
                !state.sites.some((existing) => existing.siteId === site.siteId),
            ),
          ]
        : (result.items ?? []),
    ),
    sitesPage: result.page,
    sitesLimit: result.limit,
    sitesTotal: result.total,
  })),
  on(ManagerSitesActions.loadSitesFailure, (state, { error }) => ({
    ...state,
    sitesLoading: false,
    sitesError: error,
  })),
  on(ManagerSitesActions.openSiteCreate, (state) => ({
    ...state,
    sitesViewMode: 'form' as const,
    editingSiteId: null,
    sitesError: null,
  })),
  on(ManagerSitesActions.openSiteEdit, (state, { siteId }) => ({
    ...state,
    sitesViewMode: 'form' as const,
    editingSiteId: siteId,
    sitesError: null,
  })),
  on(ManagerSitesActions.closeSiteForm, (state) => ({
    ...state,
    sitesViewMode: 'list' as const,
    editingSiteId: null,
    sitesError: null,
  })),
  on(ManagerSitesActions.saveSite, (state) => ({
    ...state,
    sitesLoading: true,
    sitesError: null,
  })),
  on(ManagerSitesActions.saveSiteSuccess, (state, { site }) => {
    const idx = state.sites.findIndex((s) => s.siteId === site.siteId);
    const next = [...state.sites];
    if (idx >= 0) next[idx] = { ...next[idx], ...site };
    else next.unshift(site);
    return {
      ...state,
      sitesLoading: false,
      sites: sortSites(next),
      sitesViewMode: 'list' as const,
      editingSiteId: null,
    };
  }),
  on(ManagerSitesActions.saveSiteFailure, (state, { error }) => ({
    ...state,
    sitesLoading: false,
    sitesError: error,
  })),
  on(ManagerSitesActions.removeSite, (state) => ({
    ...state,
    sitesLoading: true,
    sitesError: null,
  })),
  on(ManagerSitesActions.removeSiteSuccess, (state, { siteId }) => ({
    ...state,
    sitesLoading: false,
    sites: sortSites(
      state.sites.map((site) =>
        site.siteId === siteId ? { ...site, status: 'archived' } : site,
      ),
    ),
  })),
  on(ManagerSitesActions.removeSiteFailure, (state, { error }) => ({
    ...state,
    sitesLoading: false,
    sitesError: error,
  })),
);
