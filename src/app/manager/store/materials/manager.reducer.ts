import { createReducer, on } from '@ngrx/store';
import { ManagerMaterialsActions } from './manager.actions';
import { initialManagerMaterialsState } from './manager.state';
import type { BmMaterial } from '../../types/materials.interface';

export const MANAGER_MATERIALS_FEATURE_KEY = 'managerMaterials';

export const managerMaterialsReducer = createReducer(
  initialManagerMaterialsState,

  on(ManagerMaterialsActions.setMaterialsSearchQuery, (state, { query }) => ({
    ...state,
    materialsSearchQuery: query,
  })),

  on(ManagerMaterialsActions.loadMaterials, (state, { page }) => ({
    ...state,
    materialsLoading: true,
    materialsError: null,
    materialsPage: page,
  })),

  on(ManagerMaterialsActions.loadMaterialsSuccess, (state, { result }) => ({
    ...state,
    materialsLoading: false,
    materials:
      result.page > 1
        ? [
            ...state.materials,
            ...(result.items ?? []).filter(
              (m) =>
                !state.materials.some(
                  (existing) => existing.materialId === m.materialId,
                ),
            ),
          ]
        : (result.items ?? []),
    materialsPage: result.page,
    materialsLimit: result.limit,
    materialsTotal: result.total,
  })),

  on(ManagerMaterialsActions.loadMaterialsFailure, (state, { error }) => ({
    ...state,
    materialsLoading: false,
    materialsError: error,
  })),

  on(ManagerMaterialsActions.openMaterialCreate, (state) => ({
    ...state,
    materialsViewMode: 'form' as const,
    editingMaterialId: null,
    materialsError: null,
  })),

  on(ManagerMaterialsActions.openMaterialEdit, (state, { materialId }) => ({
    ...state,
    materialsViewMode: 'form' as const,
    editingMaterialId: materialId,
    materialsError: null,
  })),

  on(ManagerMaterialsActions.closeMaterialForm, (state) => ({
    ...state,
    materialsViewMode: 'list' as const,
    editingMaterialId: null,
    materialsError: null,
  })),

  on(ManagerMaterialsActions.saveMaterial, (state) => ({
    ...state,
    materialsLoading: true,
    materialsError: null,
  })),

  on(ManagerMaterialsActions.saveMaterialSuccess, (state, { material }) => {
    const idx = state.materials.findIndex(
      (m: BmMaterial) => m.materialId === material.materialId,
    );
    const next = [...state.materials];

    if (idx >= 0) next[idx] = material;
    else next.unshift(material);

    return {
      ...state,
      materialsLoading: false,
      materials: next,
      materialsViewMode: 'list' as const,
      editingMaterialId: null,
    };
  }),

  on(ManagerMaterialsActions.saveMaterialFailure, (state, { error }) => ({
    ...state,
    materialsLoading: false,
    materialsError: error,
  })),

  on(ManagerMaterialsActions.removeMaterial, (state) => ({
    ...state,
    materialsLoading: true,
    materialsError: null,
  })),

  on(ManagerMaterialsActions.removeMaterialSuccess, (state, { materialId, action }) => ({
    ...state,
    materialsLoading: false,
    materials:
      action === 'deleted'
        ? state.materials.filter((m) => m.materialId !== materialId)
        : state.materials.map((m: BmMaterial) =>
            m.materialId === materialId ? { ...m, status: 'archived' } : m,
          ),
    materialsTotal:
      action === 'deleted'
        ? Math.max(0, state.materialsTotal - 1)
        : state.materialsTotal,
  })),

  on(ManagerMaterialsActions.removeMaterialFailure, (state, { error }) => ({
    ...state,
    materialsLoading: false,
    materialsError: error,
  })),
);
