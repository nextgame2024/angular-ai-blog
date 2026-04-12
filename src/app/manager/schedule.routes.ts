import { Route } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideState } from '@ngrx/store';

import { ManagerSchedulePageComponent } from './components/schedule/manager-schedule.page';
import { ManagerScheduleProjectsService } from './services/schedule.projects.service';
import { ManagerScheduleEffects } from './store/schedule/manager.effects';
import {
  MANAGER_SCHEDULE_FEATURE_KEY,
  managerScheduleReducer,
} from './store/schedule/manager.reducer';

export const MANAGER_SCHEDULE_ROUTE: Route = {
  path: 'scheduling',
  component: ManagerSchedulePageComponent,
  providers: [
    ManagerScheduleProjectsService,
    provideEffects(ManagerScheduleEffects),
    provideState(MANAGER_SCHEDULE_FEATURE_KEY, managerScheduleReducer),
  ],
  data: {
    title: 'Scheduling',
    fullscreen: true,
  },
};
