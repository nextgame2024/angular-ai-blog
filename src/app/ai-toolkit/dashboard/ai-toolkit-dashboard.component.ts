import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { toSignal } from '@angular/core/rxjs-interop';

import toolkitJson from '../sophia-ai-business-toolkit-v1.json';
import { selectCurrentUser } from '../../auth/store/reducers';
import { environment } from 'src/environments/environment';

interface ToolkitMetadata {
  currency: string;
  price: number;
}

interface ToolkitNavItem {
  label: string;
  icon: string;
}

interface ToolkitCategory {
  slug: string;
  name: string;
  description: string;
  icon: string;
  recipeCount: number;
}

interface ToolkitQuickAction {
  label: string;
  recipeSlug: string;
  icon: string;
}

interface ToolkitRecipe {
  slug: string;
  title: string;
  category: string;
  categorySlug: string;
  description: string;
  difficulty: string;
  timeSavedMinutes: number;
  bestTool: string;
  rating: number;
  isPopular: boolean;
  isFeatured: boolean;
}

interface ToolkitData {
  metadata: ToolkitMetadata;
  navigation: ToolkitNavItem[];
  categories: ToolkitCategory[];
  quickActions: ToolkitQuickAction[];
  recipes: ToolkitRecipe[];
}

type DashboardView = 'home' | 'recipes';

@Component({
  selector: 'app-ai-toolkit-dashboard',
  imports: [CommonModule, RouterLink],
  templateUrl: './ai-toolkit-dashboard.component.html',
  styleUrls: ['./ai-toolkit-dashboard.component.css'],
})
export class AiToolkitDashboardComponent {
  private readonly router = inject(Router);
  private readonly store = inject(Store);
  private readonly http = inject(HttpClient);

  readonly toolkit = toolkitJson as ToolkitData;
  readonly view$$ = signal<DashboardView>('home');
  readonly accountModalOpen$$ = signal(false);
  readonly currentUser$$ = toSignal(this.store.select(selectCurrentUser), {
    initialValue: undefined,
  });

  readonly navigationItems$$ = computed(() => {
    const hiddenForNow = new Set(['workflows', 'ai toolbox']);
    const visibleItems = this.toolkit.navigation.filter(
      (item) => !hiddenForNow.has(item.label.toLowerCase())
    );
    const order = new Map([
      ['home', 0],
      ['start here guide', 1],
      ['all recipes', 2],
      ['business areas', 3],
      // Workflows and AI Toolbox stay hidden until those sections are ready.
      ['favorites', 4],
      // ['my account', 5],
    ]);

    return [...visibleItems].sort(
      (a, b) =>
        (order.get(a.label.toLowerCase()) ?? 99) -
        (order.get(b.label.toLowerCase()) ?? 99)
    );
  });

  readonly featuredRecipes$$ = computed(() =>
    this.toolkit.recipes.filter((recipe) => recipe.isFeatured).slice(0, 3)
  );

  readonly popularRecipes$$ = computed(() =>
    this.toolkit.recipes.filter((recipe) => recipe.isPopular).slice(0, 6)
  );

  readonly recipeCount$$ = computed(() => this.toolkit.recipes.length);

  readonly totalHoursSaved$$ = computed(() =>
    Math.round(
      this.toolkit.recipes.reduce(
        (total, recipe) => total + recipe.timeSavedMinutes,
        0
      ) / 60
    )
  );

  readonly favouriteCount$$ = computed(
    () => this.toolkit.recipes.filter((recipe) => recipe.isPopular).length
  );

  readonly quickActions$$ = computed(() =>
    this.toolkit.quickActions.map((action) => ({
      ...action,
      recipe: this.getRecipe(action.recipeSlug),
    }))
  );

  readonly previewCategories$$ = computed(() => this.toolkit.categories.slice(0, 3));

  startCheckout(): void {
    if (this.currentUser$$()) {
      this.http
        .get<{ hasAccess: boolean }>(`${environment.apiUrl}/ai-toolkit/access`)
        .subscribe({
          next: ({ hasAccess }) => {
            void this.router.navigateByUrl(
              hasAccess ? '/manager/dashboard' : '/ai-toolkit/checkout',
            );
          },
          error: () => {
            void this.router.navigateByUrl('/ai-toolkit/checkout');
          },
        });
      return;
    }

    this.accountModalOpen$$.set(true);
  }

  closeAccountModal(): void {
    this.accountModalOpen$$.set(false);
  }

  setView(view: DashboardView): void {
    this.view$$.set(view);
  }

  handleHomeClick(): void {
    if (this.view$$() === 'recipes') {
      this.view$$.set('home');
      return;
    }

    void this.router.navigateByUrl('/ai-toolkit');
  }

  isHomeItem(item: ToolkitNavItem): boolean {
    return item.label.toLowerCase() === 'home';
  }

  isAllRecipesItem(item: ToolkitNavItem): boolean {
    return item.label.toLowerCase() === 'all recipes';
  }

  getRecipe(slug: string): ToolkitRecipe | undefined {
    return this.toolkit.recipes.find((recipe) => recipe.slug === slug);
  }

  getCategoryIcon(categorySlug: string): string {
    return (
      this.toolkit.categories.find((category) => category.slug === categorySlug)
        ?.icon ?? 'file-text'
    );
  }

  iconKey(icon: string | undefined): string {
    return icon ?? 'file-text';
  }

  iconTone(value: string, index = 0): string {
    const tones = ['blue', 'green', 'violet', 'coral', 'cyan', 'gold'];
    let total = index;
    for (const char of value) total += char.charCodeAt(0);
    return tones[total % tones.length];
  }
}
