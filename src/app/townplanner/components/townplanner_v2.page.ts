import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { GoogleMapsModule } from '@angular/google-maps';
import { Store } from '@ngrx/store';
import { Subject } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  map,
  startWith,
  takeUntil,
} from 'rxjs/operators';

import { TownPlannerV2Actions } from '../store/townplanner_v2.actions';
import {
  selectAddressQuery,
  selectError,
  selectSelected,
  selectStatus,
  selectSuggestions,
  selectTownPlannerV2Loading,
  selectReportGenerating,
  selectReportError,
} from '../store/townplanner_v2.selectors';
import { GoogleMapsLoaderService } from '../services/google-maps-loader.service';
import { TownPlannerV2AddressSuggestion } from '../store/townplanner_v2.state';
import {
  GeoJsonGeometry,
  TownPlannerV2PlanningPayload,
} from '../store/townplanner_v2.state';

type LngLatTuple = [number, number];

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

interface PropertyOverviewRow {
  label: string;
  value: string;
}

@Component({
  selector: 'app-townplanner-v2-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, GoogleMapsModule],
  templateUrl: './townplanner_v2.page.html',
  styleUrls: ['./townplanner_v2.page.css'],
})
export class TownPlannerV2PageComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  mapsLoaded = false;
  mapsError: string | null = null;
  private mapsApiKey: string | null = null;

  private readonly photoFallbackSrc =
    'data:image/svg+xml;charset=utf-8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360">
        <rect width="100%" height="100%" fill="#e2e8f0"/>
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#334155" font-family="Arial" font-size="22">
          No preview available
        </text>
      </svg>`
    );

  isMobile = false;
  panelCollapsed = false;

  addressCtrl = new FormControl<string>('', { nonNullable: true });

  status$ = this.store.select(selectStatus);

  // IMPORTANT: use unified loading selector so overlay appears for both:
  // - place details loading
  // - report generation
  loading$ = this.store.select(selectTownPlannerV2Loading);

  error$ = this.store.select(selectError);
  selected$ = this.store.select(selectSelected);

  reportGenerating$ = this.store.select(selectReportGenerating);
  reportError$ = this.store.select(selectReportError);

  suggestions$ = this.store.select(selectSuggestions);
  private suggestionsSnapshot: TownPlannerV2AddressSuggestion[] = [];
  showSuggestions = false;
  activeIndex = -1;

  private sessionToken: string | null = null;

  mapCenter: google.maps.LatLngLiteral = { lat: -27.4698, lng: 153.0251 };
  mapZoom = 11;

  mapOptions: google.maps.MapOptions = {
    clickableIcons: false,
    disableDefaultUI: false,
    fullscreenControl: false,
    streetViewControl: false,
    mapTypeControl: false,
  };

  markerPosition: google.maps.LatLngLiteral | null = null;

  siteParcelPath: google.maps.LatLngLiteral[] = [];
  zoningPolygonPath: google.maps.LatLngLiteral[] = [];
  overlayPolygonPaths: OverlayPolygonPath[] = [];
  overlayPolylinePaths: OverlayPolylinePath[] = [];

  siteParcelOptions: google.maps.PolygonOptions = {
    strokeColor: '#22c55e',
    strokeWeight: 2,
    strokeOpacity: 1,
    fillOpacity: 0,
  };

  zoningPolygonOptions: google.maps.PolygonOptions = {
    strokeColor: '#38bdf8',
    strokeOpacity: 0.9,
    strokeWeight: 2,
    fillColor: '#0ea5e9',
    fillOpacity: 0.05,
  };

  constructor(
    private store: Store,
    private mapsLoader: GoogleMapsLoaderService
  ) {}

  ngOnInit(): void {
    this.updateIsMobile();

    this.mapsLoader
      .getApiKey()
      .then((k) => (this.mapsApiKey = k))
      .catch(() => (this.mapsApiKey = null));

    this.mapsLoader
      .load()
      .then(() => (this.mapsLoaded = true))
      .catch((e) => {
        this.mapsLoaded = false;
        this.mapsError = e?.message || 'Google Maps failed to load';
      });

    this.store
      .select(selectAddressQuery)
      .pipe(takeUntil(this.destroy$))
      .subscribe((q) =>
        this.addressCtrl.setValue(q || '', { emitEvent: false })
      );

    this.suggestions$.pipe(takeUntil(this.destroy$)).subscribe((sugs) => {
      this.suggestionsSnapshot = sugs || [];
      this.activeIndex = this.suggestionsSnapshot.length
        ? Math.min(this.activeIndex, this.suggestionsSnapshot.length - 1)
        : -1;
    });

    this.addressCtrl.valueChanges
      .pipe(
        startWith(this.addressCtrl.value),
        debounceTime(200),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe((q) => {
        const query = (q || '').toString();
        this.store.dispatch(
          TownPlannerV2Actions.setAddressQuery({
            query,
            sessionToken: this.sessionToken,
          })
        );
      });

    this.selected$.pipe(takeUntil(this.destroy$)).subscribe((selected) => {
      if (!selected) {
        this.markerPosition = null;
        this.clearMapLayers();
        return;
      }

      const lat = (selected as any).lat;
      const lng = (selected as any).lng;

      if (typeof lat === 'number' && typeof lng === 'number') {
        this.markerPosition = { lat, lng };
        this.mapCenter = { lat, lng };
        this.mapZoom = 18;
      } else {
        this.markerPosition = null;
      }

      const planning: TownPlannerV2PlanningPayload | null =
        (selected as any).planning ?? null;

      if (planning) {
        this.configureMapFromPlanning(planning);
      } else {
        this.clearMapLayers();
      }
    });
  }

  @HostListener('window:resize')
  onResize(): void {
    this.updateIsMobile();
  }

  private updateIsMobile(): void {
    this.isMobile = window.matchMedia('(max-width: 768px)').matches;
  }

  togglePanel(): void {
    this.panelCollapsed = !this.panelCollapsed;
  }

  panelArrow(): string {
    if (!this.isMobile) return this.panelCollapsed ? '>' : '<';
    return this.panelCollapsed ? '^' : 'v';
  }

  onInputFocus(): void {
    if (!this.sessionToken) {
      this.sessionToken =
        globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    }
    this.showSuggestions = true;
  }

  onInputBlur(): void {
    setTimeout(() => (this.showSuggestions = false), 150);
  }

  onInputKeydown(ev: KeyboardEvent): void {
    if (!this.showSuggestions || !this.suggestionsSnapshot.length) return;

    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      this.activeIndex = Math.min(
        this.activeIndex + 1,
        this.suggestionsSnapshot.length - 1
      );
      return;
    }

    if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      this.activeIndex = Math.max(this.activeIndex - 1, 0);
      return;
    }

    if (ev.key === 'Enter') {
      if (
        this.activeIndex >= 0 &&
        this.activeIndex < this.suggestionsSnapshot.length
      ) {
        ev.preventDefault();
        this.selectSuggestion(this.suggestionsSnapshot[this.activeIndex]);
      }
    }

    if (ev.key === 'Escape') {
      this.showSuggestions = false;
    }
  }

  onSuggestionMouseDown(s: TownPlannerV2AddressSuggestion): void {
    this.selectSuggestion(s);
  }

  private selectSuggestion(s: TownPlannerV2AddressSuggestion): void {
    this.store.dispatch(
      TownPlannerV2Actions.selectSuggestion({
        suggestion: s,
        sessionToken: this.sessionToken,
      })
    );

    this.sessionToken = null;

    this.showSuggestions = false;
    this.activeIndex = -1;
  }

  clear(): void {
    this.store.dispatch(TownPlannerV2Actions.clear());
  }

  onGenerateReport(): void {
    this.store.dispatch(TownPlannerV2Actions.generateReport());
  }

  canGenerateReport(selected: any): boolean {
    const lat = (selected as any)?.lat;
    const lng = (selected as any)?.lng;
    const label =
      (selected as any)?.addressLabel ||
      (selected as any)?.address ||
      (selected as any)?.formattedAddress;

    return (
      typeof lat === 'number' &&
      typeof lng === 'number' &&
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      typeof label === 'string' &&
      !!label.trim()
    );
  }

  propertyOverviewRows(selected: any): PropertyOverviewRow[] {
    const planning = (selected as any)?.planning ?? null;
    if (!planning || typeof planning !== 'object') return [];

    const zoning =
      (planning as any)?.zoning ||
      (planning as any)?.zoningName ||
      (planning as any)?.zoningCode ||
      null;
    const neighbourhoodPlan = (planning as any)?.neighbourhoodPlan || null;
    const precinct = (planning as any)?.neighbourhoodPlanPrecinct || null;
    const overlays = Array.isArray((planning as any)?.overlays)
      ? (planning as any).overlays
      : [];

    const parcelDebug = (planning as any)?.propertyParcel?.debug ?? null;
    const areaM2Raw =
      (parcelDebug as any)?.areaM2 ?? (parcelDebug as any)?.area_m2 ?? null;
    const areaM2 = Number(areaM2Raw);
    const areaLabel =
      Number.isFinite(areaM2) && areaM2 > 0
        ? `${Math.round(areaM2).toLocaleString('en-AU')} m²`
        : null;

    const lotPlan = this.extractLotPlan((planning as any)?.propertyParcel);

    const rows: PropertyOverviewRow[] = [];
    if (zoning) rows.push({ label: 'Zoning', value: String(zoning) });
    if (neighbourhoodPlan) {
      rows.push({ label: 'Neighbourhood plan', value: String(neighbourhoodPlan) });
    }
    if (precinct) rows.push({ label: 'Precinct', value: String(precinct) });
    if (lotPlan) rows.push({ label: 'Lot/Plan', value: lotPlan });
    if (areaLabel) rows.push({ label: 'Site area (approx.)', value: areaLabel });

    rows.push({
      label: 'Overlay count',
      value: String(overlays.length),
    });

    return rows;
  }

  private extractLotPlan(parcel: any): string | null {
    const props = parcel?.properties;
    if (!props || typeof props !== 'object') return null;

    const pick = (keys: string[]): string | null => {
      for (const key of keys) {
        const direct = (props as any)[key];
        if (direct !== undefined && direct !== null && String(direct).trim()) {
          return String(direct).trim();
        }
        const hit = Object.keys(props).find(
          (k) => String(k || '').toLowerCase() === key.toLowerCase()
        );
        if (hit) {
          const v = (props as any)[hit];
          if (v !== undefined && v !== null && String(v).trim()) {
            return String(v).trim();
          }
        }
      }
      return null;
    };

    const lot = pick(['lot', 'lot_number', 'lot_no', 'lotnum', 'lotno']);
    const plan = pick(['plan', 'plan_number', 'plan_no', 'planno']);
    const lotPlan =
      pick([
        'lot_plan',
        'lotplan',
        'lot_plan_desc',
        'lotplan_desc',
        'lot_plan_number',
        'lotplan_number',
      ]) || null;

    if (lot && plan) return `Lot ${lot} on ${plan}`;
    if (lotPlan) return lotPlan;
    if (lot) return `Lot ${lot}`;
    if (plan) return `Plan ${plan}`;
    return null;
  }

  hasMapLayers(): boolean {
    return (
      !!this.siteParcelPath.length ||
      !!this.zoningPolygonPath.length ||
      !!this.overlayPolygonPaths.length ||
      !!this.overlayPolylinePaths.length
    );
  }

  private clearMapLayers(): void {
    this.siteParcelPath = [];
    this.zoningPolygonPath = [];
    this.overlayPolygonPaths = [];
    this.overlayPolylinePaths = [];
  }

  private configureMapFromPlanning(
    planning: TownPlannerV2PlanningPayload
  ): void {
    const focus = this.markerPosition ?? undefined;

    const parcelGeom = this.extractGeometry(planning.siteParcelPolygon);
    this.siteParcelPath = parcelGeom
      ? this.toSinglePolygonPath(parcelGeom, focus)
      : [];

    const zoningGeom = this.extractGeometry(planning.zoningPolygon);
    this.zoningPolygonPath = zoningGeom
      ? this.toSinglePolygonPath(zoningGeom, focus)
      : [];

    const polyPaths: OverlayPolygonPath[] = [];
    const linePaths: OverlayPolylinePath[] = [];

    const rawOverlays = Array.isArray(planning.overlayPolygons)
      ? planning.overlayPolygons
      : [];

    for (const ov of rawOverlays) {
      const code = String((ov as any)?.code ?? (ov as any)?.name ?? 'overlay');
      const geom = this.extractGeometry(
        (ov as any)?.geometry ?? (ov as any)?.polygon ?? ov
      );
      if (!geom?.type || !geom?.coordinates) continue;

      if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
        const path = this.toSinglePolygonPath(geom, focus);
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

    this.overlayPolygonPaths = polyPaths;
    this.overlayPolylinePaths = linePaths;

    if (!this.markerPosition) {
      const centroid = parcelGeom ? this.computeCentroid(parcelGeom) : null;
      if (centroid) {
        this.markerPosition = centroid;
        this.mapCenter = centroid;
        this.mapZoom = 18;
      }
    }
  }

  private extractGeometry(maybe: any): GeoJsonGeometry | null {
    if (!maybe) return null;

    const candidate = (maybe as any)?.geometry ?? maybe;
    if (!candidate) return null;

    if (typeof candidate === 'object') return candidate as GeoJsonGeometry;
    if (typeof candidate === 'string') {
      try {
        return JSON.parse(candidate) as GeoJsonGeometry;
      } catch {
        return null;
      }
    }
    return null;
  }

  private toSinglePolygonPath(
    geometry: GeoJsonGeometry,
    focusPoint?: google.maps.LatLngLiteral
  ): google.maps.LatLngLiteral[] {
    if (!geometry || !geometry.type || !geometry.coordinates) return [];

    const type = geometry.type;
    const coords: any = geometry.coordinates;

    let ring: LngLatTuple[] | null = null;

    if (type === 'Polygon') {
      ring = (coords[0] || []) as LngLatTuple[];
    } else if (type === 'MultiPolygon') {
      const polygons: LngLatTuple[][] = (coords as any[]).map(
        (poly) => (poly?.[0] || []) as LngLatTuple[]
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
    return ring
      .filter((p) => Array.isArray(p) && p.length >= 2)
      .map(([lng, lat]) => ({ lat: Number(lat), lng: Number(lng) }))
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  }

  private toSingleLinePath(
    geometry: GeoJsonGeometry
  ): google.maps.LatLngLiteral[] {
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

    return line
      .filter((p) => Array.isArray(p) && p.length >= 2)
      .map(([lng, lat]) => ({ lat: Number(lat), lng: Number(lng) }))
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  }

  private computeCentroid(
    geometry: GeoJsonGeometry
  ): google.maps.LatLngLiteral | null {
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

  private getOverlayStyle(code?: string | null): google.maps.PolygonOptions {
    const base: google.maps.PolygonOptions = {
      strokeOpacity: 0.85,
      strokeWeight: 2,
      fillOpacity: 0.12,
    };

    if (!code) return { ...base, strokeColor: '#94a3b8', fillColor: '#94a3b8' };

    const c = code.toLowerCase();

    if (
      c.includes('flood') ||
      c.includes('overland') ||
      c.includes('inundation')
    ) {
      return {
        ...base,
        strokeColor: '#f97316',
        fillColor: '#f97316',
        fillOpacity: 0.16,
      };
    }

    if (c.includes('transport') || c.includes('noise')) {
      return {
        ...base,
        strokeColor: '#a855f7',
        fillColor: '#a855f7',
        fillOpacity: 0.14,
      };
    }

    return {
      ...base,
      strokeColor: '#94a3b8',
      fillColor: '#94a3b8',
      fillOpacity: 0.1,
    };
  }

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

    if (
      c.includes('flood') ||
      c.includes('overland') ||
      c.includes('inundation')
    ) {
      return { ...base, strokeColor: '#f97316' };
    }

    return { ...base, strokeColor: '#94a3b8' };
  }

  streetViewPhotoUrl(selected: any): string {
    const explicit = (selected as any)?.photoUrl;
    if (typeof explicit === 'string' && explicit.trim()) return explicit;

    const lat = (selected as any)?.lat;
    const lng = (selected as any)?.lng;

    if (
      typeof lat !== 'number' ||
      typeof lng !== 'number' ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      !this.mapsApiKey
    ) {
      return this.photoFallbackSrc;
    }

    const loc = encodeURIComponent(`${lat},${lng}`);
    const key = encodeURIComponent(this.mapsApiKey);
    return `https://maps.googleapis.com/maps/api/streetview?size=640x360&location=${loc}&fov=80&pitch=0&key=${key}`;
  }

  onPhotoError(ev: Event): void {
    const img = ev.target as HTMLImageElement | null;
    if (!img) return;

    if (img.src === this.photoFallbackSrc) return;
    img.src = this.photoFallbackSrc;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
