export type SiteStatus = 'active' | 'archived' | string;

export interface BmSite {
  siteId: string;
  companyId?: string | null;
  userId?: string | null;
  siteName: string;
  administrator?: string | null;
  address?: string | null;
  email?: string | null;
  mobile?: string | null;
  palletsOnsite: number;
  status?: SiteStatus | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface ListSitesResponse {
  sites: BmSite[];
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
