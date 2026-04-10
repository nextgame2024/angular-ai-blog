
import { Component, computed, inject, input } from '@angular/core';
import {
  Router,
  NavigationEnd,
  RouterLink,
  Event as RouterEvent,
} from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs/operators';

import { MenuItem } from 'primeng/api';

@Component({
    selector: 'mc-feed-toggler',
    templateUrl: './feedToggler.component.html',
    imports: [RouterLink]
})
export class FeedTogglerComponent {
  readonly tagName$$ = input<string | undefined>(undefined, { alias: 'tagName' });

  private readonly router = inject(Router);

  private readonly currentPath$$ = toSignal(
    this.router.events.pipe(
      filter((ev: RouterEvent): ev is NavigationEnd => ev instanceof NavigationEnd),
      map(() => this.router.url)
    ),
    { initialValue: this.router.url }
  );

  readonly items$$ = computed<MenuItem[]>(() => {
    const items: MenuItem[] = [
      {
        label: 'Gallery',
        icon: 'pi pi-globe',
        routerLink: ['/'],
        routerLinkActiveOptions: { exact: true },
      },
    ];

    const tagName = this.tagName$$();
    if (tagName) {
      items.push({
        label: `#${tagName}`,
        icon: 'pi pi-tag',
        routerLink: ['/tag', tagName],
        routerLinkActiveOptions: { exact: true }, // ✅ exact match
      });
    }

    return items;
  });

  readonly activeItem$$ = computed<MenuItem>(() => {
    const items = this.items$$();
    const fallback: MenuItem = items[0] ?? {
      label: 'Gallery',
      icon: 'pi pi-globe',
      routerLink: ['/'],
      routerLinkActiveOptions: { exact: true },
    };
    if (!items.length) return fallback;

    const path = this.currentPath$$().split('?')[0];

    const match = items.find((it: MenuItem) => {
      const link = Array.isArray(it.routerLink)
        ? it.routerLink.join('/')
        : (it.routerLink as string);
      const normalized = link.startsWith('/') ? link : `/${link}`;
      return path === normalized || path.startsWith(normalized + '/');
    });

    return match ?? fallback;
  });
}
