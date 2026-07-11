import { Component } from '@angular/core';
import { combineLatest, catchError, filter, map, of, startWith, switchMap } from 'rxjs';
import { Store } from '@ngrx/store';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { selectCurrentUser, selectIsLoading } from '../../store/reducers';
import { NavigationLinksProjectsService } from 'src/app/manager/services/navigation.links.projects.service';
import { environment } from 'src/environments/environment';
// Theme
import { ThemeService } from 'src/app/shared/services/theme.service';
import { CompanyBrandingService } from 'src/app/shared/services/company-branding.service';

type HeaderItem = {
  label: string;
  route: string;
  matchMode?: 'exact' | 'prefix';
  activeRoutes?: string[];
  excludePrefixes?: string[];
};

@Component({
  selector: 'mc-topbar',
  templateUrl: './topBar.component.html',
  styleUrls: ['./topBar.component.css'],
  imports: [CommonModule, RouterLink],
})
export class TopBarComponent {
  isMobileMenuOpen = false;

  data$ = combineLatest({
    currentUser: this.store.select(selectCurrentUser),
    isAuthLoading: this.store.select(selectIsLoading),
  }).pipe(
    map(({ currentUser, isAuthLoading }) => ({
      currentUser,
      isAuthResolved: currentUser !== undefined && !isAuthLoading,
    })),
  );
  menuItems$ = combineLatest({
    currentUser: this.store.select(selectCurrentUser),
    routeEvent: this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      startWith(null),
    ),
  }).pipe(
    switchMap(({ currentUser }) => {
      const baseItems = this.buildHeaderItems(!!currentUser, false);

      if (currentUser === undefined) return of([]);
      if (!currentUser) return of(baseItems);

      return combineLatest({
        links: this.navigationLinksApi.listActiveNavigationLinks({
          navigationType: 'header',
        }),
        toolkitAccess: this.http
          .get<{ hasAccess: boolean }>(`${environment.apiUrl}/ai-toolkit/access`)
          .pipe(catchError(() => of({ hasAccess: false }))),
      }).pipe(
          map(({ links, toolkitAccess }) => {
            const nextBaseItems = this.buildHeaderItems(
              true,
              !!toolkitAccess?.hasAccess,
            );
            const allowedLabels = new Set(
              (links || [])
                .map((link) => link.navigationLabel)
                .filter((label): label is string => !!label),
            );

            return nextBaseItems.filter((item) =>
              allowedLabels.has(item.label),
            );
          }),
          catchError(() => of([])),
        );
    }),
  );

  defaultAvatar =
    'https://files-nodejs-api.s3.ap-southeast-2.amazonaws.com/public/avatar-user.png';

  defaultLogo = environment.logoUrl || 'assets/sophiaAi-logo.svg';
  companyLogo$ = combineLatest([
    this.store.select(selectCurrentUser),
    this.store.select(selectIsLoading),
    this.branding.companyBranding$,
  ]).pipe(
    switchMap(([currentUser, isAuthLoading, branding]) => {
      if (currentUser === undefined || isAuthLoading) return of(null);

      const companyId =
        (currentUser as { companyId?: string | null } | null)?.companyId ||
        null;
      if (!currentUser || !companyId) return of(this.defaultLogo);

      if (branding?.companyId === companyId && branding.logoUrl) {
        return of(branding.logoUrl);
      }

      return this.http
        .get<{
          company?: { logoUrl?: string | null };
        }>(`${environment.apiUrl}/bm/company/${companyId}`)
        .pipe(
          map((res) => res?.company?.logoUrl || this.defaultLogo),
          catchError(() => of(this.defaultLogo)),
        );
    }),
  );

  isDark$ = this.theme.mode$.pipe(map((m) => m !== 'dark'));

  constructor(
    private store: Store,
    private http: HttpClient,
    private router: Router,
    private theme: ThemeService,
    private navigationLinksApi: NavigationLinksProjectsService,
    private branding: CompanyBrandingService,
  ) {}

  getUserImage(image: string | null | undefined): string {
    return image || this.defaultAvatar;
  }

  toggleTheme() {
    this.theme.toggle();
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen = false;
  }

  onLogoError(ev: Event) {
    const img = ev.target as HTMLImageElement;
    img.src = this.defaultLogo;
  }

  isHeaderItemActive(item: HeaderItem): boolean {
    const currentUrl = this.router.url.split('?')[0] || '/';
    const route = item.route || '/';

    if (item.matchMode === 'exact') {
      return currentUrl === route;
    }

    const matchesRoute =
      currentUrl === route ||
      currentUrl.startsWith(`${route}/`) ||
      (item.activeRoutes || []).some(
        (activeRoute) =>
          currentUrl === activeRoute ||
          currentUrl.startsWith(`${activeRoute}/`),
      );
    if (!matchesRoute) return false;

    return !(item.excludePrefixes || []).some((prefix) => {
      return currentUrl === prefix || currentUrl.startsWith(`${prefix}/`);
    });
  }

  private buildHeaderItems(
    isLoggedIn: boolean,
    hasAiToolkitAccess: boolean,
  ): HeaderItem[] {
    const items: HeaderItem[] = [
      { label: 'Home', route: '/', matchMode: 'exact' },
      ...(isLoggedIn && hasAiToolkitAccess
        ? [
            {
              label: 'Dashboard',
              route: '/manager/dashboard',
              matchMode: 'prefix' as const,
            },
          ]
        : []),
      {
        label: 'Explore Business Manager',
        route: '/explore',
        matchMode: 'prefix',
        activeRoutes: ['/manager/explore'],
      },
      {
        label: 'Ai Toolkit',
        route: '/ai-toolkit',
        matchMode: 'prefix',
      },
    ];
    if (!isLoggedIn) return items;
    items.push(
      { label: 'Town planner', route: '/townplanner', matchMode: 'prefix' },
      {
        label: 'Business manager',
        route: '/manager',
        matchMode: 'prefix',
        excludePrefixes: ['/manager/explore', '/manager/dashboard'],
      },
      { label: 'Settings', route: '/settings', matchMode: 'prefix' },
    );
    return items;
  }
}
