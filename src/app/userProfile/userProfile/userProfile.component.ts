import { Component, OnInit, inject } from '@angular/core';
import {
  ActivatedRoute,
  Params,
  Router,
  RouterLink,
  RouterLinkActive,
  NavigationEnd,
} from '@angular/router';
import { select, Store } from '@ngrx/store';
import { userProfileActions } from '../store/actions';
import { combineLatest, filter, map } from 'rxjs';
import { selectCurrentUser } from 'src/app/auth/store/reducers';
import { CurrentUserInterface } from 'src/app/shared/types/currentUser.interface';
import {
  selectError,
  selectIsLoading,
  selectUserProfileData,
} from '../store/reducers';
import { UserProfileInterface } from '../types/userProfile.interface';
import { CommonModule } from '@angular/common';
import { FeedComponent } from 'src/app/shared/components/feed/feed.component';

/* PrimeNG */
import { TabMenuModule } from 'primeng/tabmenu';
import { MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { AvatarModule } from 'primeng/avatar';
import { CardModule } from 'primeng/card';

@Component({
  selector: 'mc-user-profile',
  templateUrl: './userProfile.component.html',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    FeedComponent,
    // PrimeNG
    TabMenuModule,
    ButtonModule,
    AvatarModule,
    CardModule,
  ],
})
export class UserProfileComponent implements OnInit {
  defaultAvatar =
    'https://files-nodejs-api.s3.ap-southeast-2.amazonaws.com/public/avatar-user.png';

  route = inject(ActivatedRoute);
  store = inject(Store);
  router = inject(Router);

  slug: string = '';

  // Tab items for "My Posts" / "Favorite Posts"
  items: MenuItem[] = [];
  activeItem!: MenuItem;

  isCurrentUserProfile$ = combineLatest({
    currentUser: this.store.pipe(
      select(selectCurrentUser),
      filter(
        (currentUser): currentUser is CurrentUserInterface | null =>
          currentUser !== undefined
      )
    ),
    userProfile: this.store.pipe(
      select(selectUserProfileData),
      filter((userProfile): userProfile is UserProfileInterface =>
        Boolean(userProfile)
      )
    ),
  }).pipe(
    map(({ currentUser, userProfile }) => {
      return currentUser?.username === userProfile.username;
    })
  );

  data$ = combineLatest({
    isLoading: this.store.select(selectIsLoading),
    error: this.store.select(selectError),
    userProfile: this.store.select(selectUserProfileData),
    isCurrentUserProfile: this.isCurrentUserProfile$,
  });

  ngOnInit(): void {
    // react to route change
    this.route.params.subscribe((params: Params) => {
      this.slug = params['slug'];
      this.fetchUserProfile();
      this.buildTabs();
      this.setActiveFromUrl();
    });

    // react to navigation
    this.router.events
      .pipe(filter((ev): ev is NavigationEnd => ev instanceof NavigationEnd)) // ✅ typed
      .subscribe(() => this.setActiveFromUrl());
  }

  fetchUserProfile(): void {
    this.store.dispatch(userProfileActions.getUserProfile({ slug: this.slug }));
  }

  getApiUrl(): string {
    const isFavorites = this.router.url.includes('favorites');
    return isFavorites
      ? `/articles?favorited=${this.slug}`
      : `/articles?author=${this.slug}`;
  }

  private buildTabs(): void {
    this.items = [
      {
        label: 'My Posts',
        icon: 'pi pi-file',
        routerLink: ['/profiles', this.slug],
      },
      {
        label: 'Favorite Posts',
        icon: 'pi pi-heart',
        routerLink: ['/profiles', this.slug, 'favorites'],
      },
    ];
  }

  private setActiveFromUrl(): void {
    const path = this.router.url.split('?')[0];

    const match = this.items.find((it) => {
      const link = Array.isArray(it.routerLink)
        ? it.routerLink.join('/')
        : (it.routerLink as string);
      const normalized = link.startsWith('/') ? link : `/${link}`;
      return path === normalized || path.startsWith(normalized + '/');
    });

    this.activeItem = match ?? this.items[0];
  }

  getUserImage(user: UserProfileInterface | null): string {
    return user?.image || this.defaultAvatar;
  }
}
