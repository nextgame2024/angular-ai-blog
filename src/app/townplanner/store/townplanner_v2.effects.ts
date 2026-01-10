import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, mergeMap, of } from 'rxjs';
import { TownPlannerV2Actions } from './townplanner_v2.actions';
import { TownPlannerV2Service } from '../services/townplanner_v2.service';

@Injectable()
export class TownPlannerV2Effects {
  lookupProperty$ = createEffect(() =>
    this.actions$.pipe(
      ofType(TownPlannerV2Actions.lookupProperty),
      mergeMap(({ address }) =>
        this.api.lookupProperty(address).pipe(
          map((result) =>
            TownPlannerV2Actions.lookupPropertySuccess({ result })
          ),
          catchError((err) =>
            of(
              TownPlannerV2Actions.lookupPropertyFailure({
                error:
                  err?.error?.error ||
                  err?.message ||
                  'Failed to lookup property',
              })
            )
          )
        )
      )
    )
  );

  constructor(private actions$: Actions, private api: TownPlannerV2Service) {}
}
