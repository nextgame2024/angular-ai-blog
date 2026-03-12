import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
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
import { ManagerCompanyService } from '../services/manager.company.service';
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
  private directionsService: google.maps.DirectionsService | null = null;
  private companyAddress: string | null = null;
  isDraggingInfoPanel = false;
  private infoPanelDragOffset = { x: 0, y: 0 };

  @ViewChild('mapContainerRef') mapContainerRef?: ElementRef<HTMLElement>;
  @ViewChild('mapInfoPanelRef') mapInfoPanelRef?: ElementRef<HTMLElement>;

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
  companyMarker:
    | { position: google.maps.LatLngLiteral; icon: google.maps.Icon }
    | null = null;
  activeProject: BmProject | null = null;
  infoPanelPosition = { x: 24, y: 120 };
  routeDirections: google.maps.DirectionsResult | null = null;
  routeLoading = false;
  routeError: string | null = null;
  activeProjectTravelTime: string | null = null;
  directionsRendererOptions: google.maps.DirectionsRendererOptions = {
    suppressMarkers: true,
    preserveViewport: true,
    polylineOptions: {
      strokeColor: '#ef4444',
      strokeOpacity: 0.9,
      strokeWeight: 5.5,
    },
  };

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
    private companyService: ManagerCompanyService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.updateIsMobile();

    this.mapsLoader
      .getApiKey()
      .then((k) => (this.mapsApiKey = k))
      .catch(() => (this.mapsApiKey = null));

    this.loadCompanyAddress();

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
    this.clampInfoPanelPosition();
  }

  @HostListener('window:pointermove', ['$event'])
  onWindowPointerMove(event: PointerEvent): void {
    if (!this.isDraggingInfoPanel) return;
    this.moveInfoPanel(event.clientX, event.clientY);
    event.preventDefault();
  }

  @HostListener('window:pointerup')
  onWindowPointerUp(): void {
    this.isDraggingInfoPanel = false;
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

  openProjectInfo(project: BmProject): void {
    this.activeProject = project;
    this.routeError = null;
    this.activeProjectTravelTime = null;
    this.routeDirections = null;
    this.setDefaultInfoPanelPosition();
    this.drawCompanyToClientRoute(project);
  }

  closeProjectInfo(): void {
    this.activeProject = null;
    this.routeLoading = false;
    this.routeError = null;
    this.activeProjectTravelTime = null;
    this.routeDirections = null;
    this.isDraggingInfoPanel = false;
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

  private ensureDirectionsService(): void {
    if (this.directionsService) return;
    if (typeof google === 'undefined' || !google.maps?.DirectionsService) return;
    this.directionsService = new google.maps.DirectionsService();
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

    const companyAddress = (this.companyAddress || '').trim();
    const companyPosition = companyAddress
      ? await this.geocodeAddress(companyAddress)
      : null;

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
    this.companyMarker = companyPosition
      ? {
          position: companyPosition,
          icon: this.buildCompanyMarkerIcon(),
        }
      : null;

    if (
      this.activeProject
      && !this.projectMarkers.some(
        (marker) => marker.project.projectId === this.activeProject?.projectId,
      )
    ) {
      this.closeProjectInfo();
    }
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

  private buildCompanyMarkerIcon(): google.maps.Icon {
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="44" viewBox="0 0 24 32">` +
      `<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#111827" fill-opacity="0.34" transform="translate(0 2)"/>` +
      `<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#111827"/>` +
      `<rect x="8.6" y="6.7" width="6.8" height="5.6" rx="0.8" fill="#ffffff"/>` +
      `<path d="M10 7.8v3.4M12 7.8v3.4M14 7.8v3.4M9 9.5h6" stroke="#111827" stroke-width="0.8"/>` +
      `</svg>`;
    const url = this.svgToDataUrl(svg);
    return {
      url,
      scaledSize: new google.maps.Size(34, 44),
      anchor: new google.maps.Point(17, 42),
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

  private drawCompanyToClientRoute(project: BmProject): void {
    const origin = (this.companyAddress || '').trim();
    const destination = (project.clientAddress || '').trim();

    if (!origin || !destination) {
      this.routeDirections = null;
      this.activeProjectTravelTime = null;
      this.routeLoading = false;
      this.routeError = !origin
        ? 'Company address is missing.'
        : 'Client address is missing.';
      return;
    }

    this.ensureDirectionsService();
    if (!this.directionsService) {
      this.routeDirections = null;
      this.activeProjectTravelTime = null;
      this.routeLoading = false;
      this.routeError = 'Route service is unavailable.';
      return;
    }

    this.routeLoading = true;
    this.routeError = null;
    this.activeProjectTravelTime = null;
    this.routeDirections = null;

    const requestedProjectId = project.projectId;
    this.directionsService.route(
      {
        origin,
        destination,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (this.activeProject?.projectId !== requestedProjectId) return;

        this.routeLoading = false;
        if (status === google.maps.DirectionsStatus.OK && result) {
          this.routeDirections = result;
          const leg = result.routes?.[0]?.legs?.[0];
          this.activeProjectTravelTime = leg?.duration?.text || null;
          if (!this.activeProjectTravelTime) {
            this.routeError = 'Travel time not available for this route.';
          }
          return;
        }

        this.routeDirections = null;
        this.activeProjectTravelTime = null;
        this.routeError = 'Unable to calculate route right now.';
      },
    );
  }

  onInfoPanelPointerDown(event: PointerEvent): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('button')) return;
    if (!this.activeProject) return;

    const containerEl = this.mapContainerRef?.nativeElement;
    const panelEl = this.mapInfoPanelRef?.nativeElement;
    if (!containerEl || !panelEl) return;

    const panelRect = panelEl.getBoundingClientRect();
    this.infoPanelDragOffset = {
      x: event.clientX - panelRect.left,
      y: event.clientY - panelRect.top,
    };
    this.isDraggingInfoPanel = true;
    event.preventDefault();
  }

  private moveInfoPanel(clientX: number, clientY: number): void {
    const containerEl = this.mapContainerRef?.nativeElement;
    const panelEl = this.mapInfoPanelRef?.nativeElement;
    if (!containerEl || !panelEl) return;

    const containerRect = containerEl.getBoundingClientRect();
    const panelWidth = panelEl.offsetWidth || 380;
    const panelHeight = panelEl.offsetHeight || 260;
    const edge = 8;

    const maxX = Math.max(edge, containerRect.width - panelWidth - edge);
    const maxY = Math.max(edge, containerRect.height - panelHeight - edge);

    const rawX = clientX - containerRect.left - this.infoPanelDragOffset.x;
    const rawY = clientY - containerRect.top - this.infoPanelDragOffset.y;

    this.infoPanelPosition = {
      x: Math.min(Math.max(rawX, edge), maxX),
      y: Math.min(Math.max(rawY, edge), maxY),
    };
  }

  private setDefaultInfoPanelPosition(): void {
    const containerEl = this.mapContainerRef?.nativeElement;
    if (!containerEl) {
      this.infoPanelPosition = { x: 24, y: 120 };
      return;
    }

    const cardWidth = this.isMobile
      ? Math.min(containerEl.clientWidth - 24, 340)
      : 420;
    const edge = 8;
    const maxX = Math.max(edge, containerEl.clientWidth - cardWidth - edge);
    const x = Math.min(
      Math.max((containerEl.clientWidth - cardWidth) / 2, edge),
      maxX,
    );
    this.infoPanelPosition = {
      x: Math.round(x),
      y: this.isMobile ? 96 : 110,
    };
  }

  private clampInfoPanelPosition(): void {
    if (!this.activeProject) return;
    const containerEl = this.mapContainerRef?.nativeElement;
    const panelEl = this.mapInfoPanelRef?.nativeElement;
    if (!containerEl || !panelEl) return;

    const edge = 8;
    const maxX = Math.max(edge, containerEl.clientWidth - panelEl.offsetWidth - edge);
    const maxY = Math.max(edge, containerEl.clientHeight - panelEl.offsetHeight - edge);

    this.infoPanelPosition = {
      x: Math.min(Math.max(this.infoPanelPosition.x, edge), maxX),
      y: Math.min(Math.max(this.infoPanelPosition.y, edge), maxY),
    };
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

  private loadCompanyAddress(): void {
    this.companyService
      .listCompanies({ page: 1, limit: 1 })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          const address = String(res?.items?.[0]?.address || '').trim();
          this.companyAddress = address || null;
          this.refreshMapMarkers();
        },
        error: () => {
          this.companyAddress = null;
          this.refreshMapMarkers();
        },
      });
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
