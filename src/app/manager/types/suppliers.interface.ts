export type SupplierStatus = 'active' | 'archived' | string;

export interface BmSupplier {
  supplierId: string;
  userId?: string | null;
  companyId?: string | null;

  supplierName: string;
  address?: string | null;
  email?: string | null;
  cel?: string | null;
  tel?: string | null;
  notes?: string | null;

  status?: SupplierStatus | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface BmSupplierContact {
  contactId: string;
  supplierId: string;
  name: string;
  roleTitle?: string | null;
  email?: string | null;
  cel?: string | null;
  tel?: string | null;
  createdAt?: string | null;
}

export interface BmSupplierMaterial {
  supplierId: string;
  materialId: string;
  supplierSku?: string | null;
  leadTimeDays?: number | null;
  unitCost?: number | null;
  sellCost?: number | null;
  createdAt?: string | null;
}

export interface ListSuppliersResponse {
  suppliers: BmSupplier[];
  page: number;
  limit: number;
  total: number;
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}
