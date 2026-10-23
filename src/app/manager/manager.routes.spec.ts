import { MANAGER_ROUTES } from './manager.routes';
import { ManagerStudentsPageComponent } from './students/manager-students.page';
import { StudentOperationsStudentsPageComponent } from './student-operations/students/student-operations-students.page';

describe('Business Manager payment and student routes', () => {
  it('keeps the current register under Payments and Control and reserves a separate Students page', () => {
    const children = MANAGER_ROUTES[0].children ?? [];
    expect(children.find((route) => route.path === 'payments-and-control')).toEqual(jasmine.objectContaining({
      component: StudentOperationsStudentsPageComponent,
      data: jasmine.objectContaining({ title: 'Payments and Control' }),
    }));
    expect(children.find((route) => route.path === 'students')).toEqual(jasmine.objectContaining({
      component: ManagerStudentsPageComponent,
      data: jasmine.objectContaining({ title: 'Students' }),
    }));
    expect(children.find((route) => route.path === 'students/cases/:caseId')).toEqual(jasmine.objectContaining({
      loadComponent: jasmine.any(Function),
      data: jasmine.objectContaining({ title: 'Case Details' }),
    }));
    expect(children.find(route=>route.path==='students/new')?.data?.['creation']).toBe('student');
    expect(children.find(route=>route.path==='students/cases/:caseId/new')?.data?.['creation']).toBe('case');
    expect(children.findIndex(route=>route.path==='students/cases/:caseId/new')).toBeLessThan(children.findIndex(route=>route.path==='students/cases/:caseId'));
    expect(children.find((route) => route.path === 'student-operations/students')).toEqual(
      jasmine.objectContaining({ redirectTo: '/manager/payments-and-control', pathMatch: 'full' }),
    );
  });
});
