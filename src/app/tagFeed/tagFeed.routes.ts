import { Route } from '@angular/router';
import { TagFeedComponent } from './components/tagFeed/tagFeed.component';
import { provideState } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import {
  feedFeatureKey,
  feedReducer,
} from '../shared/components/feed/store/reducers';
import * as feedEffects from '../shared/components/feed/store/effects';
import {
  popularTagsFeatureKey,
  popularTagsReducer,
} from '../shared/components/popularTags/store/reducers';
import * as popularTagsEffects from '../shared/components/popularTags/store/effects';
import * as addToFavoritesEffects from '../shared/components/addToFavorites/store/effects';
import { AddToFavoritesService } from '../shared/components/addToFavorites/services/addToFavorites.service';

export const routes: Route[] = [
  {
    path: '',
    component: TagFeedComponent,
    providers: [
      provideState(feedFeatureKey, feedReducer),
      provideEffects(feedEffects, addToFavoritesEffects),
      provideState(popularTagsFeatureKey, popularTagsReducer),
      provideEffects(popularTagsEffects),
      AddToFavoritesService,
    ],
  },
];
