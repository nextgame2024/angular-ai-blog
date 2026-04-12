import { createReducer, on } from '@ngrx/store';

import { ManagerScheduleActions } from './manager.actions';
import { initialManagerScheduleState } from './manager.state';
import type { BmSchedule } from '../../types/schedule.interface';

export const MANAGER_SCHEDULE_FEATURE_KEY = 'managerSchedule';

function sortSchedules(items: BmSchedule[]): BmSchedule[] {
  return [...items].sort((left, right) => {
    if (left.date !== right.date) {
      return left.date.localeCompare(right.date);
    }

    if (left.startTime !== right.startTime) {
      return left.startTime.localeCompare(right.startTime);
    }

    return left.scheduledItemLabel.localeCompare(right.scheduledItemLabel);
  });
}

export const managerScheduleReducer = createReducer(
  initialManagerScheduleState,

  on(
    ManagerScheduleActions.loadScheduleRange,
    (state, { start, end, projectId }) => ({
      ...state,
      loading: true,
      error: null,
      rangeStart: start,
      rangeEnd: end,
      rangeProjectId: projectId ?? null,
    }),
  ),

  on(ManagerScheduleActions.loadScheduleRangeSuccess, (state, { schedules }) => ({
    ...state,
    loading: false,
    error: null,
    schedules: sortSchedules(schedules ?? []),
  })),

  on(ManagerScheduleActions.loadScheduleRangeFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),

  on(ManagerScheduleActions.openScheduleCreate, (state, { date }) => ({
    ...state,
    modalMode: 'create' as const,
    selectedDate: date,
    editingScheduleId: null,
    deleteConfirmScheduleId: null,
    saveError: null,
    scheduledItems: [],
    scheduledItemsError: null,
    scheduledItemsLoading: false,
  })),

  on(ManagerScheduleActions.openScheduleEdit, (state, { scheduleId }) => {
    const editingSchedule =
      state.schedules.find((schedule) => schedule.scheduleId === scheduleId)
      ?? null;

    return {
      ...state,
      modalMode: 'edit' as const,
      selectedDate: editingSchedule?.date ?? state.selectedDate,
      editingScheduleId: scheduleId,
      deleteConfirmScheduleId: null,
      saveError: null,
      scheduledItems: [],
      scheduledItemsError: null,
      scheduledItemsLoading: false,
    };
  }),

  on(ManagerScheduleActions.closeScheduleModal, (state) => ({
    ...state,
    modalMode: null,
    selectedDate: null,
    editingScheduleId: null,
    deleteConfirmScheduleId: null,
    saving: false,
    saveError: null,
    scheduledItems: [],
    scheduledItemsError: null,
    scheduledItemsLoading: false,
  })),

  on(ManagerScheduleActions.openScheduleDeleteConfirm, (state, { scheduleId }) => ({
    ...state,
    deleteConfirmScheduleId: scheduleId,
    deleteError: null,
  })),

  on(ManagerScheduleActions.closeScheduleDeleteConfirm, (state) => ({
    ...state,
    deleteConfirmScheduleId: null,
    deleting: false,
    deleteError: null,
  })),

  on(ManagerScheduleActions.searchScheduledItems, (state) => ({
    ...state,
    scheduledItemsLoading: true,
    scheduledItemsError: null,
  })),

  on(ManagerScheduleActions.searchScheduledItemsSuccess, (state, { items }) => ({
    ...state,
    scheduledItemsLoading: false,
    scheduledItemsError: null,
    scheduledItems: items ?? [],
  })),

  on(ManagerScheduleActions.searchScheduledItemsFailure, (state, { error }) => ({
    ...state,
    scheduledItemsLoading: false,
    scheduledItemsError: error,
  })),

  on(ManagerScheduleActions.clearScheduledItems, (state) => ({
    ...state,
    scheduledItems: [],
    scheduledItemsLoading: false,
    scheduledItemsError: null,
  })),

  on(ManagerScheduleActions.saveSchedule, (state) => ({
    ...state,
    saving: true,
    saveError: null,
  })),

  on(ManagerScheduleActions.saveScheduleSuccess, (state, { schedule }) => {
    const nextSchedules = [...state.schedules];
    const scheduleIndex = nextSchedules.findIndex(
      (current) => current.scheduleId === schedule.scheduleId,
    );

    if (scheduleIndex >= 0) {
      nextSchedules[scheduleIndex] = schedule;
    } else {
      nextSchedules.push(schedule);
    }

    return {
      ...state,
      schedules: sortSchedules(nextSchedules),
      saving: false,
      saveError: null,
      modalMode: null,
      selectedDate: null,
      editingScheduleId: null,
      scheduledItems: [],
      scheduledItemsLoading: false,
      scheduledItemsError: null,
    };
  }),

  on(ManagerScheduleActions.saveScheduleFailure, (state, { error }) => ({
    ...state,
    saving: false,
    saveError: error,
  })),

  on(ManagerScheduleActions.deleteSchedule, (state) => ({
    ...state,
    deleting: true,
    deleteError: null,
  })),

  on(ManagerScheduleActions.deleteScheduleSuccess, (state, { scheduleId }) => ({
    ...state,
    schedules: state.schedules.filter(
      (schedule) => schedule.scheduleId !== scheduleId,
    ),
    deleting: false,
    deleteError: null,
    deleteConfirmScheduleId: null,
    modalMode:
      state.editingScheduleId === scheduleId ? null : state.modalMode,
    selectedDate:
      state.editingScheduleId === scheduleId ? null : state.selectedDate,
    editingScheduleId:
      state.editingScheduleId === scheduleId ? null : state.editingScheduleId,
  })),

  on(ManagerScheduleActions.deleteScheduleFailure, (state, { error }) => ({
    ...state,
    deleting: false,
    deleteError: error,
  })),
);
