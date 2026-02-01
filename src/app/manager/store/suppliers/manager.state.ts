import type {
  BmSupplier,
  BmSupplierContact,
  BmSupplierMaterial,
} from '../../types/suppliers.interface';

export type SuppliersViewMode = 'list' | 'form';
export type SupplierFormTab = 'details' | 'contacts' | 'materials';
export type SupplierContactsViewMode = 'list' | 'form';
export type SupplierMaterialsViewMode = 'list' | 'form';

export interface ManagerSuppliersState {
  suppliersSearchQuery: string;

  suppliers: BmSupplier[];
  suppliersLoading: boolean;
  suppliersError: string | null;
  suppliersPage: number;
  suppliersLimit: number;
  suppliersTotal: number;
  suppliersViewMode: SuppliersViewMode;
  editingSupplierId: string | null;

  supplierFormTab: SupplierFormTab;

  contacts: BmSupplierContact[];
  contactsLoading: boolean;
  contactsError: string | null;
  contactsPage: number;
  contactsLimit: number;
  contactsTotal: number;
  contactsViewMode: SupplierContactsViewMode;
  editingContactId: string | null;

  materials: BmSupplierMaterial[];
  materialsLoading: boolean;
  materialsError: string | null;
  materialsPage: number;
  materialsLimit: number;
  materialsTotal: number;
  materialsViewMode: SupplierMaterialsViewMode;
  editingMaterialId: string | null;
}

export const initialManagerSuppliersState: ManagerSuppliersState = {
  suppliersSearchQuery: '',

  suppliers: [],
  suppliersLoading: false,
  suppliersError: null,
  suppliersPage: 1,
  suppliersLimit: 20,
  suppliersTotal: 0,
  suppliersViewMode: 'list',
  editingSupplierId: null,

  supplierFormTab: 'details',

  contacts: [],
  contactsLoading: false,
  contactsError: null,
  contactsPage: 1,
  contactsLimit: 20,
  contactsTotal: 0,
  contactsViewMode: 'list',
  editingContactId: null,

  materials: [],
  materialsLoading: false,
  materialsError: null,
  materialsPage: 1,
  materialsLimit: 20,
  materialsTotal: 0,
  materialsViewMode: 'list',
  editingMaterialId: null,
};
