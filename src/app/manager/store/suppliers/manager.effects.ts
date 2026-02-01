import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';
import { catchError, map, switchMap, withLatestFrom } from 'rxjs/operators';

import { ManagerSuppliersActions } from './manager.actions';
import { ManagerSuppliersService } from '../../services/manager.suppliers.service';
import {
  selectManagerSuppliersSearchQuery,
  selectManagerEditingSupplier,
  selectManagerEditingSupplierContact,
  selectManagerEditingSupplierMaterial,
  selectManagerSupplierContactsLimit,
  selectManagerSupplierMaterialsLimit,
} from './manager.selectors';

@Injectable()
export class ManagerSuppliersEffects {
  constructor(
    private actions$: Actions,
    private api: ManagerSuppliersService,
    private store: Store,
  ) {}

  loadSuppliers$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerSuppliersActions.loadSuppliers),
      withLatestFrom(this.store.select(selectManagerSuppliersSearchQuery)),
      switchMap(([{ page }, q]) =>
        this.api.listSuppliers({ page, limit: 20, q: q || undefined }).pipe(
          map((result) =>
            ManagerSuppliersActions.loadSuppliersSuccess({ result }),
          ),
          catchError((err) =>
            of(
              ManagerSuppliersActions.loadSuppliersFailure({
                error:
                  err?.error?.error ||
                  err?.message ||
                  'Failed to load suppliers',
              }),
            ),
          ),
        ),
      ),
    ),
  );

  saveSupplier$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerSuppliersActions.saveSupplier),
      withLatestFrom(this.store.select(selectManagerEditingSupplier)),
      switchMap(([{ payload }, editing]) => {
        const req$ = editing
          ? this.api.updateSupplier(editing.supplierId, payload)
          : this.api.createSupplier(payload);

        return req$.pipe(
          map((res) =>
            ManagerSuppliersActions.saveSupplierSuccess({ supplier: res.supplier }),
          ),
          catchError((err) =>
            of(
              ManagerSuppliersActions.saveSupplierFailure({
                error:
                  err?.error?.error ||
                  err?.message ||
                  'Failed to save supplier',
              }),
            ),
          ),
        );
      }),
    ),
  );

  archiveSupplier$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerSuppliersActions.archiveSupplier),
      switchMap(({ supplierId }) =>
        this.api.archiveSupplier(supplierId).pipe(
          map(() =>
            ManagerSuppliersActions.archiveSupplierSuccess({ supplierId }),
          ),
          catchError((err) =>
            of(
              ManagerSuppliersActions.archiveSupplierFailure({
                error:
                  err?.error?.error ||
                  err?.message ||
                  'Failed to archive supplier',
              }),
            ),
          ),
        ),
      ),
    ),
  );

  // Contacts
  loadSupplierContacts$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerSuppliersActions.loadSupplierContacts),
      withLatestFrom(this.store.select(selectManagerSupplierContactsLimit)),
      switchMap(([{ supplierId, page }, limit]) =>
        this.api.listSupplierContacts(supplierId, { page, limit }).pipe(
          map((res) => {
            const contacts = res?.contacts ?? [];
            return ManagerSuppliersActions.loadSupplierContactsSuccess({
              contacts,
              page: res?.page ?? page,
              limit: res?.limit ?? limit,
              total: res?.total ?? contacts.length ?? 0,
            });
          }),
          catchError((err) =>
            of(
              ManagerSuppliersActions.loadSupplierContactsFailure({
                error:
                  err?.error?.error ||
                  err?.message ||
                  'Failed to load contacts',
              }),
            ),
          ),
        ),
      ),
    ),
  );

  saveSupplierContact$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerSuppliersActions.saveSupplierContact),
      withLatestFrom(this.store.select(selectManagerEditingSupplierContact)),
      switchMap(([{ supplierId, payload }, editing]) => {
        const req$ = editing
          ? this.api.updateSupplierContact(
              supplierId,
              editing.contactId,
              payload,
            )
          : this.api.createSupplierContact(supplierId, payload);

        return req$.pipe(
          map((res) =>
            ManagerSuppliersActions.saveSupplierContactSuccess({
              contact: res?.contact ?? res,
            }),
          ),
          catchError((err) =>
            of(
              ManagerSuppliersActions.saveSupplierContactFailure({
                error:
                  err?.error?.error ||
                  err?.message ||
                  'Failed to save contact',
              }),
            ),
          ),
        );
      }),
    ),
  );

  deleteSupplierContact$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerSuppliersActions.deleteSupplierContact),
      switchMap(({ supplierId, contactId }) =>
        this.api.deleteSupplierContact(supplierId, contactId).pipe(
          map(() =>
            ManagerSuppliersActions.deleteSupplierContactSuccess({ contactId }),
          ),
          catchError((err) =>
            of(
              ManagerSuppliersActions.deleteSupplierContactFailure({
                error:
                  err?.error?.error ||
                  err?.message ||
                  'Failed to delete contact',
              }),
            ),
          ),
        ),
      ),
    ),
  );

  // Materials
  loadSupplierMaterials$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerSuppliersActions.loadSupplierMaterials),
      withLatestFrom(this.store.select(selectManagerSupplierMaterialsLimit)),
      switchMap(([{ supplierId, page }, limit]) =>
        this.api.listSupplierMaterials(supplierId, { page, limit }).pipe(
          map((res) => {
            const materials = res?.materials ?? [];
            return ManagerSuppliersActions.loadSupplierMaterialsSuccess({
              materials,
              page: res?.page ?? page,
              limit: res?.limit ?? limit,
              total: res?.total ?? materials.length ?? 0,
            });
          }),
          catchError((err) =>
            of(
              ManagerSuppliersActions.loadSupplierMaterialsFailure({
                error:
                  err?.error?.error ||
                  err?.message ||
                  'Failed to load materials',
              }),
            ),
          ),
        ),
      ),
    ),
  );

  saveSupplierMaterial$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerSuppliersActions.saveSupplierMaterial),
      withLatestFrom(this.store.select(selectManagerEditingSupplierMaterial)),
      switchMap(([{ supplierId, payload }, editing]) => {
        const req$ = editing
          ? this.api.updateSupplierMaterial(
              supplierId,
              editing.materialId,
              payload,
            )
          : this.api.addSupplierMaterial(supplierId, payload);

        return req$.pipe(
          map((res) =>
            ManagerSuppliersActions.saveSupplierMaterialSuccess({
              supplierMaterial: res?.supplierMaterial ?? res,
            }),
          ),
          catchError((err) =>
            of(
              ManagerSuppliersActions.saveSupplierMaterialFailure({
                error:
                  err?.error?.error ||
                  err?.message ||
                  'Failed to save supplier material',
              }),
            ),
          ),
        );
      }),
    ),
  );

  removeSupplierMaterial$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerSuppliersActions.removeSupplierMaterial),
      switchMap(({ supplierId, materialId }) =>
        this.api.removeSupplierMaterial(supplierId, materialId).pipe(
          map(() =>
            ManagerSuppliersActions.removeSupplierMaterialSuccess({ materialId }),
          ),
          catchError((err) =>
            of(
              ManagerSuppliersActions.removeSupplierMaterialFailure({
                error:
                  err?.error?.error ||
                  err?.message ||
                  'Failed to remove supplier material',
              }),
            ),
          ),
        ),
      ),
    ),
  );
}
