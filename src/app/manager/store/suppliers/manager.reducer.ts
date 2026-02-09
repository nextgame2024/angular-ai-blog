import { createReducer, on } from '@ngrx/store';
import { ManagerSuppliersActions } from './manager.actions';
import { initialManagerSuppliersState } from './manager.state';
import type { BmSupplier, BmSupplierContact, BmSupplierMaterial } from '../../types/suppliers.interface';

export const MANAGER_SUPPLIERS_FEATURE_KEY = 'managerSuppliers';

export const managerSuppliersReducer = createReducer(
  initialManagerSuppliersState,

  on(ManagerSuppliersActions.setSuppliersSearchQuery, (state, { query }) => ({
    ...state,
    suppliersSearchQuery: query,
  })),

  on(ManagerSuppliersActions.loadSuppliers, (state, { page }) => ({
    ...state,
    suppliersLoading: true,
    suppliersError: null,
    suppliersPage: page,
  })),

  on(ManagerSuppliersActions.loadSuppliersSuccess, (state, { result }) => ({
    ...state,
    suppliersLoading: false,
    suppliers:
      result.page > 1
        ? [
            ...state.suppliers,
            ...(result.items ?? []).filter(
              (s) =>
                !state.suppliers.some(
                  (existing) => existing.supplierId === s.supplierId,
                ),
            ),
          ]
        : (result.items ?? []),
    suppliersPage: result.page,
    suppliersLimit: result.limit,
    suppliersTotal: result.total,
  })),

  on(ManagerSuppliersActions.loadSuppliersFailure, (state, { error }) => ({
    ...state,
    suppliersLoading: false,
    suppliersError: error,
  })),

  on(ManagerSuppliersActions.openSupplierCreate, (state) => ({
    ...state,
    suppliersViewMode: 'form' as const,
    editingSupplierId: null,
    supplierFormTab: 'details' as const,
    suppliersError: null,
    contacts: [],
    contactsLoading: false,
    contactsError: null,
    contactsPage: 1,
    contactsLimit: 20,
    contactsTotal: 0,
    contactsViewMode: 'list' as const,
    editingContactId: null,
    materials: [],
    materialsLoading: false,
    materialsError: null,
    materialsPage: 1,
    materialsLimit: 20,
    materialsTotal: 0,
    materialsViewMode: 'list' as const,
    editingMaterialId: null,
  })),

  on(ManagerSuppliersActions.openSupplierEdit, (state, { supplierId }) => ({
    ...state,
    suppliersViewMode: 'form' as const,
    editingSupplierId: supplierId,
    supplierFormTab: 'details' as const,
    suppliersError: null,
    contacts: [],
    contactsLoading: false,
    contactsError: null,
    contactsPage: 1,
    contactsLimit: 20,
    contactsTotal: 0,
    contactsViewMode: 'list' as const,
    editingContactId: null,
    materials: [],
    materialsLoading: false,
    materialsError: null,
    materialsPage: 1,
    materialsLimit: 20,
    materialsTotal: 0,
    materialsViewMode: 'list' as const,
    editingMaterialId: null,
  })),

  on(ManagerSuppliersActions.closeSupplierForm, (state) => ({
    ...state,
    suppliersViewMode: 'list' as const,
    editingSupplierId: null,
    supplierFormTab: 'details' as const,
    contacts: [],
    contactsLoading: false,
    contactsError: null,
    contactsPage: 1,
    contactsLimit: 20,
    contactsTotal: 0,
    contactsViewMode: 'list' as const,
    editingContactId: null,
    materials: [],
    materialsLoading: false,
    materialsError: null,
    materialsPage: 1,
    materialsLimit: 20,
    materialsTotal: 0,
    materialsViewMode: 'list' as const,
    editingMaterialId: null,
  })),

  on(ManagerSuppliersActions.setSupplierFormTab, (state, { tab }) => ({
    ...state,
    supplierFormTab: tab,
  })),

  on(ManagerSuppliersActions.saveSupplier, (state) => ({
    ...state,
    suppliersLoading: true,
    suppliersError: null,
  })),

  on(ManagerSuppliersActions.saveSupplierSuccess, (state, { supplier }) => {
    const idx = state.suppliers.findIndex(
      (s: BmSupplier) => s.supplierId === supplier.supplierId,
    );
    const next = [...state.suppliers];

    if (idx >= 0) next[idx] = supplier;
    else next.unshift(supplier);

    return {
      ...state,
      suppliersLoading: false,
      suppliers: next,
      suppliersViewMode: 'form' as const,
      editingSupplierId: supplier.supplierId,
      supplierFormTab: state.editingSupplierId
        ? state.supplierFormTab
        : ('details' as const),
    };
  }),

  on(ManagerSuppliersActions.saveSupplierFailure, (state, { error }) => ({
    ...state,
    suppliersLoading: false,
    suppliersError: error,
  })),

  on(ManagerSuppliersActions.removeSupplier, (state) => ({
    ...state,
    suppliersLoading: true,
    suppliersError: null,
  })),

  on(ManagerSuppliersActions.removeSupplierSuccess, (state, { supplierId, action }) => ({
    ...state,
    suppliersLoading: false,
    suppliers:
      action === 'deleted'
        ? state.suppliers.filter((s) => s.supplierId !== supplierId)
        : state.suppliers.map((s) =>
            s.supplierId === supplierId ? { ...s, status: 'archived' } : s,
          ),
    suppliersTotal:
      action === 'deleted'
        ? Math.max(0, state.suppliersTotal - 1)
        : state.suppliersTotal,
  })),

  on(ManagerSuppliersActions.removeSupplierFailure, (state, { error }) => ({
    ...state,
    suppliersLoading: false,
    suppliersError: error,
  })),

  // Contacts
  on(ManagerSuppliersActions.loadSupplierContacts, (state, { page }) => ({
    ...state,
    contactsLoading: true,
    contactsError: null,
    contactsPage: page,
  })),

  on(ManagerSuppliersActions.loadSupplierContactsSuccess, (state, { contacts, page, limit, total }) => ({
    ...state,
    contactsLoading: false,
    contacts:
      page > 1
        ? [
            ...state.contacts,
            ...(contacts ?? []).filter(
              (c) =>
                !state.contacts.some(
                  (existing) => existing.contactId === c.contactId,
                ),
            ),
          ]
        : (contacts ?? []),
    contactsPage: page,
    contactsLimit: limit,
    contactsTotal: total,
  })),

  on(ManagerSuppliersActions.loadSupplierContactsFailure, (state, { error }) => ({
    ...state,
    contactsLoading: false,
    contactsError: error,
  })),

  on(ManagerSuppliersActions.openSupplierContactCreate, (state) => ({
    ...state,
    contactsViewMode: 'form' as const,
    editingContactId: null,
    contactsError: null,
  })),

  on(ManagerSuppliersActions.openSupplierContactEdit, (state, { contactId }) => ({
    ...state,
    contactsViewMode: 'form' as const,
    editingContactId: contactId,
    contactsError: null,
  })),

  on(ManagerSuppliersActions.closeSupplierContactForm, (state) => ({
    ...state,
    contactsViewMode: 'list' as const,
    editingContactId: null,
    contactsError: null,
  })),

  on(ManagerSuppliersActions.saveSupplierContact, (state) => ({
    ...state,
    contactsLoading: true,
    contactsError: null,
  })),

  on(ManagerSuppliersActions.saveSupplierContactSuccess, (state, { contact }) => {
    const idx = state.contacts.findIndex(
      (c: BmSupplierContact) => c.contactId === contact.contactId,
    );
    const next = [...state.contacts];

    if (idx >= 0) next[idx] = contact;
    else next.unshift(contact);

    return {
      ...state,
      contactsLoading: false,
      contacts: next,
      contactsViewMode: 'list' as const,
      editingContactId: null,
      contactsTotal: idx >= 0 ? state.contactsTotal : state.contactsTotal + 1,
    };
  }),

  on(ManagerSuppliersActions.saveSupplierContactFailure, (state, { error }) => ({
    ...state,
    contactsLoading: false,
    contactsError: error,
  })),

  on(ManagerSuppliersActions.deleteSupplierContactSuccess, (state, { contactId }) => ({
    ...state,
    contactsLoading: false,
    contacts: state.contacts.filter((c) => c.contactId !== contactId),
    contactsTotal: Math.max(0, state.contactsTotal - 1),
  })),

  on(ManagerSuppliersActions.deleteSupplierContactFailure, (state, { error }) => ({
    ...state,
    contactsError: error,
  })),

  // Materials
  on(ManagerSuppliersActions.loadSupplierMaterials, (state, { page }) => ({
    ...state,
    materialsLoading: true,
    materialsError: null,
    materialsPage: page,
  })),

  on(ManagerSuppliersActions.loadSupplierMaterialsSuccess, (state, { materials, page, limit, total }) => ({
    ...state,
    materialsLoading: false,
    materials:
      page > 1
        ? [
            ...state.materials,
            ...(materials ?? []).filter(
              (m) =>
                !state.materials.some(
                  (existing) => existing.materialId === m.materialId,
                ),
            ),
          ]
        : (materials ?? []),
    materialsPage: page,
    materialsLimit: limit,
    materialsTotal: total,
  })),

  on(ManagerSuppliersActions.loadSupplierMaterialsFailure, (state, { error }) => ({
    ...state,
    materialsLoading: false,
    materialsError: error,
  })),

  on(ManagerSuppliersActions.openSupplierMaterialCreate, (state) => ({
    ...state,
    materialsViewMode: 'form' as const,
    editingMaterialId: null,
    materialsError: null,
  })),

  on(ManagerSuppliersActions.openSupplierMaterialEdit, (state, { materialId }) => ({
    ...state,
    materialsViewMode: 'form' as const,
    editingMaterialId: materialId,
    materialsError: null,
  })),

  on(ManagerSuppliersActions.closeSupplierMaterialForm, (state) => ({
    ...state,
    materialsViewMode: 'list' as const,
    editingMaterialId: null,
    materialsError: null,
  })),

  on(ManagerSuppliersActions.saveSupplierMaterial, (state) => ({
    ...state,
    materialsLoading: true,
    materialsError: null,
  })),

  on(ManagerSuppliersActions.saveSupplierMaterialSuccess, (state, { supplierMaterial }) => {
    const idx = state.materials.findIndex(
      (m: BmSupplierMaterial) => m.materialId === supplierMaterial.materialId,
    );
    const next = [...state.materials];

    if (idx >= 0) next[idx] = supplierMaterial;
    else next.unshift(supplierMaterial);

    return {
      ...state,
      materialsLoading: false,
      materials: next,
      materialsViewMode: 'list' as const,
      editingMaterialId: null,
      materialsTotal: idx >= 0 ? state.materialsTotal : state.materialsTotal + 1,
    };
  }),

  on(ManagerSuppliersActions.saveSupplierMaterialFailure, (state, { error }) => ({
    ...state,
    materialsLoading: false,
    materialsError: error,
  })),

  on(ManagerSuppliersActions.removeSupplierMaterialSuccess, (state, { materialId }) => ({
    ...state,
    materialsLoading: false,
    materials: state.materials.filter((m) => m.materialId !== materialId),
    materialsTotal: Math.max(0, state.materialsTotal - 1),
  })),

  on(ManagerSuppliersActions.removeSupplierMaterialFailure, (state, { error }) => ({
    ...state,
    materialsError: error,
  })),
);
