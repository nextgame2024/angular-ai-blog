import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { StudentOperationsService } from '../student-operations/student-operations.service';
import type { StudentRegisterResult } from '../student-operations/student-operations.types';
import { ManagerStudentsPageComponent } from './manager-students.page';

describe('ManagerStudentsPageComponent', () => {
  let fixture: ComponentFixture<ManagerStudentsPageComponent>;
  const emptyResult: StudentRegisterResult = {
    students: [], page: 1, limit: 25, total: 0,
    summary: {
      total: 0, activeStudents: 0, newApplications: 0, actionRequired: 0,
      noVigente: 0, attentionThisWeek: 0, lastUpdated: null,
      trend: { available: false, reason: 'Historical comparison is not yet available.' },
    },
    options: { advisors: [], colleges: [] },
  };
  const api = {
    workspace: jasmine.createSpy().and.returnValue(of({ role: 'operations' })),
    studentRegister: jasmine.createSpy().and.returnValue(of(emptyResult)),
  };

  beforeEach(async () => {
    api.workspace.calls.reset();
    api.studentRegister.calls.reset();
    api.workspace.and.returnValue(of({ role: 'operations' }));
    api.studentRegister.and.returnValue(of(emptyResult));
    await TestBed.configureTestingModule({
      imports: [ManagerStudentsPageComponent],
      providers: [provideRouter([]), { provide: StudentOperationsService, useValue: api }],
    }).compileComponents();
    fixture = TestBed.createComponent(ManagerStudentsPageComponent);
  });

  it('shows an empty state and keeps future write actions disabled', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No students found');
    const actions = fixture.nativeElement.querySelectorAll('.register-actions button');
    expect(actions.length).toBe(2);
    expect(actions[0].disabled).toBeTrue();
    expect(actions[1].disabled).toBeTrue();
  });

  it('jumps to page 20 and restores its filters, size and sorting after leaving the list', fakeAsync(() => {
    api.studentRegister.and.callFake(query => of({ ...emptyResult, page: query.page, limit: query.limit, total: 1068 }));
    fixture.detectChanges();
    fixture.componentInstance.search.setValue('Example'); tick(300);
    fixture.componentInstance.advisor.setValue('advisor-1');
    fixture.componentInstance.sort('name');
    fixture.componentInstance.pageSize.setValue('50');
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('app-page-jump input') as HTMLInputElement;
    input.value = '20'; input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(api.studentRegister.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({ page: 20, limit: 50 }));
    fixture.destroy();
    api.studentRegister.calls.reset();
    fixture = TestBed.createComponent(ManagerStudentsPageComponent);
    fixture.detectChanges();
    expect(api.studentRegister).toHaveBeenCalledTimes(1);
    expect(api.studentRegister.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({
      page: 20, limit: 50, q: 'Example', advisorId: 'advisor-1', sortBy: 'name', sortDir: 'asc',
    }));
    expect((fixture.nativeElement.querySelector('app-page-jump input') as HTMLInputElement).value).toBe('20');
    fixture.componentInstance.advisor.setValue('');
    expect(api.studentRegister.calls.mostRecent().args[0].page).toBe(1);
  }));

  it('collapses only the summary while keeping filters usable without resetting the register', () => {
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('.section-toggle') as HTMLButtonElement;
    const sections = fixture.nativeElement.querySelector('#student-summary-filters') as HTMLElement;
    const search = sections.querySelector('.search-field input') as HTMLInputElement;
    const requests = api.studentRegister.calls.count();
    expect(button.parentElement?.classList.contains('filters')).toBeTrue();
    expect(button.previousElementSibling?.classList.contains('date-filter')).toBeTrue();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    button.click();
    fixture.detectChanges();
    expect((sections.querySelector('.summary-grid') as HTMLElement).hidden).toBeTrue();
    expect(sections.querySelector('.search-field input')).toBe(search);
    expect(sections.querySelectorAll('app-manager-select').length).toBe(2);
    expect(sections.querySelector('p-datepicker')).not.toBeNull();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(api.studentRegister.calls.count()).toBe(requests);
    button.click();
    fixture.detectChanges();
    expect((sections.querySelector('.summary-grid') as HTMLElement).hidden).toBeFalse();
    expect(sections.querySelector('.search-field input')).toBe(search);
    expect(button.getAttribute('aria-expanded')).toBe('true');
  });

  it('matches Payments and Control register heading typography', () => {
    fixture.detectChanges();
    const heading = fixture.nativeElement.querySelector('.page-header h1') as HTMLElement;
    const subtitle = fixture.nativeElement.querySelector('.page-header p') as HTMLElement;
    const rootSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
    expect(parseFloat(getComputedStyle(heading).fontSize)).toBeCloseTo(rootSize * 1.05, 1);
    expect(getComputedStyle(heading).fontWeight).toBe('800');
    expect(parseFloat(getComputedStyle(subtitle).fontSize)).toBeCloseTo(rootSize * 0.9, 1);
  });

  it('uses the shared spinner on initial and subsequent register loads', () => {
    const pending = new Subject<StudentRegisterResult>();
    const refresh = new Subject<StudentRegisterResult>();
    api.studentRegister.and.returnValues(pending, refresh);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-manager-list-loader .loader-ring')).not.toBeNull();
    pending.next(emptyResult);
    pending.complete();
    fixture.componentInstance.status.setValue('in_progress');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-manager-list-loader.overlay-host .loader-ring')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Updating students…');
    refresh.next(emptyResult);
    refresh.complete();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-manager-list-loader')).toBeNull();
  });

  it('keeps the date input and calendar button on one line', () => {
    fixture.detectChanges();
    const picker = fixture.nativeElement.querySelector('.student-date-range') as HTMLElement;
    const input = picker.querySelector('.p-datepicker-input') as HTMLElement;
    const calendar = picker.querySelector('.p-datepicker-dropdown') as HTMLElement;
    expect(getComputedStyle(picker).display).toBe('flex');
    expect(input.getBoundingClientRect().top).toBe(calendar.getBoundingClientRect().top);
  });

  it('debounces search and resets server pagination', fakeAsync(() => {
    fixture.detectChanges();
    api.studentRegister.calls.reset();
    fixture.componentInstance.search.setValue('  Joselin  ');
    tick(299);
    expect(api.studentRegister).not.toHaveBeenCalled();
    tick(1);
    expect(api.studentRegister).toHaveBeenCalledWith(jasmine.objectContaining({ q: 'Joselin', page: 1 }));
  }));

  it('waits for both range dates before requesting records', () => {
    fixture.detectChanges();
    api.studentRegister.calls.reset();
    fixture.componentInstance.dateRange.setValue([new Date(2026, 9, 1)]);
    expect(api.studentRegister).not.toHaveBeenCalled();
    fixture.componentInstance.dateRange.setValue([new Date(2026, 9, 1), new Date(2026, 9, 14)]);
    expect(api.studentRegister).toHaveBeenCalledWith(jasmine.objectContaining({
      from: '2026-10-01', to: '2026-10-14', page: 1,
    }));
  });

  it('cancels a stale request when a new filter is applied', () => {
    const first = new Subject<StudentRegisterResult>();
    api.studentRegister.and.returnValues(first, of(emptyResult));
    fixture.detectChanges();
    expect(first.observed).toBeTrue();
    fixture.componentInstance.status.setValue('in_progress');
    expect(first.observed).toBeFalse();
    expect(api.studentRegister).toHaveBeenCalledWith(jasmine.objectContaining({ status: 'in_progress' }));
  });

  it('applies the insight filter and requests a different server page', () => {
    api.studentRegister.and.returnValue(of({ ...emptyResult, total: 60 }));
    fixture.detectChanges();
    fixture.componentInstance.viewAttention();
    expect(api.studentRegister).toHaveBeenCalledWith(jasmine.objectContaining({ attentionThisWeek: true }));
    fixture.componentInstance.clearAttention();
    fixture.componentInstance.goToPage(2);
    expect(api.studentRegister).toHaveBeenCalledWith(jasmine.objectContaining({ page: 2, limit: 25 }));
  });

  it('filters by directory advisor ID and clears the filter without using the Xero label', () => {
    api.studentRegister.and.returnValue(of({
      ...emptyResult,
      options: {
        advisors: [{ advisorId: 'advisor-paulina', code: 'S15', name: 'Paulina Aguillon' }],
        colleges: [{ collegeId: null, name: 'ATI' }],
      },
    }));
    fixture.detectChanges();
    expect(fixture.componentInstance.advisorOptions).toContain(jasmine.objectContaining({
      value: 'advisor-paulina', label: 'Paulina Aguillon',
    }));
    fixture.componentInstance.advisor.setValue('advisor-paulina');
    expect(api.studentRegister).toHaveBeenCalledWith(jasmine.objectContaining({
      advisorId: 'advisor-paulina', advisorName: undefined, page: 1,
    }));
    fixture.componentInstance.advisor.setValue('');
    expect(api.studentRegister).toHaveBeenCalledWith(jasmine.objectContaining({
      advisorId: undefined, advisorName: undefined, page: 1,
    }));
    expect(fixture.nativeElement.querySelector('[aria-label="Filter by college"]')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('All colleges');
  });

  it('labels the mixed reference/college column and advertises it in search', fakeAsync(() => {
    api.studentRegister.and.returnValue(of({
      ...emptyResult, total: 1, students: [{
        userId: 'user-1', studentProfileId: 'profile-1', studentReference: 'STD-2',
        legalName: 'Fabian Student', email: 'fabian@example.com', recordDate: '2026-10-16', caseId: null,
        caseReference: null, currentStage: null, advisorUserId: null, advisorId: null,
        advisorName: null, advisorXeroName: null,
        collegeId: null, collegeName: 'ATI', status: 'not_started', attentionReason: null,
        caseCount: 0, cases: [], nextPayment: null,
      }],
    }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.student-table thead').textContent).toContain('Ref / College');
    const sortedHeader = fixture.nativeElement.querySelector('.student-table th[aria-sort="descending"]') as HTMLElement;
    const sortIndicator = sortedHeader.querySelector('.sort-indicator') as HTMLElement;
    expect(sortedHeader.textContent).toContain('Case opened');
    expect(api.studentRegister).toHaveBeenCalledWith(jasmine.objectContaining({ sortBy: 'date', sortDir: 'desc' }));
    expect(getComputedStyle(sortIndicator, '::before').borderBottomStyle).toBe('solid');
    expect(getComputedStyle(sortIndicator, '::after').borderTopStyle).toBe('solid');
    expect(fixture.nativeElement.querySelector('.student-cards').textContent).toContain('Ref / College');
    expect(fixture.nativeElement.querySelector('.search-field input').placeholder).toContain('Ref / College');
    api.studentRegister.calls.reset();
    fixture.componentInstance.search.setValue('ATI');
    tick(300);
    expect(api.studentRegister).toHaveBeenCalledWith(jasmine.objectContaining({ q: 'ATI', page: 1 }));
  }));

  it('shows the latest case advisor, reference, payment and lifecycle status on desktop and mobile', () => {
    api.studentRegister.and.returnValue(of({
      ...emptyResult, total: 1, students: [{
        userId: 'user-1', studentProfileId: 'profile-1', studentReference: 'STD-2',
        legalName: 'Fabian Student', email: 'fabian@example.com', recordDate: '2026-10-16', caseId: 'case-2',
        caseReference: 'CASE-2', currentStage: 'imported_pending_review',
        advisorUserId: null, advisorId: 'advisor-1', advisorName: 'Paulina Aguillon',
        advisorXeroName: 'S15 Paulina Aguillon',
        collegeId: null, collegeName: 'ATI', status: 'in_progress', attentionReason: null,
        caseCount: 2, cases: [
          { caseId: 'case-2', caseReference: 'CASE-2', lifecycleStatus: 'open', openedOn: '2026-10-16' },
          { caseId: 'case-1', caseReference: 'CASE-1', lifecycleStatus: 'completed', openedOn: '2026-01-01' },
        ],
        nextPayment: { caseId: 'case-2', dueOn: '2026-11-01', amount: '200', currency: 'AUD' },
      }],
    }));
    fixture.detectChanges();
    const table = fixture.nativeElement.querySelector('.student-table tbody') as HTMLElement;
    const mobile = fixture.nativeElement.querySelector('.student-cards') as HTMLElement;
    expect(fixture.nativeElement.querySelector('.student-table th:last-child')?.textContent).toContain('Cases');
    expect(fixture.nativeElement.querySelector('.student-table thead')?.textContent).not.toContain('Actions');
    expect(fixture.nativeElement.querySelector('.student-cards .row-actions')).toBeNull();
    for (const view of [table, mobile]) {
      expect(view.textContent).toContain('S15 Paulina Aguillon');
      expect(view.textContent).toContain('Paulina Aguillon');
      expect(view.textContent).toContain('ATI');
      expect(view.textContent).toContain('In progress');
      expect(view.textContent).toContain('CASE-2');
      expect(view.textContent).toContain('16 Oct 2026');
      expect(view.textContent).toContain('$200.00');
      const caseLink = view.querySelector('a.case-label') as HTMLAnchorElement;
      expect(caseLink.getAttribute('href')).toBe('/manager/students/cases/case-2');
      expect(caseLink.getAttribute('aria-label')).toContain('View case CASE-2');
    }
    expect(table.textContent).not.toContain('Healthy');
  });

  it('sorts the whole register by Date descending by default and toggles Date on the server', () => {
    api.studentRegister.and.returnValue(of({ ...emptyResult, total: 60 }));
    fixture.detectChanges();
    expect(api.studentRegister).toHaveBeenCalledWith(jasmine.objectContaining({ page: 1, sortBy: 'date', sortDir: 'desc' }));
    expect(fixture.componentInstance.sortAria('date')).toBe('descending');

    fixture.componentInstance.goToPage(2);
    fixture.componentInstance.sort('date');
    expect(api.studentRegister).toHaveBeenCalledWith(jasmine.objectContaining({ page: 1, sortBy: 'date', sortDir: 'asc' }));
    expect(fixture.componentInstance.sortAria('date')).toBe('ascending');
    fixture.componentInstance.sort('date');
    expect(api.studentRegister).toHaveBeenCalledWith(jasmine.objectContaining({ page: 1, sortBy: 'date', sortDir: 'desc' }));
  });

  it('keeps the register usable and labels its actual sort when an older API rejects Date', () => {
    const unsupportedDate = new HttpErrorResponse({
      status: 400,
      error: { message: 'Invalid Students register filters.' },
    });
    api.studentRegister.and.returnValues(throwError(() => unsupportedDate), of(emptyResult), of(emptyResult));
    fixture.detectChanges();

    expect(api.studentRegister.calls.count()).toBe(2);
    expect(api.studentRegister.calls.argsFor(1)[0]).toEqual(jasmine.objectContaining({ sortBy: 'name', sortDir: 'asc' }));
    expect(fixture.componentInstance.error).toBe('');
    expect(fixture.componentInstance.sortAria('date')).toBe('none');
    expect(fixture.componentInstance.sortAria('name')).toBe('ascending');
    expect(fixture.nativeElement.textContent).toContain('Date sorting is unavailable');

    fixture.componentInstance.status.setValue('in_progress');
    expect(api.studentRegister.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({
      sortBy: 'name', sortDir: 'asc', status: 'in_progress',
    }));
  });

  it('does not retry unrelated request errors as an old-API compatibility issue', () => {
    api.studentRegister.and.returnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
    fixture.detectChanges();
    expect(api.studentRegister.calls.count()).toBe(1);
    expect(fixture.componentInstance.error).toContain('could not be loaded');
    expect(fixture.componentInstance.legacyDateSort).toBeFalse();
  });
});
