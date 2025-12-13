// src/app/planner/planner.routes.ts
import { Route } from '@angular/router';
import { PreAssessmentComponent } from './components/preAssessment.component';
import { PlannerService } from './services/planner.service';
import { provideEffects } from '@ngrx/effects';
import { provideState } from '@ngrx/store';
import { plannerFeatureKey, plannerReducer } from './store/reducers';
import { PlannerEffects } from './store/effects';

export const routes: Route[] = [
  {
    path: '',
    component: PreAssessmentComponent,
    providers: [
      PlannerService,
      provideEffects(PlannerEffects),
      provideState(plannerFeatureKey, plannerReducer),
    ],
  },
];
