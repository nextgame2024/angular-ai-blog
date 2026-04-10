import {
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  Renderer2,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ActivatedRoute,
  Router,
  RouterLink,
  RouterModule,
  NavigationEnd,
} from '@angular/router';
import { Store } from '@ngrx/store';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs/operators';

import { feedActions } from './store/actions';
import { selectError, selectFeedData, selectIsLoading } from './store/reducers';

import { environment } from 'src/environments/environment.development';

import { ErrorMessageComponent } from 'src/app/shared/components/errorMessage/errorMessage.component';
import { LoadingComponent } from '../loading/loading.component';
import { TagListComponent } from '../tagList/tagList.component';
import { AddToFavoritesComponent } from '../addToFavorites/addToFavorites.component';
import { ArticleMediaComponent } from '../articleMedia/articleMedia.component';

/* PrimeNG */
import { CardModule } from 'primeng/card';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';

/* Helpers */
import queryString from 'query-string';
import { ArticleInterface } from 'src/app/shared/types/article.interface';

/* IO sentinels for infinite scroll */
import { IoObserverDirective } from 'src/app/shared/directives/io-observer.directive';

@Component({
    selector: 'mc-feed',
    templateUrl: './feed.component.html',
    styleUrls: ['./feed.component.css'],
    imports: [
        CommonModule,
        RouterModule,
        RouterLink,
        ErrorMessageComponent,
        LoadingComponent,
        TagListComponent,
        AddToFavoritesComponent,
        ArticleMediaComponent,
        // PrimeNG
        CardModule,
        AvatarModule,
        ButtonModule,
        // IntersectionObserver directive for top/bottom sentinels
        IoObserverDirective,
    ]
})
export class FeedComponent {
  /** Base API URL the parent passes (e.g. '/api/articles', '/api/articles?tag=foo') */
  readonly apiUrl$$ = input('', { alias: 'apiUrl' });

  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly renderer = inject(Renderer2);

  readonly isLoading$$ = toSignal(this.store.select(selectIsLoading), {
    initialValue: false,
  });
  readonly error$$ = toSignal(this.store.select(selectError), {
    initialValue: null,
  });
  private readonly feed$$ = toSignal(this.store.select(selectFeedData), {
    initialValue: null,
  });

  private readonly queryParams$$ = toSignal(this.route.queryParams, {
    initialValue: this.route.snapshot.queryParams,
  });

  private readonly currentUrl$$ = toSignal(
    this.router.events.pipe(
      filter((ev): ev is NavigationEnd => ev instanceof NavigationEnd),
      map(() => this.router.url)
    ),
    { initialValue: this.router.url }
  );

  // paging config
  readonly limit = environment.limit;

  // Infinite cache: page -> articles[]
  private readonly pages$$ = signal<Map<number, ArticleInterface[]>>(new Map());

  /** Flat merged list for rendering (always the source of truth for the UI) */
  readonly flatArticles$$ = computed(() => {
    const pages = this.pages$$();
    const ordered = Array.from(pages.keys()).sort((a, b) => a - b);
    const merged: ArticleInterface[] = [];
    for (const p of ordered) {
      const chunk = pages.get(p);
      if (chunk) merged.push(...chunk);
    }
    return merged;
  });

  /** Total count from the API */
  readonly totalCount$$ = signal(0);

  /** The page we most recently requested, to map the store payload back to its page */
  private readonly inFlightPage$$ = signal<number | null>(null);

  /** Anchor page when the URL’s ?page changes */
  readonly currentPage$$ = signal(1);

  /** If the whole window scrolls, keep null; if a scrollable div, set its element here */
  readonly scrollRoot$$ = signal<Element | null>(null);

  private readonly lastLoadKey$$ = signal<{ apiUrl: string; page: number } | null>(
    null
  );

  // UI helpers
  readonly defaultAvatar =
    'https://files-nodejs-api.s3.ap-southeast-2.amazonaws.com/public/avatar-user.png';
  setFallback(evt: Event) {
    const img = evt.target instanceof HTMLImageElement ? evt.target : null;
    if (img && img.src !== this.defaultAvatar) {
      this.renderer.setAttribute(img, 'src', this.defaultAvatar);
    }
  }

  // ---------- feed mode helpers ----------
  readonly baseUrl$$ = computed(() => this.currentUrl$$().split('?')[0]);
  readonly isTagFeed$$ = computed(() => this.baseUrl$$().startsWith('/tag/'));
  readonly currentTag$$ = computed(() => {
    const m = this.baseUrl$$().match(/^\/tag\/(.+)$/);
    return m ? decodeURIComponent(m[1]) : '';
  });

  private readonly loadEffect = effect(() => {
    const apiUrl = this.apiUrl$$();
    if (!apiUrl) return;
    const params = this.queryParams$$();
    const pageFromParams = Number(params?.['page'] || '1');
    const lastLoad = untracked(() => this.lastLoadKey$$());
    const apiUrlChanged = !lastLoad || lastLoad.apiUrl !== apiUrl;
    const pageChanged = !lastLoad || lastLoad.page !== pageFromParams;

    if (!lastLoad || apiUrlChanged || pageChanged) {
      const nextPage = apiUrlChanged ? 1 : pageFromParams;
      this.currentPage$$.set(nextPage);
      this.lastLoadKey$$.set({ apiUrl, page: nextPage });
      this.resetAndLoad(nextPage);
    }
  });

  private readonly mergeFeedEffect = effect(() => {
    const feed = this.feed$$();
    if (!feed) return;
    const inFlightPage = untracked(() => this.inFlightPage$$());
    if (inFlightPage == null) return;

    const nextPages = new Map(untracked(() => this.pages$$()));
    nextPages.set(inFlightPage, feed.articles);
    this.pages$$.set(nextPages);
    if (typeof feed.articlesCount === 'number') {
      this.totalCount$$.set(feed.articlesCount);
    }
    this.inFlightPage$$.set(null);
  });

  // ---------- infinite scroll entrypoints (called by IO sentinels) ----------
  maybeLoadNext(): void {
    if (this.totalCount$$() === 0) return; // short-circuit for empty feeds
    if (this.loadedCount() >= this.totalCount$$()) return; // nothing more to fetch
    const next = (this.maxLoadedPage() ?? 0) + 1;
    this.loadPage(next);
  }

  maybeLoadPrev(): void {
    if (this.totalCount$$() === 0) return;
    const min = this.minLoadedPage();
    if (min && min > 1) {
      this.loadPage(min - 1);
    }
  }

  // ---------- helpers ----------
  private resetAndLoad(anchorPage: number): void {
    this.pages$$.set(new Map());
    this.totalCount$$.set(0);
    this.inFlightPage$$.set(null);
    this.loadPage(anchorPage);
  }

  private loadPage(page: number): void {
    const apiUrl = this.apiUrl$$();
    if (!apiUrl) return;
    if (this.pages$$().has(page)) return; // already cached
    if (this.inFlightPage$$() !== null) return; // serialize requests

    this.inFlightPage$$.set(page);

    const offset = (page - 1) * this.limit;
    const parsed = queryString.parseUrl(apiUrl);
    const url = `${parsed.url}?${queryString.stringify({
      limit: this.limit,
      offset,
      ...parsed.query,
    })}`;

    this.store.dispatch(feedActions.getFeed({ url }));
  }

  private loadedCount(): number {
    let n = 0;
    this.pages$$().forEach((arr) => (n += arr.length));
    return n;
  }

  private minLoadedPage(): number | null {
    const pages = this.pages$$();
    if (pages.size === 0) return null;
    return Math.min(...pages.keys());
  }

  private maxLoadedPage(): number | null {
    const pages = this.pages$$();
    if (pages.size === 0) return null;
    return Math.max(...pages.keys());
  }

  /** Used by *ngFor trackBy to avoid re-mounting DOM when cache updates */
  readonly trackBySlug = (_: number, a: ArticleInterface) => a.slug;
}
