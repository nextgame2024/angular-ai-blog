import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';

import { provideRouter } from '@angular/router';
import { appRoutes } from './app/app.routes';

import { isDevMode, provideZoneChangeDetection } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';

import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { provideStore, provideState } from '@ngrx/store';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { provideEffects } from '@ngrx/effects';
import { provideRouterStore, routerReducer } from '@ngrx/router-store';
import { providePrimeNG } from 'primeng/config';
import Lara from '@primeuix/themes/lara';

import { authFeatureKey, authReducer } from './app/auth/store/reducers';
import * as authEffects from './app/auth/store/effects';



import { authInterceptor } from './app/shared/services/authInterceptor';

bootstrapApplication(AppComponent, {
  providers: [
    // HTTP + interceptor
    provideZoneChangeDetection(),
    provideHttpClient(withInterceptors([authInterceptor])),

    // Router
    provideRouter(appRoutes),
    provideRouterStore(),

    // NgRx
    provideStore({ router: routerReducer }),
    provideState(authFeatureKey, authReducer),
    provideEffects(authEffects),
    provideStoreDevtools({
      maxAge: 25,
      logOnly: !isDevMode(),
      autoPause: true,
      trace: false,
      traceLimit: 75,
      connectInZone: true,
    }),

    // Animations required by PrimeNG
    provideAnimations(),
    providePrimeNG({
      theme: {
        preset: Lara,
        options: {
          // keep Tailwind + PrimeNG dark mode in sync
          darkModeSelector: '.dark',
        },
      },
    }),

  ],
});
