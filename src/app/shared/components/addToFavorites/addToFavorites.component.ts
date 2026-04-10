
import { Component, effect, inject, input, signal } from '@angular/core';
import { Store } from '@ngrx/store';
import { Router } from '@angular/router';
import { take } from 'rxjs';
import { addToFavoritesActions } from './store/actions';
import { selectCurrentUser } from 'src/app/auth/store/reducers';

/* PrimeNG */
import { ButtonModule } from 'primeng/button';

@Component({
    selector: 'mc-add-to-favorites',
    templateUrl: './addToFavorites.component.html',
    imports: [ButtonModule]
})
export class AddToFavoritesComponent {
  readonly isFavoritedInput$$ = input(false, { alias: 'isFavorited' });
  readonly favoritesCountInput$$ = input(0, { alias: 'favoritesCount' });
  readonly articleSlug$$ = input('', { alias: 'articleSlug' });

  readonly isFavorited$$ = signal(false);
  readonly favoritesCount$$ = signal(0);

  private readonly store = inject(Store);
  private readonly router = inject(Router);

  private readonly syncInputs = effect(() => {
    this.isFavorited$$.set(this.isFavoritedInput$$());
    this.favoritesCount$$.set(this.favoritesCountInput$$());
  });

  handleLike(): void {
    this.store
      .select(selectCurrentUser)
      .pipe(take(1))
      .subscribe((user) => {
        if (!user) {
          this.router.navigateByUrl('/login');
          return;
        }

        const prevFav = this.isFavorited$$();
        const prevCount = this.favoritesCount$$();

        this.isFavorited$$.set(!prevFav);
        this.favoritesCount$$.set(prevFav ? prevCount - 1 : prevCount + 1);

        this.store.dispatch(
          addToFavoritesActions.addToFavorites({
            isFavorited: prevFav,
            slug: this.articleSlug$$(),
          })
        );
      });
  }
}
