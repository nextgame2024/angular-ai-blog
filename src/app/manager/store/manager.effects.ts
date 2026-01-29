import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';
import { catchError, map, switchMap, withLatestFrom } from 'rxjs/operators';

import { ManagerActions } from './manager.actions';
import { ManagerService } from '../services/manager.service';
import {
  selectManagerSearchQuery,
  selectManagerEditingClient,
  selectManagerEditingContact,
} from './manager.selectors';

@Injectable()
export class ManagerEffects {
  constructor(
    private actions$: Actions,
    private api: ManagerService,
    private store: Store
  ) {}

  // -------- Clients --------

  loadClients$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerActions.loadClients),
      withLatestFrom(this.store.select(selectManagerSearchQuery)),
      switchMap(([{ page }, q]) =>
        this.api.listClients({ page, limit: 20, q: q || undefined }).pipe(
          map((res) =>
            ManagerActions.loadClientsSuccess({
              clients: res.clients,
              page: res.page,
              limit: res.limit,
              total: res.total,
            })
          ),
          catchError((err) =>
            of(
              ManagerActions.loadClientsFailure({
                error:
                  err?.error?.error || err?.message || 'Failed to load clients',
              })
            )
          )
        )
      )
    )
  );

  saveClient$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerActions.saveClient),
      withLatestFrom(this.store.select(selectManagerEditingClient)),
      switchMap(([{ payload }, editing]) => {
        const request$ = editing
          ? this.api.updateClient(editing.clientId, payload)
          : this.api.createClient(payload);

        return request$.pipe(
          map((res) =>
            ManagerActions.saveClientSuccess({ client: res.client })
          ),
          catchError((err) =>
            of(
              ManagerActions.saveClientFailure({
                error:
                  err?.error?.error || err?.message || 'Failed to save client',
              })
            )
          )
        );
      })
    )
  );

  archiveClient$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerActions.archiveClient),
      switchMap(({ clientId }) =>
        this.api.archiveClient(clientId).pipe(
          map(() => ManagerActions.archiveClientSuccess({ clientId })),
          catchError((err) =>
            of(
              ManagerActions.archiveClientFailure({
                error:
                  err?.error?.error ||
                  err?.message ||
                  'Failed to archive client',
              })
            )
          )
        )
      )
    )
  );

  // When opening edit, load contacts automatically
  loadContactsOnOpenEdit$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerActions.openClientEdit),
      map(({ clientId }) => ManagerActions.loadClientContacts({ clientId }))
    )
  );

  // -------- Contacts --------

  loadClientContacts$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerActions.loadClientContacts),
      switchMap(({ clientId }) =>
        this.api.listClientContacts(clientId).pipe(
          map((res: any) => {
            const contacts = Array.isArray(res) ? res : res?.contacts ?? [];
            return ManagerActions.loadClientContactsSuccess({ contacts });
          }),
          catchError((err) =>
            of(
              ManagerActions.loadClientContactsFailure({
                error:
                  err?.error?.error ||
                  err?.message ||
                  'Failed to load contacts',
              })
            )
          )
        )
      )
    )
  );

  saveContact$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerActions.saveContact),
      withLatestFrom(this.store.select(selectManagerEditingContact)),
      switchMap(([{ clientId, payload }, editing]) => {
        const request$ = editing
          ? this.api.updateClientContact(clientId, editing.contactId, payload)
          : this.api.createClientContact(clientId, payload);

        return request$.pipe(
          map((res: any) => {
            const contact = res?.contact ?? res;
            return ManagerActions.saveContactSuccess({ contact });
          }),
          catchError((err) =>
            of(
              ManagerActions.saveContactFailure({
                error:
                  err?.error?.error || err?.message || 'Failed to save contact',
              })
            )
          )
        );
      })
    )
  );

  deleteContact$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerActions.deleteContact),
      switchMap(({ clientId, contactId }) =>
        this.api.deleteClientContact(clientId, contactId).pipe(
          map(() => ManagerActions.deleteContactSuccess({ contactId })),
          catchError((err) =>
            of(
              ManagerActions.deleteContactFailure({
                error:
                  err?.error?.error ||
                  err?.message ||
                  'Failed to delete contact',
              })
            )
          )
        )
      )
    )
  );
}
