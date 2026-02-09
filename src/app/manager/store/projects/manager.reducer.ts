import { createReducer, on } from '@ngrx/store';
import { ManagerProjectsActions } from './manager.actions';
import { initialManagerProjectsState } from './manager.state';
import type {
  BmProject,
  BmProjectLabor,
  BmProjectMaterial,
} from '../../types/projects.interface';

export const MANAGER_PROJECTS_FEATURE_KEY = 'managerProjects';

export const managerProjectsReducer = createReducer(
  initialManagerProjectsState,

  on(ManagerProjectsActions.setProjectsSearchQuery, (state, { query }) => ({
    ...state,
    projectsSearchQuery: query,
  })),

  on(ManagerProjectsActions.loadProjects, (state, { page }) => ({
    ...state,
    projectsLoading: true,
    projectsError: null,
    projectsPage: page,
  })),

  on(ManagerProjectsActions.loadProjectsSuccess, (state, { result }) => ({
    ...state,
    projectsLoading: false,
    projects:
      result.page > 1
        ? [
            ...state.projects,
            ...(result.items ?? []).filter(
              (p) =>
                !state.projects.some(
                  (existing) => existing.projectId === p.projectId,
                ),
            ),
          ]
        : (result.items ?? []),
    projectsPage: result.page,
    projectsLimit: result.limit,
    projectsTotal: result.total,
  })),

  on(ManagerProjectsActions.loadProjectsFailure, (state, { error }) => ({
    ...state,
    projectsLoading: false,
    projectsError: error,
  })),

  on(ManagerProjectsActions.openProjectCreate, (state) => ({
    ...state,
    projectsViewMode: 'form' as const,
    editingProjectId: null,
    projectsError: null,
    projectFormTab: 'details',
    materials: [],
    labor: [],
    materialsViewMode: 'list',
    laborViewMode: 'list',
    editingProjectMaterialId: null,
    editingProjectLaborId: null,
  })),

  on(ManagerProjectsActions.openProjectEdit, (state, { projectId }) => ({
    ...state,
    projectsViewMode: 'form' as const,
    editingProjectId: projectId,
    projectsError: null,
    projectFormTab: 'details',
    materials: [],
    labor: [],
    materialsViewMode: 'list',
    laborViewMode: 'list',
    editingProjectMaterialId: null,
    editingProjectLaborId: null,
  })),

  on(ManagerProjectsActions.closeProjectForm, (state) => ({
    ...state,
    projectsViewMode: 'list' as const,
    editingProjectId: null,
    projectFormTab: 'details',
    materials: [],
    labor: [],
    materialsViewMode: 'list',
    laborViewMode: 'list',
    editingProjectMaterialId: null,
    editingProjectLaborId: null,
  })),

  on(ManagerProjectsActions.saveProject, (state) => ({
    ...state,
    projectsLoading: true,
    projectsError: null,
  })),

  on(ManagerProjectsActions.saveProjectSuccess, (state, { project, closeOnSuccess }) => {
    const idx = state.projects.findIndex(
      (p: BmProject) => p.projectId === project.projectId,
    );
    const next = [...state.projects];
    if (idx >= 0) next[idx] = project;
    else next.unshift(project);

    const shouldClose = closeOnSuccess ?? false;
    return {
      ...state,
      projectsLoading: false,
      projects: next,
      projectsViewMode: shouldClose ? ('list' as const) : ('form' as const),
      editingProjectId: shouldClose ? null : project.projectId,
      projectFormTab: 'details',
    };
  }),

  on(ManagerProjectsActions.saveProjectFailure, (state, { error }) => ({
    ...state,
    projectsLoading: false,
    projectsError: error,
  })),

  on(ManagerProjectsActions.setProjectFormTab, (state, { tab }) => ({
    ...state,
    projectFormTab: tab,
  })),

  on(ManagerProjectsActions.removeProject, (state) => ({
    ...state,
    projectsLoading: true,
    projectsError: null,
  })),

  on(ManagerProjectsActions.removeProjectSuccess, (state, { projectId, action }) => ({
    ...state,
    projectsLoading: false,
    projects:
      action === 'deleted'
        ? state.projects.filter((p) => p.projectId !== projectId)
        : state.projects.map((p: BmProject) =>
            p.projectId === projectId ? { ...p, status: 'archived' } : p,
          ),
    projectsTotal:
      action === 'deleted' ? Math.max(0, state.projectsTotal - 1) : state.projectsTotal,
  })),

  on(ManagerProjectsActions.removeProjectFailure, (state, { error }) => ({
    ...state,
    projectsLoading: false,
    projectsError: error,
  })),

  // Materials
  on(ManagerProjectsActions.loadProjectMaterials, (state) => ({
    ...state,
    materialsLoading: true,
    materialsError: null,
  })),

  on(
    ManagerProjectsActions.loadProjectMaterialsSuccess,
    (state, { materials }) => ({
      ...state,
      materialsLoading: false,
      materials,
    }),
  ),

  on(ManagerProjectsActions.loadProjectMaterialsFailure, (state, { error }) => ({
    ...state,
    materialsLoading: false,
    materialsError: error,
  })),

  on(ManagerProjectsActions.openProjectMaterialCreate, (state) => ({
    ...state,
    materialsViewMode: 'form' as const,
    editingProjectMaterialId: null,
  })),

  on(ManagerProjectsActions.openProjectMaterialEdit, (state, { materialId }) => ({
    ...state,
    materialsViewMode: 'form' as const,
    editingProjectMaterialId: materialId,
  })),

  on(ManagerProjectsActions.closeProjectMaterialForm, (state) => ({
    ...state,
    materialsViewMode: 'list' as const,
    editingProjectMaterialId: null,
  })),

  on(ManagerProjectsActions.saveProjectMaterialSuccess, (state, { projectMaterial }) => {
    const idx = state.materials.findIndex(
      (m: BmProjectMaterial) => m.materialId === projectMaterial.materialId,
    );
    const next = [...state.materials];
    if (idx >= 0) next[idx] = projectMaterial;
    else next.unshift(projectMaterial);

    return {
      ...state,
      materials: next,
      materialsViewMode: 'list' as const,
      editingProjectMaterialId: null,
    };
  }),

  on(ManagerProjectsActions.saveProjectMaterialFailure, (state, { error }) => ({
    ...state,
    materialsError: error,
  })),

  on(ManagerProjectsActions.removeProjectMaterialSuccess, (state, { materialId }) => ({
    ...state,
    materials: state.materials.filter((m) => m.materialId !== materialId),
  })),

  // Labor
  on(ManagerProjectsActions.loadProjectLabor, (state) => ({
    ...state,
    laborLoading: true,
    laborError: null,
  })),

  on(ManagerProjectsActions.loadProjectLaborSuccess, (state, { labor }) => ({
    ...state,
    laborLoading: false,
    labor,
  })),

  on(ManagerProjectsActions.loadProjectLaborFailure, (state, { error }) => ({
    ...state,
    laborLoading: false,
    laborError: error,
  })),

  on(ManagerProjectsActions.openProjectLaborCreate, (state) => ({
    ...state,
    laborViewMode: 'form' as const,
    editingProjectLaborId: null,
  })),

  on(ManagerProjectsActions.openProjectLaborEdit, (state, { laborId }) => ({
    ...state,
    laborViewMode: 'form' as const,
    editingProjectLaborId: laborId,
  })),

  on(ManagerProjectsActions.closeProjectLaborForm, (state) => ({
    ...state,
    laborViewMode: 'list' as const,
    editingProjectLaborId: null,
  })),

  on(ManagerProjectsActions.saveProjectLaborSuccess, (state, { projectLabor }) => {
    const idx = state.labor.findIndex(
      (l: BmProjectLabor) => l.laborId === projectLabor.laborId,
    );
    const next = [...state.labor];
    if (idx >= 0) next[idx] = projectLabor;
    else next.unshift(projectLabor);

    return {
      ...state,
      labor: next,
      laborViewMode: 'list' as const,
      editingProjectLaborId: null,
    };
  }),

  on(ManagerProjectsActions.saveProjectLaborFailure, (state, { error }) => ({
    ...state,
    laborError: error,
  })),

  on(ManagerProjectsActions.removeProjectLaborSuccess, (state, { laborId }) => ({
    ...state,
    labor: state.labor.filter((l) => l.laborId !== laborId),
  })),
);
