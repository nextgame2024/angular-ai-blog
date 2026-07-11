import type {
  ToolkitCategory,
  ToolkitCategoryDetail,
  ToolkitProgress,
  ToolkitQuickAction,
  ToolkitRecipe,
} from '../../types/toolkit.interface';
import type { ToolkitView } from './manager.actions';

export interface ManagerToolkitState {
  view: ToolkitView;
  searchQuery: string;
  categories: ToolkitCategory[];
  quickActions: ToolkitQuickAction[];
  featuredRecipes: ToolkitRecipe[];
  popularRecipes: ToolkitRecipe[];
  recipes: ToolkitRecipe[];
  favoriteRecipes: ToolkitRecipe[];
  recipesPage: number;
  recipesLimit: number;
  recipesTotal: number;
  selectedCategory: ToolkitCategoryDetail | null;
  selectedRecipe: ToolkitRecipe | null;
  progress: ToolkitProgress;
  dashboardLoaded: boolean;
  recipesLoaded: boolean;
  favoritesLoaded: boolean;
  loading: boolean;
  error: string | null;
}

export const initialManagerToolkitState: ManagerToolkitState = {
  view: 'home',
  searchQuery: '',
  categories: [],
  quickActions: [],
  featuredRecipes: [],
  popularRecipes: [],
  recipes: [],
  favoriteRecipes: [],
  recipesPage: 1,
  recipesLimit: 50,
  recipesTotal: 0,
  selectedCategory: null,
  selectedRecipe: null,
  progress: {
    recipesUsed: 0,
    favoriteRecipes: 0,
    timeSavedMinutes: 0,
  },
  dashboardLoaded: false,
  recipesLoaded: false,
  favoritesLoaded: false,
  loading: false,
  error: null,
};
