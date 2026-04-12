import type {
  BmSchedule,
  BmScheduledItem,
  ScheduleModalMode,
} from '../../types/schedule.interface';

export interface ManagerScheduleState {
  schedules: BmSchedule[];
  loading: boolean;
  error: string | null;
  rangeStart: string | null;
  rangeEnd: string | null;
  rangeProjectId: string | null;
  modalMode: ScheduleModalMode;
  selectedDate: string | null;
  editingScheduleId: string | null;
  saving: boolean;
  saveError: string | null;
  scheduledItems: BmScheduledItem[];
  scheduledItemsLoading: boolean;
  scheduledItemsError: string | null;
}

export const initialManagerScheduleState: ManagerScheduleState = {
  schedules: [],
  loading: false,
  error: null,
  rangeStart: null,
  rangeEnd: null,
  rangeProjectId: null,
  modalMode: null,
  selectedDate: null,
  editingScheduleId: null,
  saving: false,
  saveError: null,
  scheduledItems: [],
  scheduledItemsLoading: false,
  scheduledItemsError: null,
};
