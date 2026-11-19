import { EMPTY, expand, reduce, throwError } from 'rxjs';
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
export interface AdvisorCalendar {
  advisorId: string;
  timezone: string;
  slotMinutes: number;
  leadTimeMinutes: number;
  bookingWindowDays: number;
  weeklyHours: { day: number; start: string; end: string }[];
  closedDates: string[];
  revision: number;
}
export interface LeadAppointment {
  id: string;
  leadId: string;
  leadName: string;
  leadEmail?: string;
  assessment?: {
    score: number;
    priority: string;
    scoreLabel?: string;
    summary?: { label: string; quote: string }[];
    nextStep?: string;
  } | null;
  advisorId: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  description: string;
  status: 'confirmed' | 'cancelled';
  version: number;
  calendarRevision: number;
}
export interface SchedulingContext {
  actorId: string;
  canManage: boolean;
  advisors: { id: string; name: string }[];
  timezone: string;
}
export interface SlotState {
  calendarRevision: number;
  timezone: string;
  advisorTimezone: string | null;
  slots: { startsAt: string; endsAt: string }[];
}
@Injectable({ providedIn: 'root' })
export class LeadSchedulingService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl + '/bm/schedule/leads';
  context() {
    return this.http.get<SchedulingContext>(this.base + '/context');
  }
  lead(id: string) {
    return this.http.get<{
      lead: {
        leadId: string;
        displayName: string;
        email?: string;
        assignedTo: string | null;
        stage: string;
      };
    }>(this.base + '/lead/' + id);
  }
  calendar(id: string) {
    return this.http.get<{
      calendar: AdvisorCalendar | null;
      canEdit: boolean;
    }>(this.base + '/calendars/' + id);
  }
  saveCalendar(id: string, body: unknown) {
    return this.http.put<{ calendar: AdvisorCalendar; canEdit: boolean }>(
      this.base + '/calendars/' + id,
      body,
    );
  }
  list(params: Record<string, string | number>) {
    return this.http.get<{
      items: LeadAppointment[];
      total: number;
      page: number;
      limit: number;
    }>(this.base + '/appointments', { params });
  }
  calendarRange(start: string, end: string, timezone: string) {
    const params = {
      start,
      end,
      timezone,
      status: 'confirmed',
      limit: 100,
      sort: 'startsAt',
      direction: 'asc',
    };
    return this.list({ ...params, page: 1 }).pipe(
      expand((result) =>
        result.page * result.limit >= result.total
          ? EMPTY
          : result.page >= 50
            ? throwError(
                () =>
                  new Error(
                    'Too many appointments. Narrow the calendar range.',
                  ),
              )
            : this.list({ ...params, page: result.page + 1 }),
      ),
      reduce(
        (items: LeadAppointment[], result) =>
          Array.from(
            new Map(
              [...items, ...result.items].map((item) => [item.id, item]),
            ).values(),
          ),
        [],
      ),
    );
  }
  bookContact(body: unknown) {
    return this.http.post<{ appointment: LeadAppointment }>(
      this.base + '/appointments/new-contact',
      body,
    );
  }
  slots(params: Record<string, string>) {
    return this.http.get<SlotState>(this.base + '/availability', { params });
  }
  mutate(
    action: 'book' | 'reschedule' | 'cancel',
    id: string | null,
    body: unknown,
  ) {
    return this.http.post<{ appointment: LeadAppointment }>(
      this.base +
        '/appointments' +
        (action === 'book' ? '' : '/' + id + '/' + action),
      body,
    );
  }
}
