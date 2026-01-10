// src/app/townplanner/store/townplanner_v2.state.ts

export type TownPlannerV2Status = 'idle' | 'loading' | 'success' | 'error';

export interface TownPlannerV2PropertyResult {
  // Keep it flexible; backend may evolve.
  address?: string;

  // Common patterns your API may return:
  lat?: number;
  lng?: number;

  centroid?: { lat: number; lng: number };

  // GeoJSON-ish geometry (Polygon/MultiPolygon)
  geometry?: any;

  // Optional property photo URL (S3)
  photoUrl?: string;

  // Everything else
  [key: string]: any;
}

export type TownPlannerV2Result = TownPlannerV2PropertyResult;

export interface TownPlannerV2State {
  addressQuery: string;
  status: TownPlannerV2Status;
  error: string | null;
  selected: TownPlannerV2PropertyResult | null;
}

export const initialTownPlannerV2State: TownPlannerV2State = {
  addressQuery: '',
  status: 'idle',
  error: null,
  selected: null,
};
