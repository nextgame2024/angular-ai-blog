import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { LeadFormCalendarComponent } from './lead-form-calendar.component';
import {
  LeadFormCalendarEditorComponent,
  validFormCalendar,
} from './lead-form-calendar-editor.component';
import { LeadSchedulingService } from '../components/schedule/leads/lead-scheduling.service';
import { of } from 'rxjs';
describe('Form calendar', () => {
  const configuration = {
    advisorId: 'advisor',
    timezone: 'Australia/Brisbane',
    weeklyHours: [{ day: 1, start: '08:00', end: '17:00' }],
  };
  it('copies all intervals to selected days without duplicates or shared objects', () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: LeadSchedulingService,
          useValue: { context: () => of({ advisors: [] }) },
        },
      ],
    });
    const fixture = TestBed.createComponent(LeadFormCalendarEditorComponent),
      editor = fixture.componentInstance;
    editor.value = {
      ...configuration,
      weeklyHours: [
        { day: 1, start: '09:00', end: '12:00' },
        { day: 1, start: '14:00', end: '17:00' },
        { day: 2, start: '08:00', end: '10:00' },
      ],
    };
    editor.copyDays = new Set([2, 6]);
    editor.copyHours();
    expect(
      editor.value.weeklyHours.filter((h) => h.day === 2).map((h) => h.start),
    ).toEqual(['09:00', '14:00']);
    expect(editor.value.weeklyHours.filter((h) => h.day === 6).length).toBe(2);
    editor.copyHours();
    expect(editor.value.weeklyHours.length).toBe(6);
    editor.value.weeklyHours.find((h) => h.day === 2)!.start = '10:00';
    expect(editor.value.weeklyHours.find((h) => h.day === 1)!.start).toBe(
      '09:00',
    );
    const before = JSON.stringify(editor.value.weeklyHours);
    editor.disabled = true;
    editor.copyHours();
    expect(JSON.stringify(editor.value.weeklyHours)).toBe(before);
  });
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
    fixture.detectChanges();
    fixture.nativeElement
      .querySelector('app-manager-calendar .time-slot')
      .click();
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('.selected-appointment'),
    ).toBeNull();
    expect(
      fixture.nativeElement
        .querySelector('.time-slot')
        .getAttribute('aria-pressed'),
    ).toBe('true');
    expect(page.selectionChange.emit).toHaveBeenCalledWith({
      startsAt: '2026-12-01T00:00:00.000Z',
      calendarRevision: 7,
    });
    const frame = document.createElement('iframe');
    frame.style.height = '900px';
    document.body.appendChild(frame);
    try {
      const doc = frame.contentDocument!;
      for (const style of Array.from(document.querySelectorAll('style')))
        doc.head.appendChild(style.cloneNode(true));
      doc.body.style.margin = '0';
      doc.body.appendChild(fixture.nativeElement.cloneNode(true));
      for (const width of [390, 1100])
        for (const dark of [false, true]) {
          frame.style.width = width + 'px';
          doc.documentElement.classList.toggle('dark', dark);
          expect(doc.documentElement.scrollWidth).toBeLessThanOrEqual(width);
          const calendar = doc.querySelector(
            'app-manager-calendar',
          ) as HTMLElement;
          expect(calendar.getBoundingClientRect().width).toBeGreaterThan(
            width - 40,
          );
          expect(
            frame.contentWindow!.getComputedStyle(calendar).backgroundColor,
          ).toBe(dark ? 'rgb(24, 36, 56)' : 'rgb(255, 255, 255)');
        }
    } finally {
      frame.remove();
    }
    http.verify();
  });
});
