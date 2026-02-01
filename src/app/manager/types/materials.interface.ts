export type MaterialStatus = 'active' | 'archived' | string;

export interface BmMaterial {
  materialId: string;
  userId?: string | null;
  companyId?: string | null;

  type?: string | null;
  materialName: string;
  code?: string | null;
  category?: string | null;
  notes?: string | null;

  status?: MaterialStatus | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface ListMaterialsResponse {
  materials: BmMaterial[];
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
