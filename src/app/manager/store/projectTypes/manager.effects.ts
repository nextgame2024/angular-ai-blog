import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';
import { catchError, map, switchMap, withLatestFrom } from 'rxjs/operators';

import { ManagerProjectTypesActions } from './manager.actions';
import { ManagerProjectTypesService } from '../../services/manager.project.types.service';
import {
  selectManagerProjectTypesSearchQuery,
  selectManagerEditingProjectTypeId,
  selectManagerEditingProjectTypeMaterialId,
  selectManagerEditingProjectTypeLaborId,
} from './manager.selectors';

@Injectable()
export class ManagerProjectTypesEffects {
  constructor(
    private actions$: Actions,
    private api: ManagerProjectTypesService,
    private store: Store,
  ) {}

  loadProjectTypes$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerProjectTypesActions.loadProjectTypes),
      withLatestFrom(this.store.select(selectManagerProjectTypesSearchQuery)),
      switchMap(([{ page }, q]) =>
        this.api.listProjectTypes({ page, limit: 20, q: q || undefined }).pipe(
          map((result) =>
            ManagerProjectTypesActions.loadProjectTypesSuccess({ result }),
          ),
          catchError((err) =>
            of(
              ManagerProjectTypesActions.loadProjectTypesFailure({
                error:
                  err?.error?.error ||
                  err?.message ||
                  'Failed to load project types',
              }),
            ),
          ),
        ),
      ),
    ),
  );

  saveProjectType$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerProjectTypesActions.saveProjectType),
      withLatestFrom(this.store.select(selectManagerEditingProjectTypeId)),
      switchMap(([{ payload, closeOnSuccess }, editingProjectTypeId]) => {
        const req$ = editingProjectTypeId
          ? this.api.updateProjectType(editingProjectTypeId, payload)
          : this.api.createProjectType(payload);

        return req$.pipe(
          map((res) =>
            ManagerProjectTypesActions.saveProjectTypeSuccess({
              projectType: res.projectType,
              closeOnSuccess,
            }),
          ),
          catchError((err) =>
            of(
              ManagerProjectTypesActions.saveProjectTypeFailure({
                error:
                  err?.error?.error ||
                  err?.message ||
                  'Failed to save project type',
              }),
            ),
          ),
        );
      }),
    ),
  );

  removeProjectType$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerProjectTypesActions.removeProjectType),
      switchMap(({ projectTypeId }) =>
        this.api.removeProjectType(projectTypeId).pipe(
          map((res) =>
            ManagerProjectTypesActions.removeProjectTypeSuccess({
              projectTypeId: res.projectTypeId,
              action: res.action,
            }),
          ),
          catchError((err) =>
            of(
              ManagerProjectTypesActions.removeProjectTypeFailure({
                error:
                  err?.error?.error ||
                  err?.message ||
                  'Failed to remove project type',
              }),
            ),
          ),
        ),
      ),
    ),
  );

  loadProjectTypeMaterials$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerProjectTypesActions.loadProjectTypeMaterials),
      switchMap(({ projectTypeId }) =>
        this.api.listProjectTypeMaterials(projectTypeId).pipe(
          map((res) =>
            ManagerProjectTypesActions.loadProjectTypeMaterialsSuccess({
              materials: res.materials || [],
            }),
          ),
          catchError((err) =>
            of(
              ManagerProjectTypesActions.loadProjectTypeMaterialsFailure({
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

  saveProjectTypeMaterial$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerProjectTypesActions.saveProjectTypeMaterial),
      withLatestFrom(
        this.store.select(selectManagerEditingProjectTypeMaterialId),
      ),
      switchMap(([{ projectTypeId, materialId, payload }, editingMaterialId]) => {
        const resolvedMaterialId = editingMaterialId ?? materialId ?? null;
        const req$ = resolvedMaterialId
          ? this.api.upsertProjectTypeMaterial(
              projectTypeId,
              resolvedMaterialId,
              payload,
            )
          : this.api.addProjectTypeMaterial(projectTypeId, payload);

        return req$.pipe(
          map((res) =>
            ManagerProjectTypesActions.saveProjectTypeMaterialSuccess({
              projectTypeMaterial: res.projectTypeMaterial,
            }),
          ),
          catchError((err) =>
            of(
              ManagerProjectTypesActions.saveProjectTypeMaterialFailure({
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

  removeProjectTypeMaterial$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerProjectTypesActions.removeProjectTypeMaterial),
      switchMap(({ projectTypeId, materialId }) =>
        this.api.removeProjectTypeMaterial(projectTypeId, materialId).pipe(
          map(() =>
            ManagerProjectTypesActions.removeProjectTypeMaterialSuccess({
              materialId,
            }),
          ),
          catchError((err) =>
            of(
              ManagerProjectTypesActions.removeProjectTypeMaterialFailure({
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

  loadProjectTypeLabor$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerProjectTypesActions.loadProjectTypeLabor),
      switchMap(({ projectTypeId }) =>
        this.api.listProjectTypeLabor(projectTypeId).pipe(
          map((res) =>
            ManagerProjectTypesActions.loadProjectTypeLaborSuccess({
              labor: res.labor || [],
            }),
          ),
          catchError((err) =>
            of(
              ManagerProjectTypesActions.loadProjectTypeLaborFailure({
                error:
                  err?.error?.error ||
                  err?.message ||
                  'Failed to load labor',
              }),
            ),
          ),
        ),
      ),
    ),
  );

  saveProjectTypeLabor$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerProjectTypesActions.saveProjectTypeLabor),
      withLatestFrom(this.store.select(selectManagerEditingProjectTypeLaborId)),
      switchMap(([{ projectTypeId, laborId, payload }, editingLaborId]) => {
        const resolvedLaborId = editingLaborId ?? laborId ?? null;
        const req$ = resolvedLaborId
          ? this.api.upsertProjectTypeLabor(
              projectTypeId,
              resolvedLaborId,
              payload,
            )
          : this.api.addProjectTypeLabor(projectTypeId, payload);

        return req$.pipe(
          map((res) =>
            ManagerProjectTypesActions.saveProjectTypeLaborSuccess({
              projectTypeLabor: res.projectTypeLabor,
            }),
          ),
          catchError((err) =>
            of(
              ManagerProjectTypesActions.saveProjectTypeLaborFailure({
                error:
                  err?.error?.error ||
                  err?.message ||
                  'Failed to save labor',
              }),
            ),
          ),
        );
      }),
    ),
  );

  removeProjectTypeLabor$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerProjectTypesActions.removeProjectTypeLabor),
      switchMap(({ projectTypeId, laborId }) =>
        this.api.removeProjectTypeLabor(projectTypeId, laborId).pipe(
          map(() =>
            ManagerProjectTypesActions.removeProjectTypeLaborSuccess({ laborId }),
          ),
          catchError((err) =>
            of(
              ManagerProjectTypesActions.removeProjectTypeLaborFailure({
                error:
                  err?.error?.error ||
                  err?.message ||
                  'Failed to remove labor',
              }),
            ),
          ),
        ),
      ),
    ),
  );
}
