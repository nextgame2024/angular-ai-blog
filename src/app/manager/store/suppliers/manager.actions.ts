import { createActionGroup, emptyProps, props } from '@ngrx/store';
import type {
  BmSupplier,
  BmSupplierContact,
  BmSupplierMaterial,
  PagedResult,
} from '../../types/suppliers.interface';
import { SupplierFormTab } from './manager.state';

export const ManagerSuppliersActions = createActionGroup({
  source: 'Manager Suppliers',
  events: {
    'Set Suppliers Search Query': props<{ query: string }>(),

    'Load Suppliers': props<{ page: number }>(),
    'Load Suppliers Success': props<{ result: PagedResult<BmSupplier> }>(),
    'Load Suppliers Failure': props<{ error: string }>(),

    'Open Supplier Create': emptyProps(),
    'Open Supplier Edit': props<{ supplierId: string }>(),
    'Close Supplier Form': emptyProps(),

    'Set Supplier Form Tab': props<{ tab: SupplierFormTab }>(),

    'Save Supplier': props<{ payload: any }>(),
    'Save Supplier Success': props<{ supplier: BmSupplier }>(),
    'Save Supplier Failure': props<{ error: string }>(),

    'Archive Supplier': props<{ supplierId: string }>(),
    'Archive Supplier Success': props<{ supplierId: string }>(),
    'Archive Supplier Failure': props<{ error: string }>(),

    // Contacts
    'Load Supplier Contacts': props<{ supplierId: string; page: number }>(),
    'Load Supplier Contacts Success': props<{
      contacts: BmSupplierContact[];
      page: number;
      limit: number;
      total: number;
    }>(),
    'Load Supplier Contacts Failure': props<{ error: string }>(),

    'Open Supplier Contact Create': emptyProps(),
    'Open Supplier Contact Edit': props<{ contactId: string }>(),
    'Close Supplier Contact Form': emptyProps(),

    'Save Supplier Contact': props<{ supplierId: string; payload: any }>(),
    'Save Supplier Contact Success': props<{ contact: BmSupplierContact }>(),
    'Save Supplier Contact Failure': props<{ error: string }>(),

    'Delete Supplier Contact': props<{ supplierId: string; contactId: string }>(),
    'Delete Supplier Contact Success': props<{ contactId: string }>(),
    'Delete Supplier Contact Failure': props<{ error: string }>(),

    // Materials
    'Load Supplier Materials': props<{ supplierId: string; page: number }>(),
    'Load Supplier Materials Success': props<{
      materials: BmSupplierMaterial[];
      page: number;
      limit: number;
      total: number;
    }>(),
    'Load Supplier Materials Failure': props<{ error: string }>(),

    'Open Supplier Material Create': emptyProps(),
    'Open Supplier Material Edit': props<{ materialId: string }>(),
    'Close Supplier Material Form': emptyProps(),

    'Save Supplier Material': props<{ supplierId: string; payload: any }>(),
    'Save Supplier Material Success': props<{ supplierMaterial: BmSupplierMaterial }>(),
    'Save Supplier Material Failure': props<{ error: string }>(),

    'Remove Supplier Material': props<{ supplierId: string; materialId: string }>(),
    'Remove Supplier Material Success': props<{ materialId: string }>(),
    'Remove Supplier Material Failure': props<{ error: string }>(),
  },
});
