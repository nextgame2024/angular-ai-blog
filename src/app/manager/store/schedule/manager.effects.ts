import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';
import { catchError, map, switchMap, withLatestFrom } from 'rxjs/operators';

import { ManagerScheduleProjectsService } from '../../services/schedule.projects.service';
import { ManagerScheduleActions } from './manager.actions';
import { selectManagerScheduleEditingScheduleId } from './manager.selectors';

function normalizeErrorMessage(
  error: unknown,
  fallbackMessage: string,
): string {
  if (
    typeof error === 'object'
    && error !== null
    && 'error' in error
    && typeof error.error === 'object'
    && error.error !== null
    && 'error' in error.error
    && typeof error.error.error === 'string'
  ) {
    return error.error.error;
  }

  if (
    typeof error === 'object'
    && error !== null
    && 'message' in error
    && typeof error.message === 'string'
  ) {
    return error.message;
  }

  return fallbackMessage;
}

@Injectable()
export class ManagerScheduleEffects {
  private readonly actions$ = inject(Actions);
  private readonly api = inject(ManagerScheduleProjectsService);
  private readonly store = inject(Store);

  readonly loadScheduleRange$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerScheduleActions.loadScheduleRange),
      switchMap(({ start, end, projectId }) =>
        this.api.listSchedules({ start, end, projectId }).pipe(
          map((response) =>
            ManagerScheduleActions.loadScheduleRangeSuccess({
              schedules: response.schedules ?? [],
            }),
          ),
          catchError((error: unknown) =>
            of(
              ManagerScheduleActions.loadScheduleRangeFailure({
                error: normalizeErrorMessage(
                  error,
                  'Failed to load schedule',
                ),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  readonly searchScheduledItems$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerScheduleActions.searchScheduledItems),
      switchMap(({ query }) => {
        const normalizedQuery = query.trim();

        if (!normalizedQuery) {
          return of(
            ManagerScheduleActions.searchScheduledItemsSuccess({
              items: [],
            }),
          );
        }

        return this.api
          .searchScheduledItems({
            q: normalizedQuery,
            type: 'project',
            limit: 10,
          })
          .pipe(
            map((response) =>
              ManagerScheduleActions.searchScheduledItemsSuccess({
                items: response.items ?? [],
              }),
            ),
            catchError((error: unknown) =>
              of(
                ManagerScheduleActions.searchScheduledItemsFailure({
                  error: normalizeErrorMessage(
                    error,
                    'Failed to search projects',
                  ),
                }),
              ),
            ),
          );
      }),
    ),
  );

  readonly saveSchedule$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerScheduleActions.saveSchedule),
      withLatestFrom(
        this.store.select(selectManagerScheduleEditingScheduleId),
      ),
      switchMap(([{ payload }, editingScheduleId]) => {
        const request$ = editingScheduleId
          ? this.api.updateSchedule(editingScheduleId, payload)
          : this.api.createSchedule(payload);

        return request$.pipe(
          map((response) =>
            ManagerScheduleActions.saveScheduleSuccess({
              schedule: response.schedule,
            }),
          ),
          catchError((error: unknown) =>
            of(
              ManagerScheduleActions.saveScheduleFailure({
                error: normalizeErrorMessage(
                  error,
                  'Failed to save schedule',
                ),
              }),
            ),
          ),
        );
      }),
    ),
  );

  readonly deleteSchedule$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerScheduleActions.deleteSchedule),
      switchMap(({ scheduleId }) =>
        this.api.deleteSchedule(scheduleId).pipe(
          map(() =>
            ManagerScheduleActions.deleteScheduleSuccess({
              scheduleId,
            }),
          ),
          catchError((error: unknown) =>
            of(
              ManagerScheduleActions.deleteScheduleFailure({
                error: normalizeErrorMessage(
                  error,
                  'Failed to delete booking',
                ),
              }),
            ),
          ),
        ),
      ),
    ),
  );
}
