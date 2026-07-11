import { createActionGroup, emptyProps, props } from '@ngrx/store';

import type {
  ToolkitCategoryDetail,
  ToolkitDashboard,
  ToolkitRecipe,
  ToolkitRecipesResponse,
} from '../../types/toolkit.interface';

export type ToolkitView =
  | 'home'
  | 'start'
  | 'recipes'
  | 'categories'
  | 'category'
  | 'recipe'
  | 'favorites';

export const ManagerToolkitActions = createActionGroup({
  source: 'Manager Toolkit',
  events: {
    'Set View': props<{ view: ToolkitView }>(),
    'Set Search Query': props<{ query: string }>(),
    'Load Dashboard': emptyProps(),
    'Load Dashboard Success': props<{ dashboard: ToolkitDashboard }>(),
    'Load Dashboard Failure': props<{ error: string }>(),
    'Load Recipes': props<{ page?: number; categorySlug?: string; favorite?: boolean }>(),
    'Load Recipes Success': props<{
      result: ToolkitRecipesResponse;
      favorite?: boolean;
    }>(),
    'Load Recipes Failure': props<{ error: string }>(),
    'Load Category': props<{ slug: string }>(),
    'Load Category Success': props<{ category: ToolkitCategoryDetail }>(),
    'Load Category Failure': props<{ error: string }>(),
    'Load Recipe': props<{ slug: string }>(),
    'Load Recipe Success': props<{ recipe: ToolkitRecipe }>(),
    'Load Recipe Failure': props<{ error: string }>(),
    'Toggle Favorite': props<{ recipeSlug: string; isFavorite: boolean }>(),
    'Toggle Favorite Success': props<{ recipeSlug: string; isFavorite: boolean }>(),
    'Toggle Favorite Failure': props<{ error: string }>(),
    'Mark Recipe Used': props<{ recipeSlug: string }>(),
    'Mark Recipe Used Success': props<{ recipeSlug: string }>(),
    'Mark Recipe Used Failure': props<{ error: string }>(),
  },
});
