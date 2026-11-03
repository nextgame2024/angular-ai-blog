import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { LeadAssistantSettingsPage } from './lead-assistant-settings.page';
import {
  LeadAssistantSettingsService,
  SettingsState,
} from './lead-assistant-settings.service';
const owner = '33333333-3333-4333-8333-333333333333';
const state = (): SettingsState => ({
  revision: 0,
  canManage: true,
  published: null,
  updatedAt: null,
  staff: [{ id: owner, name: 'Example owner' }],
  hasMoreStaff: false,
  configuration: {
    businessName: '',
    contactName: '',
    supportContact: '',
    enquiryOwnerId: null,
    contentOwnerId: null,
    fallbackOwnerId: null,
    advisorIds: [],
    timezone: 'Australia/Brisbane',
    coverage: [],
    closedDates: [],
    afterHoursMessage: '',
    greeting: '',
    defaultLanguage: 'es',
    languages: ['es'],
  },
  connection: {
    status: 'not_connected',
    numberUsage: 'business_app',
    coexistenceVerified: false,
  },
});
describe('Lead assistant Settings', () => {
  let fixture: ComponentFixture<LeadAssistantSettingsPage>,
    page: LeadAssistantSettingsPage,
    api: jasmine.SpyObj<LeadAssistantSettingsService>;
  beforeEach(async () => {
    api = jasmine.createSpyObj('LeadAssistantSettingsService', [
      'load',
      'save',
      'publish',
      'staff',
    ]);
    api.load.and.returnValue(of(state()));
    api.staff.and.returnValue(of({ staff: [], hasMore: false }));
    await TestBed.configureTestingModule({
      imports: [LeadAssistantSettingsPage],
      providers: [
        provideRouter([]),
        { provide: LeadAssistantSettingsService, useValue: api },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(LeadAssistantSettingsPage);
    page = fixture.componentInstance;
  });
  afterEach(() => {
    document.documentElement.classList.remove('dark');
    fixture.destroy();
  });
  it('keeps chrome and a scoped loader until the first response', () => {
    const pending = new Subject<SettingsState>();
    api.load.and.returnValue(pending);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'Leads & Conversations',
    );
    expect(
      fixture.nativeElement.querySelector('app-manager-list-loader'),
    ).not.toBeNull();
    pending.next(state());
    pending.complete();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('form')).not.toBeNull();
  });
  it('saves incomplete drafts without claiming WhatsApp is connected', () => {
    fixture.detectChanges();
    api.save.and.returnValue(of({ ...state(), revision: 1 }));
    page.save();
    expect(api.save).toHaveBeenCalledWith(
      0,
      jasmine.objectContaining({ businessName: '', advisorIds: [] }),
    );
    expect(fixture.nativeElement.textContent).toContain(
      'WhatsApp setup pending',
    );
  });
  it('retains edits and highlights failed server validation on custom controls', () => {
    fixture.detectChanges();
    api.save.and.returnValue(
      throwError(() => ({
        status: 400,
        error: {
          error: 'Choose active staff.',
          fields: ['enquiryOwnerId', 'advisorIds'],
        },
      })),
    );
    page.form.controls.businessName.setValue('My edits');
    page.form.markAsDirty();
    page.save();
    fixture.detectChanges();
    expect(page.form.controls.businessName.value).toBe('My edits');
    expect(
      fixture.nativeElement
        .querySelector('#enquiry-owner')
        .classList.contains('invalid'),
    ).toBeTrue();
    expect(
      fixture.nativeElement.querySelector('app-manager-toast').textContent,
    ).toContain('Choose active staff.');
  });
  it('publishes only the saved revision and blocks unsaved changes', () => {
    fixture.detectChanges();
    page.form.markAsDirty();
    page.publish();
    expect(api.publish).not.toHaveBeenCalled();
    api.save.and.returnValue(of({ ...state(), revision: 2 }));
    page.save();
    api.publish.and.returnValue(
      of({
        ...state(),
        revision: 2,
        published: {
          release_id: 'release',
          source_revision: 2,
          published_at: '2026-11-02T09:00:00Z',
        },
      }),
    );
    page.publish();
    expect(api.publish).toHaveBeenCalledOnceWith(2);
    expect(page.toast).toContain('Settings published');
  });
  it('supports split coverage and deduplicates advisors and closed dates', () => {
    fixture.detectChanges();
    page.addWindow();
    page.addWindow();
    page.coverage.at(1).patchValue({ start: '13:00', end: '17:00' });
    page.advisorChoice.setValue(owner);
    page.addAdvisor();
    page.advisorChoice.setValue(owner);
    page.addAdvisor();
    page.closedDate.setValue('2026-12-25');
    page.addClosedDate();
    page.closedDate.setValue('2026-12-25');
    page.addClosedDate();
    expect(page.configuration().advisorIds).toEqual([owner]);
    expect(page.configuration().closedDates).toHaveSize(1);
    expect(page.configuration().coverage).toHaveSize(2);
    expect(page.form.dirty).toBeTrue();
  });
  it('keeps one supported language and updates its default when needed', () => {
    fixture.detectChanges();
    page.toggleLanguage('es', false);
    expect(page.selectedLanguages).toEqual(['es']);
    page.toggleLanguage('en', true);
    page.toggleLanguage('es', false);
    expect(page.form.controls.defaultLanguage.value).toBe('en');
  });
  it('cancels superseded team searches and stops requests on destruction', fakeAsync(() => {
    fixture.detectChanges();
    const first = new Subject<{
      staff: { id: string; name: string }[];
      hasMore: boolean;
    }>();
    api.staff.and.returnValues(
      first,
      of({ staff: [{ id: 'second', name: 'Second match' }], hasMore: false }),
    );
    page.teamSearch.setValue('First');
    tick(260);
    page.teamSearch.setValue('Second');
    tick(260);
    first.next({ staff: [{ id: 'old', name: 'Old result' }], hasMore: false });
    expect(page.staff[0].name).toBe('Second match');
    page.teamSearch.setValue('Third');
    fixture.destroy();
    tick(300);
    expect(api.staff).toHaveBeenCalledTimes(2);
  }));
  it('asks before discarding unsaved changes on reload', () => {
    fixture.detectChanges();
    page.form.markAsDirty();
    page.reload();
    fixture.detectChanges();
    expect(api.load).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('[role=dialog]')).not.toBeNull();
    page.discardAndReload();
    expect(api.load).toHaveBeenCalledTimes(2);
    expect(page.form.pristine).toBeTrue();
  });
  it('does not show an editable form after access is denied', () => {
    api.load.and.returnValue(
      throwError(() => ({ status: 403, error: { error: 'Access denied' } })),
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Access denied');
  });
  for (const dark of [false, true])
    it(`fits the viewport with readable ${dark ? 'dark' : 'light'} controls`, async () => {
      document.documentElement.classList.toggle('dark', dark);
      fixture.detectChanges();
      page.addWindow();
      fixture.detectChanges();
      await fixture.whenStable();
      const root = fixture.nativeElement as HTMLElement;
      const shell = root.querySelector('.assistant-shell') as HTMLElement;
      expect(shell.scrollWidth).toBeLessThanOrEqual(shell.clientWidth + 2);
      const input = root.querySelector('#business') as HTMLElement;
      expect(input.getBoundingClientRect().height).toBeGreaterThanOrEqual(40);
      expect(getComputedStyle(input).color).not.toBe(
        getComputedStyle(input).backgroundColor,
      );
    });
});
