import type { BmLabor } from '../../types/labor.interface';

export type LaborViewMode = 'list' | 'form';

export interface ManagerLaborState {
  laborSearchQuery: string;

  labor: BmLabor[];
  laborLoading: boolean;
  laborError: string | null;
  laborPage: number;
  laborLimit: number;
  laborTotal: number;
  laborViewMode: LaborViewMode;
  editingLaborId: string | null;
}

export const initialManagerLaborState: ManagerLaborState = {
  laborSearchQuery: '',

  labor: [],
  laborLoading: false,
  laborError: null,
  laborPage: 1,
  laborLimit: 20,
  laborTotal: 0,
  laborViewMode: 'list',
  editingLaborId: null,
};
