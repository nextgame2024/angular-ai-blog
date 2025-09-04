import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Store } from '@ngrx/store';
import { filter } from 'rxjs/operators';
import { selectCurrentUser } from 'src/app/auth/store/reducers';

/* PrimeNG */
import { TabMenuModule } from 'primeng/tabmenu';
import { MenuItem } from 'primeng/api';

@Component({
  selector: 'mc-feed-toggler',
  templateUrl: './feedToggler.component.html',
  standalone: true,
  imports: [CommonModule, TabMenuModule],
})
export class FeedTogglerComponent implements OnChanges {
  @Input() tagName?: string;

  items: MenuItem[] = [];
  activeItem!: MenuItem; // <-- definite assignment (never undefined)
  private hasUser = false;

  constructor(private store: Store, private router: Router) {
    // Initial build so activeItem is set before first render
    this.rebuildItems();
    this.setActiveFromUrl();

    // React to auth changes
    this.store.select(selectCurrentUser).subscribe((u) => {
      this.hasUser = !!u;
      this.rebuildItems();
      this.setActiveFromUrl();
    });

    // React to navigation
    this.router.events
      .pipe(filter((ev): ev is NavigationEnd => ev instanceof NavigationEnd))
      .subscribe(() => this.setActiveFromUrl());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ('tagName' in changes) {
      this.rebuildItems();
      this.setActiveFromUrl();
    }
  }

  private rebuildItems(): void {
    const items: MenuItem[] = [];

    if (this.hasUser) {
      items.push({
        label: 'Your feed',
        icon: 'pi pi-user',
        routerLink: ['/feed'],
      });
    }

    items.push({
      label: 'Global feed',
      icon: 'pi pi-globe',
      routerLink: ['/'],
    });

    if (this.tagName) {
      items.push({
        label: `#${this.tagName}`,
        icon: 'pi pi-tag',
        routerLink: ['/tags', this.tagName],
      });
    }

    this.items = items;

    // Ensure activeItem is *always* set to a valid item
    if (this.items.length && !this.activeItem) {
      this.activeItem = this.items[0];
    }
  }

  private setActiveFromUrl(): void {
    if (!this.items.length) return;

    const path = this.router.url.split('?')[0];

    const match = this.items.find((it) => {
      const link = Array.isArray(it.routerLink)
        ? it.routerLink.join('/')
        : (it.routerLink as string);
      const normalized = link.startsWith('/') ? link : `/${link}`;
      return path === normalized || path.startsWith(normalized + '/');
    });

    this.activeItem = match ?? this.items[0]; // always a MenuItem
  }
}
