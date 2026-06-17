import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';
import { catchError, map, switchMap, withLatestFrom } from 'rxjs/operators';

import { ManagerExploreService } from '../../services/manager.explore.service';
import { ManagerExploreActions } from './manager.actions';
import { selectManagerExploreSearchQuery } from './manager.selectors';

@Injectable()
export class ManagerExploreEffects {
  private readonly actions$ = inject(Actions);
  private readonly store = inject(Store);
  private readonly api = inject(ManagerExploreService);

  readonly loadExploreVideos$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerExploreActions.loadExploreVideos),
      withLatestFrom(this.store.select(selectManagerExploreSearchQuery)),
      switchMap(([{ page }, query]) =>
        this.api
          .listExploreVideos({
            page,
            limit: 6,
            q: query || undefined,
          })
          .pipe(
            map((result) =>
              ManagerExploreActions.loadExploreVideosSuccess({ result }),
            ),
            catchError((error: unknown) =>
              of(
                ManagerExploreActions.loadExploreVideosFailure({
                  error:
                    error instanceof Error
                      ? error.message
                      : 'Failed to load Business Manager videos',
                }),
              ),
            ),
          ),
      ),
    ),
  );
}
