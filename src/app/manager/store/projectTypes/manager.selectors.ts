import { createFeatureSelector, createSelector } from '@ngrx/store';
import { MANAGER_PROJECT_TYPES_FEATURE_KEY } from './manager.reducer';
import { ManagerProjectTypesState } from './manager.state';
import type {
  BmProjectType,
  BmProjectTypeLabor,
  BmProjectTypeMaterial,
} from '../../types/project.types.interface';

export const selectManagerProjectTypesState =
  createFeatureSelector<ManagerProjectTypesState>(
    MANAGER_PROJECT_TYPES_FEATURE_KEY,
  );

export const selectManagerProjectTypesSearchQuery = createSelector(
  selectManagerProjectTypesState,
  (s) => s.projectTypesSearchQuery,
);

export const selectManagerProjectTypes = createSelector(
  selectManagerProjectTypesState,
  (s) => s.projectTypes,
);
export const selectManagerProjectTypesLoading = createSelector(
  selectManagerProjectTypesState,
  (s) => s.projectTypesLoading,
);
export const selectManagerProjectTypesError = createSelector(
  selectManagerProjectTypesState,
  (s) => s.projectTypesError,
);
export const selectManagerProjectTypesTotal = createSelector(
  selectManagerProjectTypesState,
  (s) => s.projectTypesTotal,
);
export const selectManagerProjectTypesPage = createSelector(
  selectManagerProjectTypesState,
  (s) => s.projectTypesPage,
);
export const selectManagerProjectTypesLimit = createSelector(
  selectManagerProjectTypesState,
  (s) => s.projectTypesLimit,
);
export const selectManagerProjectTypesViewMode = createSelector(
  selectManagerProjectTypesState,
  (s) => s.projectTypesViewMode,
);
export const selectManagerProjectTypeFormTab = createSelector(
  selectManagerProjectTypesState,
  (s) => s.projectTypeFormTab,
);

export const selectManagerEditingProjectType = createSelector(
  selectManagerProjectTypesState,
  (s) => {
    if (!s.editingProjectTypeId) return null;
    return (
      s.projectTypes.find(
        (pt: BmProjectType) => pt.projectTypeId === s.editingProjectTypeId,
      ) ?? null
    );
  },
);

export const selectManagerProjectTypeMaterials = createSelector(
  selectManagerProjectTypesState,
  (s) => s.materials,
);
export const selectManagerProjectTypeMaterialsLoading = createSelector(
  selectManagerProjectTypesState,
  (s) => s.materialsLoading,
);
export const selectManagerProjectTypeMaterialsError = createSelector(
  selectManagerProjectTypesState,
  (s) => s.materialsError,
);
export const selectManagerProjectTypeMaterialsViewMode = createSelector(
  selectManagerProjectTypesState,
  (s) => s.materialsViewMode,
);
export const selectManagerEditingProjectTypeMaterial = createSelector(
  selectManagerProjectTypesState,
  (s) => {
    if (!s.editingMaterialId) return null;
    return (
      s.materials.find(
        (m: BmProjectTypeMaterial) => m.materialId === s.editingMaterialId,
      ) ?? null
    );
  },
);

export const selectManagerProjectTypeLabor = createSelector(
  selectManagerProjectTypesState,
  (s) => s.labor,
);
export const selectManagerProjectTypeLaborLoading = createSelector(
  selectManagerProjectTypesState,
  (s) => s.laborLoading,
);
export const selectManagerProjectTypeLaborError = createSelector(
  selectManagerProjectTypesState,
  (s) => s.laborError,
);
export const selectManagerProjectTypeLaborViewMode = createSelector(
  selectManagerProjectTypesState,
  (s) => s.laborViewMode,
);
export const selectManagerEditingProjectTypeLabor = createSelector(
  selectManagerProjectTypesState,
  (s) => {
    if (!s.editingLaborId) return null;
    return (
      s.labor.find(
        (l: BmProjectTypeLabor) => l.laborId === s.editingLaborId,
      ) ?? null
    );
  },
);
