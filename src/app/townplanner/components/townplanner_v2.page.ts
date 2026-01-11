// src/app/townplanner/components/townplanner_v2.page.ts
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
} from '../store/townplanner_v2.selectors';
import { GoogleMapsLoaderService } from '../services/google-maps-loader.service';

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

  isMobile = false;
  panelCollapsed = false;

  addressCtrl = new FormControl<string>('', { nonNullable: true });

  status$ = this.store.select(selectStatus);
  loading$ = this.status$.pipe(map((s) => s === 'loading'));
  error$ = this.store.select(selectError);
  selected$ = this.store.select(selectSelected);

  // Map bindings
  mapCenter: google.maps.LatLngLiteral = { lat: -27.4698, lng: 153.0251 }; // Brisbane
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

  constructor(
    private store: Store,
    private mapsLoader: GoogleMapsLoaderService
  ) {}

  ngOnInit(): void {
    this.updateIsMobile();

    // Load Google Maps JS
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

    // Dispatch query changes
    this.addressCtrl.valueChanges
      .pipe(
        startWith(this.addressCtrl.value),
        debounceTime(200),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe((q) => {
        this.store.dispatch(
          TownPlannerV2Actions.setAddressQuery({ query: (q || '').toString() })
        );
      });

    // Update map when a result is selected
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
    // Desktop keeps < and >
    if (!this.isMobile) return this.panelCollapsed ? '>' : '<';

    // Mobile requested: close (open -> hidden) uses "v", reopen uses "^"
    return this.panelCollapsed ? '^' : 'v';
  }

  onSearchClick(): void {
    const address = (this.addressCtrl.value || '').trim();
    if (!address) return;

    this.store.dispatch(TownPlannerV2Actions.lookupProperty({ address }));

    // Optional: on mobile, collapse the panel to show more map after search
    // this.panelCollapsed = true;
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

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
