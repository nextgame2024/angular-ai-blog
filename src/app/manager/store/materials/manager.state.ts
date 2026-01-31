import type { BmMaterial } from '../../types/materials.interface';

export type MaterialsViewMode = 'list' | 'form';

export interface ManagerMaterialsState {
  materialsSearchQuery: string;

  materials: BmMaterial[];
  materialsLoading: boolean;
  materialsError: string | null;
  materialsPage: number;
  materialsLimit: number;
  materialsTotal: number;
  materialsViewMode: MaterialsViewMode;
  editingMaterialId: string | null;
}

export const initialManagerMaterialsState: ManagerMaterialsState = {
  materialsSearchQuery: '',

  materials: [],
  materialsLoading: false,
  materialsError: null,
  materialsPage: 1,
  materialsLimit: 20,
  materialsTotal: 0,
  materialsViewMode: 'list',
  editingMaterialId: null,
};
