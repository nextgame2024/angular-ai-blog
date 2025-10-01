import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ActivatedRoute,
  Params,
  Router,
  RouterLink,
  RouterModule,
} from '@angular/router';
import { Store } from '@ngrx/store';
import { Actions, ofType } from '@ngrx/effects';
import { combineLatest, Subject, takeUntil } from 'rxjs';

import { feedActions } from './store/actions';
import { selectError, selectFeedData, selectIsLoading } from './store/reducers';

import { environment } from 'src/environments/environment.development';

import { ErrorMessageComponent } from 'src/app/shared/components/errorMessage/errorMessage.component';
import { LoadingComponent } from '../loading/loading.component';
import { TagListComponent } from '../tagList/tagList.component';
import { AddToFavoritesComponent } from '../addToFavorites/addToFavorites.component';
import { SuggestedAuthorsComponent } from '../suggestedAuthors/suggestedAuthors.component';
import { ArticleMediaComponent } from '../articleMedia/articleMedia.component';

/* PrimeNG */
import { CardModule } from 'primeng/card';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';

/* Follow refresh */
import { followActions } from 'src/app/follow/store/actions';

/* Helpers */
import queryString from 'query-string';
import { ArticleInterface } from 'src/app/shared/types/article.interface';

/* IO sentinels for infinite scroll */
import { IoObserverDirective } from 'src/app/shared/directives/io-observer.directive';

@Component({
  selector: 'mc-feed',
  templateUrl: './feed.component.html',
  styleUrls: ['./feed.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    RouterLink,

    ErrorMessageComponent,
    LoadingComponent,
    TagListComponent,
    AddToFavoritesComponent,
    SuggestedAuthorsComponent,
    ArticleMediaComponent,

    // PrimeNG
    CardModule,
    AvatarModule,
    ButtonModule,

    // IntersectionObserver directive for top/bottom sentinels
    IoObserverDirective,
  ],
})
export class FeedComponent implements OnInit, OnChanges, OnDestroy {
  /** Base API URL the parent passes (e.g. '/api/articles', '/api/articles?tag=foo', or '/api/articles/feed') */
  @Input() apiUrl: string = '';

  private destroy$ = new Subject<void>();

  // We still expose loading/error so the page can show spinners/errors,
  // but the article list itself renders from our local cache (flatArticles).
  data$ = combineLatest({
    isLoading: this.store.select(selectIsLoading),
    error: this.store.select(selectError),
    feed: this.store.select(selectFeedData),
  });

  // paging config
  limit = environment.limit;
  baseUrl = this.router.url.split('?')[0]; // only used for tag helper text

  // Infinite cache: page -> articles[]
  private pages = new Map<number, ArticleInterface[]>();

  /** Flat merged list for rendering (always the source of truth for the UI) */
  flatArticles: ArticleInterface[] = [];

  /** Total count from the API */
  totalCount = 0;

  /** The page we most recently requested, to map the store payload back to its page */
  private inFlightPage: number | null = null;

  /** Anchor page when the URL’s ?page changes */
  currentPage = 1;

  /** If the whole window scrolls, keep null; if a scrollable div, set its element here */
  scrollRoot: Element | null = null;

  /** one-shot guard to avoid repeated resets when suggestions emits rapidly */
  private refreshHandled = false;

  // UI helpers
  defaultAvatar =
    'https://files-nodejs-api.s3.ap-southeast-2.amazonaws.com/public/avatar-user.png';
  setFallback(evt: Event) {
    const img = evt.target as HTMLImageElement | null;
    if (img && img.src !== this.defaultAvatar) {
      img.src = this.defaultAvatar;
    }
  }

  // ---------- feed mode helpers ----------
  /** Detect “Your feed” from the API URL (not the router path). */
  get isYourFeed(): boolean {
    return /\/articles\/feed(?:\?|$)/.test(this.apiUrl);
  }
  get isTagFeed(): boolean {
    return this.baseUrl.startsWith('/tag/');
  }
  get currentTag(): string {
    const m = this.baseUrl.match(/^\/tag\/(.+)$/);
    return m ? decodeURIComponent(m[1]) : '';
  }

  constructor(
    private store: Store,
    private router: Router,
    private route: ActivatedRoute,
    private actions$: Actions
  ) {}

  // ---------- lifecycle ----------
  ngOnInit(): void {
    // Use ?page as an initial anchor ONLY (we keep everything once loaded)
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe((params: Params) => {
        this.currentPage = Number(params['page'] || '1');
        this.baseUrl = this.router.url.split('?')[0];
        this.resetAndLoad(this.currentPage);
      });

    // Refresh “Your feed” after follow/unfollow – but not when empty
    this.actions$
      .pipe(
        ofType(followActions.followSuccess, followActions.unfollowSuccess),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        if (this.isYourFeed && this.totalCount > 0) {
          this.resetAndLoad(1);
        }
      });

    // Merge each store payload into our page cache
    this.store
      .select(selectFeedData)
      .pipe(takeUntil(this.destroy$))
      .subscribe((feed) => {
        if (!feed || this.inFlightPage == null) return;

        this.pages.set(this.inFlightPage, feed.articles as ArticleInterface[]);
        if (typeof feed.articlesCount === 'number') {
          this.totalCount = feed.articlesCount;
        }

        this.rebuildFlatList();
        this.inFlightPage = null; // request complete
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    const changed =
      changes['apiUrl'] &&
      !changes['apiUrl'].firstChange &&
      changes['apiUrl'].currentValue !== changes['apiUrl'].previousValue;

    if (changed) {
      // different feed source (tag/global/your): clear cache and start fresh
      this.resetAndLoad(1);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ---------- infinite scroll entrypoints (called by IO sentinels) ----------
  maybeLoadNext(): void {
    if (this.totalCount === 0) return; // short-circuit for empty feeds
    if (this.loadedCount() >= this.totalCount) return; // nothing more to fetch
    const next = (this.maxLoadedPage() ?? 0) + 1;
    this.loadPage(next);
  }

  maybeLoadPrev(): void {
    if (this.totalCount === 0) return;
    const min = this.minLoadedPage();
    if (min && min > 1) {
      this.loadPage(min - 1);
    }
  }

  // ---------- helpers ----------
  private resetAndLoad(anchorPage: number): void {
    this.pages.clear();
    this.flatArticles = [];
    this.totalCount = 0;
    this.inFlightPage = null;
    this.refreshHandled = false; // allow a single refresh once items exist
    this.loadPage(anchorPage);
  }

  private loadPage(page: number): void {
    if (this.pages.has(page)) return; // already cached
    if (this.inFlightPage !== null) return; // serialize requests

    this.inFlightPage = page;

    const offset = (page - 1) * this.limit;
    const parsed = queryString.parseUrl(this.apiUrl);
    const url = `${parsed.url}?${queryString.stringify({
      limit: this.limit,
      offset,
      ...parsed.query,
    })}`;

    this.store.dispatch(feedActions.getFeed({ url }));
  }

  private rebuildFlatList(): void {
    const ordered = Array.from(this.pages.keys()).sort((a, b) => a - b);
    const merged: ArticleInterface[] = [];
    for (const p of ordered) {
      const chunk = this.pages.get(p);
      if (chunk) merged.push(...chunk);
    }
    this.flatArticles = merged;
  }

  private loadedCount(): number {
    let n = 0;
    this.pages.forEach((arr) => (n += arr.length));
    return n;
  }

  private minLoadedPage(): number | null {
    if (this.pages.size === 0) return null;
    return Math.min(...this.pages.keys());
  }

  private maxLoadedPage(): number | null {
    if (this.pages.size === 0) return null;
    return Math.max(...this.pages.keys());
  }

  /** Used by *ngFor trackBy to avoid re-mounting DOM when cache updates */
  trackBySlug = (_: number, a: ArticleInterface) => a.slug;

  // Triggered by <mc-suggested-authors> (e.g., after user follows someone)
  onSuggestionsRefresh(): void {
    // Avoid loop when Your feed is empty and suggestions emits on init
    if (!this.isYourFeed) return;
    if (this.totalCount === 0) return; // nothing to refresh yet
    if (this.refreshHandled) return; // ignore extra rapid emits

    this.refreshHandled = true;
    this.resetAndLoad(1);
  }
}
