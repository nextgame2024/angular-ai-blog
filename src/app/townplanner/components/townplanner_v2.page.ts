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
} from '../store/townplanner_v2.selectors';
import { GoogleMapsLoaderService } from '../services/google-maps-loader.service';
import { TownPlannerV2AddressSuggestion } from '../store/townplanner_v2.state';

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

  // Small inline placeholder (prevents broken-image icon when photo is unavailable)
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
  loading$ = this.status$.pipe(map((s) => s === 'loading'));
  error$ = this.store.select(selectError);
  selected$ = this.store.select(selectSelected);

  suggestions$ = this.store.select(selectSuggestions);
  private suggestionsSnapshot: TownPlannerV2AddressSuggestion[] = [];
  showSuggestions = false;
  activeIndex = -1;

  // Per Google Places best practice: one token per autocomplete session
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
  polygonPaths: google.maps.LatLngLiteral[] = [];

  // Default polygon styling (kept minimal; no explicit colors to avoid clashing with map theme)
  polygonOptions: google.maps.PolygonOptions = {
    clickable: false,
    draggable: false,
    editable: false,
    geodesic: true,
    strokeOpacity: 1,
    strokeWeight: 2,
    fillOpacity: 0.15,
  };

  constructor(
    private store: Store,
    private mapsLoader: GoogleMapsLoaderService
  ) {}

  ngOnInit(): void {
    this.updateIsMobile();

    // Resolve key once for Street View photo previews
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

    // Keep input synced with store query
    this.store
      .select(selectAddressQuery)
      .pipe(takeUntil(this.destroy$))
      .subscribe((q) =>
        this.addressCtrl.setValue(q || '', { emitEvent: false })
      );

    // suggestions snapshot for keyboard selection
    this.suggestions$.pipe(takeUntil(this.destroy$)).subscribe((sugs) => {
      this.suggestionsSnapshot = sugs || [];
      this.activeIndex = this.suggestionsSnapshot.length
        ? Math.min(this.activeIndex, this.suggestionsSnapshot.length - 1)
        : -1;
    });

    // Dispatch query changes (debounced)
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

    // Update map when selected changes
    this.selected$.pipe(takeUntil(this.destroy$)).subscribe((selected) => {
      if (!selected) {
        this.markerPosition = null;
        this.polygonPaths = [];
        return;
      }

      const lat = selected.lat ?? selected.centroid?.lat;
      const lng = selected.lng ?? selected.centroid?.lng;

      if (typeof lat === 'number' && typeof lng === 'number') {
        this.markerPosition = { lat, lng };
        this.mapCenter = { lat, lng };
        this.mapZoom = 18;
      }

      this.polygonPaths = this.geoJsonToPaths(selected.geometry);
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
    // New autocomplete session
    if (!this.sessionToken) {
      this.sessionToken =
        globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    }
    this.showSuggestions = true;
  }

  onInputBlur(): void {
    // Allow click to register before hiding
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
    // mousedown fires before blur; good for selection
    this.selectSuggestion(s);
  }

  private selectSuggestion(s: TownPlannerV2AddressSuggestion): void {
    this.store.dispatch(
      TownPlannerV2Actions.selectSuggestion({
        suggestion: s,
        sessionToken: this.sessionToken,
      })
    );

    // End session after place details is requested (Google best practice)
    this.sessionToken = null;

    this.showSuggestions = false;
    this.activeIndex = -1;
  }

  clear(): void {
    this.store.dispatch(TownPlannerV2Actions.clear());
  }

  private geoJsonToPaths(geom: any): google.maps.LatLngLiteral[] {
    try {
      if (!geom) return [];

      const type = String(geom.type || '').toLowerCase();
      const coords = geom.coordinates;

      const ring =
        type === 'polygon'
          ? coords?.[0]
          : type === 'multipolygon'
          ? coords?.[0]?.[0]
          : null;

      if (!Array.isArray(ring)) return [];

      return ring
        .filter((p: any) => Array.isArray(p) && p.length >= 2)
        .map((p: any) => ({ lng: Number(p[0]), lat: Number(p[1]) }))
        .filter((p: any) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    } catch {
      return [];
    }
  }

  streetViewPhotoUrl(selected: any): string {
    // Prefer a backend-provided URL if present in the future
    const explicit = (selected as any)?.photoUrl;
    if (typeof explicit === 'string' && explicit.trim()) return explicit;

    const lat = (selected as any)?.lat ?? (selected as any)?.centroid?.lat;
    const lng = (selected as any)?.lng ?? (selected as any)?.centroid?.lng;

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
    // Street View Static API preview image
    return `https://maps.googleapis.com/maps/api/streetview?size=640x360&location=${loc}&fov=80&pitch=0&key=${key}`;
  }

  onPhotoError(ev: Event): void {
    const img = ev.target as HTMLImageElement | null;
    if (!img) return;

    // Prevent infinite error loops
    if (img.src === this.photoFallbackSrc) return;
    img.src = this.photoFallbackSrc;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
