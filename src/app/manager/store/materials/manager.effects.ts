import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';
import { catchError, map, switchMap, withLatestFrom } from 'rxjs/operators';

import { ManagerMaterialsActions } from './manager.actions';
import { ManagerMaterialsService } from '../../services/manager.materials.service';
import {
  selectManagerMaterialsSearchQuery,
  selectManagerEditingMaterial,
} from './manager.selectors';

@Injectable()
export class ManagerMaterialsEffects {
  constructor(
    private actions$: Actions,
    private api: ManagerMaterialsService,
    private store: Store,
  ) {}

  loadMaterials$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerMaterialsActions.loadMaterials),
      withLatestFrom(this.store.select(selectManagerMaterialsSearchQuery)),
      switchMap(([{ page }, q]) =>
        this.api.listMaterials({ page, limit: 20, q: q || undefined }).pipe(
          map((result) =>
            ManagerMaterialsActions.loadMaterialsSuccess({ result }),
          ),
          catchError((err) =>
            of(
              ManagerMaterialsActions.loadMaterialsFailure({
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

  saveMaterial$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerMaterialsActions.saveMaterial),
      withLatestFrom(this.store.select(selectManagerEditingMaterial)),
      switchMap(([{ payload }, editing]) => {
        const req$ = editing
          ? this.api.updateMaterial(editing.materialId, payload)
          : this.api.createMaterial(payload);

        return req$.pipe(
          map((res) =>
            ManagerMaterialsActions.saveMaterialSuccess({
              material: res.material,
            }),
          ),
          catchError((err) =>
            of(
              ManagerMaterialsActions.saveMaterialFailure({
                error:
                  err?.error?.error ||
                  err?.message ||
                  'Failed to save material',
              }),
            ),
          ),
        );
      }),
    ),
  );

  removeMaterial$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerMaterialsActions.removeMaterial),
      switchMap(({ materialId }) =>
        this.api.removeMaterial(materialId).pipe(
          map((res) =>
            ManagerMaterialsActions.removeMaterialSuccess({
              materialId: res.materialId,
              action: res.action,
            }),
          ),
          catchError((err) =>
            of(
              ManagerMaterialsActions.removeMaterialFailure({
                error:
                  err?.error?.error ||
                  err?.message ||
                  'Failed to remove material',
              }),
            ),
          ),
        ),
      ),
    ),
  );
}
