export type TownPlannerV2Status = 'idle' | 'loading' | 'success' | 'error';

export interface TownPlannerV2AddressSuggestion {
  description: string;
  placeId: string;
}

export interface TownPlannerV2PropertyResult {
  address?: string;
  placeId?: string;

  lat?: number;
  lng?: number;

  centroid?: { lat: number; lng: number };
  geometry?: any;

  [key: string]: any;
}

export type TownPlannerV2Result = TownPlannerV2PropertyResult;

export interface TownPlannerV2State {
  addressQuery: string;

  // Google session token for a single autocomplete session
  sessionToken: string | null;

  // Suggestions
  suggestions: TownPlannerV2AddressSuggestion[];
  suggestionsStatus: TownPlannerV2Status;

  // Selected place details
  status: TownPlannerV2Status;
  error: string | null;
  selected: TownPlannerV2PropertyResult | null;
}

export const initialTownPlannerV2State: TownPlannerV2State = {
  addressQuery: '',
  sessionToken: null,

  suggestions: [],
  suggestionsStatus: 'idle',

  status: 'idle',
  error: null,
  selected: null,
};
