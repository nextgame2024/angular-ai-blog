import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { GoogleMapsModule } from '@angular/google-maps';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterModule,
} from '@angular/router';
import { Store } from '@ngrx/store';
import { Subject, filter } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { GoogleMapsLoaderService } from '../../townplanner/services/google-maps-loader.service';
import { ManagerActions } from '../store/manager.actions';
import { selectManagerSearchQuery } from '../store/manager.selectors';

type MenuItem = { label: string; route: string };

@Component({
  selector: 'app-manager-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, GoogleMapsModule, RouterModule],
  templateUrl: './manager.page.html',
  styleUrls: ['./manager.page.css'],
})
export class ManagerPageComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  mapsLoaded = false;
  mapsError: string | null = null;

  isMobile = false;
  panelCollapsed = false;
  panelOpenMobile = true;

  // New: fullscreen panel when inside a section like Clients
  panelFullscreen = false;
  panelTitle = 'Business manager';

  // Keep the search field now; autocomplete + geocoding can come later
  searchCtrl = new FormControl<string>('', { nonNullable: true });

  menu: MenuItem[] = [
    { label: 'Clients', route: '/manager/clients' },
    { label: 'Projects', route: '/manager/projects' },
    { label: 'Users', route: '/manager/users' },
    { label: 'Suppliers', route: '/manager/suppliers' },
    { label: 'Materials', route: '/manager/materials' },
    { label: 'Labor costs', route: '/manager/labor' },
    { label: 'Pricing', route: '/manager/pricing' },
    { label: 'Quotes', route: '/manager/quotes' },
    { label: 'Invoices', route: '/manager/invoices' },
  ];

  mapCenter: google.maps.LatLngLiteral = { lat: -27.4698, lng: 153.0251 };
  mapZoom = 11;

  mapOptions: google.maps.MapOptions = {
    clickableIcons: false,
    disableDefaultUI: false,
    fullscreenControl: false,
    streetViewControl: false,
    mapTypeControl: false,
  };

  constructor(
    private store: Store,
    private mapsLoader: GoogleMapsLoaderService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.updateIsMobile();

    this.mapsLoader
      .load()
      .then(() => (this.mapsLoaded = true))
      .catch((e) => {
        this.mapsLoaded = false;
        this.mapsError = e?.message || 'Google Maps failed to load';
      });

    // Keep query in store (pattern consistency + ready for future autocomplete)
    this.store
      .select(selectManagerSearchQuery)
      .pipe(takeUntil(this.destroy$))
      .subscribe((q) =>
        this.searchCtrl.setValue(q || '', { emitEvent: false })
      );

    this.searchCtrl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((q) => {
        this.store.dispatch(ManagerActions.setSearchQuery({ query: q || '' }));
      });

    // Track active child route data (title + fullscreen)
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe(() => this.syncRouteUIState());

    // first load
    this.syncRouteUIState();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.updateIsMobile();
  }

  togglePanelCollapsed(): void {
    this.panelCollapsed = !this.panelCollapsed;
  }

  togglePanelMobile(): void {
    this.panelOpenMobile = !this.panelOpenMobile;
  }

  goBackToMenu(): void {
    this.router.navigateByUrl('/manager/menu');
  }

  private syncRouteUIState(): void {
    const child = this.route.firstChild;
    const data = child?.snapshot?.data ?? {};

    this.panelTitle = data['title'] || 'Business manager';
    this.panelFullscreen = !!data['fullscreen'];

    // In fullscreen mode, menu is hidden so we keep panel expanded/open.
    if (this.panelFullscreen) {
      this.panelCollapsed = false;
      this.panelOpenMobile = true;
    }
  }

  private updateIsMobile(): void {
    this.isMobile = window.matchMedia('(max-width: 768px)').matches;

    // Mobile-first behavior: panel acts like a drawer, except when fullscreen.
    if (this.isMobile) {
      this.panelCollapsed = false;
      if (!this.panelFullscreen) this.panelOpenMobile = false;
    } else {
      this.panelOpenMobile = true;
    }
  }
}
