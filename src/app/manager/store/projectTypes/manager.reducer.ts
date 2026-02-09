import { createReducer, on } from '@ngrx/store';
import { ManagerProjectTypesActions } from './manager.actions';
import { initialManagerProjectTypesState } from './manager.state';
import type {
  BmProjectType,
  BmProjectTypeLabor,
  BmProjectTypeMaterial,
} from '../../types/project.types.interface';

export const MANAGER_PROJECT_TYPES_FEATURE_KEY = 'managerProjectTypes';

export const managerProjectTypesReducer = createReducer(
  initialManagerProjectTypesState,

  on(
    ManagerProjectTypesActions.setProjectTypesSearchQuery,
    (state, { query }) => ({
      ...state,
      projectTypesSearchQuery: query,
    }),
  ),

  on(ManagerProjectTypesActions.loadProjectTypes, (state, { page }) => ({
    ...state,
    projectTypesLoading: true,
    projectTypesError: null,
    projectTypesPage: page,
  })),

  on(ManagerProjectTypesActions.loadProjectTypesSuccess, (state, { result }) => ({
    ...state,
    projectTypesLoading: false,
    projectTypes:
      result.page > 1
        ? [
            ...state.projectTypes,
            ...(result.items ?? []).filter(
              (pt) =>
                !state.projectTypes.some(
                  (existing) => existing.projectTypeId === pt.projectTypeId,
                ),
            ),
          ]
        : (result.items ?? []),
    projectTypesPage: result.page,
    projectTypesLimit: result.limit,
    projectTypesTotal: result.total,
  })),

  on(ManagerProjectTypesActions.loadProjectTypesFailure, (state, { error }) => ({
    ...state,
    projectTypesLoading: false,
    projectTypesError: error,
  })),

  on(ManagerProjectTypesActions.openProjectTypeCreate, (state) => ({
    ...state,
    projectTypesViewMode: 'form' as const,
    editingProjectTypeId: null,
    projectTypesError: null,
    projectTypeFormTab: 'details' as const,
    materials: [],
    labor: [],
    materialsViewMode: 'list' as const,
    laborViewMode: 'list' as const,
    editingMaterialId: null,
    editingLaborId: null,
  })),

  on(ManagerProjectTypesActions.openProjectTypeEdit, (state, { projectTypeId }) => ({
    ...state,
    projectTypesViewMode: 'form' as const,
    editingProjectTypeId: projectTypeId,
    projectTypesError: null,
    projectTypeFormTab: 'details' as const,
    materialsViewMode: 'list' as const,
    laborViewMode: 'list' as const,
    editingMaterialId: null,
    editingLaborId: null,
  })),

  on(ManagerProjectTypesActions.closeProjectTypeForm, (state) => ({
    ...state,
    projectTypesViewMode: 'list' as const,
    editingProjectTypeId: null,
    projectTypeFormTab: 'details' as const,
  })),

  on(ManagerProjectTypesActions.setProjectTypeFormTab, (state, { tab }) => ({
    ...state,
    projectTypeFormTab: tab,
  })),

  on(ManagerProjectTypesActions.saveProjectType, (state) => ({
    ...state,
    projectTypesLoading: true,
    projectTypesError: null,
  })),

  on(
    ManagerProjectTypesActions.saveProjectTypeSuccess,
    (state, { projectType, closeOnSuccess }) => {
      const idx = state.projectTypes.findIndex(
        (pt: BmProjectType) => pt.projectTypeId === projectType.projectTypeId,
      );
      const next = [...state.projectTypes];

      if (idx >= 0) next[idx] = projectType;
      else next.unshift(projectType);

      return {
        ...state,
        projectTypesLoading: false,
        projectTypes: next,
        projectTypesViewMode: closeOnSuccess ? ('list' as const) : state.projectTypesViewMode,
        editingProjectTypeId: closeOnSuccess ? null : projectType.projectTypeId,
      };
    },
  ),

  on(ManagerProjectTypesActions.saveProjectTypeFailure, (state, { error }) => ({
    ...state,
    projectTypesLoading: false,
    projectTypesError: error,
  })),

  on(ManagerProjectTypesActions.removeProjectType, (state) => ({
    ...state,
    projectTypesLoading: true,
    projectTypesError: null,
  })),

  on(
    ManagerProjectTypesActions.removeProjectTypeSuccess,
    (state, { projectTypeId, action }) => ({
      ...state,
      projectTypesLoading: false,
      projectTypes:
        action === 'deleted'
          ? state.projectTypes.filter((pt) => pt.projectTypeId !== projectTypeId)
          : state.projectTypes.map((pt: BmProjectType) =>
              pt.projectTypeId === projectTypeId
                ? { ...pt, status: 'archived' }
                : pt,
            ),
      projectTypesTotal:
        action === 'deleted'
          ? Math.max(0, state.projectTypesTotal - 1)
          : state.projectTypesTotal,
    }),
  ),

  on(ManagerProjectTypesActions.removeProjectTypeFailure, (state, { error }) => ({
    ...state,
    projectTypesLoading: false,
    projectTypesError: error,
  })),

  on(ManagerProjectTypesActions.loadProjectTypeMaterials, (state) => ({
    ...state,
    materialsLoading: true,
    materialsError: null,
  })),

  on(
    ManagerProjectTypesActions.loadProjectTypeMaterialsSuccess,
    (state, { materials }) => ({
      ...state,
      materialsLoading: false,
      materials,
    }),
  ),

  on(
    ManagerProjectTypesActions.loadProjectTypeMaterialsFailure,
    (state, { error }) => ({
      ...state,
      materialsLoading: false,
      materialsError: error,
    }),
  ),

  on(ManagerProjectTypesActions.openProjectTypeMaterialCreate, (state) => ({
    ...state,
    materialsViewMode: 'form' as const,
    editingMaterialId: null,
    materialsError: null,
  })),

  on(
    ManagerProjectTypesActions.openProjectTypeMaterialEdit,
    (state, { materialId }) => ({
      ...state,
      materialsViewMode: 'form' as const,
      editingMaterialId: materialId,
      materialsError: null,
    }),
  ),

  on(ManagerProjectTypesActions.closeProjectTypeMaterialForm, (state) => ({
    ...state,
    materialsViewMode: 'list' as const,
    editingMaterialId: null,
  })),

  on(ManagerProjectTypesActions.saveProjectTypeMaterial, (state) => ({
    ...state,
    materialsLoading: true,
    materialsError: null,
  })),

  on(
    ManagerProjectTypesActions.saveProjectTypeMaterialSuccess,
    (state, { projectTypeMaterial }) => {
      const idx = state.materials.findIndex(
        (m: BmProjectTypeMaterial) =>
          m.materialId === projectTypeMaterial.materialId,
      );
      const next = [...state.materials];

      if (idx >= 0) next[idx] = projectTypeMaterial;
      else next.unshift(projectTypeMaterial);

      return {
        ...state,
        materialsLoading: false,
        materials: next,
        materialsViewMode: 'list' as const,
        editingMaterialId: null,
      };
    },
  ),

  on(
    ManagerProjectTypesActions.saveProjectTypeMaterialFailure,
    (state, { error }) => ({
      ...state,
      materialsLoading: false,
      materialsError: error,
    }),
  ),

  on(ManagerProjectTypesActions.removeProjectTypeMaterial, (state) => ({
    ...state,
    materialsLoading: true,
    materialsError: null,
  })),

  on(
    ManagerProjectTypesActions.removeProjectTypeMaterialSuccess,
    (state, { materialId }) => ({
      ...state,
      materialsLoading: false,
      materials: state.materials.filter(
        (m: BmProjectTypeMaterial) => m.materialId !== materialId,
      ),
    }),
  ),

  on(
    ManagerProjectTypesActions.removeProjectTypeMaterialFailure,
    (state, { error }) => ({
      ...state,
      materialsLoading: false,
      materialsError: error,
    }),
  ),

  on(ManagerProjectTypesActions.loadProjectTypeLabor, (state) => ({
    ...state,
    laborLoading: true,
    laborError: null,
  })),

  on(ManagerProjectTypesActions.loadProjectTypeLaborSuccess, (state, { labor }) => ({
    ...state,
    laborLoading: false,
    labor,
  })),

  on(ManagerProjectTypesActions.loadProjectTypeLaborFailure, (state, { error }) => ({
    ...state,
    laborLoading: false,
    laborError: error,
  })),

  on(ManagerProjectTypesActions.openProjectTypeLaborCreate, (state) => ({
    ...state,
    laborViewMode: 'form' as const,
    editingLaborId: null,
    laborError: null,
  })),

  on(ManagerProjectTypesActions.openProjectTypeLaborEdit, (state, { laborId }) => ({
    ...state,
    laborViewMode: 'form' as const,
    editingLaborId: laborId,
    laborError: null,
  })),

  on(ManagerProjectTypesActions.closeProjectTypeLaborForm, (state) => ({
    ...state,
    laborViewMode: 'list' as const,
    editingLaborId: null,
  })),

  on(ManagerProjectTypesActions.saveProjectTypeLabor, (state) => ({
    ...state,
    laborLoading: true,
    laborError: null,
  })),

  on(
    ManagerProjectTypesActions.saveProjectTypeLaborSuccess,
    (state, { projectTypeLabor }) => {
      const idx = state.labor.findIndex(
        (l: BmProjectTypeLabor) => l.laborId === projectTypeLabor.laborId,
      );
      const next = [...state.labor];

      if (idx >= 0) next[idx] = projectTypeLabor;
      else next.unshift(projectTypeLabor);

      return {
        ...state,
        laborLoading: false,
        labor: next,
        laborViewMode: 'list' as const,
        editingLaborId: null,
      };
    },
  ),

  on(
    ManagerProjectTypesActions.saveProjectTypeLaborFailure,
    (state, { error }) => ({
      ...state,
      laborLoading: false,
      laborError: error,
    }),
  ),

  on(ManagerProjectTypesActions.removeProjectTypeLabor, (state) => ({
    ...state,
    laborLoading: true,
    laborError: null,
  })),

  on(
    ManagerProjectTypesActions.removeProjectTypeLaborSuccess,
    (state, { laborId }) => ({
      ...state,
      laborLoading: false,
      labor: state.labor.filter(
        (l: BmProjectTypeLabor) => l.laborId !== laborId,
      ),
    }),
  ),

  on(
    ManagerProjectTypesActions.removeProjectTypeLaborFailure,
    (state, { error }) => ({
      ...state,
      laborLoading: false,
      laborError: error,
    }),
  ),
);
