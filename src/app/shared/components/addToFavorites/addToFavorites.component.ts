import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
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
  standalone: true,
  imports: [CommonModule, ButtonModule],
})
export class AddToFavoritesComponent {
  @Input() isFavorited = false;
  @Input() favoritesCount = 0;
  @Input() articleSlug = '';

  constructor(private store: Store, private router: Router) {}

  handleLike(): void {
    this.store
      .select(selectCurrentUser)
      .pipe(take(1))
      .subscribe((user) => {
        if (!user) {
          this.router.navigateByUrl('/login');
          return;
        }

        const prevFav = this.isFavorited;
        const prevCount = this.favoritesCount;

        this.isFavorited = !prevFav;
        this.favoritesCount = prevFav ? prevCount - 1 : prevCount + 1;

        this.store.dispatch(
          addToFavoritesActions.addToFavorites({
            isFavorited: prevFav,
            slug: this.articleSlug,
          })
        );
      });
  }
}
