import { Component, computed, effect, inject, signal } from '@angular/core';
import {
  ActivatedRoute,
  Event as RouterEvent,
  Router,
  RouterLink,
  NavigationEnd,
} from '@angular/router';
import { Store } from '@ngrx/store';
import { userProfileActions } from '../store/actions';
import { selectCurrentUser } from 'src/app/auth/store/reducers';
import {
  selectError,
  selectIsLoading,
  selectUserProfileData,
} from '../store/reducers';
import { CommonModule } from '@angular/common';
import { FeedComponent } from 'src/app/shared/components/feed/feed.component';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs/operators';

/* PrimeNG */
import { MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { AvatarModule } from 'primeng/avatar';
import { CardModule } from 'primeng/card';

@Component({
    selector: 'mc-user-profile',
    templateUrl: './userProfile.component.html',
    imports: [
        CommonModule,
        RouterLink,
        FeedComponent,
        // PrimeNG
        ButtonModule,
        AvatarModule,
        CardModule,
    ]
})
export class UserProfileComponent {
  readonly defaultAvatar =
    'https://files-nodejs-api.s3.ap-southeast-2.amazonaws.com/public/avatar-user.png';

  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(Store);
  private readonly router = inject(Router);

  private readonly params$$ = toSignal(this.route.params, {
    initialValue: this.route.snapshot.params,
  });
  readonly slug$$ = computed(() => this.params$$()['slug'] ?? '');
  private readonly lastSlug$$ = signal<string | null>(null);

  private readonly currentPath$$ = toSignal(
    this.router.events.pipe(
      filter((ev: RouterEvent): ev is NavigationEnd => ev instanceof NavigationEnd),
      map(() => this.router.url)
    ),
    { initialValue: this.router.url }
  );

  readonly userProfile$$ = toSignal(this.store.select(selectUserProfileData), {
    initialValue: null,
  });
  readonly error$$ = toSignal(this.store.select(selectError), {
    initialValue: null,
  });
  readonly isLoading$$ = toSignal(this.store.select(selectIsLoading), {
    initialValue: false,
  });
  readonly currentUser$$ = toSignal(this.store.select(selectCurrentUser), {
    initialValue: null,
  });

  readonly isCurrentUserProfile$$ = computed(() => {
    const currentUser = this.currentUser$$();
    const userProfile = this.userProfile$$();
    if (!currentUser || !userProfile) return false;
    return currentUser.username === userProfile.username;
  });

  readonly items$$ = computed<MenuItem[]>(() => {
    const slug = this.slug$$();
    if (!slug) return [];
    return [
      {
        label: 'My Posts',
        icon: 'pi pi-file',
        routerLink: ['/profiles', slug],
        routerLinkActiveOptions: { exact: true },
      },
      {
        label: 'Favorite Posts',
        icon: 'pi pi-heart',
        routerLink: ['/profiles', slug, 'favorites'],
        routerLinkActiveOptions: { exact: true },
      },
    ];
  });

  readonly activeItem$$ = computed<MenuItem | null>(() => {
    const items = this.items$$();
    if (!items.length) return null;
    const path = this.currentPath$$().split('?')[0];
    const match = items.find((it: MenuItem) => {
      const link = Array.isArray(it.routerLink)
        ? it.routerLink.join('/')
        : (it.routerLink as string);
      const normalized = link.startsWith('/') ? link : `/${link}`;
      return path === normalized || path.startsWith(normalized + '/');
    });
    return match ?? items[0];
  });

  readonly apiUrl$$ = computed(() => {
    const slug = this.slug$$();
    if (!slug) return '';
    const isFavorites = this.currentPath$$().includes('favorites');
    return isFavorites
      ? `/articles?favorited=${slug}`
      : `/articles?author=${slug}`;
  });

  private readonly loadEffect = effect(() => {
    const slug = this.slug$$();
    if (!slug) return;
    if (this.lastSlug$$() === slug) return;
    this.lastSlug$$.set(slug);
    this.fetchUserProfile();
  });

  fetchUserProfile(): void {
    const slug = this.slug$$();
    if (!slug) return;
    this.store.dispatch(userProfileActions.getUserProfile({ slug }));
  }

  getUserImage(image: string | null | undefined): string {
    return image || this.defaultAvatar;
  }
}
