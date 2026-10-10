import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Actions } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { provideMockStore } from '@ngrx/store/testing';
import { of } from 'rxjs';
import { selectCurrentUser } from '../../../auth/store/reducers';
import { AvatarUploadService } from '../../../settings/components/settings/services/avatar-upload.service';
import { TownPlannerV2Service } from '../../../townplanner/services/townplanner_v2.service';
import { ManagerCompanyService } from '../../services/manager.company.service';
import { ManagerSitesService } from '../../services/manager.sites.service';
import { ManagerService } from '../../services/manager.service';
import { NavigationLinksProjectsService } from '../../services/navigation.links.projects.service';
import { StudentOperationsService } from '../../student-operations/student-operations.service';
import {
  selectManagerEditingUser, selectManagerUsers, selectManagerUsersError,
  selectManagerUsersLoading, selectManagerUsersPage, selectManagerUsersSearchQuery,
  selectManagerUsersTotal, selectManagerUsersViewMode,
} from '../../store/manager.selectors';
import { ManagerUsersPageComponent } from './manager-users.page';

describe('Manager Users Student Operations fields', () => {
  let fixture: ComponentFixture<ManagerUsersPageComponent>;
  let managerApi: jasmine.SpyObj<ManagerService>;
  let store: Store;

  beforeEach(async () => {
    managerApi = jasmine.createSpyObj<ManagerService>('ManagerService', ['setBusinessPackAssignment']);
    managerApi.setBusinessPackAssignment.and.returnValue(of({ assignment: null } as never));
    await TestBed.configureTestingModule({
      imports: [ManagerUsersPageComponent],
      providers: [
        provideRouter([]),
        provideMockStore({ selectors: [
          { selector: selectManagerUsers, value: [] },
          { selector: selectManagerUsersLoading, value: false },
          { selector: selectManagerUsersError, value: null },
          { selector: selectManagerUsersTotal, value: 0 },
          { selector: selectManagerUsersPage, value: 1 },
          { selector: selectManagerUsersViewMode, value: 'form' },
          { selector: selectManagerUsersSearchQuery, value: '' },
          { selector: selectManagerEditingUser, value: null },
          { selector: selectCurrentUser, value: {
            id: 'chief-1', companyId: 'company-1', workspaceProfile: 'student_operations',
          } },
        ] }),
        { provide: Actions, useValue: new Actions(of()) },
        { provide: TownPlannerV2Service, useValue: {
          suggestAddresses: () => of([]), getPlaceDetails: () => of(null),
        } },
        { provide: AvatarUploadService, useValue: {} },
        { provide: ManagerCompanyService, useValue: {} },
        { provide: ManagerSitesService, useValue: {
          listSites: () => of({ items: [] }),
        } },
        { provide: NavigationLinksProjectsService, useValue: {
          listNavigationLinks: () => of({ items: [] }),
        } },
        { provide: StudentOperationsService, useValue: {
          workspace: () => of({ role: 'chief_executive' }),
        } },
        { provide: ManagerService, useValue: managerApi },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ManagerUsersPageComponent);
    store = TestBed.inject(Store);
    fixture.detectChanges();
  });

  it('hides the role and Xero student name for Advisor and saves through the server-owned role path', () => {
    const component = fixture.componentInstance;
    component.userForm.patchValue({
      name: 'New Advisor', email: 'advisor@example.com', username: 'advisor',
      password: 'password123', type: 'advisor', businessPackRole: 'chief_executive',
      studentNameInXero: 'Old student name',
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Student operations role');
    expect(fixture.nativeElement.textContent).not.toContain('Student name in Xero');

    spyOn(store, 'dispatch');
    component.saveUser();
    expect(store.dispatch).toHaveBeenCalledWith(jasmine.objectContaining({
      payload: jasmine.objectContaining({ type: 'advisor' }),
    }));
    const saveAction = (store.dispatch as jasmine.Spy).calls.mostRecent().args[0] as {
      payload: Record<string, unknown>;
    };
    expect(saveAction.payload['studentNameInXero']).toBeUndefined();
    (component as never as { finishRoleAssignment: (user: { id: string }) => void })
      .finishRoleAssignment({ id: 'advisor-1' });
    expect(managerApi.setBusinessPackAssignment).not.toHaveBeenCalled();
  });

  it('shows the Xero student name only for Student type in Student Operations', () => {
    const component = fixture.componentInstance;
    component.userForm.patchValue({
      name: 'Student', email: 'student@example.com', username: 'student',
      password: 'password123', type: 'student', studentNameInXero: 'Student in Xero',
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Student name in Xero');

    spyOn(store, 'dispatch');
    component.saveUser();
    expect(store.dispatch).toHaveBeenCalledWith(jasmine.objectContaining({
      payload: jasmine.objectContaining({ studentNameInXero: 'Student in Xero' }),
    }));

    component.selectedCompanyWorkspaceProfile = 'project_map';
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Student name in Xero');
  });

  it('does not partially save a Chief Executive changing their own type to Advisor', () => {
    const component = fixture.componentInstance;
    (component as never as { editingUserId: string }).editingUserId = 'chief-1';
    component.userForm.controls.type.setValue('advisor');
    spyOn(store, 'dispatch');

    component.saveUser();

    expect(store.dispatch).not.toHaveBeenCalled();
    expect(component.roleAdministrationError).toContain('cannot change your own Chief Executive role');
  });
});
