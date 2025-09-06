import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { catchError, map, mergeMap } from 'rxjs/operators';
import { followActions } from './actions';
import { FollowService } from 'src/app/shared/services/follow.service';

export const loadSuggestionsEffect = createEffect(
  (actions$ = inject(Actions), api = inject(FollowService)) => {
    return actions$.pipe(
      ofType(followActions.loadSuggestions),
      mergeMap(({ limit }) =>
        api.suggestions(limit ?? 6).pipe(
          map((profiles) => followActions.loadSuggestionsSuccess({ profiles })),
          catchError((error) =>
            of(followActions.loadSuggestionsFailure({ error }))
          )
        )
      )
    );
  },
  { functional: true }
);

export const followEffect = createEffect(
  (actions$ = inject(Actions), api = inject(FollowService)) => {
    return actions$.pipe(
      ofType(followActions.follow),
      mergeMap(({ username }) =>
        api.follow(username).pipe(
          map((profile) => followActions.followSuccess({ profile })),
          catchError((error) => of(followActions.followFailure({ error })))
        )
      )
    );
  },
  { functional: true }
);

export const unfollowEffect = createEffect(
  (actions$ = inject(Actions), api = inject(FollowService)) => {
    return actions$.pipe(
      ofType(followActions.unfollow),
      mergeMap(({ username }) =>
        api.unfollow(username).pipe(
          map((profile) => followActions.unfollowSuccess({ profile })),
          catchError((error) => of(followActions.unfollowFailure({ error })))
        )
      )
    );
  },
  { functional: true }
);
