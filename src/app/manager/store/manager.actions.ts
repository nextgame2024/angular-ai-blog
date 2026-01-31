import { createActionGroup, emptyProps, props } from '@ngrx/store';
import {
  BmClient,
  BmClientContact,
  BmUser,
  PagedResult,
} from '../services/manager.service';
import { ClientFormTab } from './manager.state';

export const ManagerActions = createActionGroup({
  source: 'Manager',
  events: {
    'Set Search Query': props<{ query: string }>(),
    'Set Clients Search Query': props<{ query: string }>(),
    'Set Users Search Query': props<{ query: string }>(),

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
    'Load Client Contacts': props<{ clientId: string; page: number }>(),
    'Load Client Contacts Success': props<{
      contacts: BmClientContact[];
      page: number;
      limit: number;
      total: number;
    }>(),
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

    /* =========================
       Users
    ========================= */
    'Load Users': props<{ page: number }>(),
    'Load Users Success': props<{ result: PagedResult<BmUser> }>(),
    'Load Users Failure': props<{ error: string }>(),

    'Open User Create': emptyProps(),
    'Open User Edit': props<{ userId: string }>(),
    'Close User Form': emptyProps(),

    'Save User': props<{ payload: any }>(),
    'Save User Success': props<{ user: BmUser }>(),
    'Save User Failure': props<{ error: string }>(),

    'Archive User': props<{ userId: string }>(),
    'Archive User Success': props<{ userId: string }>(),
    'Archive User Failure': props<{ error: string }>(),
  },
});
