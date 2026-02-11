import { CommonModule } from '@angular/common';
import {
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  GoogleMapsModule,
  MapInfoWindow,
  MapMarker,
} from '@angular/google-maps';
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
  private mapsApiKey: string | null = null;

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
    {
      label: 'Project types',
      route: '/manager/project-types',
      icon: 'project-types',
    },
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
  mapZoom = 12;

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
    icon: google.maps.Icon;
  }> = [];
  activeProject: BmProject | null = null;

  private readonly allowedStatuses = new Set([
    'to_do',
    'in_progress',
    'quote_created',
    'quote_approved',
    'invoice_process',
  ]);
  private readonly statusColors: Record<string, string> = {
    to_do: '#11eed8',
    in_progress: '#f4f00c',
    quote_created: '#ee8510',
    quote_approved: '#0cf41c',
    invoice_process: '#f125dd',
  };
  private readonly photoFallbackSrc =
    'data:image/svg+xml;charset=utf-8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360">
        <rect width="100%" height="100%" fill="#e2e8f0"/>
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#334155" font-family="Arial" font-size="22">
          No preview available
        </text>
      </svg>`,
    );

  constructor(
    private store: Store,
    private mapsLoader: GoogleMapsLoaderService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.updateIsMobile();

    this.mapsLoader
      .getApiKey()
      .then((k) => (this.mapsApiKey = k))
      .catch(() => (this.mapsApiKey = null));

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
        takeUntil(this.destroy$),
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

  streetViewPhotoUrl(project: BmProject | null): string {
    if (!project?.clientAddress || !this.mapsApiKey)
      return this.photoFallbackSrc;
    const addr = encodeURIComponent(project.clientAddress);
    return `https://maps.googleapis.com/maps/api/streetview?size=640x360&location=${addr}&fov=70&pitch=0&key=${this.mapsApiKey}`;
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
        this.allowedStatuses.has(project.status || '') &&
        this.matchesSearch(project, query),
    );
    const limited = visible.slice(0, 50);

    const markers = await Promise.all(
      limited.map(async (project) => {
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
      (
        marker,
      ): marker is {
        project: BmProject;
        position: google.maps.LatLngLiteral;
        icon: google.maps.Icon;
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

  private buildMarkerIcon(status?: string | null): google.maps.Icon {
    const color = this.statusColors[status || ''] ?? this.statusColors['to_do'];
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 24 32">` +
      `<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#0f172a" fill-opacity="0.35" transform="translate(0 2)"/>` +
      `<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="${color}" stroke="#0f172a" stroke-opacity="0.65" stroke-width="0.8"/>` +
      `<circle cx="12" cy="9" r="3.2" fill="#ffffff" fill-opacity="0.9"/>` +
      `</svg>`;
    const url = this.svgToDataUrl(svg);
    return {
      url,
      scaledSize: new google.maps.Size(38, 50),
      anchor: new google.maps.Point(21, 48),
    };
  }

  private svgToDataUrl(svg: string): string {
    const encoded = window.btoa(unescape(encodeURIComponent(svg)));
    return `data:image/svg+xml;base64,${encoded}`;
  }

  private maybeLoadMoreProjectsForMap(): void {
    if (!this.mapsLoaded) return;
    if (this.projectsLoading) return;
    if (this.projectsTotal === 0) return;
    if (this.projectsSnapshot.length >= this.projectsTotal) return;
    if (this.countVisibleProjects() >= 50) return;
    const expectedLoaded = this.projectsPage * this.projectsLimit;
    if (expectedLoaded >= this.projectsTotal) return;
    this.store.dispatch(
      ManagerProjectsActions.loadProjects({ page: this.projectsPage + 1 }),
    );
  }

  private countVisibleProjects(): number {
    const query = this.searchSnapshot.trim().toLowerCase();
    return this.projectsSnapshot.filter(
      (project) =>
        this.allowedStatuses.has(project.status || '') &&
        this.matchesSearch(project, query),
    ).length;
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
