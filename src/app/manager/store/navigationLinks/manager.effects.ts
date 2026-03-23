import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';
import { catchError, map, switchMap, withLatestFrom } from 'rxjs/operators';

import { ManagerNavigationLinksActions } from './manager.actions';
import {
  selectManagerEditingNavigationLink,
  selectManagerNavigationLinksSearchQuery,
} from './manager.selectors';
import { NavigationLinksProjectsService } from '../../services/navigation.links.projects.service';

@Injectable()
export class ManagerNavigationLinksEffects {
  constructor(
    private actions$: Actions,
    private api: NavigationLinksProjectsService,
    private store: Store,
  ) {}

  loadNavigationLinks$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerNavigationLinksActions.loadNavigationLinks),
      withLatestFrom(this.store.select(selectManagerNavigationLinksSearchQuery)),
      switchMap(([{ page }, q]) =>
        this.api.listNavigationLinks({ page, limit: 20, q: q || undefined }).pipe(
          map((result) =>
            ManagerNavigationLinksActions.loadNavigationLinksSuccess({ result }),
          ),
          catchError((err) =>
            of(
              ManagerNavigationLinksActions.loadNavigationLinksFailure({
                error:
                  err?.error?.error ||
                  err?.message ||
                  'Failed to load navigation links',
              }),
            ),
          ),
        ),
      ),
    ),
  );

  saveNavigationLink$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerNavigationLinksActions.saveNavigationLink),
      withLatestFrom(this.store.select(selectManagerEditingNavigationLink)),
      switchMap(([{ payload }, editing]) => {
        const req$ = editing
          ? this.api.updateNavigationLink(editing.navigationLinkId, payload)
          : this.api.createNavigationLink(payload);

        return req$.pipe(
          map((res) =>
            ManagerNavigationLinksActions.saveNavigationLinkSuccess({
              navigationLink: res.navigationLink,
            }),
          ),
          catchError((err) =>
            of(
              ManagerNavigationLinksActions.saveNavigationLinkFailure({
                error:
                  err?.error?.error ||
                  err?.message ||
                  'Failed to save navigation link',
              }),
            ),
          ),
        );
      }),
    ),
  );

  syncNavigationLabels$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerNavigationLinksActions.syncNavigationLabels),
      switchMap(({ payload }) =>
        this.api.syncNavigationLabels(payload).pipe(
          map((result) =>
            ManagerNavigationLinksActions.syncNavigationLabelsSuccess({
              result,
            }),
          ),
          catchError((err) =>
            of(
              ManagerNavigationLinksActions.syncNavigationLabelsFailure({
                error:
                  err?.error?.error ||
                  err?.message ||
                  'Failed to sync navigation labels',
              }),
            ),
          ),
        ),
      ),
    ),
  );

  reloadAfterSync$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerNavigationLinksActions.syncNavigationLabelsSuccess),
      map(() => ManagerNavigationLinksActions.loadNavigationLinks({ page: 1 })),
    ),
  );

  removeNavigationLink$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerNavigationLinksActions.removeNavigationLink),
      switchMap(({ navigationLinkId }) =>
        this.api.removeNavigationLink(navigationLinkId).pipe(
          map(() =>
            ManagerNavigationLinksActions.removeNavigationLinkSuccess({
              navigationLinkId,
            }),
          ),
          catchError((err) =>
            of(
              ManagerNavigationLinksActions.removeNavigationLinkFailure({
                error:
                  err?.error?.error ||
                  err?.message ||
                  'Failed to remove navigation link',
              }),
            ),
          ),
        ),
      ),
    ),
  );
}
