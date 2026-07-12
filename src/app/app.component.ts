import { Component, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { TopBarComponent } from './auth/components/topBar/topBar.component';
import { Store } from '@ngrx/store';
import { authActions } from './auth/store/actions';
import { FooterComponent } from 'src/app/shared/components/footer/footer.component';
import { PrimeIconsService } from 'src/app/shared/services/prime-icons.service';
import { AnalyticsService } from './shared/services/analytics.service';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    imports: [CommonModule, RouterOutlet, TopBarComponent, FooterComponent]
})
export class AppComponent {
  private readonly store = inject(Store);
  private readonly primeIcons = inject(PrimeIconsService);
  readonly analytics = inject(AnalyticsService);

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
