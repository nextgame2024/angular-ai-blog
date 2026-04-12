import { createFeatureSelector, createSelector } from '@ngrx/store';

import { MANAGER_SCHEDULE_FEATURE_KEY } from './manager.reducer';
import type { ManagerScheduleState } from './manager.state';

export const selectManagerScheduleState =
  createFeatureSelector<ManagerScheduleState>(MANAGER_SCHEDULE_FEATURE_KEY);

export const selectManagerSchedules = createSelector(
  selectManagerScheduleState,
  (state) => state.schedules,
);

export const selectManagerScheduleLoading = createSelector(
  selectManagerScheduleState,
  (state) => state.loading,
);

export const selectManagerScheduleError = createSelector(
  selectManagerScheduleState,
  (state) => state.error,
);

export const selectManagerScheduleRangeStart = createSelector(
  selectManagerScheduleState,
  (state) => state.rangeStart,
);

export const selectManagerScheduleRangeEnd = createSelector(
  selectManagerScheduleState,
  (state) => state.rangeEnd,
);

export const selectManagerScheduleModalMode = createSelector(
  selectManagerScheduleState,
  (state) => state.modalMode,
);

export const selectManagerScheduleSelectedDate = createSelector(
  selectManagerScheduleState,
  (state) => state.selectedDate,
);

export const selectManagerScheduleEditingScheduleId = createSelector(
  selectManagerScheduleState,
  (state) => state.editingScheduleId,
);

export const selectManagerEditingSchedule = createSelector(
  selectManagerScheduleState,
  (state) =>
    state.editingScheduleId
      ? state.schedules.find(
          (schedule) => schedule.scheduleId === state.editingScheduleId,
        ) ?? null
      : null,
);

export const selectManagerScheduleSaving = createSelector(
  selectManagerScheduleState,
  (state) => state.saving,
);

export const selectManagerScheduleSaveError = createSelector(
  selectManagerScheduleState,
  (state) => state.saveError,
);

export const selectManagerScheduledItems = createSelector(
  selectManagerScheduleState,
  (state) => state.scheduledItems,
);

export const selectManagerScheduledItemsLoading = createSelector(
  selectManagerScheduleState,
  (state) => state.scheduledItemsLoading,
);

export const selectManagerScheduledItemsError = createSelector(
  selectManagerScheduleState,
  (state) => state.scheduledItemsError,
);
