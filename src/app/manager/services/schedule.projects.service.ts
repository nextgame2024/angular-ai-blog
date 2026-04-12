import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

import type {
  BmSchedule,
  BmScheduledItem,
  ScheduleItemsResponse,
  ScheduleListResponse,
  ScheduleSavePayload,
} from '../types/schedule.interface';

@Injectable()
export class ManagerScheduleProjectsService {
  private readonly http = inject(HttpClient);
  private readonly apiBase = environment.apiUrl;
  private readonly scheduleBase = `${this.apiBase}/bm/schedule`;

  private normalizeScheduleDate(value: unknown): string {
    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }

    const normalized = String(value || '').trim();
    if (!normalized) {
      return '';
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      return normalized;
    }

    if (/^\d{4}-\d{2}-\d{2}T/.test(normalized)) {
      return normalized.slice(0, 10);
    }

    return normalized;
  }

  private normalizeScheduleTime(value: unknown): string {
    const normalized = String(value || '').trim();
    if (!normalized) {
      return '';
    }

    if (/^\d{2}:\d{2}$/.test(normalized)) {
      return normalized;
    }

    if (/^\d{2}:\d{2}:\d{2}$/.test(normalized)) {
      return normalized.slice(0, 5);
    }

    return normalized;
  }

  private normalizeSchedule(schedule: BmSchedule): BmSchedule {
    return {
      ...schedule,
      date: this.normalizeScheduleDate(schedule.date),
      startTime: this.normalizeScheduleTime(schedule.startTime),
      endTime: this.normalizeScheduleTime(schedule.endTime),
    };
  }

  listSchedules(params: {
    start: string;
    end: string;
    projectId?: string | null;
  }): Observable<ScheduleListResponse> {
    let httpParams = new HttpParams()
      .set('start', params.start)
      .set('end', params.end);

    if (params.projectId) {
      httpParams = httpParams.set('project_id', params.projectId);
    }

    return this.http
      .get<ScheduleListResponse>(this.scheduleBase, {
        params: httpParams,
      })
      .pipe(
        map((response) => ({
          ...response,
          schedules: (response.schedules ?? []).map((schedule) =>
            this.normalizeSchedule(schedule),
          ),
        })),
      );
  }

  searchScheduledItems(params: {
    q: string;
    type?: string;
    limit?: number;
  }): Observable<ScheduleItemsResponse> {
    let httpParams = new HttpParams().set('q', params.q);

    if (params.type) {
      httpParams = httpParams.set('type', params.type);
    }
    if (params.limit) {
      httpParams = httpParams.set('limit', String(params.limit));
    }

    return this.http.get<ScheduleItemsResponse>(`${this.scheduleBase}/items`, {
      params: httpParams,
    });
  }

  createSchedule(
    payload: ScheduleSavePayload,
  ): Observable<{ schedule: BmSchedule }> {
    return this.http
      .post<{ schedule: BmSchedule }>(this.scheduleBase, {
        schedule: payload,
      })
      .pipe(
        map((response) => ({
          schedule: this.normalizeSchedule(response.schedule),
        })),
      );
  }

  updateSchedule(
    scheduleId: string,
    payload: ScheduleSavePayload,
  ): Observable<{ schedule: BmSchedule }> {
    return this.http
      .put<{ schedule: BmSchedule }>(
        `${this.scheduleBase}/${scheduleId}`,
        { schedule: payload },
      )
      .pipe(
        map((response) => ({
          schedule: this.normalizeSchedule(response.schedule),
        })),
      );
  }

  deleteSchedule(scheduleId: string): Observable<{ scheduleId: string }> {
    return this.http.delete<{ scheduleId: string }>(
      `${this.scheduleBase}/${scheduleId}`,
    );
  }
}
