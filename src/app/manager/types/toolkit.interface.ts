export interface ToolkitCategory {
  slug: string;
  name: string;
  description: string;
  icon: string;
  recipeCount: number;
}

export interface ToolkitRecipe {
  slug: string;
  sourceId: number;
  title: string;
  category: string;
  categorySlug: string;
  description: string;
  purpose: string;
  whenToUse: string;
  prompt: string;
  beforeUse: string[];
  difficulty: string;
  timeSavedMinutes: number;
  bestTool: string;
  rating: number;
  isPopular: boolean;
  isFeatured: boolean;
  courseType: string;
  level: string;
  isFavorite: boolean;
  tags: string[];
  relatedRecipes?: Array<{ slug: string; title: string }>;
}

export interface ToolkitQuickAction {
  label: string;
  icon: string;
  recipeSlug: string;
  recipeTitle: string;
  recipeDescription: string;
  isFavorite: boolean;
}

export interface ToolkitProgress {
  recipesUsed: number;
  favoriteRecipes: number;
  timeSavedMinutes: number;
}

export interface ToolkitDashboard {
  categories: ToolkitCategory[];
  quickActions: ToolkitQuickAction[];
  featuredRecipes: ToolkitRecipe[];
  popularRecipes: ToolkitRecipe[];
  progress: ToolkitProgress;
}

export interface ToolkitCategoryDetail extends ToolkitCategory {
  recipes: ToolkitRecipe[];
}

export interface ToolkitRecipesResponse {
  recipes: ToolkitRecipe[];
  total: number;
  limit: number;
  offset: number;
  page: number;
}

export interface ToolkitCategoriesResponse {
  categories: ToolkitCategory[];
}

export interface ToolkitRecipeResponse {
  recipe: ToolkitRecipe;
}

export interface ToolkitCategoryResponse {
  category: ToolkitCategoryDetail;
}
