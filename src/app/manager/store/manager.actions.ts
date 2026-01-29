import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { BmClient, BmClientContact } from '../services/manager.service';
import { ClientFormTab } from './manager.state';

export const ManagerActions = createActionGroup({
  source: 'Manager',
  events: {
    'Set Search Query': props<{ query: string }>(),

    // Clients
    'Load Clients': props<{ page: number }>(),
    'Load Clients Success': props<{
      clients: BmClient[];
      page: number;
      limit: number;
      total: number;
    }>(),
    'Load Clients Failure': props<{ error: string }>(),

    'Open Client Create': emptyProps(),
    'Open Client Edit': props<{ clientId: string }>(),
    'Close Client Form': emptyProps(),

    'Set Client Form Tab': props<{ tab: ClientFormTab }>(),

    'Save Client': props<{ payload: any }>(),
    'Save Client Success': props<{ client: BmClient }>(),
    'Save Client Failure': props<{ error: string }>(),

    'Archive Client': props<{ clientId: string }>(),
    'Archive Client Success': props<{ clientId: string }>(),
    'Archive Client Failure': props<{ error: string }>(),

    // Contacts (nested)
    'Load Client Contacts': props<{ clientId: string }>(),
    'Load Client Contacts Success': props<{ contacts: BmClientContact[] }>(),
    'Load Client Contacts Failure': props<{ error: string }>(),

    'Open Contact Create': emptyProps(),
    'Open Contact Edit': props<{ contactId: string }>(),
    'Close Contact Form': emptyProps(),

    'Save Contact': props<{ clientId: string; payload: any }>(),
    'Save Contact Success': props<{ contact: BmClientContact }>(),
    'Save Contact Failure': props<{ error: string }>(),

    'Delete Contact': props<{ clientId: string; contactId: string }>(),
    'Delete Contact Success': props<{ contactId: string }>(),
    'Delete Contact Failure': props<{ error: string }>(),
  },
});
