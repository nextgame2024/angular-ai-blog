import { Component, effect, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TopBarComponent } from './auth/components/topBar/topBar.component';
import { Store } from '@ngrx/store';
import { authActions } from './auth/store/actions';
import { FooterComponent } from 'src/app/shared/components/footer/footer.component';
import { PrimeIconsService } from 'src/app/shared/services/prime-icons.service';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    imports: [RouterOutlet, TopBarComponent, FooterComponent]
})
export class AppComponent {
  private readonly store = inject(Store);
  private readonly primeIcons = inject(PrimeIconsService);

  private readonly initEffect = effect(() => {
    this.store.dispatch(authActions.getCurrentUser());
    this.primeIcons.ensureLoaded();
  });
}
