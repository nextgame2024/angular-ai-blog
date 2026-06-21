import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';
import { catchError, map, switchMap, withLatestFrom } from 'rxjs/operators';

import { ManagerPalletsService } from '../../services/manager.pallets.service';
import { ManagerPalletsActions } from './manager.actions';
import { selectManagerPalletsSearchQuery } from './manager.selectors';

@Injectable()
export class ManagerPalletsEffects {
  constructor(
    private actions$: Actions,
    private api: ManagerPalletsService,
    private store: Store,
  ) {}

  loadContext$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerPalletsActions.loadContext),
      switchMap(() =>
        this.api.getContext().pipe(
          map((context) => ManagerPalletsActions.loadContextSuccess({ context })),
          catchError((err) =>
            of(
              ManagerPalletsActions.loadContextFailure({
                error:
                  err?.error?.error || err?.message || 'Failed to load pallet sites',
              }),
            ),
          ),
        ),
      ),
    ),
  );

  loadOnSite$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerPalletsActions.loadOnSite),
      withLatestFrom(this.store.select(selectManagerPalletsSearchQuery)),
      switchMap(([{ page }, q]) =>
        this.api.listOnSite({ page, limit: 20, q: q || undefined }).pipe(
          map((result) => ManagerPalletsActions.loadOnSiteSuccess({ result })),
          catchError((err) =>
            of(
              ManagerPalletsActions.loadOnSiteFailure({
                error:
                  err?.error?.error || err?.message || 'Failed to load pallet inventory',
              }),
            ),
          ),
        ),
      ),
    ),
  );

  loadSent$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerPalletsActions.loadSent),
      switchMap(({ page }) =>
        this.api.listSent({ page, limit: 20 }).pipe(
          map((result) => ManagerPalletsActions.loadSentSuccess({ result })),
          catchError((err) =>
            of(
              ManagerPalletsActions.loadSentFailure({
                error:
                  err?.error?.error || err?.message || 'Failed to load sent pallets',
              }),
            ),
          ),
        ),
      ),
    ),
  );

  loadIncoming$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerPalletsActions.loadIncoming),
      switchMap(({ page }) =>
        this.api.listIncoming({ page, limit: 20 }).pipe(
          map((result) => ManagerPalletsActions.loadIncomingSuccess({ result })),
          catchError((err) =>
            of(
              ManagerPalletsActions.loadIncomingFailure({
                error:
                  err?.error?.error || err?.message || 'Failed to load pallets in transit',
              }),
            ),
          ),
        ),
      ),
    ),
  );

  movePallets$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerPalletsActions.movePallets),
      switchMap(({ payload }) =>
        this.api.movePallets(payload).pipe(
          map((res) =>
            ManagerPalletsActions.movePalletsSuccess({ movement: res.movement }),
          ),
          catchError((err) =>
            of(
              ManagerPalletsActions.movePalletsFailure({
                error:
                  err?.error?.error || err?.message || 'Failed to move pallets',
              }),
            ),
          ),
        ),
      ),
    ),
  );

  deleteMovement$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerPalletsActions.deleteMovement),
      switchMap(({ palletId }) =>
        this.api.deleteMovement(palletId).pipe(
          map(() => ManagerPalletsActions.deleteMovementSuccess({ palletId })),
          catchError((err) =>
            of(
              ManagerPalletsActions.deleteMovementFailure({
                error:
                  err?.error?.error || err?.message || 'Failed to delete movement',
              }),
            ),
          ),
        ),
      ),
    ),
  );

  receiveMovement$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerPalletsActions.receiveMovement),
      switchMap(({ palletId }) =>
        this.api.receiveMovement(palletId).pipe(
          map(() => ManagerPalletsActions.receiveMovementSuccess({ palletId })),
          catchError((err) =>
            of(
              ManagerPalletsActions.receiveMovementFailure({
                error:
                  err?.error?.error || err?.message || 'Failed to receive pallets',
              }),
            ),
          ),
        ),
      ),
    ),
  );
}
