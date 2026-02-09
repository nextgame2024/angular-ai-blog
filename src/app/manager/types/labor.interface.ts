export type LaborStatus = 'active' | 'archived' | string;

export interface BmLabor {
  laborId: string;
  userId?: string | null;
  companyId?: string | null;

  laborName: string;
  unitType?: string | null;
  unitCost: number;
  sellCost?: number | null;
  unitProductivity?: number | null;
  productivityUnit?: string | null;

  status?: LaborStatus | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  hasProjects?: boolean | null;
}

export interface ListLaborResponse {
  labor: BmLabor[];
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
