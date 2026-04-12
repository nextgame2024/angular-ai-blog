import { createActionGroup, emptyProps, props } from '@ngrx/store';

import type {
  BmSchedule,
  BmScheduledItem,
  ScheduleSavePayload,
} from '../../types/schedule.interface';

export const ManagerScheduleActions = createActionGroup({
  source: 'Manager Schedule',
  events: {
    'Load Schedule Range': props<{
      start: string;
      end: string;
      projectId?: string | null;
    }>(),
    'Load Schedule Range Success': props<{ schedules: BmSchedule[] }>(),
    'Load Schedule Range Failure': props<{ error: string }>(),

    'Open Schedule Create': props<{ date: string }>(),
    'Open Schedule Edit': props<{ scheduleId: string }>(),
    'Close Schedule Modal': emptyProps(),

    'Search Scheduled Items': props<{ query: string }>(),
    'Search Scheduled Items Success': props<{ items: BmScheduledItem[] }>(),
    'Search Scheduled Items Failure': props<{ error: string }>(),
    'Clear Scheduled Items': emptyProps(),

    'Save Schedule': props<{ payload: ScheduleSavePayload }>(),
    'Save Schedule Success': props<{ schedule: BmSchedule }>(),
    'Save Schedule Failure': props<{ error: string }>(),
  },
});
