export type TownPlannerV2Status = 'idle' | 'loading' | 'success' | 'error';

export interface TownPlannerV2PropertyResult {
  address?: string;

  lat?: number;
  lng?: number;

  centroid?: { lat: number; lng: number };

  geometry?: any;

  photoUrl?: string;

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
