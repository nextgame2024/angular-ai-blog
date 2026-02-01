export type ProjectStatus = 'to_do' | 'active' | 'cancelled' | 'archived' | string;

export interface BmProject {
  projectId: string;
  companyId?: string | null;
  userId?: string | null;

  clientId: string;
  clientName?: string | null;

  projectName: string;
  description?: string | null;

  status?: ProjectStatus | null;
  defaultPricing?: boolean | null;
  pricingProfileId?: string | null;

  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface BmProjectMaterial {
  projectId: string;
  materialId: string;
  materialName: string;
  quantity?: number | null;
  unitCostOverride?: number | null;
  sellCostOverride?: number | null;
  notes?: string | null;
}

export interface BmProjectLabor {
  projectId: string;
  laborId: string;
  laborName: string;
  unitType?: string | null;
  quantity?: number | null;
  unitCostOverride?: number | null;
  sellCostOverride?: number | null;
  notes?: string | null;
}

export interface ListProjectsResponse {
  projects: BmProject[];
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
