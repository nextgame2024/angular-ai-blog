import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import * as PlannerActions from './actions';
import { PlannerService } from '../services/planner.service';
import { catchError, map, mergeMap, of } from 'rxjs';

@Injectable()
export class PlannerEffects {
  createPreAssessment$ = createEffect(() =>
    this.actions$.pipe(
      ofType(PlannerActions.createPreAssessmentAction),
      mergeMap(({ site, proposal }) =>
        this.plannerService.createPreAssessment(site, proposal).pipe(
          map((result) =>
            PlannerActions.createPreAssessmentSuccessAction({ result })
          ),
          catchError((errorResponse) => {
            let message = 'Unable to create pre-assessment';

            const err = errorResponse?.error;
            if (err) {
              if (typeof err === 'string') {
                message = err;
              } else if (typeof err.error === 'string') {
                message = err.error;
              } else if (typeof err.error?.message === 'string') {
                message = err.error.message;
              }
            }

            return of(
              PlannerActions.createPreAssessmentFailureAction({
                error: message,
              })
            );
          })
        )
      )
    )
  );

  constructor(
    private readonly actions$: Actions,
    private readonly plannerService: PlannerService
  ) {}
}
