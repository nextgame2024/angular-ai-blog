import { Route } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideState } from '@ngrx/store';

import { TownPlannerV2PageComponent } from './components/townplanner_v2.page';
import { TownPlannerV2Service } from './services/townplanner_v2.service';
import { TownPlannerV2Effects } from './store/townplanner_v2.effects';
import {
  TOWNPLANNER_V2_FEATURE_KEY,
  townPlannerV2Reducer,
} from './store/townplanner_v2.reducer';

export const TOWNPLANNER_ROUTES: Route[] = [
  {
    path: '',
    component: TownPlannerV2PageComponent,
    providers: [
      TownPlannerV2Service,
      provideEffects(TownPlannerV2Effects),
      provideState(TOWNPLANNER_V2_FEATURE_KEY, townPlannerV2Reducer),
    ],
  },
];
