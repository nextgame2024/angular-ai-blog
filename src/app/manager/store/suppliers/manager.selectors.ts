import { createFeatureSelector, createSelector } from '@ngrx/store';
import { MANAGER_SUPPLIERS_FEATURE_KEY } from './manager.reducer';
import { ManagerSuppliersState } from './manager.state';
import type { BmSupplier, BmSupplierContact, BmSupplierMaterial } from '../../types/suppliers.interface';

export const selectManagerSuppliersState =
  createFeatureSelector<ManagerSuppliersState>(MANAGER_SUPPLIERS_FEATURE_KEY);

export const selectManagerSuppliersSearchQuery = createSelector(
  selectManagerSuppliersState,
  (s) => s.suppliersSearchQuery,
);

export const selectManagerSuppliers = createSelector(
  selectManagerSuppliersState,
  (s) => s.suppliers,
);
export const selectManagerSuppliersLoading = createSelector(
  selectManagerSuppliersState,
  (s) => s.suppliersLoading,
);
export const selectManagerSuppliersError = createSelector(
  selectManagerSuppliersState,
  (s) => s.suppliersError,
);
export const selectManagerSuppliersTotal = createSelector(
  selectManagerSuppliersState,
  (s) => s.suppliersTotal,
);
export const selectManagerSuppliersPage = createSelector(
  selectManagerSuppliersState,
  (s) => s.suppliersPage,
);
export const selectManagerSuppliersLimit = createSelector(
  selectManagerSuppliersState,
  (s) => s.suppliersLimit,
);
export const selectManagerSuppliersViewMode = createSelector(
  selectManagerSuppliersState,
  (s) => s.suppliersViewMode,
);

export const selectManagerEditingSupplier = createSelector(
  selectManagerSuppliersState,
  (s) => {
    if (!s.editingSupplierId) return null;
    return (
      s.suppliers.find(
        (sup: BmSupplier) => sup.supplierId === s.editingSupplierId,
      ) ?? null
    );
  },
);

export const selectManagerSupplierFormTab = createSelector(
  selectManagerSuppliersState,
  (s) => s.supplierFormTab,
);

// Contacts
export const selectManagerSupplierContacts = createSelector(
  selectManagerSuppliersState,
  (s) => s.contacts,
);
export const selectManagerSupplierContactsLoading = createSelector(
  selectManagerSuppliersState,
  (s) => s.contactsLoading,
);
export const selectManagerSupplierContactsError = createSelector(
  selectManagerSuppliersState,
  (s) => s.contactsError,
);
export const selectManagerSupplierContactsTotal = createSelector(
  selectManagerSuppliersState,
  (s) => s.contactsTotal,
);
export const selectManagerSupplierContactsPage = createSelector(
  selectManagerSuppliersState,
  (s) => s.contactsPage,
);
export const selectManagerSupplierContactsLimit = createSelector(
  selectManagerSuppliersState,
  (s) => s.contactsLimit,
);
export const selectManagerSupplierContactsViewMode = createSelector(
  selectManagerSuppliersState,
  (s) => s.contactsViewMode,
);

export const selectManagerEditingSupplierContact = createSelector(
  selectManagerSuppliersState,
  (s) => {
    if (!s.editingContactId) return null;
    return (
      s.contacts.find(
        (c: BmSupplierContact) => c.contactId === s.editingContactId,
      ) ?? null
    );
  },
);

// Materials
export const selectManagerSupplierMaterials = createSelector(
  selectManagerSuppliersState,
  (s) => s.materials,
);
export const selectManagerSupplierMaterialsLoading = createSelector(
  selectManagerSuppliersState,
  (s) => s.materialsLoading,
);
export const selectManagerSupplierMaterialsError = createSelector(
  selectManagerSuppliersState,
  (s) => s.materialsError,
);
export const selectManagerSupplierMaterialsTotal = createSelector(
  selectManagerSuppliersState,
  (s) => s.materialsTotal,
);
export const selectManagerSupplierMaterialsPage = createSelector(
  selectManagerSuppliersState,
  (s) => s.materialsPage,
);
export const selectManagerSupplierMaterialsLimit = createSelector(
  selectManagerSuppliersState,
  (s) => s.materialsLimit,
);
export const selectManagerSupplierMaterialsViewMode = createSelector(
  selectManagerSuppliersState,
  (s) => s.materialsViewMode,
);

export const selectManagerEditingSupplierMaterial = createSelector(
  selectManagerSuppliersState,
  (s) => {
    if (!s.editingMaterialId) return null;
    return (
      s.materials.find(
        (m: BmSupplierMaterial) => m.materialId === s.editingMaterialId,
      ) ?? null
    );
  },
);
