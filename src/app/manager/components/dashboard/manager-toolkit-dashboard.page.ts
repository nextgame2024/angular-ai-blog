import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Store } from '@ngrx/store';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, map, take, takeUntil } from 'rxjs/operators';

import { selectCurrentUser } from '../../../auth/store/reducers';
import {
  ManagerToolkitActions,
  ToolkitView,
} from '../../store/toolkit/manager.actions';
import {
  selectManagerToolkitCategories,
  selectManagerToolkitCompletion,
  selectManagerToolkitDashboardLoaded,
  selectManagerToolkitError,
  selectManagerToolkitFavoriteRecipes,
  selectManagerToolkitFavoritesLoaded,
  selectManagerToolkitFeaturedRecipes,
  selectManagerToolkitLoading,
  selectManagerToolkitPopularRecipes,
  selectManagerToolkitProgress,
  selectManagerToolkitQuickActions,
  selectManagerToolkitRecipeTotal,
  selectManagerToolkitRecipes,
  selectManagerToolkitRecipesLoaded,
  selectManagerToolkitSearchQuery,
  selectManagerToolkitSelectedCategory,
  selectManagerToolkitSelectedRecipe,
  selectManagerToolkitView,
} from '../../store/toolkit/manager.selectors';
import type {
  ToolkitCategory,
  ToolkitQuickAction,
  ToolkitRecipe,
} from '../../types/toolkit.interface';
import { AnalyticsService } from 'src/app/shared/services/analytics.service';

@Component({
  selector: 'app-manager-toolkit-dashboard-page',
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './manager-toolkit-dashboard.page.html',
  styleUrls: ['./manager-toolkit-dashboard.page.css'],
})
export class ManagerToolkitDashboardPageComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  readonly view$ = this.store.select(selectManagerToolkitView);
  readonly categories$ = this.store.select(selectManagerToolkitCategories);
  readonly quickActions$ = this.store.select(selectManagerToolkitQuickActions);
  readonly featuredRecipes$ = this.store.select(selectManagerToolkitFeaturedRecipes);
  readonly popularRecipes$ = this.store.select(selectManagerToolkitPopularRecipes);
  readonly recipes$ = this.store.select(selectManagerToolkitRecipes);
  readonly favoriteRecipes$ = this.store.select(selectManagerToolkitFavoriteRecipes);
  readonly recipeTotal$ = this.store.select(selectManagerToolkitRecipeTotal);
  readonly selectedCategory$ = this.store.select(selectManagerToolkitSelectedCategory);
  readonly selectedRecipe$ = this.store.select(selectManagerToolkitSelectedRecipe);
  readonly progress$ = this.store.select(selectManagerToolkitProgress);
  readonly completion$ = this.store.select(selectManagerToolkitCompletion);
  readonly greetingText$ = this.store
    .select(selectCurrentUser)
    .pipe(
      map((user) => {
        const name = this.displayName(user?.name || user?.username);
        return name ? `Hello, ${name}!` : 'Hello!';
      }),
    );
  readonly loading$ = this.store.select(selectManagerToolkitLoading);
  readonly error$ = this.store.select(selectManagerToolkitError);
  readonly searchQuery$ = this.store.select(selectManagerToolkitSearchQuery);
  readonly dashboardLoaded$ = this.store.select(selectManagerToolkitDashboardLoaded);
  readonly recipesLoaded$ = this.store.select(selectManagerToolkitRecipesLoaded);
  readonly favoritesLoaded$ = this.store.select(selectManagerToolkitFavoritesLoaded);
  readonly searchCtrl = new FormControl('', { nonNullable: true });
  copyMessage: string | null = null;
  guideCopyMessage: string | null = null;

  readonly startHereGuide = {
    title: 'Start Here Guide',
    sections: [
      {
        heading: 'Welcome',
        body: 'This toolkit is designed for busy small business owners who want to use AI in a practical way, without becoming AI experts.',
        icon: 'sparkles',
      },
      {
        heading: 'What You Need',
        body: 'A device, internet access, a free ChatGPT, Claude or Gemini account, and a real business task you want to complete.',
        icon: 'check-circle',
      },
      {
        heading: 'Your First AI Win',
        body: 'Open ChatGPT, Claude or Gemini, choose one recipe, paste your business context, review the result, and use it.',
        icon: 'copy',
      },
      {
        heading: 'The Sophia Formula',
        body: 'Role, context, goal, constraints, and output. This structure helps AI give better business-ready responses.',
        icon: 'list-checks',
      },
      {
        heading: 'Before You Send Anything',
        body: 'Always check names, dates, prices, tone, promises, and private information before sending AI-generated content.',
        icon: 'shield',
      },
    ],
  };

  readonly starterPrompt = `Act as a practical small business assistant.

My business is: [BUSINESS TYPE]
The task I need help with is: [PASTE TASK]
My customer or audience is: [CUSTOMER TYPE]

Give me a clear, useful first draft.
Keep the tone professional and easy to understand.
Ask me for any missing details before making assumptions.`;

  constructor(
    private store: Store,
    private analytics: AnalyticsService,
  ) {}

  ngOnInit(): void {
    this.store.dispatch(ManagerToolkitActions.loadDashboard());
    this.searchCtrl.valueChanges
      .pipe(debounceTime(220), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((query) => {
        const trimmedQuery = query.trim();
        if (trimmedQuery) {
          this.analytics.trackEvent('search', {
            search_term: trimmedQuery,
            context: 'member_toolkit',
          });
        }
        this.store.dispatch(ManagerToolkitActions.setSearchQuery({ query }));
        this.store.dispatch(ManagerToolkitActions.loadRecipes({ page: 1 }));
        this.store.dispatch(ManagerToolkitActions.setView({ view: 'recipes' }));
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setView(view: ToolkitView): void {
    this.copyMessage = null;
    this.guideCopyMessage = null;
    this.store.dispatch(ManagerToolkitActions.setView({ view }));
    if (view === 'home') {
      this.dashboardLoaded$.pipe(take(1)).subscribe((loaded) => {
        if (!loaded) this.store.dispatch(ManagerToolkitActions.loadDashboard());
      });
    }
    if (view === 'recipes') {
      this.recipesLoaded$.pipe(take(1)).subscribe((loaded) => {
        if (!loaded) this.store.dispatch(ManagerToolkitActions.loadRecipes({ page: 1 }));
      });
    }
    if (view === 'categories') {
      this.dashboardLoaded$.pipe(take(1)).subscribe((loaded) => {
        if (!loaded) this.store.dispatch(ManagerToolkitActions.loadDashboard());
      });
    }
    if (view === 'favorites') {
      this.favoritesLoaded$.pipe(take(1)).subscribe((loaded) => {
        if (!loaded) {
          this.store.dispatch(
            ManagerToolkitActions.loadRecipes({ page: 1, favorite: true }),
          );
        }
      });
    }
  }

  openCategory(category: ToolkitCategory): void {
    this.copyMessage = null;
    this.store.dispatch(ManagerToolkitActions.setView({ view: 'category' }));
    this.store.dispatch(ManagerToolkitActions.loadCategory({ slug: category.slug }));
  }

  openRecipe(recipe: ToolkitRecipe | ToolkitQuickAction): void {
    const slug = 'slug' in recipe ? recipe.slug : recipe.recipeSlug;
    this.analytics.trackEvent('view_recipe', {
      recipe_slug: slug,
      recipe_title: 'title' in recipe ? recipe.title : recipe.recipeTitle,
      source: 'member_toolkit',
    });
    this.copyMessage = null;
    this.store.dispatch(ManagerToolkitActions.setView({ view: 'recipe' }));
    this.store.dispatch(ManagerToolkitActions.loadRecipe({ slug }));
  }

  openRecipeSlug(slug: string): void {
    this.analytics.trackEvent('view_recipe', {
      recipe_slug: slug,
      source: 'member_toolkit_related_recipe',
    });
    this.copyMessage = null;
    this.store.dispatch(ManagerToolkitActions.setView({ view: 'recipe' }));
    this.store.dispatch(ManagerToolkitActions.loadRecipe({ slug }));
  }

  toggleFavorite(recipe: ToolkitRecipe): void {
    this.store.dispatch(
      ManagerToolkitActions.toggleFavorite({
        recipeSlug: recipe.slug,
        isFavorite: recipe.isFavorite,
      }),
    );
  }

  async copyPrompt(recipe: ToolkitRecipe): Promise<void> {
    try {
      await navigator.clipboard.writeText(recipe.prompt);
      this.analytics.trackEvent('copy_prompt', {
        recipe_slug: recipe.slug,
        recipe_title: recipe.title,
        category: recipe.category,
        source: 'member_toolkit',
      });
      this.copyMessage = 'Prompt copied';
      this.store.dispatch(
        ManagerToolkitActions.markRecipeUsed({ recipeSlug: recipe.slug }),
      );
    } catch {
      this.copyMessage = 'Copy failed. Select the prompt and copy it manually.';
    }
  }

  async copyStarterPrompt(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.starterPrompt);
      this.guideCopyMessage = 'Starter prompt copied';
    } catch {
      this.guideCopyMessage =
        'Copy failed. Select the prompt and copy it manually.';
    }
  }

  iconKey(icon?: string | null): string {
    return String(icon || '').toLowerCase();
  }

  recipeIcon(recipe: ToolkitRecipe): string {
    const category = String(recipe.categorySlug || '').toLowerCase();
    if (category.includes('sales')) return 'dollar-sign';
    if (category.includes('marketing')) return 'megaphone';
    if (category.includes('operations')) return 'settings';
    if (category.includes('finance')) return 'receipt';
    if (category.includes('hr')) return 'user';
    return 'mail';
  }

  trackBySlug(_: number, item: { slug?: string; recipeSlug?: string }): string {
    return item.slug || item.recipeSlug || String(_);
  }

  trackByLabel(_: number, item: { label?: string; name?: string }): string {
    return item.label || item.name || String(_);
  }

  private displayName(value?: string | null): string {
    const name = String(value || '').trim();
    if (!name) return '';
    const firstPart = name.split(/\s+/)[0] || name;
    return firstPart
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }
}
