import { createActionGroup, emptyProps, props } from '@ngrx/store';

export interface Profile {
  username: string;
  bio: string;
  image: string | null;
  following: boolean;
}

export const followActions = createActionGroup({
  source: 'Follow',
  events: {
    Follow: props<{ username: string }>(),
    'Follow Success': props<{ profile: Profile }>(),
    'Follow Failure': props<{ error: any }>(),

    Unfollow: props<{ username: string }>(),
    'Unfollow Success': props<{ profile: Profile }>(),
    'Unfollow Failure': props<{ error: any }>(),

    'Load Suggestions': props<{ limit?: number }>(),
    'Load Suggestions Success': props<{ profiles: Profile[] }>(),
    'Load Suggestions Failure': props<{ error: any }>(),

    'Clear Suggestions': emptyProps(),
  },
});
