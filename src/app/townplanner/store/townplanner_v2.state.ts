export type TownPlannerV2Status = 'idle' | 'loading' | 'success' | 'error';
export type TownPlannerV2ReportStatus = 'idle' | 'running' | 'ready' | 'failed';

export type GeoJsonGeometry = {
  type: string;
  coordinates: any;
};

export type TownPlannerV2OverlayMeta = {
  name: string;
  code?: string | null;
  severity?: string | null;
  description?: string | null;
};

export type TownPlannerV2OverlayGeometry = {
  code?: string | null;
  name?: string | null;
  geometry?: GeoJsonGeometry | null;
  polygon?: GeoJsonGeometry | null;
};

export type TownPlannerV2PlanningPayload = {
  zoning?: string | null;
  zoningName?: string | null;
  zoningCode?: string | null;
  neighbourhoodPlan?: string | null;
  neighbourhoodPlanPrecinct?: string | null;
  neighbourhoodPlanPrecinctCode?: string | null;

  // Map-ready geometries (GeoJSON in EPSG:4326)
  siteParcelPolygon?:
    | { geometry?: GeoJsonGeometry | null }
    | GeoJsonGeometry
    | null;
  zoningPolygon?:
    | { geometry?: GeoJsonGeometry | null }
    | GeoJsonGeometry
    | null;

  overlayPolygons?: TownPlannerV2OverlayGeometry[] | null;
  overlayPolylines?: TownPlannerV2OverlayGeometry[] | null;

  // Human readable overlay list
  overlays?: TownPlannerV2OverlayMeta[] | null;

  // Optional parcel metadata (if provided by backend)
  propertyParcel?: {
    properties?: Record<string, any> | null;
    geometry?: GeoJsonGeometry | null;
    debug?: {
      areaM2?: number | null;
      area_m2?: number | null;
      [k: string]: any;
    } | null;
  } | null;
};

export interface TownPlannerV2AddressSuggestion {
  description: string;
  placeId: string;
}

export interface TownPlannerV2PropertyResult {
  address?: string;
  formattedAddress?: string | null;
  addressLabel?: string;
  placeId?: string;

  lat?: number;
  lng?: number;

  // Option A: enriched place-details (optional)
  planning?: TownPlannerV2PlanningPayload | null;
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

  // Report generation
  reportStatus: TownPlannerV2ReportStatus;
  reportRequested: boolean;
  reportToken: string | null;
  reportPdfUrl: string | null;
  reportError: string | null;
}

export const initialTownPlannerV2State: TownPlannerV2State = {
  addressQuery: '',
  sessionToken: null,

  suggestions: [],
  suggestionsStatus: 'idle',

  status: 'idle',
  error: null,
  selected: null,

  reportStatus: 'idle',
  reportRequested: false,
  reportToken: null,
  reportPdfUrl: null,
  reportError: null,
};
