import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';
import { catchError, map, switchMap, withLatestFrom } from 'rxjs/operators';

import { ManagerToolkitService } from '../../services/manager.toolkit.service';
import { ManagerToolkitActions } from './manager.actions';
import { selectManagerToolkitSearchQuery } from './manager.selectors';

function errorMessage(err: any, fallback: string): string {
  return err?.error?.error || err?.message || fallback;
}

@Injectable()
export class ManagerToolkitEffects {
  constructor(
    private actions$: Actions,
    private api: ManagerToolkitService,
    private store: Store,
  ) {}

  loadDashboard$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerToolkitActions.loadDashboard),
      switchMap(() =>
        this.api.getDashboard().pipe(
          map((dashboard) =>
            ManagerToolkitActions.loadDashboardSuccess({ dashboard }),
          ),
          catchError((err) =>
            of(
              ManagerToolkitActions.loadDashboardFailure({
                error: errorMessage(err, 'Failed to load toolkit dashboard'),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  loadRecipes$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerToolkitActions.loadRecipes),
      withLatestFrom(this.store.select(selectManagerToolkitSearchQuery)),
      switchMap(([{ page, categorySlug, favorite }, q]) =>
        this.api
          .listRecipes({
            page: page || 1,
            limit: 50,
            q: q || undefined,
            categorySlug,
            favorite,
          })
          .pipe(
            map((result) =>
              ManagerToolkitActions.loadRecipesSuccess({ result, favorite }),
            ),
            catchError((err) =>
              of(
                ManagerToolkitActions.loadRecipesFailure({
                  error: errorMessage(err, 'Failed to load recipes'),
                }),
              ),
            ),
          ),
      ),
    ),
  );

  loadCategory$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerToolkitActions.loadCategory),
      switchMap(({ slug }) =>
        this.api.getCategory(slug).pipe(
          map(({ category }) =>
            ManagerToolkitActions.loadCategorySuccess({ category }),
          ),
          catchError((err) =>
            of(
              ManagerToolkitActions.loadCategoryFailure({
                error: errorMessage(err, 'Failed to load category'),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  loadRecipe$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerToolkitActions.loadRecipe),
      switchMap(({ slug }) =>
        this.api.getRecipe(slug).pipe(
          map(({ recipe }) =>
            ManagerToolkitActions.loadRecipeSuccess({ recipe }),
          ),
          catchError((err) =>
            of(
              ManagerToolkitActions.loadRecipeFailure({
                error: errorMessage(err, 'Failed to load recipe'),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  toggleFavorite$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerToolkitActions.toggleFavorite),
      switchMap(({ recipeSlug, isFavorite }) => {
        const request$ = isFavorite
          ? this.api.removeFavorite(recipeSlug)
          : this.api.addFavorite(recipeSlug);
        return request$.pipe(
          switchMap(() =>
            of(
              ManagerToolkitActions.toggleFavoriteSuccess({
                recipeSlug,
                isFavorite: !isFavorite,
              }),
              ManagerToolkitActions.loadDashboard(),
            ),
          ),
          catchError((err) =>
            of(
              ManagerToolkitActions.toggleFavoriteFailure({
                error: errorMessage(err, 'Failed to update favorite'),
              }),
            ),
          ),
        );
      }),
    ),
  );

  markRecipeUsed$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerToolkitActions.markRecipeUsed),
      switchMap(({ recipeSlug }) =>
        this.api.markRecipeUsed(recipeSlug).pipe(
          switchMap(() =>
            of(
              ManagerToolkitActions.markRecipeUsedSuccess({ recipeSlug }),
              ManagerToolkitActions.loadDashboard(),
            ),
          ),
          catchError((err) =>
            of(
              ManagerToolkitActions.markRecipeUsedFailure({
                error: errorMessage(err, 'Failed to update recipe usage'),
              }),
            ),
          ),
        ),
      ),
    ),
  );
}
