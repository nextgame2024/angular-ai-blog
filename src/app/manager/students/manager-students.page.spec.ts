import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
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
    fixture.componentInstance.status.setValue('healthy');
    expect(first.observed).toBeFalse();
    expect(api.studentRegister).toHaveBeenCalledWith(jasmine.objectContaining({ status: 'healthy' }));
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
});
