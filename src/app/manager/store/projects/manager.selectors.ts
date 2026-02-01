import { createFeatureSelector, createSelector } from '@ngrx/store';
import { MANAGER_PROJECTS_FEATURE_KEY } from './manager.reducer';
import type { ManagerProjectsState } from './manager.state';

export const selectManagerProjectsState =
  createFeatureSelector<ManagerProjectsState>(MANAGER_PROJECTS_FEATURE_KEY);

export const selectManagerProjects = createSelector(
  selectManagerProjectsState,
  (state) => state.projects,
);

export const selectManagerProjectsLoading = createSelector(
  selectManagerProjectsState,
  (state) => state.projectsLoading,
);

export const selectManagerProjectsError = createSelector(
  selectManagerProjectsState,
  (state) => state.projectsError,
);

export const selectManagerProjectsPage = createSelector(
  selectManagerProjectsState,
  (state) => state.projectsPage,
);

export const selectManagerProjectsLimit = createSelector(
  selectManagerProjectsState,
  (state) => state.projectsLimit,
);

export const selectManagerProjectsTotal = createSelector(
  selectManagerProjectsState,
  (state) => state.projectsTotal,
);

export const selectManagerProjectsSearchQuery = createSelector(
  selectManagerProjectsState,
  (state) => state.projectsSearchQuery,
);

export const selectManagerProjectsViewMode = createSelector(
  selectManagerProjectsState,
  (state) => state.projectsViewMode,
);

export const selectManagerEditingProjectId = createSelector(
  selectManagerProjectsState,
  (state) => state.editingProjectId,
);

export const selectManagerEditingProject = createSelector(
  selectManagerProjectsState,
  (state) =>
    state.editingProjectId
      ? state.projects.find((p) => p.projectId === state.editingProjectId) ??
        null
      : null,
);

export const selectManagerProjectFormTab = createSelector(
  selectManagerProjectsState,
  (state) => state.projectFormTab,
);

export const selectManagerProjectMaterials = createSelector(
  selectManagerProjectsState,
  (state) => state.materials,
);

export const selectManagerProjectMaterialsLoading = createSelector(
  selectManagerProjectsState,
  (state) => state.materialsLoading,
);

export const selectManagerProjectMaterialsError = createSelector(
  selectManagerProjectsState,
  (state) => state.materialsError,
);

export const selectManagerProjectMaterialsViewMode = createSelector(
  selectManagerProjectsState,
  (state) => state.materialsViewMode,
);

export const selectManagerEditingProjectMaterial = createSelector(
  selectManagerProjectsState,
  (state) =>
    state.editingProjectMaterialId
      ? state.materials.find(
          (m) => m.materialId === state.editingProjectMaterialId,
        ) ?? null
      : null,
);

export const selectManagerProjectLabor = createSelector(
  selectManagerProjectsState,
  (state) => state.labor,
);

export const selectManagerProjectLaborLoading = createSelector(
  selectManagerProjectsState,
  (state) => state.laborLoading,
);

export const selectManagerProjectLaborError = createSelector(
  selectManagerProjectsState,
  (state) => state.laborError,
);

export const selectManagerProjectLaborViewMode = createSelector(
  selectManagerProjectsState,
  (state) => state.laborViewMode,
);

export const selectManagerEditingProjectLabor = createSelector(
  selectManagerProjectsState,
  (state) =>
    state.editingProjectLaborId
      ? state.labor.find((l) => l.laborId === state.editingProjectLaborId) ??
        null
      : null,
);
