import {
  TestBed,
  ComponentFixture,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { LeadSchedulingPage } from './lead-scheduling.page';
import {
  LeadSchedulingService,
  LeadAppointment,
} from './lead-scheduling.service';
import { LeadWorkspaceService } from '../../../leads/lead-workspace.service';
const start =
  new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10) +
  'T01:00:00.000Z';
const appt = (): LeadAppointment => ({
  id: 'appointment',
  leadId: 'lead',
  leadName: 'Example lead',
  advisorId: 'advisor',
  startsAt: start,
  endsAt: new Date(Date.parse(start) + 1800000).toISOString(),
  timezone: 'Australia/Brisbane',
  description: '',
  status: 'confirmed',
  version: 1,
  calendarRevision: 1,
});
describe('Scheduling lead appointments', () => {
  let fixture: ComponentFixture<LeadSchedulingPage>,
    page: LeadSchedulingPage,
    api: jasmine.SpyObj<LeadSchedulingService>,
    leads: jasmine.SpyObj<LeadWorkspaceService>;
  beforeEach(async () => {
    api = jasmine.createSpyObj('LeadSchedulingService', [
      'context',
      'lead',
      'list',
      'calendar',
      'saveCalendar',
      'slots',
      'mutate',
    ]);
    leads = jasmine.createSpyObj('LeadWorkspaceService', ['list', 'detail']);
    api.context.and.returnValue(
      of({
        actorId: 'advisor',
        canManage: true,
        advisors: [{ id: 'advisor', name: 'Example advisor' }],
        timezone: 'Australia/Brisbane',
      }),
    );
    api.list.and.returnValue(
      of({ items: [appt()], total: 1, page: 1, limit: 25 }),
    );
    api.slots.and.returnValue(
      of({
        calendarRevision: 1,
        timezone: 'Australia/Brisbane',
        advisorTimezone: 'Australia/Brisbane',
        slots: [{ startsAt: start, endsAt: appt().endsAt }],
      }),
    );
    api.calendar.and.returnValue(of({ calendar: null, canEdit: true }));
    api.mutate.and.returnValue(of({ appointment: appt() }));
    leads.list.and.returnValue(of({ items: [], total: 0, page: 1, limit: 25 }));
    await TestBed.configureTestingModule({
      imports: [LeadSchedulingPage],
      providers: [
        provideRouter([]),
        { provide: LeadSchedulingService, useValue: api },
        { provide: LeadWorkspaceService, useValue: leads },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(LeadSchedulingPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
  });
  afterEach(() => {
    document.documentElement.classList.remove('dark');
    fixture.destroy();
  });
  it('loads once and applies server pagination and sort instead of sorting one page locally', () => {
    expect(api.list).toHaveBeenCalledTimes(1);
    page.sortBy('lead');
    expect(api.list.calls.mostRecent().args[0]['sort']).toBe('lead');
    page.range.controls.limit.setValue('50');
    expect(api.list.calls.mostRecent().args[0]['limit']).toBe(50);
    expect(fixture.nativeElement.textContent).toContain('Example lead');
  });
  it('retains the request key and entered values for a safe booking retry', () => {
    page.openBooking();
    page.booking.controls.leadId.setValue('lead');
    page.booking.controls.slot.setValue(start);
    api.mutate.and.returnValue(
      throwError(() => ({ error: { error: 'Try again' } })),
    );
    page.saveBooking();
    const first = api.mutate.calls.mostRecent().args[2] as any;
    expect(page.mode).toBe('book');
    expect(page.booking.controls.slot.value).toBe(start);
    api.mutate.and.returnValue(of({ appointment: appt() }));
    page.saveBooking();
    expect((api.mutate.calls.mostRecent().args[2] as any).requestKey).toBe(
      first.requestKey,
    );
    expect(page.mode).toBeNull();
  });
  it('blocks incomplete submission and never books merely when a slot is selected', () => {
    page.openBooking();
    page.saveBooking();
    expect(api.mutate).not.toHaveBeenCalled();
    expect(page.booking.controls.leadId.touched).toBeTrue();
    page.booking.controls.leadId.setValue('lead');
    page.booking.controls.slot.setValue(start);
    expect(api.mutate).not.toHaveBeenCalled();
  });
  it('cancels stale availability requests and clears a selected time after a date change', () => {
    const request = new Subject<any>();
    api.slots.and.returnValue(request);
    page.openBooking();
    expect(request.observed).toBeTrue();
    page.booking.controls.slot.setValue(start);
    page.booking.controls.date.setValue('2027-02-01');
    expect(page.booking.controls.slot.value).toBe('');
    page.close();
    expect(request.observed).toBeFalse();
  });
  it('refreshes available slots after a booking conflict without discarding the lead', () => {
    page.openBooking();
    page.booking.controls.leadId.setValue('lead');
    page.booking.controls.slot.setValue(start);
    api.mutate.and.returnValue(
      throwError(() => ({
        error: { error: 'Choose another time', fields: ['slot'] },
      })),
    );
    const before = api.slots.calls.count();
    page.saveBooking();
    expect(page.booking.controls.leadId.value).toBe('lead');
    expect(page.booking.controls.slot.value).toBe('');
    expect(api.slots.calls.count()).toBe(before + 1);
  });
  it('preserves cancelled and past rows with disabled actions and confirms cancellation', () => {
    const row = appt();
    expect(page.canChange({ ...row, status: 'cancelled' })).toBeFalse();
    expect(
      page.canChange({ ...row, startsAt: '2020-01-01T00:00:00Z' }),
    ).toBeFalse();
    page.openCancel(row);
    expect(api.mutate).not.toHaveBeenCalled();
    page.cancel();
    expect(api.mutate.calls.mostRecent().args[0]).toBe('cancel');
    expect((api.mutate.calls.mostRecent().args[2] as any).expectedVersion).toBe(
      1,
    );
  });
  it('shows availability read-only when not authorized and serializes shared selects as numbers', () => {
    api.calendar.and.returnValue(of({ calendar: null, canEdit: false }));
    page.openAvailability();
    page.saveAvailability();
    expect(api.saveCalendar).not.toHaveBeenCalled();
    page.canEditCalendar = true;
    page.addWindow();
    api.saveCalendar.and.returnValue(
      of({
        calendar: {
          advisorId: 'advisor',
          timezone: 'UTC',
          slotMinutes: 30,
          leadTimeMinutes: 60,
          bookingWindowDays: 30,
          weeklyHours: [],
          closedDates: [],
          revision: 1,
        },
        canEdit: true,
      }),
    );
    page.saveAvailability();
    const body = api.saveCalendar.calls.mostRecent().args[1] as any;
    expect(body.slotMinutes).toBe(30);
    expect(body.weeklyHours[0].day).toBe(1);
  });
  it('loads a preselected lead before fetching availability, without a redundant search', () => {
    const params = TestBed.inject(ActivatedRoute).snapshot.queryParamMap;
    spyOn(params, 'get').and.callFake((key) =>
      key === 'leadId' ? 'lead' : null,
    );
    api.lead.and.returnValue(
      of({
        lead: {
          leadId: 'lead',
          displayName: 'Example lead',
          assignedTo: 'advisor',
          stage: 'new',
        },
        events: [],
        hasOlder: false,
      } as any),
    );
    api.slots.calls.reset();
    page.openBooking();
    expect(api.slots).toHaveBeenCalledTimes(1);
    expect(leads.list).not.toHaveBeenCalled();
    expect(page.booking.controls.leadId.value).toBe('lead');
  });
  it('clears stale selection immediately and debounces timezone lookups', fakeAsync(() => {
    page.openBooking();
    page.booking.controls.slot.setValue(start);
    const count = api.slots.calls.count();
    page.booking.controls.timezone.setValue('Pacific/Au');
    expect(page.booking.controls.slot.value).toBe('');
    page.booking.controls.timezone.setValue('Pacific/Auckland');
    tick(349);
    expect(api.slots.calls.count()).toBe(count);
    tick(1);
    expect(api.slots.calls.count()).toBe(count + 1);
    page.close();
  }));
  it('opens available times upwards within the booking dialog', () => {
    api.slots.and.returnValue(
      of({
        calendarRevision: 1,
        timezone: 'Australia/Brisbane',
        advisorTimezone: 'Australia/Brisbane',
        slots: Array.from({ length: 20 }, (_, i) => ({
          startsAt: new Date(Date.parse(start) + i * 900000).toISOString(),
          endsAt: new Date(
            Date.parse(start) + i * 900000 + 1800000,
          ).toISOString(),
        })),
      }),
    );
    page.openBooking();
    fixture.detectChanges();
    const trigger = fixture.nativeElement.querySelector(
      'button[aria-label="Available appointment time"]',
    ) as HTMLButtonElement;
    trigger.scrollIntoView({ block: 'center' });
    trigger.click();
    fixture.detectChanges();
    const menu = trigger
      .closest('app-manager-select')!
      .querySelector('.select-menu') as HTMLElement;
    expect(menu).not.toBeNull();
    expect(menu.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      trigger.getBoundingClientRect().top + 1,
    );
  });
  it('fits desktop/mobile layouts, themed dialogs and touch targets', () => {
    for (const dark of [false, true]) {
      document.documentElement.classList.toggle('dark', dark);
      fixture.detectChanges();
      const table = fixture.nativeElement.querySelector('.desktop-table');
      const cards = fixture.nativeElement.querySelector('.mobile-cards');
      expect(
        getComputedStyle(window.innerWidth <= 860 ? cards : table).display,
      ).not.toBe('none');
      page.openBooking();
      fixture.detectChanges();
      const dialog = fixture.nativeElement.querySelector('.lead-modal');
      expect(dialog.getBoundingClientRect().width).toBeLessThanOrEqual(
        window.innerWidth,
      );
      expect(dialog.scrollWidth).toBeLessThanOrEqual(dialog.clientWidth);
      expect(getComputedStyle(dialog).backgroundColor).toBe(
        dark ? 'rgb(24, 36, 56)' : 'rgb(255, 255, 255)',
      );
      expect(getComputedStyle(dialog.querySelector('button')).minHeight).toBe(
        '44px',
      );
      page.close();
      fixture.detectChanges();
    }
  });
});
