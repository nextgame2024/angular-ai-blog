import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';
import { catchError, map, switchMap, withLatestFrom } from 'rxjs/operators';

import { ManagerLaborActions } from './manager.actions';
import { ManagerLaborService } from '../../services/manager.labor.service';
import {
  selectManagerLaborSearchQuery,
  selectManagerEditingLabor,
} from './manager.selectors';

@Injectable()
export class ManagerLaborEffects {
  constructor(
    private actions$: Actions,
    private api: ManagerLaborService,
    private store: Store,
  ) {}

  loadLabor$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerLaborActions.loadLabor),
      withLatestFrom(this.store.select(selectManagerLaborSearchQuery)),
      switchMap(([{ page }, q]) =>
        this.api.listLabor({ page, limit: 20, q: q || undefined }).pipe(
          map((result) => ManagerLaborActions.loadLaborSuccess({ result })),
          catchError((err) =>
            of(
              ManagerLaborActions.loadLaborFailure({
                error:
                  err?.error?.error ||
                  err?.message ||
                  'Failed to load labor',
              }),
            ),
          ),
        ),
      ),
    ),
  );

  saveLabor$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerLaborActions.saveLabor),
      withLatestFrom(this.store.select(selectManagerEditingLabor)),
      switchMap(([{ payload }, editing]) => {
        const req$ = editing
          ? this.api.updateLabor(editing.laborId, payload)
          : this.api.createLabor(payload);

        return req$.pipe(
          map((res) =>
            ManagerLaborActions.saveLaborSuccess({ labor: res.labor }),
          ),
          catchError((err) =>
            of(
              ManagerLaborActions.saveLaborFailure({
                error:
                  err?.error?.error ||
                  err?.message ||
                  'Failed to save labor',
              }),
            ),
          ),
        );
      }),
    ),
  );

  removeLabor$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerLaborActions.removeLabor),
      switchMap(({ laborId }) =>
        this.api.removeLabor(laborId).pipe(
          map((res) =>
            ManagerLaborActions.removeLaborSuccess({
              laborId: res.laborId,
              action: res.action,
            }),
          ),
          catchError((err) =>
            of(
              ManagerLaborActions.removeLaborFailure({
                error:
                  err?.error?.error ||
                  err?.message ||
                  'Failed to remove labor',
              }),
            ),
          ),
        ),
      ),
    ),
  );
}
