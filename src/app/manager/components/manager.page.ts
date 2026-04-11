
import {
  Component,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CdkDrag, CdkDragEnd, CdkDragHandle } from '@angular/cdk/drag-drop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { GoogleMap, GoogleMapsModule } from '@angular/google-maps';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterModule,
} from '@angular/router';
import { Store } from '@ngrx/store';
import { firstValueFrom } from 'rxjs';
import { filter, map, timeout } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';

import { selectCurrentUser } from '../../auth/store/reducers';
import type { CurrentUserInterface } from '../../shared/types/currentUser.interface';
import { GoogleMapsLoaderService } from '../../townplanner/services/google-maps-loader.service';
import { ManagerCompanyService } from '../services/manager.company.service';
import { NavigationLinksProjectsService } from '../services/navigation.links.projects.service';
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

type MenuItem = {
  label: string;
  route: string;
  icon: string;
  superAdminOnly?: boolean;
};

@Component({
    selector: 'app-manager-page',
    imports: [
      CdkDrag,
      CdkDragHandle,
      ReactiveFormsModule,
      GoogleMapsModule,
      RouterModule,
    ],
    templateUrl: './manager.page.html',
    styleUrls: ['./manager.page.css']
})
export class ManagerPageComponent implements OnDestroy {
  private readonly store = inject(Store);
  private readonly mapsLoader = inject(GoogleMapsLoaderService);
  private readonly companyService = inject(ManagerCompanyService);
  private readonly navigationLinksApi = inject(NavigationLinksProjectsService);
  private readonly projectsService = inject(ManagerProjectsService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private mapRefreshToken = 0;
  private geocoder: google.maps.Geocoder | null = null;
  private geocodeCache = new Map<string, google.maps.LatLngLiteral>();
  private geocodeInFlight = new Map<
    string,
    Promise<google.maps.LatLngLiteral | null>
  >();
  private directionsService: google.maps.DirectionsService | null = null;
  private mapsApiKey: string | null = null;
  private streetViewRequestToken = 0;
  private readonly streetViewEnabled = true;
  private readonly routePreviewEnabled = true;
  private readonly superAdminId = 'c2dad143-077c-4082-92f0-47805601db3b';
  private menuLoadToken = 0;
  readonly useAdvancedMarkers = false;
  readonly zeroDragPosition = { x: 0, y: 0 };
  private readonly companyMarkerIconUrl =
    'data:image/svg+xml;utf8,'
    + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="58" viewBox="0 0 24 32"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#111827"/><rect x="8.6" y="6.7" width="6.8" height="5.6" rx="0.8" fill="#ffffff"/><path d="M10 7.8v3.4M12 7.8v3.4M14 7.8v3.4M9 9.5h6" stroke="#111827" stroke-width="0.8"/></svg>`,
    );
  readonly companyMarkerIcon: google.maps.Icon = {
    url: this.companyMarkerIconUrl,
  };
  private readonly mapDebugEnabled =
    typeof window !== 'undefined'
    && window.localStorage.getItem('manager-map-debug') === '1';
  private readonly projectMarkerListeners = new Map<
    string,
    {
      marker: google.maps.marker.AdvancedMarkerElement;
      cleanup: () => void;
    }
  >();
  readonly googleMapRef$$ = viewChild<GoogleMap>('googleMapRef');

  readonly mapsLoaded$$ = signal(false);
  readonly mapsError$$ = signal<string | null>(null);

  readonly isMobile$$ = signal(false);
  readonly panelCollapsed$$ = signal(false);
  readonly panelOpenMobile$$ = signal(true);
  readonly panelFullscreen$$ = signal(false);
  readonly panelTitle$$ = signal('Business manager');

  // Keep the search field now; autocomplete + geocoding can come later
  readonly searchCtrl = new FormControl<string>('', { nonNullable: true });

  readonly menu: MenuItem[] = [
    { label: 'Clients', route: '/manager/clients', icon: 'clients' },
    { label: 'Projects', route: '/manager/projects', icon: 'projects' },
    {
      label: 'Project types',
      route: '/manager/project-types',
      icon: 'project-types',
    },
    { label: 'Users', route: '/manager/users', icon: 'users' },
    { label: 'Company', route: '/manager/company', icon: 'company' },
    {
      label: 'Navigation links',
      route: '/manager/navigation-links',
      icon: 'navigation-links',
      superAdminOnly: true,
    },
    { label: 'Suppliers', route: '/manager/suppliers', icon: 'suppliers' },
    { label: 'Materials', route: '/manager/materials', icon: 'materials' },
    { label: 'Labor costs', route: '/manager/labor', icon: 'labor' },
    { label: 'Pricing', route: '/manager/pricing', icon: 'pricing' },
    { label: 'Quotes', route: '/manager/quotes', icon: 'quotes' },
    { label: 'Invoices', route: '/manager/invoices', icon: 'invoices' },
  ];

  readonly mapCenter: google.maps.LatLngLiteral = { lat: -27.4698, lng: 153.0251 };
  readonly mapZoom = 12;

  readonly mapOptions: google.maps.MapOptions = {
    clickableIcons: false,
    disableDefaultUI: false,
    fullscreenControl: false,
    streetViewControl: false,
    mapTypeControl: false,
    renderingType: 'RASTER' as google.maps.RenderingType,
    // Required for AdvancedMarkerElement so we avoid deprecated Marker fallback.
    mapId: this.useAdvancedMarkers ? 'DEMO_MAP_ID' : undefined,
  };

  readonly projectMarkers$$ = signal<Array<{
    projectId: string;
    title: string;
    position: google.maps.LatLngLiteral;
  }>>([]);
  readonly companyMarker$$ =
    signal<{ position: google.maps.LatLngLiteral } | null>(
      null,
    );
  readonly activeProject$$ = signal<BmProject | null>(null);
  readonly infoPanelDragPosition$$ = signal<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  readonly isDraggingInfoPanel$$ = signal(false);
  readonly routePath$$ = signal<google.maps.LatLngLiteral[]>([]);
  readonly routeLoading$$ = signal(false);
  readonly routeError$$ = signal<string | null>(null);
  readonly activeProjectTravelTime$$ = signal<string | null>(null);
  readonly streetViewLoading$$ = signal(false);
  readonly streetViewReady$$ = signal(false);
  readonly streetViewImageUrl$$ = signal<string | null>(null);

  readonly routePolylineOptions: google.maps.PolylineOptions = {
    geodesic: false,
    strokeColor: '#ef4444',
    strokeOpacity: 0.9,
    strokeWeight: 5.5,
  };
  readonly projectMarkerOptions: google.maps.marker.AdvancedMarkerElementOptions = {
    gmpClickable: true,
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

  private readonly mapsInit$$ = signal(false);
  private readonly companyAddressLoaded$$ = signal(false);

  private readonly currentUser$$ = toSignal(this.store.select(selectCurrentUser), {
    initialValue: null,
  });
  private readonly isSuperAdmin$$ = computed(
    () => this.currentUser$$()?.id === this.superAdminId,
  );
  private readonly searchQuery$$ = toSignal(
    this.store.select(selectManagerSearchQuery),
    { initialValue: '' },
  );
  private readonly projects$$ = toSignal(
    this.store.select(selectManagerProjects),
    { initialValue: [] as BmProject[] },
  );
  private readonly projectsPage$$ = toSignal(
    this.store.select(selectManagerProjectsPage),
    { initialValue: 1 },
  );
  private readonly projectsLimit$$ = toSignal(
    this.store.select(selectManagerProjectsLimit),
    { initialValue: 20 },
  );
  private readonly projectsTotal$$ = toSignal(
    this.store.select(selectManagerProjectsTotal),
    { initialValue: 0 },
  );
  private readonly projectsLoading$$ = toSignal(
    this.store.select(selectManagerProjectsLoading),
    { initialValue: false },
  );

  private readonly activeMenuLabels$$ = signal<Set<string>>(new Set());
  private readonly menuConfigLoaded$$ = signal(false);
  private readonly companyAddress$$ = signal<string | null>(null);

  readonly visibleMenu$$ = computed<MenuItem[]>(() => {
    const user = this.currentUser$$();
    if (!user) return [];

    const baseItems = this.menu.filter(
      (item) => !item.superAdminOnly || this.isSuperAdmin$$(),
    );

    if (!this.menuConfigLoaded$$()) {
      return baseItems.filter((item) => item.superAdminOnly);
    }

    const activeMenuLabels = this.activeMenuLabels$$();
    return baseItems.filter(
      (item) => item.superAdminOnly || activeMenuLabels.has(item.label),
    );
  });

  private readonly currentPath$$ = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  private readonly initEffect = effect((onCleanup) => {
    this.updateIsMobile();
    const onResize = () => {
      this.updateIsMobile();
    };

    window.addEventListener('resize', onResize, { passive: true });

    onCleanup(() => {
      window.removeEventListener('resize', onResize);
    });
  });

  private readonly mapsLoadEffect = effect(() => {
    if (this.mapsInit$$()) return;
    this.mapsInit$$.set(true);
    this.mapsLoader
      .load()
      .then(() => {
        this.mapsLoaded$$.set(true);
        this.mapsError$$.set(null);
        this.ensureGeocoder();
        void this.mapsLoader
          .getApiKey()
          .then((key) => {
            this.mapsApiKey = key;
          })
          .catch(() => {
            this.mapsApiKey = null;
          });
        this.refreshMapMarkers();
      })
      .catch((e: unknown) => {
        this.mapsLoaded$$.set(false);
        this.mapsError$$.set(
          e instanceof Error ? e.message : 'Google Maps failed to load',
        );
      });
  });

  private readonly projectsInitEffect = effect(() => {
    this.store.dispatch(ManagerProjectsActions.loadProjects({ page: 1 }));
  });

  private readonly searchQuerySyncEffect = effect(() => {
    const next = this.searchQuery$$() || '';
    if (this.searchCtrl.value !== next) {
      this.searchCtrl.setValue(next, { emitEvent: false });
    }
    this.refreshMapMarkers();
  });

  private readonly searchInputEffect = effect((onCleanup) => {
    const sub = this.searchCtrl.valueChanges.subscribe((q) => {
      const next = q || '';
      this.store.dispatch(ManagerActions.setSearchQuery({ query: next }));
      this.store.dispatch(
        ManagerProjectsActions.setProjectsSearchQuery({ query: next }),
      );
      this.store.dispatch(ManagerProjectsActions.loadProjects({ page: 1 }));
    });
    onCleanup(() => sub.unsubscribe());
  });

  private readonly projectsEffect = effect(() => {
    this.projects$$();
    this.refreshMapMarkers();
    this.maybeLoadMoreProjectsForMap();
  });

  private readonly projectsMetaEffect = effect(() => {
    this.projectsPage$$();
    this.projectsLimit$$();
    this.projectsTotal$$();
    this.projectsLoading$$();
    this.maybeLoadMoreProjectsForMap();
  });

  private readonly currentUserEffect = effect(() => {
    const user = this.currentUser$$();
    if (!user) {
      this.menuConfigLoaded$$.set(false);
      this.activeMenuLabels$$.set(new Set());
      return;
    }
    void this.loadActiveMenuLinks();
  });

  private readonly routeEffect = effect(() => {
    this.currentPath$$();
    this.syncRouteUIState();
  });

  private readonly companyAddressEffect = effect(() => {
    if (this.companyAddressLoaded$$()) return;
    this.companyAddressLoaded$$.set(true);
    void this.loadCompanyAddress();
  });

  private readonly debugInteractionProbeEffect = effect((onCleanup) => {
    if (!this.mapDebugEnabled) return;
    if (typeof document === 'undefined') return;

    const toTag = (el: EventTarget | null): string => {
      if (!(el instanceof Element)) return 'n/a';
      const cls = (el.className || '').toString().trim();
      if (!cls) return el.tagName;
      const shortClass = cls.replace(/\s+/g, '.');
      return `${el.tagName}.${shortClass}`;
    };

    const logEvent = (name: string, event: Event) => {
      const target = event.target as Element | null;
      const active = document.activeElement as Element | null;
      const center =
        typeof window !== 'undefined'
          ? document.elementFromPoint(
            Math.max(0, Math.floor(window.innerWidth / 2)),
            Math.max(0, Math.floor(window.innerHeight / 2)),
          )
          : null;
      this.logMapDebug(name, {
        target: toTag(target),
        active: toTag(active),
        center: toTag(center),
      });
    };

    const onPointerDown = (event: PointerEvent) =>
      logEvent('doc-pointerdown-capture', event);
    const onPointerUp = (event: PointerEvent) =>
      logEvent('doc-pointerup-capture', event);
    const onClick = (event: MouseEvent) =>
      logEvent('doc-click-capture', event);
    const onError = (event: ErrorEvent) => {
      this.logMapDebug('window-error', {
        message: event.message,
        source: event.filename,
        line: event.lineno,
        column: event.colno,
      });
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason =
        event.reason instanceof Error
          ? event.reason.message
          : String(event.reason || '');
      this.logMapDebug('window-unhandled-rejection', { reason });
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointerup', onPointerUp, true);
    document.addEventListener('click', onClick, true);
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);

    onCleanup(() => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('pointerup', onPointerUp, true);
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    });
  });

  togglePanelCollapsed(): void {
    this.panelCollapsed$$.set(!this.panelCollapsed$$());
  }

  togglePanelMobile(): void {
    this.panelOpenMobile$$.set(!this.panelOpenMobile$$());
  }

  goBackToMenu(): void {
    this.router.navigateByUrl('/manager/menu');
  }

  private async loadActiveMenuLinks(): Promise<void> {
    const user = this.currentUser$$();
    if (!user) {
      this.menuConfigLoaded$$.set(false);
      this.activeMenuLabels$$.set(new Set());
      return;
    }

    const requestToken = ++this.menuLoadToken;
    this.menuConfigLoaded$$.set(false);
    try {
      const links = await firstValueFrom(
        this.navigationLinksApi.listActiveNavigationLinks({
          navigationType: 'menu',
        }),
      );

      if (requestToken !== this.menuLoadToken) return;
      const labels = (links || [])
        .map((link) => link.navigationLabel)
        .filter((label): label is string => !!label);
      this.activeMenuLabels$$.set(new Set(labels));
    } catch {
      if (requestToken !== this.menuLoadToken) return;
      this.activeMenuLabels$$.set(new Set());
    } finally {
      if (requestToken === this.menuLoadToken) {
        this.menuConfigLoaded$$.set(true);
      }
    }
  }

  readonly trackByProjectMarker = (
    _: number,
    marker: { projectId: string },
  ) => marker.projectId;

  onProjectMarkerInitialized(
    projectId: string,
    marker: google.maps.marker.AdvancedMarkerElement,
  ): void {
    if (!projectId || !marker) return;

    const existing = this.projectMarkerListeners.get(projectId);
    if (existing?.marker === marker) return;
    if (existing) {
      existing.cleanup();
      this.projectMarkerListeners.delete(projectId);
    }

    marker.gmpClickable = true;

    let cleanup: (() => void) | null = null;
    if (
      typeof marker.addEventListener === 'function'
      && typeof marker.removeEventListener === 'function'
    ) {
      const onGmpClick = () => {
        this.logMapDebug('gmp-click', { projectId });
        this.onProjectMarkerClick(projectId);
      };
      marker.addEventListener('gmp-click', onGmpClick);
      cleanup = () => marker.removeEventListener('gmp-click', onGmpClick);
    } else {
      const listener = marker.addListener('click', () => {
        this.logMapDebug('click-fallback', { projectId });
        this.onProjectMarkerClick(projectId);
      });
      cleanup = () => listener.remove();
    }

    this.projectMarkerListeners.set(projectId, { marker, cleanup });
    this.logMapDebug('marker-initialized', { projectId });
  }

  onProjectMarkerClick(projectId: string): void {
    this.logMapDebug('marker-click-received', {
      projectId,
      activeProjectId: this.activeProject$$()?.projectId || null,
    });
    if (!projectId) return;
    if (this.activeProject$$()?.projectId === projectId) return;

    const project = this.projects$$().find((it) => it.projectId === projectId);
    if (!project?.projectId) return;

    this.logMapDebug('open-project-info', { projectId });
    this.openProjectInfo(project);
  }

  openProjectInfo(project: BmProject | null | undefined): void {
    if (!project?.projectId) {
      this.closeProjectInfo('openProjectInfo-invalid-project');
      return;
    }
    this.logMapDebug('open-project-info-run', {
      projectId: project.projectId,
      projectName: project.projectName || null,
    });

    const safeProject: BmProject = {
      projectId: project.projectId,
      projectName: project.projectName,
      clientName: project.clientName ?? null,
      clientAddress: project.clientAddress ?? null,
      projectTypeName: project.projectTypeName ?? null,
      status: project.status ?? null,
      clientId: project.clientId,
    };
    this.activeProject$$.set(safeProject);
    this.routeError$$.set(null);
    this.activeProjectTravelTime$$.set(null);
    this.routePath$$.set([]);
    this.streetViewLoading$$.set(false);
    this.streetViewReady$$.set(false);
    this.streetViewImageUrl$$.set(null);
    if (this.streetViewEnabled) {
      void this.renderStreetViewPreview(project).catch(() => {
        if (this.activeProject$$()?.projectId !== project.projectId) return;
        this.streetViewLoading$$.set(false);
        this.streetViewReady$$.set(false);
        this.streetViewImageUrl$$.set(null);
      });
    }
    if (this.routePreviewEnabled) {
      void this.drawCompanyToClientRoute(project).catch((err: unknown) => {
        if (this.activeProject$$()?.projectId !== project.projectId) return;
        this.routeLoading$$.set(false);
        this.routePath$$.set([]);
        this.routeError$$.set(
          this.normalizeRouteErrorMessage(
            this.getErrorMessage(err, 'Unable to draw driving route on map right now.'),
          ),
        );
      });
    }
  }

  closeProjectInfo(reason = 'manual'): void {
    this.logMapDebug('close-project-info', {
      reason,
      activeProjectId: this.activeProject$$()?.projectId || null,
    });
    this.activeProject$$.set(null);
    this.routeLoading$$.set(false);
    this.routeError$$.set(null);
    this.activeProjectTravelTime$$.set(null);
    this.routePath$$.set([]);
    this.streetViewLoading$$.set(false);
    this.streetViewReady$$.set(false);
    this.streetViewImageUrl$$.set(null);
    this.streetViewRequestToken += 1;
    this.isDraggingInfoPanel$$.set(false);
  }

  onInfoPanelDragStarted(): void {
    if (this.isMobile$$()) return;
    this.isDraggingInfoPanel$$.set(true);
  }

  onInfoPanelDragEnded(event: CdkDragEnd): void {
    this.isDraggingInfoPanel$$.set(false);
    if (this.isMobile$$()) {
      this.infoPanelDragPosition$$.set(this.zeroDragPosition);
      return;
    }
    const next = event.source.getFreeDragPosition();
    this.infoPanelDragPosition$$.set({
      x: Number.isFinite(next.x) ? Math.round(next.x) : 0,
      y: Number.isFinite(next.y) ? Math.round(next.y) : 0,
    });
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

  private async renderStreetViewPreview(project: BmProject): Promise<void> {
    if (!this.streetViewEnabled) {
      this.streetViewLoading$$.set(false);
      this.streetViewReady$$.set(false);
      this.streetViewImageUrl$$.set(null);
      return;
    }

    const requestedProjectId = project.projectId;
    const requestToken = ++this.streetViewRequestToken;
    const destination = (project.clientAddress || '').trim();

    this.streetViewLoading$$.set(true);
    this.streetViewReady$$.set(false);
    this.streetViewImageUrl$$.set(null);

    if (!destination) {
      this.streetViewLoading$$.set(false);
      return;
    }

    this.ensureGeocoder();
    const destinationPos = await this.geocodeAddress(destination);
    if (
      this.activeProject$$()?.projectId !== requestedProjectId
      || requestToken !== this.streetViewRequestToken
    ) {
      return;
    }
    if (!destinationPos) {
      this.streetViewLoading$$.set(false);
      return;
    }

    const apiKey = await this.resolveMapsApiKey();
    if (
      this.activeProject$$()?.projectId !== requestedProjectId
      || requestToken !== this.streetViewRequestToken
    ) {
      return;
    }
    if (!apiKey) {
      this.streetViewLoading$$.set(false);
      return;
    }

    const staticUrl = this.buildStreetViewStaticUrl(destinationPos, apiKey);
    this.streetViewImageUrl$$.set(staticUrl);
  }

  onStreetViewImageLoad(projectId: string): void {
    if (this.activeProject$$()?.projectId !== projectId) return;
    this.streetViewReady$$.set(true);
    this.streetViewLoading$$.set(false);
  }

  onStreetViewImageError(projectId: string): void {
    if (this.activeProject$$()?.projectId !== projectId) return;
    this.streetViewReady$$.set(false);
    this.streetViewLoading$$.set(false);
    this.streetViewImageUrl$$.set(null);
    this.logMapDebug('street-view-image-error', { projectId });
  }

  private async resolveMapsApiKey(): Promise<string | null> {
    if (this.mapsApiKey) return this.mapsApiKey;
    try {
      const key = await this.mapsLoader.getApiKey();
      this.mapsApiKey = key;
      return key;
    } catch {
      return null;
    }
  }

  private buildStreetViewStaticUrl(
    position: google.maps.LatLngLiteral,
    apiKey: string,
  ): string {
    const params = new URLSearchParams({
      size: '640x360',
      location: `${position.lat},${position.lng}`,
      source: 'outdoor',
      fov: '95',
      pitch: '2',
      key: apiKey,
    });
    return `https://maps.googleapis.com/maps/api/streetview?${params.toString()}`;
  }

  private async refreshMapMarkers(): Promise<void> {
    if (!this.mapsLoaded$$()) return;
    this.ensureGeocoder();
    if (!this.geocoder) return;
    const startedAt =
      typeof performance !== 'undefined' ? performance.now() : Date.now();

    const token = ++this.mapRefreshToken;
    const query = (this.searchQuery$$() || '').trim().toLowerCase();
    const visible = this.projects$$().filter(
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
          projectId: project.projectId,
          title: project.projectName || 'Project',
          position,
        };
      }),
    );

    const companyAddress = (this.companyAddress$$() || '').trim();
    const companyPosition = companyAddress
      ? await this.geocodeAddress(companyAddress)
      : null;

    if (token !== this.mapRefreshToken) return;
    const nextMarkers = markers.filter(
      (
        marker,
      ): marker is {
        projectId: string;
        title: string;
        position: google.maps.LatLngLiteral;
      } => Boolean(marker),
    );
    this.projectMarkers$$.set(nextMarkers);
    this.pruneProjectMarkerListeners(nextMarkers);
    this.companyMarker$$.set(
      companyPosition
      ? {
          position: companyPosition,
        }
      : null,
    );
    const finishedAt =
      typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.logMapDebug('markers-refreshed', {
      visibleProjects: visible.length,
      renderedMarkers: nextMarkers.length,
      elapsedMs: Number((finishedAt - startedAt).toFixed(1)),
    });

    const activeProject = this.activeProject$$();
    if (
      activeProject
      && !nextMarkers.some(
        (marker) => marker.projectId === activeProject.projectId,
      )
    ) {
      this.logMapDebug('active-project-closed-after-refresh', {
        activeProjectId: activeProject.projectId,
      });
      this.closeProjectInfo('active-project-not-in-marker-set');
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
      project.scopeAndConditions,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  }

  private maybeLoadMoreProjectsForMap(): void {
    if (!this.mapsLoaded$$()) return;
    if (this.projectsLoading$$()) return;
    if (this.projectsTotal$$() === 0) return;
    if (this.projects$$().length >= this.projectsTotal$$()) return;
    if (this.countVisibleProjects() >= 50) return;
    const expectedLoaded = this.projectsPage$$() * this.projectsLimit$$();
    if (expectedLoaded >= this.projectsTotal$$()) return;
    this.store.dispatch(
      ManagerProjectsActions.loadProjects({ page: this.projectsPage$$() + 1 }),
    );
  }

  private async drawCompanyToClientRoute(project: BmProject): Promise<void> {
    const requestedProjectId = project.projectId;
    const destinationAddress = (project.clientAddress || '').trim();
    let originAddress = (this.companyAddress$$() || '').trim();
    let resolvedDestinationAddress = destinationAddress;

    if (!destinationAddress) {
      this.routePath$$.set([]);
      this.activeProjectTravelTime$$.set(null);
      this.routeLoading$$.set(false);
      this.routeError$$.set('Client address is missing.');
      return;
    }

    this.routeLoading$$.set(true);
    this.routeError$$.set(null);
    this.activeProjectTravelTime$$.set(null);
    this.routePath$$.set([]);

    let originPos: google.maps.LatLngLiteral | null = null;
    let destinationPos: google.maps.LatLngLiteral | null = null;
    let routePath: google.maps.LatLngLiteral[] = [];
    let backendRouteError: string | null = null;

    try {
      const geocodeTasks: Array<Promise<void>> = [];
      if (originAddress) {
        geocodeTasks.push(
          this.geocodeAddress(originAddress).then((position) => {
            originPos = position;
          }),
        );
      }
      geocodeTasks.push(
        this.geocodeAddress(resolvedDestinationAddress).then((position) => {
          destinationPos = position;
        }),
      );
      await Promise.all(geocodeTasks);
      if (this.activeProject$$()?.projectId !== requestedProjectId) return;
    } catch {
      if (this.activeProject$$()?.projectId !== requestedProjectId) return;
      originPos = null;
      destinationPos = null;
    }

    try {
      const routeResponse = await firstValueFrom(
        this.projectsService.getProjectSurchargeTransportationRoute(
          requestedProjectId,
        ).pipe(timeout({ first: 12000 })),
      );
      if (this.activeProject$$()?.projectId !== requestedProjectId) return;

      const backendOriginAddress = String(
        routeResponse?.transportationRoute?.companyAddress || '',
      ).trim();
      const backendDestinationAddress = String(
        routeResponse?.transportationRoute?.clientAddress || '',
      ).trim();
      if (!originAddress && backendOriginAddress) {
        originAddress = backendOriginAddress;
        this.companyAddress$$.set(originAddress);
      }
      if (backendDestinationAddress) {
        resolvedDestinationAddress = backendDestinationAddress;
      }
      if (!originPos && originAddress) {
        originPos = await this.geocodeAddress(originAddress);
      }
      if (!destinationPos && resolvedDestinationAddress) {
        destinationPos = await this.geocodeAddress(resolvedDestinationAddress);
      }
      if (this.activeProject$$()?.projectId !== requestedProjectId) return;
      if (originPos) {
        this.companyMarker$$.set({ position: originPos });
      }

      const encodedPolyline = String(
        routeResponse?.transportationRoute?.encodedPolyline || '',
      ).trim();
      const safeEncodedPolyline =
        encodedPolyline.length > 20000 ? '' : encodedPolyline;
      if (safeEncodedPolyline !== encodedPolyline) {
        backendRouteError = 'Route geometry is too large to render on this device.';
      }
      routePath = safeEncodedPolyline
        ? this.decodeEncodedPolyline(safeEncodedPolyline)
        : [];

      if (routePath.length > 1) {
        this.routePath$$.set(routePath);
        this.fitMapToPath(routePath);
      } else {
        routePath = [];
      }

      const formattedRouteTime = String(
        routeResponse?.transportationRoute?.formattedTime || '',
      ).trim();
      if (formattedRouteTime) {
        this.activeProjectTravelTime$$.set(formattedRouteTime);
      }
    } catch (err: unknown) {
      if (this.activeProject$$()?.projectId !== requestedProjectId) return;
      backendRouteError = this.normalizeRouteErrorMessage(
        this.getErrorMessage(
          err,
          'Unable to draw driving route on map right now.',
        ),
      );
    }

    if (!routePath.length) {
      const browserRoute = await this.requestBrowserDirectionsRoute(
        originAddress,
        resolvedDestinationAddress,
      );
      if (this.activeProject$$()?.projectId !== requestedProjectId) return;
      if (browserRoute?.path?.length && browserRoute.path.length > 1) {
        routePath = browserRoute.path;
        this.routePath$$.set(routePath);
        this.fitMapToPath(routePath);
        if (!this.activeProjectTravelTime$$() && browserRoute.durationText) {
          this.activeProjectTravelTime$$.set(browserRoute.durationText);
        }
      }
    }

    if (!routePath.length && originPos && destinationPos) {
      routePath = [originPos, destinationPos];
      this.routePath$$.set(routePath);
      this.fitMapToPath(routePath);
      if (!this.routeError$$()) {
        this.routeError$$.set('Live route unavailable. Showing straight-line route.');
      }
    }

    if (!routePath.length) {
      this.routePath$$.set([]);
      this.routeError$$.set(
        backendRouteError || 'Unable to draw driving route on map right now.',
      );
    } else if (!this.routeError$$() && backendRouteError) {
      this.routeError$$.set('Live route unavailable. Showing fallback route.');
    }

    if (!this.activeProjectTravelTime$$()) {
      try {
        const response = await firstValueFrom(
          this.projectsService.getProjectSurchargeTransportationTime(
            requestedProjectId,
          ).pipe(timeout({ first: 10000 })),
        );
        if (this.activeProject$$()?.projectId !== requestedProjectId) return;

        const formattedTime = String(
          response?.transportation?.formattedTime || '',
        ).trim();
        this.activeProjectTravelTime$$.set(formattedTime || null);
        if (!this.activeProjectTravelTime$$() && !this.routeError$$()) {
          this.routeError$$.set('Travel time not available for this route.');
        }
      } catch (err: unknown) {
        if (this.activeProject$$()?.projectId !== requestedProjectId) return;
        const fallbackMinutes = this.estimateTravelMinutes(
          originPos,
          destinationPos,
        );
        if (fallbackMinutes !== null) {
          this.activeProjectTravelTime$$.set(
            `~ ${this.formatDurationMinutes(fallbackMinutes)}`,
          );
          if (!this.routeError$$()) {
            this.routeError$$.set(
              'Live travel time unavailable. Showing estimated time.',
            );
          }
        } else {
          this.activeProjectTravelTime$$.set(null);
          if (!this.routeError$$()) {
            this.routeError$$.set(
              this.normalizeRouteErrorMessage(
                this.getErrorMessage(err, 'Unable to calculate route right now.'),
              ),
            );
          }
        }
      }
    }

    if (this.activeProject$$()?.projectId === requestedProjectId) {
      this.routeLoading$$.set(false);
    }
  }

  private ensureDirectionsService(): void {
    if (this.directionsService) return;
    if (typeof google === 'undefined' || !google.maps?.DirectionsService) return;
    this.directionsService = new google.maps.DirectionsService();
  }

  private async requestBrowserDirectionsRoute(
    originAddress: string,
    destinationAddress: string,
  ): Promise<{ path: google.maps.LatLngLiteral[]; durationText: string | null } | null> {
    const origin = String(originAddress || '').trim();
    const destination = String(destinationAddress || '').trim();
    if (!origin || !destination) return null;

    this.ensureDirectionsService();
    if (!this.directionsService || typeof google === 'undefined') return null;

    const routePromise = new Promise<{
      path: google.maps.LatLngLiteral[];
      durationText: string | null;
    } | null>((resolve) => {
      this.directionsService?.route(
        {
          origin,
          destination,
          travelMode: google.maps.TravelMode.DRIVING,
          provideRouteAlternatives: false,
        },
        (result, status) => {
          if (status !== 'OK' || !result?.routes?.length) {
            resolve(null);
            return;
          }
          const route = result.routes[0];
          const overviewPath = route?.overview_path || [];
          const path = overviewPath
            .map((point) => ({ lat: point.lat(), lng: point.lng() }))
            .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
          if (path.length <= 1) {
            resolve(null);
            return;
          }

          const durationText = String(route?.legs?.[0]?.duration?.text || '').trim() || null;
          resolve({ path, durationText });
        },
      );
    });

    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), 10_000);
    });

    return Promise.race([routePromise, timeoutPromise]);
  }

  private fitMapToPath(path: google.maps.LatLngLiteral[]): void {
    if (!Array.isArray(path) || path.length < 2) return;
    if (typeof google === 'undefined' || !google.maps?.LatLngBounds) return;

    const map = this.googleMapRef$$()?.googleMap;
    if (!map) return;

    const bounds = new google.maps.LatLngBounds();
    for (const point of path) {
      bounds.extend(point);
    }
    if (bounds.isEmpty()) return;

    map.fitBounds(bounds, 72);
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

  private countVisibleProjects(): number {
    const query = (this.searchQuery$$() || '').trim().toLowerCase();
    return this.projects$$().filter(
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

  private decodeEncodedPolyline(encoded: string): google.maps.LatLngLiteral[] {
    const path: google.maps.LatLngLiteral[] = [];
    const maxPoints = 3000;
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
      if (path.length >= maxPoints) {
        break;
      }
    }

    return path;
  }

  private getErrorMessage(err: unknown, fallback: string): string {
    if (!err) return fallback;
    if (typeof err === 'string') return err.trim() || fallback;
    if (err instanceof Error) return err.message.trim() || fallback;
    if (typeof err === 'object') {
      const typed = err as { error?: { error?: string; message?: string } };
      const nested = typed.error;
      const msg = nested?.error || nested?.message;
      if (typeof msg === 'string' && msg.trim()) return msg.trim();
    }
    return fallback;
  }

  private normalizeRouteErrorMessage(message: string): string {
    const lower = String(message || '').toLowerCase();
    if (lower.includes('timeout')) {
      return 'Route service timed out. Please try again.';
    }
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

  private async loadCompanyAddress(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.companyService.listCompanies({ page: 1, limit: 1 }),
      );
      const address = String(res?.items?.[0]?.address || '').trim();
      this.companyAddress$$.set(address || null);
    } catch {
      this.companyAddress$$.set(null);
    } finally {
      this.refreshMapMarkers();
    }
  }

  private syncRouteUIState(): void {
    const child = this.route.firstChild;
    const data = child?.snapshot?.data ?? {};

    this.panelTitle$$.set(data['title'] || 'Business manager');
    this.panelFullscreen$$.set(!!data['fullscreen']);

    // In fullscreen mode, menu is hidden so we keep panel expanded/open.
    if (this.panelFullscreen$$()) {
      this.panelCollapsed$$.set(false);
      this.panelOpenMobile$$.set(true);
    }
  }

  private updateIsMobile(): void {
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    this.isMobile$$.set(isMobile);

    // Mobile-first behavior: panel acts like a drawer, except when fullscreen.
    if (isMobile) {
      this.infoPanelDragPosition$$.set(this.zeroDragPosition);
      this.isDraggingInfoPanel$$.set(false);
      this.panelCollapsed$$.set(false);
      if (!this.panelFullscreen$$()) this.panelOpenMobile$$.set(false);
    } else {
      this.panelOpenMobile$$.set(true);
      this.isDraggingInfoPanel$$.set(false);
    }
  }

  ngOnDestroy(): void {
    this.isDraggingInfoPanel$$.set(false);
    this.clearProjectMarkerListeners();
  }

  private pruneProjectMarkerListeners(
    markers: Array<{ projectId: string }>,
  ): void {
    const activeMarkerIds = new Set(markers.map((marker) => marker.projectId));
    for (const [projectId, listenerRef] of this.projectMarkerListeners) {
      if (activeMarkerIds.has(projectId)) continue;
      listenerRef.cleanup();
      this.projectMarkerListeners.delete(projectId);
      this.logMapDebug('marker-listener-pruned', { projectId });
    }
  }

  private clearProjectMarkerListeners(): void {
    for (const [projectId, listenerRef] of this.projectMarkerListeners) {
      listenerRef.cleanup();
      this.logMapDebug('marker-listener-cleared', { projectId });
    }
    this.projectMarkerListeners.clear();
  }

  private logMapDebug(message: string, data?: unknown): void {
    if (!this.mapDebugEnabled) return;
    const prefix = '[ManagerMap]';
    if (typeof data === 'undefined') {
      console.log(prefix, message);
      return;
    }
    console.log(prefix, message, data);
  }
}
