/**
 * Teams Effects (NgRx)
 * --------------------
 * WHAT IS THIS FILE?
 * Effects listen to actions and perform *side effects* such as HTTP calls,
 * then dispatch new actions with the results (success/failure).
 *
 * WHY DO WE NEED EFFECTS?
 * - Keep components dumb (no HTTP logic in the UI).
 * - Centralize async workflows (retry, map, error handling).
 *
 * TRAINING FLOW:
 * Component → dispatch(Action) → Effect intercepts → Service(HTTP) →
 * → Effect dispatches Success/Failure → Reducer updates Store → UI updates via selectors.
 */

import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, of, switchMap } from 'rxjs';

import { TeamsService } from '../services/teams.service';
import { teamsActions } from './actions';

export const loadTeamsEffect = createEffect(
  (
    actions$ = inject(Actions), // Stream of all actions
    api = inject(TeamsService) // Our HTTP service for Teams
  ) => {
    return actions$.pipe(
      // Only react to the "Load" action
      ofType(teamsActions.load),
      // switchMap cancels previous pending loads (if any) and starts a new HTTP call
      switchMap(() =>
        api.list().pipe(
          // On success, map the HTTP response into a "Load success" action
          map((res) => teamsActions.loadSuccess({ teams: res.teams })),
          // On error, emit a "Load failure" action (with a safe message)
          catchError((err) =>
            of(
              teamsActions.loadFailure({
                error: err?.error?.error || 'Failed to load teams',
              })
            )
          )
        )
      )
    );
  },
  { functional: true } // use the new Angular inject() style without classes
);

export const createTeamEffect = createEffect(
  (actions$ = inject(Actions), api = inject(TeamsService)) => {
    return actions$.pipe(
      ofType(teamsActions.create),
      switchMap(({ name }) =>
        api.create(name).pipe(
          map((res) => teamsActions.createSuccess({ team: res.team })),
          catchError((err) =>
            of(
              teamsActions.createFailure({
                error: err?.error?.error || 'Failed to create team',
              })
            )
          )
        )
      )
    );
  },
  { functional: true }
);

export const updateTeamEffect = createEffect(
  (actions$ = inject(Actions), api = inject(TeamsService)) => {
    return actions$.pipe(
      ofType(teamsActions.update),
      switchMap(({ id, name }) =>
        api.update(id, name).pipe(
          map((res) => teamsActions.updateSuccess({ team: res.team })),
          catchError((err) =>
            of(
              teamsActions.updateFailure({
                error: err?.error?.error || 'Failed to update team',
              })
            )
          )
        )
      )
    );
  },
  { functional: true }
);

export const deleteTeamEffect = createEffect(
  (actions$ = inject(Actions), api = inject(TeamsService)) => {
    return actions$.pipe(
      ofType(teamsActions.delete),
      switchMap(({ id }) =>
        api.delete(id).pipe(
          map(() => teamsActions.deleteSuccess({ id })),
          catchError((err) =>
            of(
              teamsActions.deleteFailure({
                error: err?.error?.error || 'Failed to delete team',
              })
            )
          )
        )
      )
    );
  },
  { functional: true }
);

export const reorderTeamsEffect = createEffect(
  (actions$ = inject(Actions), api = inject(TeamsService)) => {
    return actions$.pipe(
      ofType(teamsActions.reorder),
      switchMap(({ ids }) =>
        api.reorder(ids).pipe(
          map((res) => teamsActions.reorderSuccess({ teams: res.teams })),
          catchError((err) =>
            of(
              teamsActions.reorderFailure({
                error: err?.error?.error || 'Failed to reorder teams',
              })
            )
          )
        )
      )
    );
  },
  { functional: true }
);

/**
 * NOTE:
 * We intentionally do not navigate or show toasts in these effects.
 * - Navigation back to the list happens in the Members component after save.
 * - If you want global toasts, you can add a small effect that listens to
 *   any *failure action and shows a PrimeNG toast.
 */
