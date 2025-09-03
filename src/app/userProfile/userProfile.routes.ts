import { Route } from '@angular/router';
import { UserProfileComponent } from './userProfile/userProfile.component';
import { UserProfileService } from './services/userProfile.service';
import * as userProfileEffects from './store/effects';
import { provideEffects } from '@ngrx/effects';
import { userProfileFeatureKey, userProfileReducer } from './store/reducers';
import { provideState } from '@ngrx/store';

export const routes: Route[] = [
  {
    path: '',
    component: UserProfileComponent,
    providers: [
      UserProfileService,
      provideState(userProfileFeatureKey, userProfileReducer),
      provideEffects(userProfileEffects),
    ],
  },
];
