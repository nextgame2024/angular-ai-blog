import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';

import { provideRouter } from '@angular/router';
import { appRoutes } from './app/app.routes';

import { importProvidersFrom, isDevMode } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';

import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { CommonModule } from '@angular/common';

import { provideStore, provideState } from '@ngrx/store';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { provideEffects } from '@ngrx/effects';
import { provideRouterStore, routerReducer } from '@ngrx/router-store';

import { authFeatureKey, authReducer } from './app/auth/store/reducers';
import * as authEffects from './app/auth/store/effects';

import {
  feedFeatureKey,
  feedReducer,
} from './app/shared/components/feed/store/reducers';
import * as feedEffects from './app/shared/components/feed/store/effects';

import {
  popularTagsFeatureKey,
  popularTagsReducer,
} from './app/shared/components/popularTags/store/reducers';
import * as popularTagsEffects from './app/shared/components/popularTags/store/effects';

import * as addToFavoritesEffects from './app/shared/components/addToFavorites/store/effects';
import { AddToFavoritesService } from './app/shared/components/addToFavorites/services/addToFavorites.service';

import { followFeatureKey, followReducer } from './app/follow/store/reducers';
import * as followEffects from './app/follow/store/effects';

import { authInterceptor } from './app/shared/services/authInterceptor';
import {
  uploadFeatureKey,
  avatarUploadReducer,
} from './app/settings/components/settings/store';
import * as uploadEffects from './app/settings/components/settings/store/upload.effects';

// PrimeNG modules (add/remove as you need)
import { MenubarModule } from 'primeng/menubar';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { MessagesModule } from 'primeng/messages';
import { CardModule } from 'primeng/card';
import { PaginatorModule } from 'primeng/paginator';
import { ChipModule } from 'primeng/chip';
import { TagModule } from 'primeng/tag';
import { FileUploadModule } from 'primeng/fileupload';

bootstrapApplication(AppComponent, {
  providers: [
    // HTTP + interceptor
    provideHttpClient(withInterceptors([authInterceptor])),

    // Router
    provideRouter(appRoutes),
    provideRouterStore(),

    // NgRx
    provideStore({ router: routerReducer }),
    provideState(authFeatureKey, authReducer),
    provideState(feedFeatureKey, feedReducer),
    provideState(popularTagsFeatureKey, popularTagsReducer),
    provideState(followFeatureKey, followReducer),
    provideState(uploadFeatureKey, avatarUploadReducer),
    provideEffects(
      authEffects,
      feedEffects,
      popularTagsEffects,
      addToFavoritesEffects,
      followEffects,
      uploadEffects.UploadEffects
    ),
    provideStoreDevtools({
      maxAge: 25,
      logOnly: !isDevMode(),
      autoPause: true,
      trace: false,
      traceLimit: 75,
    }),

    // Animations required by PrimeNG
    provideAnimations(),

    // Make shared Angular/PrimeNG modules available app-wide
    importProvidersFrom(
      CommonModule,
      MenubarModule,
      AvatarModule,
      ButtonModule,
      InputTextModule,
      PasswordModule,
      MessagesModule,
      CardModule,
      PaginatorModule,
      ChipModule,
      TagModule,
      FileUploadModule
    ),

    // Services
    AddToFavoritesService,
  ],
});
