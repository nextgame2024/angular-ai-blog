// src/app/planner/preAssessmentState.interface.ts

export interface SiteDetails {
  address: string;
  lotPlan?: string | null;
  siteArea?: number | null;
  frontage?: number | null;
  cornerLot?: boolean | null;
}

export interface Setbacks {
  front?: number | null;
  side1?: number | null;
  side2?: number | null;
  rear?: number | null;
}

export interface ProposalDetails {
  purpose?: string | null;
  lengthM?: number | null;
  widthM?: number | null;
  heightRidgeM?: number | null;
  heightWallM?: number | null;
  materials?: string | null;
  stormwater?: string | null;
  earthworks?: string | null;
  existingBuildingsAffected?: boolean | null;
  replacement?: boolean | null;
  setbacks?: Setbacks;
}

export interface OverlayInfo {
  name: string;
  code?: string | null;
  severity?: string | null;
  description?: string | null;
}

export interface GeocodeInfo {
  lat: number;
  lng: number;
  formattedAddress: string;
}

/**
 * Lightweight GeoJSON geometry as returned by the backend
 * (Polygon / MultiPolygon only for now).
 */
export interface GeoJsonGeometry {
  type: string;
  // We keep this loose to avoid over-typing Polygon vs MultiPolygon
  coordinates: any;
}

/**
 * Overlay polygon used for drawing on the map.
 * `code` matches OverlayInfo.code where applicable.
 */
export interface OverlayPolygon {
  code: string | null;
  geometry: GeoJsonGeometry;
}

export interface PlanningData {
  geocode: GeocodeInfo;

  zoning: string | null;
  zoningCode?: string | null;

  // Simplified zoning polygon for map display
  zoningPolygon?: GeoJsonGeometry | null;

  neighbourhoodPlan?: string | null;
  neighbourhoodPlanCode?: string | null;
  neighbourhoodPlanPrecinct?: string | null;
  neighbourhoodPlanPrecinctCode?: string | null;

  hasTransportNoiseCorridor?: boolean;

  // High-level overlay list used in the UI + PDF
  overlays: OverlayInfo[];

  // Simplified overlay polygons (flood, noise, etc.) for map display
  overlayPolygons?: OverlayPolygon[];

  // Raw debug fields (from backend) – keep them as any
  rawZoningFeature?: any;
  rawNeighbourhoodPlanBoundary?: any;
  rawNeighbourhoodPlanPrecinct?: any;
  rawFloodFeatures?: any[];
  rawTransportNoiseFeature?: any;
}

export interface SummarySection {
  title: string;
  body: string;
}

export interface ClassificationInfo {
  devType: string;
  assessmentLevel: string;
  reasoning: string;
}

export interface PreAssessmentResult {
  id: string;
  projectId: number | null;
  userId: string | null;
  pdfKey: string;
  pdfUrl: string;
  site: SiteDetails;
  proposal: ProposalDetails;
  planningData: PlanningData;
  summary: {
    sections: SummarySection[];
  };
  classification?: ClassificationInfo;
  createdAt: string;
}

export interface PlannerState {
  loading: boolean;
  error: string | null;
  result: PreAssessmentResult | null;
}
