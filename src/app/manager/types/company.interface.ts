export type CompanyStatus = 'active' | 'archived' | string;

export interface BmCompany {
  companyId: string;
  ownerUserId?: string | null;
  companyName: string;
  status?: CompanyStatus | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  legalName?: string | null;
  tradingName?: string | null;
  abn?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  tel?: string | null;
  cel?: string | null;
  logoUrl?: string | null;
}

export interface ListCompaniesResponse {
  companies: BmCompany[];
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
