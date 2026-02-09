import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';
import { catchError, map, switchMap, withLatestFrom } from 'rxjs/operators';

import { ManagerPricingActions } from './manager.actions';
import { ManagerPricingService } from '../../services/manager.pricing.service';
import {
  selectManagerPricingSearchQuery,
  selectManagerEditingPricingProfile,
} from './manager.selectors';

@Injectable()
export class ManagerPricingEffects {
  constructor(
    private actions$: Actions,
    private api: ManagerPricingService,
    private store: Store,
  ) {}

  loadPricingProfiles$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerPricingActions.loadPricingProfiles),
      withLatestFrom(this.store.select(selectManagerPricingSearchQuery)),
      switchMap(([{ page }, q]) =>
        this.api.listPricingProfiles({ page, limit: 20, q: q || undefined }).pipe(
          map((result) =>
            ManagerPricingActions.loadPricingProfilesSuccess({ result }),
          ),
          catchError((err) =>
            of(
              ManagerPricingActions.loadPricingProfilesFailure({
                error:
                  err?.error?.error ||
                  err?.message ||
                  'Failed to load pricing profiles',
              }),
            ),
          ),
        ),
      ),
    ),
  );

  savePricingProfile$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerPricingActions.savePricingProfile),
      withLatestFrom(this.store.select(selectManagerEditingPricingProfile)),
      switchMap(([{ payload }, editing]) => {
        const req$ = editing
          ? this.api.updatePricingProfile(editing.pricingProfileId, payload)
          : this.api.createPricingProfile(payload);

        return req$.pipe(
          map((res) =>
            ManagerPricingActions.savePricingProfileSuccess({
              pricingProfile: res.pricingProfile,
            }),
          ),
          catchError((err) =>
            of(
              ManagerPricingActions.savePricingProfileFailure({
                error:
                  err?.error?.error ||
                  err?.message ||
                  'Failed to save pricing profile',
              }),
            ),
          ),
        );
      }),
    ),
  );

  removePricingProfile$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerPricingActions.removePricingProfile),
      switchMap(({ pricingProfileId }) =>
        this.api.removePricingProfile(pricingProfileId).pipe(
          map((res) =>
            ManagerPricingActions.removePricingProfileSuccess({
              pricingProfileId: res?.pricingProfileId ?? pricingProfileId,
              action: res?.action ?? 'archived',
            }),
          ),
          catchError((err) =>
            of(
              ManagerPricingActions.removePricingProfileFailure({
                error:
                  err?.error?.error ||
                  err?.message ||
                  'Failed to remove pricing profile',
              }),
            ),
          ),
        ),
      ),
    ),
  );
}
