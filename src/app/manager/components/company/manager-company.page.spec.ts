import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Actions } from '@ngrx/effects';
import { provideMockStore } from '@ngrx/store/testing';
import { of } from 'rxjs';
import { selectCurrentUser } from '../../../auth/store/reducers';
import { CompanyBrandingService } from '../../../shared/services/company-branding.service';
import { AvatarUploadService } from '../../../settings/components/settings/services/avatar-upload.service';
import { TownPlannerV2Service } from '../../../townplanner/services/townplanner_v2.service';
import { StudentOperationsService } from '../../student-operations/student-operations.service';
import {
  selectManagerCompanies,
  selectManagerCompaniesError,
  selectManagerCompaniesLoading,
  selectManagerCompaniesPage,
  selectManagerCompaniesTotal,
  selectManagerCompaniesViewMode,
  selectManagerCompanySearchQuery,
  selectManagerEditingCompany,
} from '../../store/company/manager.selectors';
import { ManagerCompanyPageComponent } from './manager-company.page';

describe('ManagerCompanyPageComponent', () => {
  let fixture: ComponentFixture<ManagerCompanyPageComponent>;

  beforeEach(async () => {
    const company = {
      companyId: 'company-1', companyName: 'Agency Pty Ltd', status: 'active',
      workspaceProfile: 'student_operations',
    };
    await TestBed.configureTestingModule({
      imports: [ManagerCompanyPageComponent],
      providers: [
        provideRouter([]),
        provideMockStore({ selectors: [
          { selector: selectManagerCompanies, value: [company] },
          { selector: selectManagerCompaniesLoading, value: false },
          { selector: selectManagerCompaniesError, value: null },
          { selector: selectManagerCompaniesTotal, value: 1 },
          { selector: selectManagerCompaniesPage, value: 1 },
          { selector: selectManagerCompaniesViewMode, value: 'form' },
          { selector: selectManagerCompanySearchQuery, value: '' },
          { selector: selectManagerEditingCompany, value: company },
          { selector: selectCurrentUser, value: { id: 'chief-1', companyId: 'company-1' } },
        ] }),
        { provide: Actions, useValue: new Actions(of()) },
        { provide: TownPlannerV2Service, useValue: {
          suggestAddresses: () => of([]), getPlaceDetails: () => of(null),
        } },
        { provide: AvatarUploadService, useValue: {} },
        { provide: CompanyBrandingService, useValue: { setCompanyLogo: () => undefined } },
        { provide: StudentOperationsService, useValue: {
          workspace: () => of({ role: 'chief_executive' }),
          xeroStatus: () => of({ configured: false, connections: [] }),
        } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ManagerCompanyPageComponent);
  });

  it('shows Xero management on an existing Student Operations company', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-xero-connections')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Xero connection');
  });

  it('keeps Xero management mounted after a full-page return while company state reloads', () => {
    fixture.componentInstance.companyForm.controls.workspace_profile.setValue('project_map');
    fixture.componentInstance.currentUser = {
      id: 'chief-1', companyId: 'company-1', workspaceProfile: 'student_operations',
    } as never;
    fixture.detectChanges();

    expect(fixture.componentInstance.isStudentOperationsCompany).toBeTrue();
    expect(fixture.nativeElement.querySelector('app-xero-connections')).not.toBeNull();
  });
});
