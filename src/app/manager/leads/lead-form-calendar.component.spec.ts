import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { LeadFormCalendarComponent } from './lead-form-calendar.component';
import { validFormCalendar } from './lead-form-calendar-editor.component';
describe('Form calendar', () => {
  const configuration = {
    advisorId: 'advisor',
    timezone: 'Australia/Brisbane',
    weeklyHours: [{ day: 1, start: '08:00', end: '17:00' }],
  };
  it('validates time intervals and overlap', () => {
    expect(validFormCalendar(configuration)).toBeTrue();
    expect(
      validFormCalendar({ ...configuration, weeklyHours: [] }),
    ).toBeFalse();
    expect(
      validFormCalendar({
        ...configuration,
        weeklyHours: [{ day: 1, start: '17:00', end: '08:00' }],
      }),
    ).toBeFalse();
    expect(
      validFormCalendar({
        ...configuration,
        weeklyHours: [
          ...configuration.weeklyHours,
          { day: 1, start: '09:00', end: '10:00' },
        ],
      }),
    ).toBeFalse();
  });
  it('loads public times, cancels stale requests and emits the selected revision', async () => {
    await TestBed.configureTestingModule({
      imports: [LeadFormCalendarComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(LeadFormCalendarComponent),
      page = fixture.componentInstance,
      http = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('block', {
      id: 'calendar',
      kind: 'calendar',
      text: '',
      required: false,
      options: [],
      calendar: configuration,
    });
    fixture.componentRef.setInput('token', 'tenant.publication');
    fixture.componentRef.setInput('formVersion', 2);
    fixture.detectChanges();
    const old = http.expectOne((r) => r.url.includes('/availability'));
    page.day = '2026-12-01';
    page.load();
    expect(old.cancelled).toBeTrue();
    const current = http.expectOne(
      (r) => r.params.get('date') === '2026-12-01',
    );
    current.flush({
      calendarRevision: 7,
      slots: [
        {
          startsAt: '2026-12-01T00:00:00.000Z',
          endsAt: '2026-12-01T00:30:00.000Z',
        },
      ],
    });
    spyOn(page.selectionChange, 'emit');
    page.choose(page.options[0].value);
    expect(page.selectionChange.emit).toHaveBeenCalledWith({
      startsAt: '2026-12-01T00:00:00.000Z',
      calendarRevision: 7,
    });
    http.verify();
  });
});
