import { CommonModule } from '@angular/common';
import {
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { GoogleMapsModule, MapInfoWindow, MapMarker } from '@angular/google-maps';
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
import { ManagerProjectsActions } from '../store/projects/manager.actions';
import {
  selectManagerProjects,
  selectManagerProjectsLimit,
  selectManagerProjectsLoading,
  selectManagerProjectsPage,
  selectManagerProjectsTotal,
} from '../store/projects/manager.selectors';
import type { BmProject } from '../types/projects.interface';

type MenuItem = { label: string; route: string; icon: string };

@Component({
  selector: 'app-manager-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, GoogleMapsModule, RouterModule],
  templateUrl: './manager.page.html',
  styleUrls: ['./manager.page.css'],
})
export class ManagerPageComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private projectsSnapshot: BmProject[] = [];
  private searchSnapshot = '';
  private projectsPage = 1;
  private projectsLimit = 20;
  private projectsTotal = 0;
  private projectsLoading = false;
  private mapRefreshToken = 0;
  private geocoder: google.maps.Geocoder | null = null;
  private geocodeCache = new Map<string, google.maps.LatLngLiteral>();
  private geocodeInFlight = new Map<
    string,
    Promise<google.maps.LatLngLiteral | null>
  >();

  @ViewChild(MapInfoWindow) infoWindow?: MapInfoWindow;

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
    { label: 'Clients', route: '/manager/clients', icon: 'clients' },
    { label: 'Projects', route: '/manager/projects', icon: 'projects' },
    { label: 'Project types', route: '/manager/project-types', icon: 'project-types' },
    { label: 'Users', route: '/manager/users', icon: 'users' },
    { label: 'Company', route: '/manager/company', icon: 'company' },
    { label: 'Suppliers', route: '/manager/suppliers', icon: 'suppliers' },
    { label: 'Materials', route: '/manager/materials', icon: 'materials' },
    { label: 'Labor costs', route: '/manager/labor', icon: 'labor' },
    { label: 'Pricing', route: '/manager/pricing', icon: 'pricing' },
    { label: 'Quotes', route: '/manager/quotes', icon: 'quotes' },
    { label: 'Invoices', route: '/manager/invoices', icon: 'invoices' },
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

  projectMarkers: Array<{
    project: BmProject;
    position: google.maps.LatLngLiteral;
    icon: google.maps.Symbol;
  }> = [];
  activeProject: BmProject | null = null;

  private readonly hiddenStatuses = new Set(['cancelled', 'on_hold', 'done']);
  private readonly statusColors: Record<string, string> = {
    to_do: '#2563eb',
    in_progress: '#f59e0b',
    quote_created: '#0ea5a5',
    quote_approved: '#16a34a',
    invoice_process: '#7c3aed',
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
      .then(() => {
        this.mapsLoaded = true;
        this.ensureGeocoder();
        this.refreshMapMarkers();
      })
      .catch((e) => {
        this.mapsLoaded = false;
        this.mapsError = e?.message || 'Google Maps failed to load';
      });

    // Keep query in store (pattern consistency + ready for future autocomplete)
    this.store
      .select(selectManagerSearchQuery)
      .pipe(takeUntil(this.destroy$))
      .subscribe((q) => {
        const next = q || '';
        this.searchSnapshot = next;
        this.searchCtrl.setValue(next, { emitEvent: false });
        this.refreshMapMarkers();
      });

    this.searchCtrl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((q) => {
        const next = q || '';
        this.store.dispatch(ManagerActions.setSearchQuery({ query: next }));
        this.store.dispatch(
          ManagerProjectsActions.setProjectsSearchQuery({ query: next }),
        );
        this.store.dispatch(ManagerProjectsActions.loadProjects({ page: 1 }));
      });

    this.store
      .select(selectManagerProjects)
      .pipe(takeUntil(this.destroy$))
      .subscribe((projects) => {
        this.projectsSnapshot = projects || [];
        this.refreshMapMarkers();
        this.maybeLoadMoreProjectsForMap();
      });

    this.store
      .select(selectManagerProjectsPage)
      .pipe(takeUntil(this.destroy$))
      .subscribe((page) => {
        this.projectsPage = page || 1;
        this.maybeLoadMoreProjectsForMap();
      });

    this.store
      .select(selectManagerProjectsLimit)
      .pipe(takeUntil(this.destroy$))
      .subscribe((limit) => {
        this.projectsLimit = limit || 20;
      });

    this.store
      .select(selectManagerProjectsTotal)
      .pipe(takeUntil(this.destroy$))
      .subscribe((total) => {
        this.projectsTotal = total || 0;
        this.maybeLoadMoreProjectsForMap();
      });

    this.store
      .select(selectManagerProjectsLoading)
      .pipe(takeUntil(this.destroy$))
      .subscribe((loading) => {
        this.projectsLoading = !!loading;
        this.maybeLoadMoreProjectsForMap();
      });

    this.store.dispatch(ManagerProjectsActions.loadProjects({ page: 1 }));

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

  trackByProjectMarker = (_: number, marker: { project: BmProject }) =>
    marker.project.projectId;

  openProjectInfo(marker: MapMarker, project: BmProject): void {
    this.activeProject = project;
    this.infoWindow?.open(marker);
  }

  closeProjectInfo(): void {
    this.infoWindow?.close();
    this.activeProject = null;
  }

  formatStatus(status?: string | null): string {
    switch (status) {
      case 'to_do':
        return 'To do';
      case 'in_progress':
        return 'In progress';
      case 'quote_approved':
        return 'Quote approved';
      case 'quote_created':
        return 'Quote created';
      case 'invoice_process':
        return 'Invoice process';
      case 'done':
        return 'Done';
      case 'on_hold':
        return 'On hold';
      case 'cancelled':
        return 'Cancelled';
      case 'archived':
        return 'Archived';
      default:
        return status || 'To do';
    }
  }

  private ensureGeocoder(): void {
    if (this.geocoder) return;
    if (typeof google === 'undefined' || !google.maps?.Geocoder) return;
    this.geocoder = new google.maps.Geocoder();
  }

  private async refreshMapMarkers(): Promise<void> {
    if (!this.mapsLoaded) return;
    this.ensureGeocoder();
    if (!this.geocoder) return;

    const token = ++this.mapRefreshToken;
    const query = this.searchSnapshot.trim().toLowerCase();
    const visible = this.projectsSnapshot.filter(
      (project) =>
        !this.hiddenStatuses.has(project.status || '') &&
        this.matchesSearch(project, query),
    );

    const markers = await Promise.all(
      visible.map(async (project) => {
        const address = (project.clientAddress || '').trim();
        if (!address) return null;
        const position = await this.geocodeAddress(address);
        if (!position) return null;
        return {
          project,
          position,
          icon: this.buildMarkerIcon(project.status),
        };
      }),
    );

    if (token !== this.mapRefreshToken) return;
    this.projectMarkers = markers.filter(
      (marker): marker is {
        project: BmProject;
        position: google.maps.LatLngLiteral;
        icon: google.maps.Symbol;
      } => Boolean(marker),
    );
  }

  private matchesSearch(project: BmProject, query: string): boolean {
    if (!query) return true;
    const haystack = [
      project.projectName,
      project.clientName,
      project.clientAddress,
      project.projectTypeName,
      project.description,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  }

  private buildMarkerIcon(status?: string | null): google.maps.Symbol {
    const color =
      this.statusColors[status || ''] ?? this.statusColors['to_do'];
    return {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: color,
      fillOpacity: 0.9,
      strokeColor: '#0f172a',
      strokeOpacity: 0.7,
      strokeWeight: 1,
      scale: 7,
    };
  }

  private maybeLoadMoreProjectsForMap(): void {
    if (!this.mapsLoaded) return;
    if (this.projectsLoading) return;
    if (this.projectsTotal === 0) return;
    if (this.projectsSnapshot.length >= this.projectsTotal) return;
    const expectedLoaded = this.projectsPage * this.projectsLimit;
    if (expectedLoaded >= this.projectsTotal) return;
    this.store.dispatch(
      ManagerProjectsActions.loadProjects({ page: this.projectsPage + 1 }),
    );
  }

  private async geocodeAddress(
    address: string,
  ): Promise<google.maps.LatLngLiteral | null> {
    if (this.geocodeCache.has(address)) {
      return this.geocodeCache.get(address) || null;
    }
    if (this.geocodeInFlight.has(address)) {
      return this.geocodeInFlight.get(address) || null;
    }
    if (!this.geocoder) return null;

    const request = new Promise<google.maps.LatLngLiteral | null>((resolve) => {
      this.geocoder?.geocode({ address }, (results, status) => {
        if (status !== 'OK' || !results?.length) {
          resolve(null);
          return;
        }
        const location = results[0]?.geometry?.location;
        if (!location) {
          resolve(null);
          return;
        }
        resolve({ lat: location.lat(), lng: location.lng() });
      });
    });

    this.geocodeInFlight.set(address, request);
    const result = await request;
    this.geocodeInFlight.delete(address);
    if (result) this.geocodeCache.set(address, result);
    return result;
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
