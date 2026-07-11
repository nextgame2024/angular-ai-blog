import { createReducer, on } from '@ngrx/store';

import { ManagerToolkitActions } from './manager.actions';
import { initialManagerToolkitState } from './manager.state';

export const MANAGER_TOOLKIT_FEATURE_KEY = 'managerToolkit';

function updateFavoriteFlag<T extends { slug?: string; recipeSlug?: string; isFavorite?: boolean }>(
  items: T[],
  recipeSlug: string,
  isFavorite: boolean,
): T[] {
  return items.map((item) => {
    const slug = item.slug || item.recipeSlug;
    return slug === recipeSlug ? { ...item, isFavorite } : item;
  });
}

export const managerToolkitReducer = createReducer(
  initialManagerToolkitState,
  on(ManagerToolkitActions.setView, (state, { view }) => ({ ...state, view })),
  on(ManagerToolkitActions.setSearchQuery, (state, { query }) => ({
    ...state,
    searchQuery: query,
    recipesLoaded: false,
  })),
  on(
    ManagerToolkitActions.loadDashboard,
    ManagerToolkitActions.loadRecipes,
    ManagerToolkitActions.loadCategory,
    ManagerToolkitActions.loadRecipe,
    ManagerToolkitActions.toggleFavorite,
    ManagerToolkitActions.markRecipeUsed,
    (state) => ({ ...state, loading: true, error: null }),
  ),
  on(ManagerToolkitActions.loadDashboardSuccess, (state, { dashboard }) => ({
    ...state,
    loading: false,
    categories: dashboard.categories || [],
    quickActions: dashboard.quickActions || [],
    featuredRecipes: dashboard.featuredRecipes || [],
    popularRecipes: dashboard.popularRecipes || [],
    progress: dashboard.progress || state.progress,
    dashboardLoaded: true,
  })),
  on(ManagerToolkitActions.loadRecipesSuccess, (state, { result, favorite }) => ({
    ...state,
    loading: false,
    recipes: favorite ? state.recipes : result.recipes || [],
    favoriteRecipes: favorite ? result.recipes || [] : state.favoriteRecipes,
    recipesPage: result.page || 1,
    recipesLimit: result.limit || 50,
    recipesTotal: favorite ? state.recipesTotal : result.total || 0,
    recipesLoaded: favorite ? state.recipesLoaded : true,
    favoritesLoaded: favorite ? true : state.favoritesLoaded,
  })),
  on(ManagerToolkitActions.loadCategorySuccess, (state, { category }) => ({
    ...state,
    loading: false,
    selectedCategory: category,
  })),
  on(ManagerToolkitActions.loadRecipeSuccess, (state, { recipe }) => ({
    ...state,
    loading: false,
    selectedRecipe: recipe,
  })),
  on(
    ManagerToolkitActions.toggleFavoriteSuccess,
    (state, { recipeSlug, isFavorite }) => ({
      ...state,
      loading: false,
      featuredRecipes: updateFavoriteFlag(
        state.featuredRecipes,
        recipeSlug,
        isFavorite,
      ),
      popularRecipes: updateFavoriteFlag(
        state.popularRecipes,
        recipeSlug,
        isFavorite,
      ),
      quickActions: updateFavoriteFlag(
        state.quickActions,
        recipeSlug,
        isFavorite,
      ),
      recipes: updateFavoriteFlag(state.recipes, recipeSlug, isFavorite),
      favoriteRecipes: isFavorite
        ? updateFavoriteFlag(state.favoriteRecipes, recipeSlug, isFavorite)
        : state.favoriteRecipes.filter((recipe) => recipe.slug !== recipeSlug),
      selectedRecipe:
        state.selectedRecipe?.slug === recipeSlug
          ? { ...state.selectedRecipe, isFavorite }
          : state.selectedRecipe,
      progress: {
        ...state.progress,
        favoriteRecipes: Math.max(
          0,
          state.progress.favoriteRecipes + (isFavorite ? 1 : -1),
        ),
      },
      favoritesLoaded: false,
      dashboardLoaded: false,
    }),
  ),
  on(ManagerToolkitActions.markRecipeUsedSuccess, (state) => ({
    ...state,
    loading: false,
    dashboardLoaded: false,
  })),
  on(
    ManagerToolkitActions.loadDashboardFailure,
    ManagerToolkitActions.loadRecipesFailure,
    ManagerToolkitActions.loadCategoryFailure,
    ManagerToolkitActions.loadRecipeFailure,
    ManagerToolkitActions.toggleFavoriteFailure,
    ManagerToolkitActions.markRecipeUsedFailure,
    (state, { error }) => ({ ...state, loading: false, error }),
  ),
);
