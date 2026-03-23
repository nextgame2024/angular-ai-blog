import { createActionGroup, emptyProps, props } from '@ngrx/store';
import type {
  BmNavigationLink,
  NavigationLinksSyncResult,
  PagedResult,
} from '../../types/navigation.links.interface';

export const ManagerNavigationLinksActions = createActionGroup({
  source: 'Manager Navigation Links',
  events: {
    'Set Navigation Links Search Query': props<{ query: string }>(),

    'Load Navigation Links': props<{ page: number }>(),
    'Load Navigation Links Success': props<{
      result: PagedResult<BmNavigationLink>;
    }>(),
    'Load Navigation Links Failure': props<{ error: string }>(),

    'Open Navigation Link Create': emptyProps(),
    'Open Navigation Link Edit': props<{ navigationLinkId: string }>(),
    'Close Navigation Link Form': emptyProps(),

    'Save Navigation Link': props<{ payload: any }>(),
    'Save Navigation Link Success': props<{ navigationLink: BmNavigationLink }>(),
    'Save Navigation Link Failure': props<{ error: string }>(),

    'Sync Navigation Labels': props<{ payload: any }>(),
    'Sync Navigation Labels Success': props<{ result: NavigationLinksSyncResult }>(),
    'Sync Navigation Labels Failure': props<{ error: string }>(),

    'Remove Navigation Link': props<{ navigationLinkId: string }>(),
    'Remove Navigation Link Success': props<{ navigationLinkId: string }>(),
    'Remove Navigation Link Failure': props<{ error: string }>(),
  },
});
