import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { StudentOperationsService } from '../student-operations.service';
import { ManagerService } from '../../services/manager.service';
import { StudentOperationsStudentsPageComponent } from './student-operations-students.page';

describe('StudentOperationsStudentsPageComponent', () => {
  let fixture: ComponentFixture<StudentOperationsStudentsPageComponent>;
  const api = {
    workspace: jasmine.createSpy().and.returnValue(of({
      packId: 'student-operations', version: '0.1.0', tenantId: 'tenant-1',
      role: 'operations', authorizationRevision: 1, workspaceRoutes: ['students'],
    })),
    students: jasmine.createSpy().and.returnValue(of({
      students: [], page: 1, limit: 20, total: 0,
    })),
    advisors: jasmine.createSpy().and.returnValue(of({ advisorIdentityUserIds: [] })),
    student: jasmine.createSpy(),
    createStudent: jasmine.createSpy(),
    updateStudent: jasmine.createSpy(),
  };
  const managerApi = {
    listUsers: jasmine.createSpy().and.returnValue(of({
      items: [], page: 1, limit: 100, total: 0,
    })),
  };

  beforeEach(async () => {
    api.workspace.calls.reset();
    api.students.calls.reset();
    api.advisors.calls.reset();
    api.createStudent.calls.reset();
    managerApi.listUsers.calls.reset();
    api.workspace.and.returnValue(of({
      packId: 'student-operations', version: '0.1.0', tenantId: 'tenant-1',
      role: 'operations', authorizationRevision: 1, workspaceRoutes: ['students'],
    }));
    api.students.and.returnValue(of({ students: [], page: 1, limit: 20, total: 0 }));
    await TestBed.configureTestingModule({
      imports: [StudentOperationsStudentsPageComponent],
      providers: [
        provideRouter([]),
        { provide: StudentOperationsService, useValue: api },
        { provide: ManagerService, useValue: managerApi },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(StudentOperationsStudentsPageComponent);
  });

  it('renders the production empty state with a create action for operations', () => {
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('No students found');
    expect(text).toContain('excludes restricted identity documents');
    expect(text).toContain('Create');
    expect(text).not.toContain('synthetic');
  });

  it('keeps advisors read-only by hiding student write actions', () => {
    api.workspace.and.returnValue(of({
      packId: 'student-operations', version: '0.1.0', tenantId: 'tenant-1',
      role: 'advisor', authorizationRevision: 1, workspaceRoutes: ['students'],
    }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.btn.primary')).toBeNull();
  });

  it('highlights invalid required fields and shows the standard validation toast', () => {
    fixture.detectChanges();
    fixture.componentInstance.openCreate();
    fixture.detectChanges();

    fixture.componentInstance.saveStudent();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('input[formControlName="studentReference"]')).toHaveClass('ng-invalid');
    expect(fixture.nativeElement.querySelector('input[formControlName="studentReference"]')).toHaveClass('ng-touched');
    expect(fixture.nativeElement.querySelector('.form-toast.error')?.textContent).toContain(
      'Please complete the required student fields',
    );
    expect(api.createStudent).not.toHaveBeenCalled();
  });

  it('submits a validated student create with an idempotency key', () => {
    api.createStudent.and.returnValue(of({ studentId: 'student-1' }));
    fixture.detectChanges();
    fixture.componentInstance.openCreate();
    fixture.detectChanges();
    fixture.componentInstance.studentForm.patchValue({
      studentReference: 'STU-001', legalName: 'Synthetic Student',
      email: 'student@example.invalid', currentStage: 'new_application', status: 'active',
    });
    fixture.componentInstance.saveStudent();
    expect(api.createStudent).toHaveBeenCalledWith(
      jasmine.objectContaining({ studentReference: 'STU-001', legalName: 'Synthetic Student' }),
      jasmine.any(String),
    );
  });

  it('shows entitlement denial without exposing workspace data', () => {
    api.workspace.and.returnValue(throwError(() => ({ status: 403 })));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'This account does not have Student Operations workspace access.',
    );
    expect(fixture.componentInstance.students).toEqual([]);
  });

  it('keeps the page controls visible while loading only the register', () => {
    api.students.and.returnValue(new Subject());
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Manage active and historical');
    expect(fixture.nativeElement.querySelector('.list-loader .loader-content')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.list-loader .loader-card')).toBeNull();
    expect(fixture.nativeElement.querySelector('.screen-loader')).toBeNull();
  });

  it('allows the privacy notice to be dismissed', () => {
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.privacy-dismiss').click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain(
      'This register excludes restricted identity documents',
    );
  });
});
