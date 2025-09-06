import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import { feedActions } from './store/actions';
import { Store } from '@ngrx/store';
import { combineLatest, Subject, takeUntil } from 'rxjs';
import { selectError, selectFeedData, selectIsLoading } from './store/reducers';
import { CommonModule } from '@angular/common';
import {
  ActivatedRoute,
  Params,
  Router,
  RouterLink,
  RouterModule,
} from '@angular/router';
import { ErrorMessageComponent } from 'src/app/shared/components/errorMessage/errorMessage.component';
import { LoadingComponent } from '../loading/loading.component';
import { environment } from 'src/environments/environment.development';
import { PaginationComponent } from '../pagination/pagination.component';
import queryString from 'query-string';
import { TagListComponent } from '../tagList/tagList.component';
import { AddToFavoritesComponent } from '../addToFavorites/addToFavorites.component';
import { SuggestedAuthorsComponent } from '../suggestedAuthors/suggestedAuthors.component';

/* PrimeNG */
import { CardModule } from 'primeng/card';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';

/* NgRx Effects */
import { Actions, ofType } from '@ngrx/effects';
import { followActions } from 'src/app/follow/store/actions';

@Component({
  selector: 'mc-feed',
  templateUrl: './feed.component.html',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    RouterLink,
    ErrorMessageComponent,
    LoadingComponent,
    PaginationComponent,
    TagListComponent,
    AddToFavoritesComponent,
    SuggestedAuthorsComponent,

    // PrimeNG
    CardModule,
    AvatarModule,
    ButtonModule,
  ],
})
export class FeedComponent implements OnInit, OnChanges, OnDestroy {
  @Input() apiUrl: string = '';
  private destroy$ = new Subject<void>();

  defaultAvatar =
    'https://files-nodejs-api.s3.ap-southeast-2.amazonaws.com/public/avatar-user.png';
  setFallback(evt: Event) {
    const img = evt.target as HTMLImageElement | null;
    if (!img) return;
    if (img.src !== this.defaultAvatar) {
      img.src = this.defaultAvatar;
    }
  }

  get isYourFeed(): boolean {
    return this.baseUrl === '/feed';
  }
  get isTagFeed(): boolean {
    return this.baseUrl.startsWith('/tag/');
  }
  get currentTag(): string {
    const m = this.baseUrl.match(/^\/tag\/(.+)$/);
    return m ? decodeURIComponent(m[1]) : '';
  }

  data$ = combineLatest({
    isLoading: this.store.select(selectIsLoading),
    error: this.store.select(selectError),
    feed: this.store.select(selectFeedData),
  });
  limit = environment.limit;
  baseUrl = this.router.url.split('?')[0];
  currentPage: number = 1;

  constructor(
    private store: Store,
    private router: Router,
    private route: ActivatedRoute,
    private actions$: Actions
  ) {}

  ngOnInit(): void {
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe((params: Params) => {
        this.currentPage = Number(params['page'] || '1');
        this.baseUrl = this.router.url.split('?')[0];
        this.fetchFeed();
      });

    this.actions$
      .pipe(
        ofType(followActions.followSuccess, followActions.unfollowSuccess),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        if (this.isYourFeed) this.fetchFeed();
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    const isApiUrlChanged =
      !changes['apiUrl'].firstChange &&
      changes['apiUrl'].currentValue !== changes['apiUrl'].previousValue;

    if (isApiUrlChanged) this.fetchFeed();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  fetchFeed(): void {
    const offset = this.currentPage * this.limit - this.limit;
    const parsedUrl = queryString.parseUrl(this.apiUrl);
    const stringifiedParams = queryString.stringify({
      limit: this.limit,
      offset,
      ...parsedUrl.query,
    });
    const apiUrlWithParams = `${parsedUrl.url}?${stringifiedParams}`;
    this.store.dispatch(feedActions.getFeed({ url: apiUrlWithParams }));
  }

  onSuggestionsRefresh(): void {
    if (this.isYourFeed) this.fetchFeed();
  }
}
