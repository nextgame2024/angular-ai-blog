import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';
import { catchError, map, switchMap, withLatestFrom } from 'rxjs/operators';

import { ManagerProjectsActions } from './manager.actions';
import { ManagerProjectsService } from '../../services/manager.projects.service';
import {
  selectManagerEditingProject,
  selectManagerProjectsSearchQuery,
} from './manager.selectors';

@Injectable()
export class ManagerProjectsEffects {
  constructor(
    private actions$: Actions,
    private api: ManagerProjectsService,
    private store: Store,
  ) {}

  loadProjects$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerProjectsActions.loadProjects),
      withLatestFrom(this.store.select(selectManagerProjectsSearchQuery)),
      switchMap(([{ page }, q]) =>
        this.api.listProjects({ page, limit: 20, q: q || undefined }).pipe(
          map((result) =>
            ManagerProjectsActions.loadProjectsSuccess({ result }),
          ),
          catchError((err) =>
            of(
              ManagerProjectsActions.loadProjectsFailure({
                error:
                  err?.error?.error ||
                  err?.message ||
                  'Failed to load projects',
              }),
            ),
          ),
        ),
      ),
    ),
  );

  saveProject$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerProjectsActions.saveProject),
      withLatestFrom(this.store.select(selectManagerEditingProject)),
      switchMap(([{ payload, closeOnSuccess }, editing]) => {
        const req$ = editing
          ? this.api.updateProject(editing.projectId, payload)
          : this.api.createProject(payload);

        return req$.pipe(
          map((res) =>
            ManagerProjectsActions.saveProjectSuccess({
              project: res.project,
              closeOnSuccess,
            }),
          ),
          catchError((err) =>
            of(
              ManagerProjectsActions.saveProjectFailure({
                error:
                  err?.error?.error ||
                  err?.message ||
                  'Failed to save project',
              }),
            ),
          ),
        );
      }),
    ),
  );

  archiveProject$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerProjectsActions.archiveProject),
      switchMap(({ projectId }) =>
        this.api.archiveProject(projectId).pipe(
          map(() => ManagerProjectsActions.archiveProjectSuccess({ projectId })),
          catchError((err) =>
            of(
              ManagerProjectsActions.archiveProjectFailure({
                error:
                  err?.error?.error ||
                  err?.message ||
                  'Failed to archive project',
              }),
            ),
          ),
        ),
      ),
    ),
  );

  loadProjectMaterials$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerProjectsActions.loadProjectMaterials),
      switchMap(({ projectId }) =>
        this.api.listProjectMaterials(projectId).pipe(
          map((res) =>
            ManagerProjectsActions.loadProjectMaterialsSuccess({
              materials: res.materials ?? [],
            }),
          ),
          catchError((err) =>
            of(
              ManagerProjectsActions.loadProjectMaterialsFailure({
                error:
                  err?.error?.error ||
                  err?.message ||
                  'Failed to load project materials',
              }),
            ),
          ),
        ),
      ),
    ),
  );

  saveProjectMaterial$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerProjectsActions.saveProjectMaterial),
      switchMap(({ projectId, materialId, payload }) => {
        const req$ = materialId
          ? this.api.upsertProjectMaterial(projectId, materialId, payload)
          : this.api.addProjectMaterial(projectId, payload);
        return req$.pipe(
          map((res) =>
            ManagerProjectsActions.saveProjectMaterialSuccess({
              projectMaterial: res.projectMaterial,
            }),
          ),
          catchError((err) =>
            of(
              ManagerProjectsActions.saveProjectMaterialFailure({
                error:
                  err?.error?.error ||
                  err?.message ||
                  'Failed to save project material',
              }),
            ),
          ),
        );
      }),
    ),
  );

  removeProjectMaterial$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerProjectsActions.removeProjectMaterial),
      switchMap(({ projectId, materialId }) =>
        this.api.removeProjectMaterial(projectId, materialId).pipe(
          map(() =>
            ManagerProjectsActions.removeProjectMaterialSuccess({ materialId }),
          ),
          catchError((err) =>
            of(
              ManagerProjectsActions.removeProjectMaterialFailure({
                error:
                  err?.error?.error ||
                  err?.message ||
                  'Failed to remove project material',
              }),
            ),
          ),
        ),
      ),
    ),
  );

  loadProjectLabor$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerProjectsActions.loadProjectLabor),
      switchMap(({ projectId }) =>
        this.api.listProjectLabor(projectId).pipe(
          map((res) =>
            ManagerProjectsActions.loadProjectLaborSuccess({
              labor: res.labor ?? [],
            }),
          ),
          catchError((err) =>
            of(
              ManagerProjectsActions.loadProjectLaborFailure({
                error:
                  err?.error?.error ||
                  err?.message ||
                  'Failed to load project labor',
              }),
            ),
          ),
        ),
      ),
    ),
  );

  saveProjectLabor$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerProjectsActions.saveProjectLabor),
      switchMap(({ projectId, laborId, payload }) => {
        const req$ = laborId
          ? this.api.upsertProjectLabor(projectId, laborId, payload)
          : this.api.addProjectLabor(projectId, payload);
        return req$.pipe(
          map((res) =>
            ManagerProjectsActions.saveProjectLaborSuccess({
              projectLabor: res.projectLabor,
            }),
          ),
          catchError((err) =>
            of(
              ManagerProjectsActions.saveProjectLaborFailure({
                error:
                  err?.error?.error ||
                  err?.message ||
                  'Failed to save project labor',
              }),
            ),
          ),
        );
      }),
    ),
  );

  removeProjectLabor$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerProjectsActions.removeProjectLabor),
      switchMap(({ projectId, laborId }) =>
        this.api.removeProjectLabor(projectId, laborId).pipe(
          map(() =>
            ManagerProjectsActions.removeProjectLaborSuccess({ laborId }),
          ),
          catchError((err) =>
            of(
              ManagerProjectsActions.removeProjectLaborFailure({
                error:
                  err?.error?.error ||
                  err?.message ||
                  'Failed to remove project labor',
              }),
            ),
          ),
        ),
      ),
    ),
  );
}
