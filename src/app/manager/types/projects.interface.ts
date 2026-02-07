export type ProjectStatus =
  | 'to_do'
  | 'in_progress'
  | 'quote_approved'
  | 'done'
  | 'on_hold'
  | 'cancelled'
  | 'archived'
  | string;

export interface BmProject {
  projectId: string;
  companyId?: string | null;
  userId?: string | null;

  clientId: string;
  clientName?: string | null;

  projectName: string;
  description?: string | null;

  status?: ProjectStatus | null;
  statusBeforeHold?: ProjectStatus | null;
  defaultPricing?: boolean | null;
  costInQuote?: boolean | null;
  projectTypeId?: string | null;
  projectTypeName?: string | null;
  pricingProfileId?: string | null;
  pricingProfileName?: string | null;
  invoiceDocumentId?: string | null;
  invoiceDocNumber?: string | null;
  invoicePdfUrl?: string | null;
  invoiceStatus?: string | null;

  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface BmProjectMaterial {
  projectId: string;
  materialId: string;
  supplierId?: string | null;
  supplierName?: string | null;
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
