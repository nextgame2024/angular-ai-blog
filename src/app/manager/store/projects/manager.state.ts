import type {
  BmProject,
  BmProjectLabor,
  BmProjectMaterial,
} from '../../types/projects.interface';

export type ProjectsViewMode = 'list' | 'form';
export type ProjectFormTab = 'details' | 'materials' | 'labor';
export type ProjectMaterialsViewMode = 'list' | 'form';
export type ProjectLaborViewMode = 'list' | 'form';

export interface ManagerProjectsState {
  projectsSearchQuery: string;

  projects: BmProject[];
  projectsLoading: boolean;
  projectsError: string | null;
  projectsPage: number;
  projectsLimit: number;
  projectsTotal: number;
  projectsViewMode: ProjectsViewMode;
  editingProjectId: string | null;

  projectFormTab: ProjectFormTab;

  materials: BmProjectMaterial[];
  materialsLoading: boolean;
  materialsError: string | null;
  materialsViewMode: ProjectMaterialsViewMode;
  editingProjectMaterialId: string | null;

  labor: BmProjectLabor[];
  laborLoading: boolean;
  laborError: string | null;
  laborViewMode: ProjectLaborViewMode;
  editingProjectLaborId: string | null;
}

export const initialManagerProjectsState: ManagerProjectsState = {
  projectsSearchQuery: '',

  projects: [],
  projectsLoading: false,
  projectsError: null,
  projectsPage: 1,
  projectsLimit: 20,
  projectsTotal: 0,
  projectsViewMode: 'list',
  editingProjectId: null,

  projectFormTab: 'details',

  materials: [],
  materialsLoading: false,
  materialsError: null,
  materialsViewMode: 'list',
  editingProjectMaterialId: null,

  labor: [],
  laborLoading: false,
  laborError: null,
  laborViewMode: 'list',
  editingProjectLaborId: null,
};
