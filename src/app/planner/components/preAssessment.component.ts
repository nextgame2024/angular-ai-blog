// src/app/planner/components/preAssessment.component.ts

import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GoogleMapsModule } from '@angular/google-maps';
import { Store } from '@ngrx/store';
import { Observable, Subject, takeUntil } from 'rxjs';

import {
  PlannerState,
  SiteDetails,
  ProposalDetails,
  PreAssessmentResult,
} from '../types/preAssessmentState.interface';
import * as PlannerActions from '../store/actions';
import { GoogleMapsLoaderService } from '../../townplanner/services/google-maps-loader.service';

interface OverlayPolygonPath {
  code: string;
  path: google.maps.LatLngLiteral[];
  style: google.maps.PolygonOptions;
}

interface OverlayPolylinePath {
  code: string;
  path: google.maps.LatLngLiteral[];
  style: google.maps.PolylineOptions;
}

type LngLatTuple = [number, number];

@Component({
  standalone: true,
  selector: 'app-pre-assessment',
  imports: [CommonModule, FormsModule, GoogleMapsModule],
  templateUrl: './preAssessment.component.html',
  styleUrls: ['./preAssessment.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PreAssessmentComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  /** Use this in template: *ngIf="mapsReady" around <google-map> */
  mapsReady = false;

  // ---- FORM STATE ---------------------------------------------------------

  site: SiteDetails = {
    address: '',
    lotPlan: null,
    siteArea: null,
    frontage: null,
    cornerLot: null,
  };

  proposal: ProposalDetails = {
    purpose: '',
    lengthM: null,
    widthM: null,
    heightRidgeM: null,
    heightWallM: null,
    materials: '',
    stormwater: '',
    earthworks: '',
    existingBuildingsAffected: null,
    replacement: null,
    setbacks: {
      front: null,
      side1: null,
      side2: null,
      rear: null,
    },
  };

  // ---- STORE STATE --------------------------------------------------------

  loading$: Observable<boolean>;
  error$: Observable<string | null>;
  result$: Observable<PreAssessmentResult | null>;

  // ---- UI STATE -----------------------------------------------------------

  mapCenter: google.maps.LatLngLiteral | null = null;
  mapOptions: google.maps.MapOptions = {
    zoom: 18,
    mapTypeId: 'hybrid',
    disableDefaultUI: true,
    gestureHandling: 'greedy',
  };

  // Map layers
  siteParcelPath: google.maps.LatLngLiteral[] = [];
  zoningPolygonPath: google.maps.LatLngLiteral[] = [];
  overlayPolygonPaths: OverlayPolygonPath[] = [];
  overlayPolylinePaths: OverlayPolylinePath[] = [];

  siteParcelOptions: google.maps.PolygonOptions = {
    strokeColor: '#22c55e', // green – property boundary
    strokeWeight: 2,
    strokeOpacity: 1,
    fillOpacity: 0,
  };

  zoningPolygonOptions: google.maps.PolygonOptions = {
    strokeColor: '#38bdf8', // blue – zoning for subject site
    strokeOpacity: 0.9,
    strokeWeight: 2,
    fillColor: '#0ea5e9',
    fillOpacity: 0.05,
  };

  nextSteps: string[] = [];

  constructor(
    private store: Store<{ planner: PlannerState }>,
    private mapsLoader: GoogleMapsLoaderService,
    private cdr: ChangeDetectorRef
  ) {
    this.loading$ = this.store.select((s) => s.planner.loading);
    this.error$ = this.store.select((s) => s.planner.error);
    this.result$ = this.store.select((s) => s.planner.result);
  }

  async ngOnInit(): Promise<void> {
    // Load Google Maps JS API dynamically (runtime-config.json + injected env var on Amplify)
    try {
      await this.mapsLoader.load();
      this.mapsReady = true;
    } catch (err) {
      console.error('[planner] Failed to load Google Maps:', err);
      this.mapsReady = false;
    } finally {
      // OnPush: ensure template re-checks and <google-map> can render
      this.cdr.markForCheck();
    }

    // React to result changes (configure map layers, next steps)
    this.result$
      .pipe(takeUntil(this.destroy$))
      .subscribe((result: PreAssessmentResult | null) => {
        if (result) {
          this.configureMap(result);
          this.buildNextSteps(result.classification);
        } else {
          this.clearMapLayers();
        }
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ---- UI HANDLERS --------------------------------------------------------

  generateSummary(): void {
    if (!this.site.address?.trim()) return;
    const siteSnapshot = structuredClone(this.site);
    const proposalSnapshot = structuredClone(this.proposal);

    this.store.dispatch(
      PlannerActions.createPreAssessmentAction({
        site: siteSnapshot,
        proposal: proposalSnapshot,
      })
    );
  }

  downloadPdf(result: PreAssessmentResult | null): void {
    if (result?.pdfUrl) {
      window.open(result.pdfUrl, '_blank');
    }
  }

  // ---- MAP SETUP ----------------------------------------------------------

  private clearMapLayers(): void {
    this.mapCenter = null;
    this.siteParcelPath = [];
    this.zoningPolygonPath = [];
    this.overlayPolygonPaths = [];
    this.overlayPolylinePaths = [];
    this.nextSteps = [];
  }

  private configureMap(result: PreAssessmentResult): void {
    const pd: any = result.planningData || {};

    // 1. Work out the focus point for all geometries
    const geocode = pd.geocode;
    let focusPoint: google.maps.LatLngLiteral | undefined;

    if (geocode?.lat && geocode?.lng) {
      focusPoint = { lat: geocode.lat, lng: geocode.lng };
      this.mapCenter = { ...focusPoint };
    } else if (pd.siteParcelPolygon) {
      const parcelGeom = this.normalizeGeometry(
        pd.siteParcelPolygon.geometry || pd.siteParcelPolygon
      );
      const centroid = parcelGeom ? this.computeCentroid(parcelGeom) : null;
      if (centroid) {
        focusPoint = centroid;
        this.mapCenter = centroid;
      } else {
        this.mapCenter = null;
      }
    } else {
      this.mapCenter = null;
    }

    const fp = focusPoint ?? this.mapCenter ?? undefined;

    // 2. Site parcel (property boundary)
    if (pd.siteParcelPolygon) {
      const geom = this.normalizeGeometry(
        pd.siteParcelPolygon.geometry || pd.siteParcelPolygon
      );
      this.siteParcelPath = geom ? this.toSinglePolygonPath(geom, fp) : [];
    } else {
      this.siteParcelPath = [];
    }

    // 3. Zoning polygon
    if (pd.zoningPolygon) {
      const geom = this.normalizeGeometry(
        pd.zoningPolygon.geometry || pd.zoningPolygon
      );
      this.zoningPolygonPath = geom ? this.toSinglePolygonPath(geom, fp) : [];
    } else {
      this.zoningPolygonPath = [];
    }

    // 4. Overlays: polygon + line support
    const polyPaths: OverlayPolygonPath[] = [];
    const linePaths: OverlayPolylinePath[] = [];

    if (Array.isArray(pd.overlayPolygons)) {
      for (const ov of pd.overlayPolygons) {
        const code = (ov?.code ?? ov?.name ?? '').toString();
        const rawGeom = ov?.geometry || ov?.polygon || ov;
        const geom = this.normalizeGeometry(rawGeom);
        if (!geom?.type || !geom?.coordinates) continue;

        if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
          const path = this.toSinglePolygonPath(geom, fp);
          if (!path.length) continue;
          polyPaths.push({ code, path, style: this.getOverlayStyle(code) });
          continue;
        }

        if (geom.type === 'LineString' || geom.type === 'MultiLineString') {
          const path = this.toSingleLinePath(geom);
          if (!path.length) continue;
          linePaths.push({ code, path, style: this.getOverlayLineStyle(code) });
          continue;
        }
      }
    }

    this.overlayPolygonPaths = polyPaths;
    this.overlayPolylinePaths = linePaths;
  }

  private normalizeGeometry(maybe: any): any | null {
    if (!maybe) return null;
    if (typeof maybe === 'object') return maybe;
    if (typeof maybe === 'string') {
      try {
        return JSON.parse(maybe);
      } catch {
        return null;
      }
    }
    return null;
  }

  private toSinglePolygonPath(
    geometry: any,
    focusPoint?: google.maps.LatLngLiteral
  ): google.maps.LatLngLiteral[] {
    if (!geometry || !geometry.type || !geometry.coordinates) return [];

    const type = geometry.type;
    const coords = geometry.coordinates;

    let ring: LngLatTuple[] | null = null;

    if (type === 'Polygon') {
      ring = (coords[0] || []) as LngLatTuple[];
    } else if (type === 'MultiPolygon') {
      const polygons: LngLatTuple[][] = (coords as any[]).map(
        (poly) => poly[0] as LngLatTuple[]
      );

      if (!polygons.length) return [];

      if (focusPoint) {
        let bestRing: LngLatTuple[] | null = null;
        let bestArea = Number.POSITIVE_INFINITY;

        for (const candidate of polygons) {
          if (!candidate || candidate.length < 3) continue;
          if (this.isPointInRing(focusPoint, candidate)) {
            const area = this.ringArea(candidate);
            if (area < bestArea) {
              bestArea = area;
              bestRing = candidate;
            }
          }
        }

        if (bestRing) {
          ring = bestRing;
        } else {
          let nearest: LngLatTuple[] | null = null;
          let nearestDist = Number.POSITIVE_INFINITY;
          let nearestArea = Number.POSITIVE_INFINITY;

          for (const candidate of polygons) {
            if (!candidate || candidate.length < 3) continue;
            const c = this.ringCentroid(candidate);
            const d = this.haversineMeters(focusPoint, c);
            const a = this.ringArea(candidate);

            if (
              d < nearestDist - 0.01 ||
              (Math.abs(d - nearestDist) < 0.01 && a < nearestArea)
            ) {
              nearestDist = d;
              nearestArea = a;
              nearest = candidate;
            }
          }

          ring = nearest || polygons[0] || null;
        }
      } else {
        ring = polygons[0] || null;
      }
    } else {
      return [];
    }

    if (!ring) return [];
    return ring.map(([lng, lat]) => ({ lat, lng }));
  }

  private toSingleLinePath(geometry: any): google.maps.LatLngLiteral[] {
    if (!geometry || !geometry.type || !geometry.coordinates) return [];

    let line: LngLatTuple[] | null = null;

    if (geometry.type === 'LineString') {
      line = geometry.coordinates as LngLatTuple[];
    } else if (geometry.type === 'MultiLineString') {
      const lines = geometry.coordinates as LngLatTuple[][];
      if (!lines?.length) return [];
      line = lines.reduce(
        (best, cur) => (cur.length > best.length ? cur : best),
        lines[0]
      );
    }

    if (!line?.length) return [];
    return line.map(([lng, lat]) => ({ lat, lng }));
  }

  private computeCentroid(geometry: any): google.maps.LatLngLiteral | null {
    const path = this.toSinglePolygonPath(geometry);
    if (!path.length) return null;

    const sum = path.reduce(
      (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
      { lat: 0, lng: 0 }
    );

    return {
      lat: sum.lat / path.length,
      lng: sum.lng / path.length,
    };
  }

  // ---- GEOMETRY HELPERS ---------------------------------------------------

  private isPointInRing(
    point: google.maps.LatLngLiteral,
    ring: LngLatTuple[]
  ): boolean {
    let inside = false;
    const x = point.lng;
    const y = point.lat;

    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];

      const intersect =
        yi > y !== yj > y &&
        x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-12) + xi;

      if (intersect) inside = !inside;
    }

    return inside;
  }

  private ringArea(ring: LngLatTuple[]): number {
    let sum = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [x1, y1] = ring[j];
      const [x2, y2] = ring[i];
      sum += x1 * y2 - x2 * y1;
    }
    return Math.abs(sum) / 2;
  }

  private ringCentroid(ring: LngLatTuple[]): google.maps.LatLngLiteral {
    let latSum = 0;
    let lngSum = 0;
    let n = 0;
    for (const [lng, lat] of ring) {
      lngSum += lng;
      latSum += lat;
      n += 1;
    }
    return { lat: n ? latSum / n : 0, lng: n ? lngSum / n : 0 };
  }

  private haversineMeters(
    a: google.maps.LatLngLiteral,
    b: google.maps.LatLngLiteral
  ): number {
    const R = 6371000;
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);

    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);

    const h =
      sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;

    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  // ---- NEXT STEPS ---------------------------------------------------------

  private buildNextSteps(
    classification?: PreAssessmentResult['classification']
  ): void {
    const steps: string[] = [];

    if (!classification) {
      steps.push('Check your site and proposal details and re-run assessment.');
      this.nextSteps = steps;
      return;
    }

    const level = (classification.assessmentLevel || '').toLowerCase();

    if (level.includes('accepted')) {
      steps.push(
        'Confirm compliance with Dwelling house code and relevant overlay codes.'
      );
      steps.push('Engage a building certifier to obtain building approval.');
    } else if (level.includes('code')) {
      steps.push(
        'Prepare a code assessable development application with plans and a planning report.'
      );
      steps.push(
        'Lodge the DA via Brisbane City Council’s Development Services portal.'
      );
    } else if (level.includes('impact')) {
      steps.push(
        'Engage a town planner to prepare an impact assessable development application.'
      );
      steps.push(
        'Consider pre-lodgement advice with Council and prepare for public notification.'
      );
    } else {
      steps.push(
        'The assessment level is unclear. Seek advice from a town planner experienced in Brisbane City Plan.'
      );
    }

    steps.push(
      'After DA approval (if required), obtain building and plumbing approvals before construction.'
    );

    this.nextSteps = steps;
  }

  // ---- OVERLAY STYLING ----------------------------------------------------

  private getOverlayLineStyle(
    code?: string | null
  ): google.maps.PolylineOptions {
    const base: google.maps.PolylineOptions = {
      strokeOpacity: 0.9,
      strokeWeight: 3,
    };

    if (!code) return { ...base, strokeColor: '#6b7280' };

    const c = code.toLowerCase();
    if (c.includes('transport') || c.includes('noise')) {
      return { ...base, strokeColor: '#a855f7' };
    }
    return { ...base, strokeColor: '#94a3b8' };
  }

  private getOverlayStyle(code?: string | null): google.maps.PolygonOptions {
    const base: google.maps.PolygonOptions = {
      strokeOpacity: 0.9,
      strokeWeight: 1.5,
      fillOpacity: 0.25,
    };

    if (!code) {
      return { ...base, strokeColor: '#6b7280', fillColor: '#6b7280' };
    }

    const c = code.toLowerCase();

    if (c.includes('flood')) {
      return { ...base, strokeColor: '#f97316', fillColor: '#fb923c' };
    }

    if (c.includes('overland')) {
      return { ...base, strokeColor: '#f97316', fillColor: '#fed7aa' };
    }

    if (c.includes('transport') || c.includes('noise')) {
      return { ...base, strokeColor: '#a855f7', fillColor: '#c084fc' };
    }

    if (c.includes('heritage') || c.includes('character')) {
      return { ...base, strokeColor: '#0ea5e9', fillColor: '#38bdf8' };
    }

    return { ...base, strokeColor: '#94a3b8', fillColor: '#94a3b8' };
  }
}
