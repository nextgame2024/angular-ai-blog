import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { OpenForAustraliaService } from '../open-for-australia.service';
import { OpenForAustraliaDashboardComponent } from './open-for-australia-dashboard.component';

describe('OpenForAustraliaDashboardComponent', () => {
  let fixture: ComponentFixture<OpenForAustraliaDashboardComponent>;
  const api = {
    workspace: jasmine.createSpy().and.returnValue(of({
      packId: 'open-for-australia', version: '0.1.0', tenantId: 'tenant-1',
      role: 'operations', authorizationRevision: 1, workspaceRoutes: ['students'],
    })),
    students: jasmine.createSpy().and.callFake((input: { status?: string }) => of({
      students: [], page: 1, limit: 1,
      total: input.status === 'active' ? 8 : input.status === 'action_required' ? 2
        : input.status === 'on_hold' ? 1 : 11,
    })),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OpenForAustraliaDashboardComponent],
      providers: [
        provideRouter([]),
        { provide: OpenForAustraliaService, useValue: api },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(OpenForAustraliaDashboardComponent);
  });

  it('shows only evidence-backed student metrics and labels pending finance data', () => {
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Active students');
    expect(text).toContain('2 students require action');
    expect(text).toContain('Available after Payments & Controls');
    expect(text).not.toContain('$');
  });
});
