import { createFeatureSelector, createSelector } from '@ngrx/store';

import { MANAGER_TOOLKIT_FEATURE_KEY } from './manager.reducer';
import type { ManagerToolkitState } from './manager.state';

export const selectManagerToolkitState =
  createFeatureSelector<ManagerToolkitState>(MANAGER_TOOLKIT_FEATURE_KEY);

export const selectManagerToolkitView = createSelector(
  selectManagerToolkitState,
  (state) => state.view,
);
export const selectManagerToolkitSearchQuery = createSelector(
  selectManagerToolkitState,
  (state) => state.searchQuery,
);
export const selectManagerToolkitCategories = createSelector(
  selectManagerToolkitState,
  (state) => state.categories,
);
export const selectManagerToolkitQuickActions = createSelector(
  selectManagerToolkitState,
  (state) => state.quickActions,
);
export const selectManagerToolkitFeaturedRecipes = createSelector(
  selectManagerToolkitState,
  (state) => state.featuredRecipes,
);
export const selectManagerToolkitPopularRecipes = createSelector(
  selectManagerToolkitState,
  (state) => state.popularRecipes,
);
export const selectManagerToolkitRecipes = createSelector(
  selectManagerToolkitState,
  (state) => state.recipes,
);
export const selectManagerToolkitFavoriteRecipes = createSelector(
  selectManagerToolkitState,
  (state) => state.favoriteRecipes,
);
export const selectManagerToolkitSelectedCategory = createSelector(
  selectManagerToolkitState,
  (state) => state.selectedCategory,
);
export const selectManagerToolkitSelectedRecipe = createSelector(
  selectManagerToolkitState,
  (state) => state.selectedRecipe,
);
export const selectManagerToolkitProgress = createSelector(
  selectManagerToolkitState,
  (state) => state.progress,
);
export const selectManagerToolkitLoading = createSelector(
  selectManagerToolkitState,
  (state) => state.loading,
);
export const selectManagerToolkitError = createSelector(
  selectManagerToolkitState,
  (state) => state.error,
);
export const selectManagerToolkitRecipeTotal = createSelector(
  selectManagerToolkitState,
  (state) => state.recipesTotal,
);
export const selectManagerToolkitCompletion = createSelector(
  selectManagerToolkitState,
  (state) => {
    const categoryTotal = state.categories.reduce(
      (total, category) => total + (category.recipeCount || 0),
      0,
    );
    const totalRecipes = state.recipesTotal || categoryTotal || 50;
    const recipesUsed = state.progress.recipesUsed || 0;
    const percent = Math.min(
      100,
      Math.round((recipesUsed / totalRecipes) * 100),
    );

    return {
      totalRecipes,
      recipesUsed,
      percent,
    };
  },
);
export const selectManagerToolkitDashboardLoaded = createSelector(
  selectManagerToolkitState,
  (state) => state.dashboardLoaded,
);
export const selectManagerToolkitRecipesLoaded = createSelector(
  selectManagerToolkitState,
  (state) => state.recipesLoaded,
);
export const selectManagerToolkitFavoritesLoaded = createSelector(
  selectManagerToolkitState,
  (state) => state.favoritesLoaded,
);
