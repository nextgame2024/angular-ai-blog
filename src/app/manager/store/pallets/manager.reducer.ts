import { createReducer, on } from '@ngrx/store';
import { ManagerPalletsActions } from './manager.actions';
import { initialManagerPalletsState } from './manager.state';

export const MANAGER_PALLETS_FEATURE_KEY = 'managerPallets';

export const managerPalletsReducer = createReducer(
  initialManagerPalletsState,
  on(ManagerPalletsActions.setActiveTab, (state, { tab }) => ({
    ...state,
    activeTab: tab,
  })),
  on(ManagerPalletsActions.setSearchQuery, (state, { query }) => ({
    ...state,
    searchQuery: query,
  })),
  on(
    ManagerPalletsActions.loadContext,
    ManagerPalletsActions.loadOnSite,
    ManagerPalletsActions.loadSent,
    ManagerPalletsActions.loadIncoming,
    ManagerPalletsActions.movePallets,
    ManagerPalletsActions.deleteMovement,
    ManagerPalletsActions.receiveMovement,
    (state) => ({ ...state, loading: true, error: null }),
  ),
  on(ManagerPalletsActions.loadContextSuccess, (state, { context }) => ({
    ...state,
    loading: false,
    context,
  })),
  on(ManagerPalletsActions.loadOnSiteSuccess, (state, { result }) => ({
    ...state,
    loading: false,
    onSite:
      result.page > 1
        ? [
            ...state.onSite,
            ...(result.items ?? []).filter(
              (site) => !state.onSite.some((existing) => existing.siteId === site.siteId),
            ),
          ]
        : (result.items ?? []),
    onSitePage: result.page,
    onSiteLimit: result.limit,
    onSiteTotal: result.total,
  })),
  on(ManagerPalletsActions.loadSentSuccess, (state, { result }) => ({
    ...state,
    loading: false,
    sent:
      result.page > 1
        ? [
            ...state.sent,
            ...(result.items ?? []).filter(
              (movement) =>
                !state.sent.some((existing) => existing.palletId === movement.palletId),
            ),
          ]
        : (result.items ?? []),
    sentPage: result.page,
    sentLimit: result.limit,
    sentTotal: result.total,
  })),
  on(ManagerPalletsActions.loadIncomingSuccess, (state, { result }) => ({
    ...state,
    loading: false,
    incoming:
      result.page > 1
        ? [
            ...state.incoming,
            ...(result.items ?? []).filter(
              (movement) =>
                !state.incoming.some(
                  (existing) => existing.palletId === movement.palletId,
                ),
            ),
          ]
        : (result.items ?? []),
    incomingPage: result.page,
    incomingLimit: result.limit,
    incomingTotal: result.total,
  })),
  on(ManagerPalletsActions.movePalletsSuccess, (state, { movement }) => ({
    ...state,
    loading: false,
    sent: [movement, ...state.sent],
    sentTotal: state.sentTotal + 1,
    context: {
      ...state.context,
      originSite: state.context.originSite
        ? {
            ...state.context.originSite,
            palletsOnsite:
              Number(state.context.originSite.palletsOnsite ?? 0) -
              Number(movement.pallets ?? 0),
          }
        : state.context.originSite,
    },
  })),
  on(ManagerPalletsActions.deleteMovementSuccess, (state, { palletId }) => ({
    ...state,
    loading: false,
    sent: state.sent.filter((movement) => movement.palletId !== palletId),
    sentTotal: Math.max(0, state.sentTotal - 1),
  })),
  on(ManagerPalletsActions.receiveMovementSuccess, (state, { palletId }) => ({
    ...state,
    loading: false,
    incoming: state.incoming.filter((movement) => movement.palletId !== palletId),
    incomingTotal: Math.max(0, state.incomingTotal - 1),
  })),
  on(
    ManagerPalletsActions.loadContextFailure,
    ManagerPalletsActions.loadOnSiteFailure,
    ManagerPalletsActions.loadSentFailure,
    ManagerPalletsActions.loadIncomingFailure,
    ManagerPalletsActions.movePalletsFailure,
    ManagerPalletsActions.deleteMovementFailure,
    ManagerPalletsActions.receiveMovementFailure,
    (state, { error }) => ({ ...state, loading: false, error }),
  ),
);
