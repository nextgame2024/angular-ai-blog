import { createActionGroup, emptyProps, props } from '@ngrx/store';
import type {
  BmPalletMovement,
  PagedPalletMovements,
  PagedPalletSites,
  PalletsContext,
} from '../../types/pallets.interface';

export type PalletsTab = 'onSite' | 'move' | 'inTransit';

export const ManagerPalletsActions = createActionGroup({
  source: 'Manager Pallets',
  events: {
    'Set Active Tab': props<{ tab: PalletsTab }>(),
    'Set Search Query': props<{ query: string }>(),
    'Load Context': emptyProps(),
    'Load Context Success': props<{ context: PalletsContext }>(),
    'Load Context Failure': props<{ error: string }>(),
    'Load On Site': props<{ page: number }>(),
    'Load On Site Success': props<{ result: PagedPalletSites }>(),
    'Load On Site Failure': props<{ error: string }>(),
    'Load Sent': props<{ page: number }>(),
    'Load Sent Success': props<{ result: PagedPalletMovements }>(),
    'Load Sent Failure': props<{ error: string }>(),
    'Load Incoming': props<{ page: number }>(),
    'Load Incoming Success': props<{ result: PagedPalletMovements }>(),
    'Load Incoming Failure': props<{ error: string }>(),
    'Move Pallets': props<{ payload: any }>(),
    'Move Pallets Success': props<{ movement: BmPalletMovement }>(),
    'Move Pallets Failure': props<{ error: string }>(),
    'Delete Movement': props<{ palletId: string }>(),
    'Delete Movement Success': props<{ palletId: string }>(),
    'Delete Movement Failure': props<{ error: string }>(),
    'Receive Movement': props<{ palletId: string }>(),
    'Receive Movement Success': props<{ palletId: string }>(),
    'Receive Movement Failure': props<{ error: string }>(),
  },
});
