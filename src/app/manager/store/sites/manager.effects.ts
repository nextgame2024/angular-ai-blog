import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';
import { catchError, map, switchMap, withLatestFrom } from 'rxjs/operators';

import { ManagerSitesService } from '../../services/manager.sites.service';
import { ManagerSitesActions } from './manager.actions';
import {
  selectManagerEditingSite,
  selectManagerSitesSearchQuery,
} from './manager.selectors';

@Injectable()
export class ManagerSitesEffects {
  constructor(
    private actions$: Actions,
    private api: ManagerSitesService,
    private store: Store,
  ) {}

  loadSites$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerSitesActions.loadSites),
      withLatestFrom(this.store.select(selectManagerSitesSearchQuery)),
      switchMap(([{ page }, q]) =>
        this.api.listSites({ page, limit: 20, q: q || undefined }).pipe(
          map((result) => ManagerSitesActions.loadSitesSuccess({ result })),
          catchError((err) =>
            of(
              ManagerSitesActions.loadSitesFailure({
                error: err?.error?.error || err?.message || 'Failed to load sites',
              }),
            ),
          ),
        ),
      ),
    ),
  );

  saveSite$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerSitesActions.saveSite),
      withLatestFrom(this.store.select(selectManagerEditingSite)),
      switchMap(([{ payload }, editing]) => {
        const req$ = editing
          ? this.api.updateSite(editing.siteId, payload)
          : this.api.createSite(payload);
        return req$.pipe(
          map((res) => ManagerSitesActions.saveSiteSuccess({ site: res.site })),
          catchError((err) =>
            of(
              ManagerSitesActions.saveSiteFailure({
                error: err?.error?.error || err?.message || 'Failed to save site',
              }),
            ),
          ),
        );
      }),
    ),
  );

  removeSite$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerSitesActions.removeSite),
      switchMap(({ siteId }) =>
        this.api.removeSite(siteId).pipe(
          map(() => ManagerSitesActions.removeSiteSuccess({ siteId })),
          catchError((err) =>
            of(
              ManagerSitesActions.removeSiteFailure({
                error: err?.error?.error || err?.message || 'Failed to archive site',
              }),
            ),
          ),
        ),
      ),
    ),
  );
}
