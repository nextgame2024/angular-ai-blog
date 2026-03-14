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
import { Subject, filter, firstValueFrom } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { GoogleMapsLoaderService } from '../../townplanner/services/google-maps-loader.service';
import { ManagerCompanyService } from '../services/manager.company.service';
import { ManagerProjectsService } from '../services/manager.projects.service';
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
  private streetViewService: google.maps.StreetViewService | null = null;
  private streetViewPanorama: google.maps.StreetViewPanorama | null = null;
  private streetViewRequestToken = 0;
  private companyAddress: string | null = null;
  isDraggingInfoPanel = false;
  private infoPanelDragOffset = { x: 0, y: 0 };

  @ViewChild('mapContainerRef') mapContainerRef?: ElementRef<HTMLElement>;
  @ViewChild('mapInfoPanelRef') mapInfoPanelRef?: ElementRef<HTMLElement>;
  @ViewChild('streetViewPreviewRef')
  streetViewPreviewRef?: ElementRef<HTMLElement>;

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
  routePath: google.maps.LatLngLiteral[] = [];
  routeLoading = false;
  routeError: string | null = null;
  activeProjectTravelTime: string | null = null;
  streetViewLoading = false;
  streetViewReady = false;
  routePolylineOptions: google.maps.PolylineOptions = {
    geodesic: false,
    strokeColor: '#ef4444',
    strokeOpacity: 0.9,
    strokeWeight: 5.5,
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

  constructor(
    private store: Store,
    private mapsLoader: GoogleMapsLoaderService,
    private companyService: ManagerCompanyService,
    private projectsService: ManagerProjectsService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.updateIsMobile();

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
    this.routePath = [];
    this.streetViewLoading = false;
    this.streetViewReady = false;
    this.setDefaultInfoPanelPosition();
    void this.renderStreetViewPreview(project);
    void this.drawCompanyToClientRoute(project);
  }

  closeProjectInfo(): void {
    this.activeProject = null;
    this.routeLoading = false;
    this.routeError = null;
    this.activeProjectTravelTime = null;
    this.routePath = [];
    this.streetViewLoading = false;
    this.streetViewReady = false;
    this.streetViewRequestToken += 1;
    if (this.streetViewPanorama) {
      this.streetViewPanorama.setVisible(false);
    }
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

  private ensureGeocoder(): void {
    if (this.geocoder) return;
    if (typeof google === 'undefined' || !google.maps?.Geocoder) return;
    this.geocoder = new google.maps.Geocoder();
  }

  private ensureStreetViewService(): void {
    if (this.streetViewService) return;
    if (typeof google === 'undefined' || !google.maps?.StreetViewService) return;
    this.streetViewService = new google.maps.StreetViewService();
  }

  private async waitForStreetViewHost(): Promise<HTMLElement | null> {
    for (let i = 0; i < 8; i += 1) {
      const host = this.streetViewPreviewRef?.nativeElement || null;
      if (host) return host;
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    return this.streetViewPreviewRef?.nativeElement || null;
  }

  private async renderStreetViewPreview(project: BmProject): Promise<void> {
    const requestedProjectId = project.projectId;
    const requestToken = ++this.streetViewRequestToken;
    const destination = (project.clientAddress || '').trim();

    this.streetViewLoading = true;
    this.streetViewReady = false;
    if (this.streetViewPanorama) {
      this.streetViewPanorama.setVisible(false);
    }

    if (!destination) {
      this.streetViewLoading = false;
      return;
    }

    this.ensureGeocoder();
    const destinationPos = await this.geocodeAddress(destination);
    if (
      this.activeProject?.projectId !== requestedProjectId
      || requestToken !== this.streetViewRequestToken
    ) {
      return;
    }
    if (!destinationPos) {
      this.streetViewLoading = false;
      return;
    }

    const host = await this.waitForStreetViewHost();
    if (
      this.activeProject?.projectId !== requestedProjectId
      || requestToken !== this.streetViewRequestToken
    ) {
      return;
    }
    if (!host) {
      this.streetViewLoading = false;
      return;
    }

    this.ensureStreetViewService();
    if (
      !this.streetViewService
      || typeof google === 'undefined'
      || !google.maps?.StreetViewPanorama
    ) {
      this.streetViewLoading = false;
      return;
    }

    const panoramaData = await this.findStreetViewPanorama(destinationPos);
    if (
      this.activeProject?.projectId !== requestedProjectId
      || requestToken !== this.streetViewRequestToken
    ) {
      return;
    }

    if (!panoramaData?.location) {
      this.streetViewReady = false;
      this.streetViewLoading = false;
      return;
    }

    const pano = panoramaData.location.pano || null;
    const panoramaPosition =
      this.toLatLngLiteral(panoramaData.location.latLng) || destinationPos;
    const heading = this.computeHeading(panoramaPosition, destinationPos);

    this.streetViewPanorama = new google.maps.StreetViewPanorama(host, {
      position: panoramaPosition,
      disableDefaultUI: true,
      clickToGo: false,
      linksControl: false,
      panControl: false,
      motionTracking: false,
      motionTrackingControl: false,
      fullscreenControl: false,
      addressControl: false,
      showRoadLabels: false,
      zoomControl: false,
      pov: { heading, pitch: 2 },
      zoom: 1,
    });
    if (pano) {
      this.streetViewPanorama.setPano(pano);
    }
    this.streetViewPanorama.setVisible(true);
    this.streetViewReady = true;
    this.streetViewLoading = false;
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

  private async drawCompanyToClientRoute(project: BmProject): Promise<void> {
    const origin = (this.companyAddress || '').trim();
    const destination = (project.clientAddress || '').trim();

    if (!origin || !destination) {
      this.routePath = [];
      this.activeProjectTravelTime = null;
      this.routeLoading = false;
      this.routeError = !origin
        ? 'Company address is missing.'
        : 'Client address is missing.';
      return;
    }

    this.routeLoading = true;
    this.routeError = null;
    this.activeProjectTravelTime = null;
    this.routePath = [];

    const requestedProjectId = project.projectId;
    let originPos: google.maps.LatLngLiteral | null = null;
    let destinationPos: google.maps.LatLngLiteral | null = null;

    try {
      [originPos, destinationPos] = await Promise.all([
        this.geocodeAddress(origin),
        this.geocodeAddress(destination),
      ]);
      if (this.activeProject?.projectId !== requestedProjectId) return;
    } catch {
      if (this.activeProject?.projectId !== requestedProjectId) return;
      originPos = null;
      destinationPos = null;
    }

    try {
      const routeResponse = await firstValueFrom(
        this.projectsService.getProjectSurchargeTransportationRoute(
          requestedProjectId,
        ),
      );
      if (this.activeProject?.projectId !== requestedProjectId) return;

      const encodedPolyline = String(
        routeResponse?.transportationRoute?.encodedPolyline || '',
      ).trim();
      const routePath = encodedPolyline
        ? this.decodeEncodedPolyline(encodedPolyline)
        : [];

      if (routePath.length > 1) {
        this.routePath = routePath;
      } else {
        this.routePath = [];
        this.routeError = 'Unable to draw driving route on map right now.';
      }

      const formattedRouteTime = String(
        routeResponse?.transportationRoute?.formattedTime || '',
      ).trim();
      if (formattedRouteTime) {
        this.activeProjectTravelTime = formattedRouteTime;
      }
    } catch (err: any) {
      if (this.activeProject?.projectId !== requestedProjectId) return;
      this.routePath = [];
      this.routeError = this.normalizeRouteErrorMessage(this.getErrorMessage(
        err,
        'Unable to draw driving route on map right now.',
      ));
    }

    if (!this.activeProjectTravelTime) {
      try {
        const response = await firstValueFrom(
          this.projectsService.getProjectSurchargeTransportationTime(
            requestedProjectId,
          ),
        );
        if (this.activeProject?.projectId !== requestedProjectId) return;

        const formattedTime = String(
          response?.transportation?.formattedTime || '',
        ).trim();
        this.activeProjectTravelTime = formattedTime || null;
        if (!this.activeProjectTravelTime && !this.routeError) {
          this.routeError = 'Travel time not available for this route.';
        }
      } catch (err: any) {
        if (this.activeProject?.projectId !== requestedProjectId) return;
        const fallbackMinutes = this.estimateTravelMinutes(
          originPos,
          destinationPos,
        );
        if (fallbackMinutes !== null) {
          this.activeProjectTravelTime = `~ ${this.formatDurationMinutes(
            fallbackMinutes,
          )}`;
          if (!this.routeError) {
            this.routeError =
              'Live travel time unavailable. Showing estimated time.';
          }
        } else {
          this.activeProjectTravelTime = null;
          if (!this.routeError) {
            this.routeError = this.normalizeRouteErrorMessage(
              this.getErrorMessage(
                err,
                'Unable to calculate route right now.',
              ),
            );
          }
        }
      }
    }

    if (this.activeProject?.projectId === requestedProjectId) {
      this.routeLoading = false;
    }
  }

  private estimateTravelMinutes(
    origin: google.maps.LatLngLiteral | null,
    destination: google.maps.LatLngLiteral | null,
  ): number | null {
    if (!origin || !destination) return null;

    const km = this.haversineDistanceKm(origin, destination);
    if (!Number.isFinite(km) || km <= 0) return null;

    // Fallback estimate for when live routing APIs are unavailable.
    const avgCitySpeedKmH = 45;
    return Math.max(1, Math.round((km / avgCitySpeedKmH) * 60));
  }

  private haversineDistanceKm(
    a: google.maps.LatLngLiteral,
    b: google.maps.LatLngLiteral,
  ): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);

    const sinLat = Math.sin(dLat / 2);
    const sinLng = Math.sin(dLng / 2);
    const h =
      sinLat * sinLat
      + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
    const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    return 6371 * c;
  }

  private formatDurationMinutes(totalMinutesRaw: number): string {
    const totalMinutes = Math.max(0, Math.round(Number(totalMinutesRaw) || 0));
    if (totalMinutes < 60) {
      return `${totalMinutes} minute${totalMinutes === 1 ? '' : 's'}`;
    }
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const hoursLabel = `${hours} hour${hours === 1 ? '' : 's'}`;
    if (!minutes) return hoursLabel;
    return `${hoursLabel} ${minutes} minute${minutes === 1 ? '' : 's'}`;
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

  private async findStreetViewPanorama(
    position: google.maps.LatLngLiteral,
  ): Promise<google.maps.StreetViewPanoramaData | null> {
    const radii = [40, 80, 140, 220];
    for (const radius of radii) {
      const data = await this.requestStreetViewPanorama(position, radius);
      if (data) return data;
    }
    return null;
  }

  private requestStreetViewPanorama(
    position: google.maps.LatLngLiteral,
    radius: number,
  ): Promise<google.maps.StreetViewPanoramaData | null> {
    if (
      !this.streetViewService
      || typeof google === 'undefined'
      || !google.maps?.StreetViewStatus
    ) {
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      this.streetViewService?.getPanorama(
        {
          location: position,
          radius,
          source: google.maps.StreetViewSource.OUTDOOR,
          preference: google.maps.StreetViewPreference.NEAREST,
        },
        (data, status) => {
          if (status !== google.maps.StreetViewStatus.OK || !data?.location) {
            resolve(null);
            return;
          }
          resolve(data);
        },
      );
    });
  }

  private toLatLngLiteral(
    value: google.maps.LatLng | google.maps.LatLngLiteral | null | undefined,
  ): google.maps.LatLngLiteral | null {
    if (!value) return null;
    if (typeof (value as google.maps.LatLng).lat === 'function') {
      const latLng = value as google.maps.LatLng;
      return { lat: latLng.lat(), lng: latLng.lng() };
    }

    const literal = value as google.maps.LatLngLiteral;
    if (!Number.isFinite(literal.lat) || !Number.isFinite(literal.lng)) {
      return null;
    }
    return { lat: literal.lat, lng: literal.lng };
  }

  private computeHeading(
    from: google.maps.LatLngLiteral,
    to: google.maps.LatLngLiteral,
  ): number {
    if (from.lat === to.lat && from.lng === to.lng) return 0;

    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const toDeg = (rad: number) => (rad * 180) / Math.PI;
    const lat1 = toRad(from.lat);
    const lat2 = toRad(to.lat);
    const dLng = toRad(to.lng - from.lng);

    const y = Math.sin(dLng) * Math.cos(lat2);
    const x =
      Math.cos(lat1) * Math.sin(lat2)
      - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    const heading = toDeg(Math.atan2(y, x));
    return (heading + 360) % 360;
  }

  private decodeEncodedPolyline(encoded: string): google.maps.LatLngLiteral[] {
    const path: google.maps.LatLngLiteral[] = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
      let shift = 0;
      let result = 0;
      let byte = 0;

      do {
        if (index >= encoded.length) return path;
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);

      const dLat = result & 1 ? ~(result >> 1) : result >> 1;
      lat += dLat;

      shift = 0;
      result = 0;

      do {
        if (index >= encoded.length) return path;
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);

      const dLng = result & 1 ? ~(result >> 1) : result >> 1;
      lng += dLng;

      path.push({ lat: lat / 1e5, lng: lng / 1e5 });
    }

    return path;
  }

  private getErrorMessage(err: any, fallback: string): string {
    return String(
      err?.error?.error || err?.error?.message || err?.message || fallback,
    ).trim() || fallback;
  }

  private normalizeRouteErrorMessage(message: string): string {
    const lower = String(message || '').toLowerCase();
    if (
      lower.includes('are blocked')
      || lower.includes('api not activated')
      || lower.includes('not authorized to use this service or api')
      || lower.includes('google maps distance matrix api is not authorized')
    ) {
      return 'Unable to draw driving route right now due Google Maps API restrictions.';
    }
    return message;
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
