import { createReducer, on } from '@ngrx/store';
import { ManagerLaborActions } from './manager.actions';
import { initialManagerLaborState } from './manager.state';
import type { BmLabor } from '../../types/labor.interface';

export const MANAGER_LABOR_FEATURE_KEY = 'managerLabor';

export const managerLaborReducer = createReducer(
  initialManagerLaborState,

  on(ManagerLaborActions.setLaborSearchQuery, (state, { query }) => ({
    ...state,
    laborSearchQuery: query,
  })),

  on(ManagerLaborActions.loadLabor, (state, { page }) => ({
    ...state,
    laborLoading: true,
    laborError: null,
    laborPage: page,
  })),

  on(ManagerLaborActions.loadLaborSuccess, (state, { result }) => ({
    ...state,
    laborLoading: false,
    labor:
      result.page > 1
        ? [
            ...state.labor,
            ...(result.items ?? []).filter(
              (l) => !state.labor.some((existing) => existing.laborId === l.laborId),
            ),
          ]
        : (result.items ?? []),
    laborPage: result.page,
    laborLimit: result.limit,
    laborTotal: result.total,
  })),

  on(ManagerLaborActions.loadLaborFailure, (state, { error }) => ({
    ...state,
    laborLoading: false,
    laborError: error,
  })),

  on(ManagerLaborActions.openLaborCreate, (state) => ({
    ...state,
    laborViewMode: 'form' as const,
    editingLaborId: null,
    laborError: null,
  })),

  on(ManagerLaborActions.openLaborEdit, (state, { laborId }) => ({
    ...state,
    laborViewMode: 'form' as const,
    editingLaborId: laborId,
    laborError: null,
  })),

  on(ManagerLaborActions.closeLaborForm, (state) => ({
    ...state,
    laborViewMode: 'list' as const,
    editingLaborId: null,
  })),

  on(ManagerLaborActions.saveLabor, (state) => ({
    ...state,
    laborLoading: true,
    laborError: null,
  })),

  on(ManagerLaborActions.saveLaborSuccess, (state, { labor }) => {
    const idx = state.labor.findIndex((l) => l.laborId === labor.laborId);
    const next = [...state.labor];

    if (idx >= 0) next[idx] = labor;
    else next.unshift(labor);

    return {
      ...state,
      laborLoading: false,
      labor: next,
      laborViewMode: 'list' as const,
      editingLaborId: null,
    };
  }),

  on(ManagerLaborActions.saveLaborFailure, (state, { error }) => ({
    ...state,
    laborLoading: false,
    laborError: error,
  })),

  on(ManagerLaborActions.removeLabor, (state) => ({
    ...state,
    laborLoading: true,
    laborError: null,
  })),

  on(ManagerLaborActions.removeLaborSuccess, (state, { laborId, action }) => ({
    ...state,
    laborLoading: false,
    labor:
      action === 'deleted'
        ? state.labor.filter((l) => l.laborId !== laborId)
        : state.labor.map((l: BmLabor) =>
            l.laborId === laborId ? { ...l, status: 'archived' } : l,
          ),
    laborTotal:
      action === 'deleted' ? Math.max(0, state.laborTotal - 1) : state.laborTotal,
  })),

  on(ManagerLaborActions.removeLaborFailure, (state, { error }) => ({
    ...state,
    laborLoading: false,
    laborError: error,
  })),
);
