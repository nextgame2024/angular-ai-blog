import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { OpenForAustraliaService } from '../open-for-australia.service';
import { OpenForAustraliaStudentsPageComponent } from './open-for-australia-students.page';

describe('OpenForAustraliaStudentsPageComponent', () => {
  let fixture: ComponentFixture<OpenForAustraliaStudentsPageComponent>;
  const api = {
    workspace: jasmine.createSpy().and.returnValue(of({
      packId: 'open-for-australia', version: '0.1.0', tenantId: 'tenant-1',
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
      packId: 'open-for-australia', version: '0.1.0', tenantId: 'tenant-1',
      role: 'operations', authorizationRevision: 1, workspaceRoutes: ['students'],
    }));
    api.students.and.returnValue(of({ students: [], page: 1, limit: 20, total: 0 }));
    await TestBed.configureTestingModule({
      imports: [OpenForAustraliaStudentsPageComponent],
      providers: [
        provideRouter([]),
        { provide: OpenForAustraliaService, useValue: api },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(OpenForAustraliaStudentsPageComponent);
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
      'This account does not have Open For Australia workspace access.',
    );
    expect(fixture.componentInstance.students).toEqual([]);
  });
});
