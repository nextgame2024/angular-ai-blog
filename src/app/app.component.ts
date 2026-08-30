import { Component, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { distinctUntilChanged, filter, map, startWith } from 'rxjs';
import { TopBarComponent } from './auth/components/topBar/topBar.component';
import { Store } from '@ngrx/store';
import { authActions } from './auth/store/actions';
import { FooterComponent } from 'src/app/shared/components/footer/footer.component';
import { PrimeIconsService } from 'src/app/shared/services/prime-icons.service';
import { AnalyticsService } from './shared/services/analytics.service';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css'],
    imports: [CommonModule, RouterOutlet, TopBarComponent, FooterComponent]
})
export class AppComponent {
  private readonly store = inject(Store);
  private readonly primeIcons = inject(PrimeIconsService);
  private readonly router = inject(Router);
  readonly analytics = inject(AnalyticsService);
  readonly isSophiaRoute$ = this.router.events.pipe(
    filter((event): event is NavigationEnd => event instanceof NavigationEnd),
    map((event) => event.urlAfterRedirects),
    startWith(this.router.url),
    map((url) => isSophiaUrl(url)),
    distinctUntilChanged(),
  );

  private readonly initEffect = effect(() => {
    this.store.dispatch(authActions.getCurrentUser());
    this.primeIcons.ensureLoaded();
    this.analytics.init();
  });

  acceptAnalytics(): void {
    this.analytics.accept();
  }

  rejectAnalytics(): void {
    this.analytics.reject();
  }
}

function isSophiaUrl(url: string): boolean {
  const path = url.split(/[?#]/, 1)[0];
  return path === '/sophia' || path.startsWith('/sophia/');
}
