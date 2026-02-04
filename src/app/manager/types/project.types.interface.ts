export type ProjectTypeStatus = 'active' | 'archived' | string;

export interface BmProjectType {
  projectTypeId: string;
  companyId?: string | null;
  userId?: string | null;
  name: string;
  notes?: string | null;
  status?: ProjectTypeStatus | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface BmProjectTypeMaterial {
  projectTypeId: string;
  materialId: string;
  supplierId?: string | null;
  supplierName?: string | null;
  materialName: string;
  quantity?: number | null;
  unitCostOverride?: number | null;
  sellCostOverride?: number | null;
  notes?: string | null;
}

export interface BmProjectTypeLabor {
  projectTypeId: string;
  laborId: string;
  laborName: string;
  unitType?: string | null;
  quantity?: number | null;
  unitCostOverride?: number | null;
  sellCostOverride?: number | null;
  notes?: string | null;
}

export interface ListProjectTypesResponse {
  projectTypes: BmProjectType[];
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
