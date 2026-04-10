import { Component, computed, effect, inject } from '@angular/core';
import { popularTagsActions } from './store/actions';
import { Store } from '@ngrx/store';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  selectError,
  selectIsLoading,
  selectPopularTagsData,
} from './store/reducers';
import { CommonModule } from '@angular/common';
import { LoadingComponent } from '../loading/loading.component';
import { ErrorMessageComponent } from '../errorMessage/errorMessage.component';
import { RouterLink } from '@angular/router';

/* PrimeNG */
import { ChipModule } from 'primeng/chip';

@Component({
    selector: 'mc-popular-tags',
    templateUrl: './popularTags.component.html',
    imports: [
        CommonModule,
        LoadingComponent,
        ErrorMessageComponent,
        RouterLink,
        ChipModule,
    ]
})
export class PopularTagsComponent {
  private readonly store = inject(Store);

  readonly popularTags$$ = toSignal(this.store.select(selectPopularTagsData), {
    initialValue: [],
  });
  readonly safePopularTags$$ = computed(() => this.popularTags$$() ?? []);
  readonly isLoading$$ = toSignal(this.store.select(selectIsLoading), {
    initialValue: false,
  });
  readonly error$$ = toSignal(this.store.select(selectError), {
    initialValue: null,
  });

  private readonly loadEffect = effect(() => {
    this.store.dispatch(popularTagsActions.getPopularTags());
  });
}
