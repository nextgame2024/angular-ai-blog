import { createFeatureSelector, createSelector } from '@ngrx/store';
import { MANAGER_LABOR_FEATURE_KEY } from './manager.reducer';
import { ManagerLaborState } from './manager.state';
import type { BmLabor } from '../../types/labor.interface';

export const selectManagerLaborState =
  createFeatureSelector<ManagerLaborState>(MANAGER_LABOR_FEATURE_KEY);

export const selectManagerLaborSearchQuery = createSelector(
  selectManagerLaborState,
  (s) => s.laborSearchQuery,
);

export const selectManagerLabor = createSelector(
  selectManagerLaborState,
  (s) => s.labor,
);
export const selectManagerLaborLoading = createSelector(
  selectManagerLaborState,
  (s) => s.laborLoading,
);
export const selectManagerLaborError = createSelector(
  selectManagerLaborState,
  (s) => s.laborError,
);
export const selectManagerLaborTotal = createSelector(
  selectManagerLaborState,
  (s) => s.laborTotal,
);
export const selectManagerLaborPage = createSelector(
  selectManagerLaborState,
  (s) => s.laborPage,
);
export const selectManagerLaborLimit = createSelector(
  selectManagerLaborState,
  (s) => s.laborLimit,
);
export const selectManagerLaborViewMode = createSelector(
  selectManagerLaborState,
  (s) => s.laborViewMode,
);

export const selectManagerEditingLabor = createSelector(
  selectManagerLaborState,
  (s) => {
    if (!s.editingLaborId) return null;
    return (
      s.labor.find((l: BmLabor) => l.laborId === s.editingLaborId) ?? null
    );
  },
);
