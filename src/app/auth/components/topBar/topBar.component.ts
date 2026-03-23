import { Component } from '@angular/core';
import { combineLatest, catchError, map, of, switchMap } from 'rxjs';
import { Store } from '@ngrx/store';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { selectCurrentUser } from '../../store/reducers';
import { NavigationLinksProjectsService } from 'src/app/manager/services/navigation.links.projects.service';
import type { MenuItem } from 'primeng/api';

// PrimeNG
import { MenubarModule } from 'primeng/menubar';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { environment } from 'src/environments/environment';
// Theme
import { ThemeService } from 'src/app/shared/services/theme.service';

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
  });
  menuItems$ = this.store.select(selectCurrentUser).pipe(
    switchMap((currentUser) => {
      const isSuperAdmin = currentUser?.id === this.superAdminId;
      const baseItems = this.buildHeaderItems(!!currentUser);

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

  logo = environment.apiUrl;

  isDark$ = this.theme.mode$.pipe(map((m) => m !== 'dark'));

  constructor(
    private store: Store,
    private theme: ThemeService,
    private navigationLinksApi: NavigationLinksProjectsService,
  ) {}

  getUserImage(image: string | null | undefined): string {
    return image || this.defaultAvatar;
  }

  toggleTheme() {
    this.theme.toggle();
  }

  onLogoError(ev: Event) {
    const img = ev.target as HTMLImageElement;
    img.src = 'assets/sophiaAi-logo.svg';
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
