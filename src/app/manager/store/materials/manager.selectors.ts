import { createFeatureSelector, createSelector } from '@ngrx/store';
import { MANAGER_MATERIALS_FEATURE_KEY } from './manager.reducer';
import { ManagerMaterialsState } from './manager.state';
import type { BmMaterial } from '../../types/materials.interface';

export const selectManagerMaterialsState =
  createFeatureSelector<ManagerMaterialsState>(MANAGER_MATERIALS_FEATURE_KEY);

export const selectManagerMaterialsSearchQuery = createSelector(
  selectManagerMaterialsState,
  (s) => s.materialsSearchQuery,
);

export const selectManagerMaterials = createSelector(
  selectManagerMaterialsState,
  (s) => s.materials,
);
export const selectManagerMaterialsLoading = createSelector(
  selectManagerMaterialsState,
  (s) => s.materialsLoading,
);
export const selectManagerMaterialsError = createSelector(
  selectManagerMaterialsState,
  (s) => s.materialsError,
);
export const selectManagerMaterialsTotal = createSelector(
  selectManagerMaterialsState,
  (s) => s.materialsTotal,
);
export const selectManagerMaterialsPage = createSelector(
  selectManagerMaterialsState,
  (s) => s.materialsPage,
);
export const selectManagerMaterialsLimit = createSelector(
  selectManagerMaterialsState,
  (s) => s.materialsLimit,
);
export const selectManagerMaterialsViewMode = createSelector(
  selectManagerMaterialsState,
  (s) => s.materialsViewMode,
);

export const selectManagerEditingMaterial = createSelector(
  selectManagerMaterialsState,
  (s) => {
    if (!s.editingMaterialId) return null;
    return (
      s.materials.find(
        (m: BmMaterial) => m.materialId === s.editingMaterialId,
      ) ?? null
    );
  },
);
