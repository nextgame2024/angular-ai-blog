import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

import type {
  ToolkitCategoriesResponse,
  ToolkitCategoryResponse,
  ToolkitDashboard,
  ToolkitRecipeResponse,
  ToolkitRecipesResponse,
} from '../types/toolkit.interface';

@Injectable()
export class ManagerToolkitService {
  private readonly toolkitBase = `${environment.apiUrl}/bm/toolkit`;

  constructor(private http: HttpClient) {}

  getDashboard(): Observable<ToolkitDashboard> {
    return this.http.get<ToolkitDashboard>(`${this.toolkitBase}/dashboard`);
  }

  listCategories(): Observable<ToolkitCategoriesResponse> {
    return this.http.get<ToolkitCategoriesResponse>(`${this.toolkitBase}/categories`);
  }

  getCategory(slug: string): Observable<ToolkitCategoryResponse> {
    return this.http.get<ToolkitCategoryResponse>(
      `${this.toolkitBase}/categories/${slug}`,
    );
  }

  listRecipes(params: {
    page?: number;
    limit?: number;
    q?: string;
    categorySlug?: string;
    favorite?: boolean;
  } = {}): Observable<ToolkitRecipesResponse> {
    let httpParams = new HttpParams()
      .set('page', String(params.page ?? 1))
      .set('limit', String(params.limit ?? 50));
    if (params.q) httpParams = httpParams.set('q', params.q);
    if (params.categorySlug) {
      httpParams = httpParams.set('categorySlug', params.categorySlug);
    }
    if (params.favorite) httpParams = httpParams.set('favorite', 'true');

    return this.http.get<ToolkitRecipesResponse>(`${this.toolkitBase}/recipes`, {
      params: httpParams,
    });
  }

  getRecipe(slug: string): Observable<ToolkitRecipeResponse> {
    return this.http.get<ToolkitRecipeResponse>(`${this.toolkitBase}/recipes/${slug}`);
  }

  markRecipeUsed(recipeSlug: string): Observable<unknown> {
    return this.http.post(`${this.toolkitBase}/recipes/${recipeSlug}/use`, {});
  }

  addFavorite(recipeSlug: string): Observable<unknown> {
    return this.http.post(`${this.toolkitBase}/favorites/${recipeSlug}`, {});
  }

  removeFavorite(recipeSlug: string): Observable<unknown> {
    return this.http.delete(`${this.toolkitBase}/favorites/${recipeSlug}`);
  }
}
