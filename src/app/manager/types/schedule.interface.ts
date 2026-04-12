export type ScheduleItemType = 'project' | string;
export type ScheduleModalMode = 'create' | 'edit' | null;

export interface BmScheduledItem {
  scheduledItemType: ScheduleItemType;
  scheduledItemId: string;
  scheduledItemLabel: string;
  scheduledItemSecondaryLabel?: string | null;
  projectId?: string | null;
}

export interface BmSchedule {
  scheduleId: string;
  companyId?: string | null;
  userId?: string | null;
  projectId?: string | null;
  scheduledItemType: ScheduleItemType;
  scheduledItemId: string;
  scheduledItemLabel: string;
  scheduledItemSecondaryLabel?: string | null;
  date: string;
  startTime: string;
  endTime: string;
  description?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface ScheduleListResponse {
  schedules: BmSchedule[];
}

export interface ScheduleItemsResponse {
  items: BmScheduledItem[];
}

export interface ScheduleSavePayload {
  scheduled_item_type: ScheduleItemType;
  scheduled_item_id: string;
  date: string;
  start_time: string;
  end_time: string;
  description: string;
}
