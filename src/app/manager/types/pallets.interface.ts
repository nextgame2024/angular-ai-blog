import type { BmSite, PagedResult } from './sites.interface';

export type PalletStatus = 'in_transit' | 'received' | 'cancelled' | string;

export interface BmPalletMovement {
  palletId: string;
  companyId?: string | null;
  userId?: string | null;
  originSiteId: string;
  originSiteName?: string | null;
  originAdministrator?: string | null;
  originAddress?: string | null;
  originEmail?: string | null;
  originMobile?: string | null;
  destinationSiteId: string;
  destinationSiteName?: string | null;
  destinationAdministrator?: string | null;
  destinationAddress?: string | null;
  destinationEmail?: string | null;
  destinationMobile?: string | null;
  pallets: number;
  status?: PalletStatus | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  receivedAt?: string | null;
}

export interface PalletsContext {
  originSite: BmSite | null;
  destinationSites: BmSite[];
}

export interface ListPalletSitesResponse {
  sites: BmSite[];
  page: number;
  limit: number;
  total: number;
}

export interface ListPalletMovementsResponse {
  originSite?: BmSite | null;
  destinationSite?: BmSite | null;
  movements: BmPalletMovement[];
  page: number;
  limit: number;
  total: number;
}

export type PagedPalletSites = PagedResult<BmSite>;
export type PagedPalletMovements = PagedResult<BmPalletMovement>;
