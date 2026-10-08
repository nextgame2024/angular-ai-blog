import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { StudentOperationsService } from '../student-operations.service';
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
  };

  beforeEach(async () => {
    api.workspace.calls.reset();
    api.students.calls.reset();
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
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(StudentOperationsStudentsPageComponent);
  });

  it('renders the production empty state without a create action', () => {
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('No students found');
    expect(text).toContain('excludes restricted identity documents');
    expect(text).not.toContain('Add student');
    expect(text).not.toContain('synthetic');
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
