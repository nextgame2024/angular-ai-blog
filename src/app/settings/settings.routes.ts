import { Route } from '@angular/router';
import { SettingsComponent } from './components/settings/settings.component';
import { provideState } from '@ngrx/store';
import {
  settingsFeatureKey,
  settingsReducer,
} from './components/settings/store/reducers';
import { provideEffects } from '@ngrx/effects';
import {
  uploadFeatureKey,
  avatarUploadReducer,
} from './components/settings/store';
import * as uploadEffects from './components/settings/store/upload.effects';

export const routes: Route[] = [
  {
    path: '',
    component: SettingsComponent,
    providers: [
      provideState(settingsFeatureKey, settingsReducer),
      provideState(uploadFeatureKey, avatarUploadReducer),
      provideEffects(uploadEffects.UploadEffects),
    ],
  },
];
