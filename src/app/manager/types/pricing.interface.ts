export type PricingStatus = 'active' | 'archived' | string;

export interface BmPricingProfile {
  pricingProfileId: string;
  userId?: string | null;
  companyId?: string | null;

  profileName: string;
  materialMarkup?: number | null;
  laborMarkup?: number | null;
  gstRate?: number | null;
  hasProjects?: boolean | null;

  status?: PricingStatus | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface ListPricingProfilesResponse {
  pricingProfiles: BmPricingProfile[];
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
