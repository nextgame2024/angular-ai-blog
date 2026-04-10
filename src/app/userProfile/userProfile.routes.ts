import { Route } from '@angular/router';
import { UserProfileComponent } from './userProfile/userProfile.component';
import { UserProfileService } from './services/userProfile.service';
import * as userProfileEffects from './store/effects';
import { provideEffects } from '@ngrx/effects';
import { userProfileFeatureKey, userProfileReducer } from './store/reducers';
import { provideState } from '@ngrx/store';
import {
  feedFeatureKey,
  feedReducer,
} from '../shared/components/feed/store/reducers';
import * as feedEffects from '../shared/components/feed/store/effects';
import * as addToFavoritesEffects from '../shared/components/addToFavorites/store/effects';
import { AddToFavoritesService } from '../shared/components/addToFavorites/services/addToFavorites.service';

export const routes: Route[] = [
  {
    path: '',
    component: UserProfileComponent,
    providers: [
      UserProfileService,
      provideState(userProfileFeatureKey, userProfileReducer),
      provideEffects(userProfileEffects),
      provideState(feedFeatureKey, feedReducer),
      provideEffects(feedEffects, addToFavoritesEffects),
      AddToFavoritesService,
    ],
  },
];
