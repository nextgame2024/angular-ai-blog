/**
 * Teams feature routes
 * --------------------
 * Why this looks "different":
 * - We lazy-load this whole feature under /teams.
 * - The empty path ('') is a layout shell that hosts child pages (list, members).
 * - We register NgRx state/effects *at route level* so they only load for this feature.
 */
import { Route } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideState } from '@ngrx/store';
import { teamsReducer, teamsFeatureKey } from './store/reducers';
import * as TeamsEffects from './store/effects';

export const routes: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./components/menu/teams-layout.component').then(
        (m) => m.TeamsLayoutComponent
      ),
    // Route-level providers: feature state/effects are only loaded on /teams
    providers: [
      provideState(teamsFeatureKey, teamsReducer),
      provideEffects(TeamsEffects),
    ],
    children: [
      {
        path: 'list',
        loadComponent: () =>
          import('./components/teamList/teams-list.component').then(
            (m) => m.TeamsListComponent
          ),
      },
      // CREATE
      {
        path: 'members',
        loadComponent: () =>
          import('./components/createEditTeam/teams-members.component').then(
            (m) => m.TeamsMembersComponent
          ),
      },
      // EDIT
      {
        path: ':id/members',
        loadComponent: () =>
          import('./components/createEditTeam/teams-members.component').then(
            (m) => m.TeamsMembersComponent
          ),
      },
      { path: '', pathMatch: 'full', redirectTo: 'list' },
    ],
  },
];
