import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { OpenForAustraliaService } from '../open-for-australia.service';
import { OpenForAustraliaDashboardComponent } from './open-for-australia-dashboard.component';

describe('OpenForAustraliaDashboardComponent', () => {
  let fixture: ComponentFixture<OpenForAustraliaDashboardComponent>;
  const api = {
    dashboard: jasmine.createSpy().and.returnValue(of({
      workspace: {
        packId: 'open-for-australia', version: '0.1.0', tenantId: 'tenant-1',
        role: 'operations', authorizationRevision: 1, workspaceRoutes: ['students'],
      },
      summary: {
        totalStudents: 11,
        activeStudents: 8,
        actionRequired: 2,
        onHold: 1,
      },
    })),
    hasDashboardCache: jasmine.createSpy().and.returnValue(false),
    dashboardCachedAt: jasmine.createSpy().and.returnValue(123456789),
  };

  beforeEach(async () => {
    api.dashboard.calls.reset();
    api.hasDashboardCache.calls.reset();
    api.hasDashboardCache.and.returnValue(false);
    api.dashboardCachedAt.calls.reset();
    api.dashboardCachedAt.and.returnValue(123456789);
    api.dashboard.and.returnValue(of({
      workspace: {
        packId: 'open-for-australia', version: '0.1.0', tenantId: 'tenant-1',
        role: 'operations', authorizationRevision: 1, workspaceRoutes: ['students'],
      },
      summary: { totalStudents: 11, activeStudents: 8, actionRequired: 2, onHold: 1 },
    }));
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
    expect(api.dashboard).toHaveBeenCalledTimes(1);
  });

  it('renders the dashboard heading while loading only the data region', () => {
    api.dashboard.and.returnValue(new Subject());
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Operations Dashboard');
    expect(fixture.nativeElement.querySelector('.dashboard-content-loader .loader-content')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.dashboard-content-loader .loader-card')).toBeNull();
    expect(fixture.nativeElement.querySelector('.screen-loader')).toBeNull();
  });

  it('keeps the current metrics visible while a manual refresh is running', () => {
    fixture.detectChanges();
    api.hasDashboardCache.and.returnValue(true);
    api.dashboard.and.returnValue(new Subject());

    fixture.componentInstance.load(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('11 total student records');
    expect(fixture.nativeElement.textContent).toContain('Refreshing…');
    expect(fixture.nativeElement.querySelector('.dashboard-content-loader')).toBeNull();
    expect(api.dashboard).toHaveBeenCalledWith({ refresh: true });
  });
});
