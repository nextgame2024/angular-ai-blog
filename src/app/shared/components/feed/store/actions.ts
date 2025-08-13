import { GetFeedResponseInterface } from '../types/getFeedResponse.interface';
import { createActionGroup, emptyProps, props } from '@ngrx/store';

export const feedActions = createActionGroup({
  source: 'feed',
  events: {
    'Get feed': props<{ url: string }>(),
    'Get feed success': props<{ feed: GetFeedResponseInterface }>(),
    'Get feed failure': emptyProps(),
  },
});
