// src/app/townplanner/components/townplanner_v2.page.ts

import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GoogleMapsModule } from '@angular/google-maps';
import { Store } from '@ngrx/store';
import { Subject, takeUntil } from 'rxjs';

import { TownPlannerV2Actions } from '../store/townplanner_v2.actions';
import {
  selectTownPlannerV2AddressQuery,
  selectTownPlannerV2Error,
  selectTownPlannerV2Loading,
  selectTownPlannerV2Result,
} from '../store/townplanner_v2.selectors';
import { TownPlannerV2PropertyResult } from '../store/townplanner_v2.state';

@Component({
  selector: 'app-townplanner-v2-page',
  standalone: true,
  imports: [CommonModule, FormsModule, GoogleMapsModule],
  templateUrl: './townplanner_v2.page.html',
  styleUrls: ['./townplanner_v2.page.css'],
})
export class TownPlannerV2PageComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // UI state
  panelCollapsed = false;

  // Form state (Angular 15 friendly)
  addressQuery = '';

  // Store state
  readonly loading$ = this.store.select(selectTownPlannerV2Loading);
  readonly error$ = this.store.select(selectTownPlannerV2Error);
  readonly selected$ = this.store.select(selectTownPlannerV2Result);
  readonly addressQuery$ = this.store.select(selectTownPlannerV2AddressQuery);

  // Map config
  mapWidth = '100%';
  mapHeight = '100%';

  mapCenter: google.maps.LatLngLiteral = { lat: -27.4705, lng: 153.026 }; // Brisbane
  mapZoom = 11;

  mapOptions: google.maps.MapOptions = {
    streetViewControl: false,
    fullscreenControl: false,
    mapTypeControl: false,
    clickableIcons: false,
  };

  polygonPaths: google.maps.LatLngLiteral[] = [];

  polygonOptions: google.maps.PolygonOptions = {
    strokeOpacity: 1,
    strokeWeight: 2,
    fillOpacity: 0.2,
    clickable: false,
  };

  constructor(private store: Store) {}

  ngOnInit(): void {
    // keep local field in sync
    this.addressQuery$
      .pipe(takeUntil(this.destroy$))
      .subscribe((q) => (this.addressQuery = (q || '').toString()));

    // update map when a property is selected
    this.selected$
      .pipe(takeUntil(this.destroy$))
      .subscribe((selected) => this.applySelectionToMap(selected));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  togglePanel(): void {
    this.panelCollapsed = !this.panelCollapsed;
  }

  onSearch(): void {
    const q = (this.addressQuery || '').trim();
    if (!q) return;

    this.store.dispatch(TownPlannerV2Actions.setAddressQuery({ query: q }));
    this.store.dispatch(TownPlannerV2Actions.lookupProperty({ address: q }));
  }

  private applySelectionToMap(
    selected: TownPlannerV2PropertyResult | null
  ): void {
    this.polygonPaths = [];

    if (!selected) return;

    const centroid =
      selected.centroid ||
      (typeof selected.lat === 'number' && typeof selected.lng === 'number'
        ? { lat: selected.lat, lng: selected.lng }
        : null);

    if (centroid) {
      this.mapCenter = { lat: centroid.lat, lng: centroid.lng };
      this.mapZoom = 18;
    }

    // Try to map GeoJSON Polygon/MultiPolygon to google polygon paths
    const geom = selected.geometry;
    const paths = this.geoJsonToPolygonPaths(geom);
    if (paths.length) {
      this.polygonPaths = paths;
    }
  }

  private geoJsonToPolygonPaths(geom: any): google.maps.LatLngLiteral[] {
    if (!geom) return [];

    // Accept:
    // - { type: 'Polygon', coordinates: [ [ [lng,lat], ... ] ] }
    // - { type: 'MultiPolygon', coordinates: [ [ [ [lng,lat], ... ] ] ] }
    try {
      if (geom.type === 'Polygon' && Array.isArray(geom.coordinates?.[0])) {
        return (geom.coordinates[0] as number[][]).map(([lng, lat]) => ({
          lat,
          lng,
        }));
      }

      if (
        geom.type === 'MultiPolygon' &&
        Array.isArray(geom.coordinates?.[0]?.[0])
      ) {
        // take first polygon outer ring for phase 1
        return (geom.coordinates[0][0] as number[][]).map(([lng, lat]) => ({
          lat,
          lng,
        }));
      }
    } catch {
      // ignore invalid geometry
    }

    return [];
  }
}
