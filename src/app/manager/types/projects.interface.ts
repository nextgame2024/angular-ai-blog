export type ProjectStatus =
  | 'to_do'
  | 'in_progress'
  | 'quote_created'
  | 'quote_approved'
  | 'done'
  | 'on_hold'
  | 'cancelled'
  | 'archived'
  | 'deleted'
  | string;

export interface BmProject {
  projectId: string;
  companyId?: string | null;
  userId?: string | null;

  clientId: string;
  clientName?: string | null;
  clientAddress?: string | null;

  projectName: string;
  metersRequired?: number | null;
  description?: string | null;
  scopeAndConditions?: string | null;

  status?: ProjectStatus | null;
  statusBeforeHold?: ProjectStatus | null;
  defaultPricing?: boolean | null;
  costInQuote?: boolean | null;
  projectTypeId?: string | null;
  projectTypeName?: string | null;
  pricingProfileId?: string | null;
  pricingProfileName?: string | null;
  quoteDocumentId?: string | null;
  quoteDocNumber?: string | null;
  quotePdfUrl?: string | null;
  invoiceDocumentId?: string | null;
  invoiceDocNumber?: string | null;
  invoicePdfUrl?: string | null;
  invoiceStatus?: string | null;
  hasProjects?: boolean | null;

  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface BmProjectMaterial {
  projectId: string;
  materialId: string;
  supplierId?: string | null;
  supplierName?: string | null;
  materialName: string;
  unit?: string | null;
  coverageRatio?: number | null;
  coverageUnit?: string | null;
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
  unitProductivity?: number | null;
  productivityUnit?: string | null;
  quantity?: number | null;
  unitCostOverride?: number | null;
  sellCostOverride?: number | null;
  notes?: string | null;
}

export interface BmProjectLaborExtras {
  dailyRate: number;
  laborHours: number;
  additionalTotal: number;
  dailyRateSource?: 'project' | 'global' | string;
}

export interface BmProjectSurcharge {
  surchargeId: string;
  projectId: string;
  type: string;
  name: string;
  cost: number;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface BmProjectSurchargeTransportation {
  companyAddress: string;
  clientAddress: string;
  durationMinutes: number;
  formattedTime: string;
}

export interface BmProjectSurchargeTransportationRoute {
  companyAddress: string;
  clientAddress: string;
  durationMinutes: number;
  formattedTime: string;
  distanceMeters?: number | null;
  encodedPolyline: string;
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
