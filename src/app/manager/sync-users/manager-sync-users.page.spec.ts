import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { ManagerSyncUsersPageComponent } from './manager-sync-users.page';
import {
  ManagerSyncUsersService,
  SyncOverview,
} from './manager-sync-users.service';

describe('Sync users review', () => {
  let fixture: ComponentFixture<ManagerSyncUsersPageComponent>;
  let api: jasmine.SpyObj<ManagerSyncUsersService>;
  const result: SyncOverview = {
    records: [
      {
        id: 'candidate-1',
        display_name: 'Meliza Velez Puerta',
        source_names: [
          'M30 MELIZA VELEZ PUERTA',
          'S15 - M30 Meliza Velez Puerta',
        ],
        emails: [],
        record_count: 4,
        status: 'pending',
        reason: 'Email is missing',
        student_id: null,
        resolution_name: null,
        resolution_email: null,
      },
    ],
    counts: { pending: 1 },
    runs: [
      {
        id: 'run-1',
        mode: 'preview',
        status: 'succeeded',
        phase: 'done',
        created_count: 0,
        processed_count: 0,
        error: null,
        created_at: '2026-10-11T00:00:00Z',
      },
    ],
    page: 1,
    total: 1,
    automatic: false,
  };
  beforeEach(async () => {
    api = jasmine.createSpyObj('ManagerSyncUsersService', [
      'list',
      'run',
      'resolve',
    ]);
    api.list.and.returnValue(of(result));
    api.run.and.returnValue(of({}));
    api.resolve.and.returnValue(of({}));
    await TestBed.configureTestingModule({
      imports: [ManagerSyncUsersPageComponent],
      providers: [
        provideRouter([]),
        { provide: ManagerSyncUsersService, useValue: api },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ManagerSyncUsersPageComponent);
  });
  afterEach(() => fixture.destroy());
  it('keeps loading visible until the first response and then shows actionable pending reasons', async () => {
    const response = new Subject<SyncOverview>();
    api.list.and.returnValue(response);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Loading sync records');
    expect(fixture.nativeElement.textContent).not.toContain('No records match');
    response.next(result);
    response.complete();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Email is missing');
    expect(fixture.nativeElement.textContent).toContain('4 transactions');
  });
  it('requires a valid correction and sends the explicit resolution', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    const page = fixture.componentInstance;
    page.edit(result.records[0]);
    await page.resolve('correct');
    expect(api.resolve).not.toHaveBeenCalled();
    expect(page.form.controls.email.touched).toBeTrue();
    page.form.controls.email.setValue('meliza@example.test');
    await page.resolve('correct');
    expect(api.resolve).toHaveBeenCalledWith(
      'candidate-1',
      jasmine.objectContaining({
        action: 'correct',
        email: 'meliza@example.test',
      }),
    );
    expect(page.selected).toBeNull();
  });
  for (const width of [390, 1440])
    for (const dark of [false, true]) {
      it(`fits ${width}px in ${dark ? 'dark' : 'light'} mode, including review controls`, async () => {
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.componentInstance.edit(result.records[0]);
        fixture.detectChanges();
        const frame = document.createElement('iframe');
        frame.style.width = `${width}px`;
        frame.style.height = '900px';
        document.body.appendChild(frame);
        try {
          const doc = frame.contentDocument!;
          doc.documentElement.classList.toggle('dark', dark);
          for (const style of Array.from(document.querySelectorAll('style')))
            doc.head.appendChild(style.cloneNode(true));
          doc.body.style.margin = '0';
          doc.body.appendChild(fixture.nativeElement);
          await new Promise((resolve) => setTimeout(resolve, 30));
          expect(doc.documentElement.scrollWidth).toBeLessThanOrEqual(
            width + 1,
          );
          const record = doc.querySelector('.record')!;
          expect(record.getBoundingClientRect().width).toBeLessThanOrEqual(
            width,
          );
          const panel = doc.querySelector('.review-panel')!;
          expect(panel.getBoundingClientRect().right).toBeLessThanOrEqual(
            width,
          );
          for (const button of Array.from(doc.querySelectorAll('.btn')))
            expect(
              button.getBoundingClientRect().height,
            ).toBeGreaterThanOrEqual(44);
          const background =
            frame.contentWindow!.getComputedStyle(record).backgroundColor;
          expect(background).toBe(
            dark ? 'rgb(30, 41, 59)' : 'rgb(255, 255, 255)',
          );
        } finally {
          document.body.appendChild(fixture.nativeElement);
          frame.remove();
        }
      });
    }
});
