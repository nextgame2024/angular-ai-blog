import type {
  BmProjectType,
  BmProjectTypeLabor,
  BmProjectTypeMaterial,
} from '../../types/project.types.interface';

export type ProjectTypeViewMode = 'list' | 'form';
export type ProjectTypeFormTab = 'details' | 'materials' | 'labor';
export type ProjectTypeChildViewMode = 'list' | 'form';

export interface ManagerProjectTypesState {
  projectTypesSearchQuery: string;

  projectTypes: BmProjectType[];
  projectTypesLoading: boolean;
  projectTypesError: string | null;
  projectTypesPage: number;
  projectTypesLimit: number;
  projectTypesTotal: number;
  projectTypesViewMode: ProjectTypeViewMode;
  editingProjectTypeId: string | null;

  projectTypeFormTab: ProjectTypeFormTab;

  materials: BmProjectTypeMaterial[];
  materialsLoading: boolean;
  materialsError: string | null;
  materialsViewMode: ProjectTypeChildViewMode;
  editingMaterialId: string | null;

  labor: BmProjectTypeLabor[];
  laborLoading: boolean;
  laborError: string | null;
  laborViewMode: ProjectTypeChildViewMode;
  editingLaborId: string | null;
}

export const initialManagerProjectTypesState: ManagerProjectTypesState = {
  projectTypesSearchQuery: '',

  projectTypes: [],
  projectTypesLoading: false,
  projectTypesError: null,
  projectTypesPage: 1,
  projectTypesLimit: 20,
  projectTypesTotal: 0,
  projectTypesViewMode: 'list',
  editingProjectTypeId: null,

  projectTypeFormTab: 'details',

  materials: [],
  materialsLoading: false,
  materialsError: null,
  materialsViewMode: 'list',
  editingMaterialId: null,

  labor: [],
  laborLoading: false,
  laborError: null,
  laborViewMode: 'list',
  editingLaborId: null,
};
