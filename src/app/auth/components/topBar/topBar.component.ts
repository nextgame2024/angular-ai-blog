import { Component } from '@angular/core';
import { combineLatest, catchError, map, of, switchMap } from 'rxjs';
import { Store } from '@ngrx/store';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { selectCurrentUser, selectIsLoading } from '../../store/reducers';
import { NavigationLinksProjectsService } from 'src/app/manager/services/navigation.links.projects.service';
import type { MenuItem } from 'primeng/api';

// PrimeNG
import { MenubarModule } from 'primeng/menubar';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { environment } from 'src/environments/environment';
// Theme
import { ThemeService } from 'src/app/shared/services/theme.service';
import { CompanyBrandingService } from 'src/app/shared/services/company-branding.service';

@Component({
  selector: 'mc-topbar',
  standalone: true,
  templateUrl: './topBar.component.html',
  styleUrls: ['./topBar.component.css'],
  imports: [
    CommonModule,
    RouterLink,
    MenubarModule,
    AvatarModule,
    ButtonModule,
  ],
})
export class TopBarComponent {
  private readonly superAdminId = 'c2dad143-077c-4082-92f0-47805601db3b';

  data$ = combineLatest({
    currentUser: this.store.select(selectCurrentUser),
    isAuthLoading: this.store.select(selectIsLoading),
  }).pipe(
    map(({ currentUser, isAuthLoading }) => ({
      currentUser,
      isAuthResolved: currentUser !== undefined && !isAuthLoading,
    })),
  );
  menuItems$ = this.store.select(selectCurrentUser).pipe(
    switchMap((currentUser) => {
      const isSuperAdmin = currentUser?.id === this.superAdminId;
      const baseItems = this.buildHeaderItems(!!currentUser);

      if (currentUser === undefined) return of([]);
      if (!currentUser) return of(baseItems);

      return this.navigationLinksApi
        .listActiveNavigationLinks({ navigationType: 'header' })
        .pipe(
          map((links) => {
            const allowedLabels = new Set(
              (links || [])
                .map((link) => link.navigationLabel)
                .filter((label): label is string => !!label),
            );

            return baseItems.filter((item) =>
              item.label ? allowedLabels.has(item.label) : true,
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
        .get<{ company?: { logoUrl?: string | null } }>(
          `${environment.apiUrl}/bm/company/${companyId}`,
        )
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

  onLogoError(ev: Event) {
    const img = ev.target as HTMLImageElement;
    img.src = this.defaultLogo;
  }

  private buildHeaderItems(isLoggedIn: boolean): MenuItem[] {
    return [
      { label: 'Home', routerLink: '/' },
      { label: 'Town planner', routerLink: '/townplanner', visible: isLoggedIn },
      {
        label: 'Business manager',
        routerLink: '/manager',
        visible: isLoggedIn,
      },
      { label: 'Settings', routerLink: '/settings', visible: isLoggedIn },
    ];
  }
}
