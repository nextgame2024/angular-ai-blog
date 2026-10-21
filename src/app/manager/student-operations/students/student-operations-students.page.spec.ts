import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { StudentOperationsService } from '../student-operations.service';
import { ManagerService } from '../../services/manager.service';
import { StudentOperationsStudentsPageComponent } from './student-operations-students.page';
import type { XeroStudentSyncRun, XeroStudentSyncStatus } from '../student-operations.types';

describe('StudentOperationsStudentsPageComponent', () => {
  const nativeIntersectionObserver = globalThis.IntersectionObserver;
  let fixture: ComponentFixture<StudentOperationsStudentsPageComponent>;
  const api = {
    paymentsRegister: jasmine.createSpy().and.returnValue(throwError(() => ({ status: 404 }))),
    workspace: jasmine.createSpy().and.returnValue(of({
      packId: 'student-operations', version: '0.1.0', tenantId: 'tenant-1',
      role: 'operations', authorizationRevision: 1, workspaceRoutes: ['students'],
    })),
    students: jasmine.createSpy().and.returnValue(of({
      students: [], page: 1, limit: 20, total: 0,
    })),
    dashboard: jasmine.createSpy().and.returnValue(of({
      workspace: {},
      summary: { totalStudents: 0, activeStudents: 0, newApplications: 0, actionRequired: 0, onHold: 0 },
    })),
    xeroStatus: jasmine.createSpy().and.returnValue(of({ configured: true, connections: [] })),
    xeroStudentInvoices: jasmine.createSpy().and.returnValue(of({
      invoices: [], page: 1, limit: 25, total: 0, totalPages: 0,
    })),
    xeroStudentInvoicePaymentTracks: jasmine.createSpy().and.returnValue(of({ paymentTracks: ['Pending'] })),
    xeroStudentInvoice: jasmine.createSpy(),
    xeroStudentSyncStatus: jasmine.createSpy().and.returnValue(of({
      configured: false, organisationRole: null, lastSuccessfulSyncAt: null,
      lastErrorCode: null, nextScheduledSyncAt: null, latestRun: null,
    })),
    refreshXeroStudents: jasmine.createSpy(),
    beginXeroAuthorization: jasmine.createSpy().and.returnValue(of({ authorizationUrl: 'https://login.xero.test' })),
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
    api.paymentsRegister.calls.reset();
    api.paymentsRegister.and.returnValue(throwError(() => ({ status: 404 })));
    api.workspace.calls.reset();
    api.students.calls.reset();
    api.advisors.calls.reset();
    api.dashboard.calls.reset();
    api.xeroStatus.calls.reset();
    api.xeroStudentInvoices.calls.reset();
    api.xeroStudentInvoicePaymentTracks.calls.reset();
    api.xeroStudentInvoice.calls.reset();
    api.xeroStudentSyncStatus.calls.reset();
    api.refreshXeroStudents.calls.reset();
    api.createStudent.calls.reset();
    managerApi.listUsers.calls.reset();
    api.workspace.and.returnValue(of({
      packId: 'student-operations', version: '0.1.0', tenantId: 'tenant-1',
      role: 'operations', authorizationRevision: 1, workspaceRoutes: ['students'],
    }));
    api.students.and.returnValue(of({ students: [], page: 1, limit: 20, total: 0 }));
    api.dashboard.and.returnValue(of({
      workspace: {},
      summary: { totalStudents: 0, activeStudents: 0, newApplications: 0, actionRequired: 0, onHold: 0 },
    }));
    api.xeroStatus.and.returnValue(of({ configured: true, connections: [] }));
    api.xeroStudentInvoices.and.returnValue(of({ invoices: [], page: 1, limit: 25, total: 0, totalPages: 0 }));
    api.xeroStudentInvoicePaymentTracks.and.returnValue(of({ paymentTracks: ['Pending'] }));
    api.xeroStudentSyncStatus.and.returnValue(of({
      configured: false, organisationRole: null, lastSuccessfulSyncAt: null,
      lastErrorCode: null, nextScheduledSyncAt: null, latestRun: null,
    }));
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

  afterEach(() => { globalThis.IntersectionObserver = nativeIntersectionObserver; });

  it('renders the production empty state with a create action for operations', () => {
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('No students found');
    expect(text).toContain('excludes restricted identity documents');
    expect(text).toContain('Create');
    expect(text).not.toContain('synthetic');
  });

  it('renders the initial Trust register from one request without waiting for secondary metadata', () => {
    api.paymentsRegister.and.returnValue(of({
      workspace: { role: 'chief_executive' },
      connection: { connectionId: 'connection-1', tenantName: 'Example TRUST', status: 'active', organisationRole: 'trust', missingStudentDiscoveryScopes: [] },
      invoices: { invoices: [{ xeroInvoiceId: 'invoice-1', invoiceNumber: 'INV-1', studentName: 'Student', status: 'draft', amountDue: 100, amountPaid: 0, currencyCode: 'AUD' }], page: 1, limit: 25, total: 1, totalPages: 1 },
      connectionIssue: null,
    }));
    api.xeroStudentSyncStatus.and.returnValue(new Subject());
    api.xeroStudentInvoicePaymentTracks.and.returnValue(new Subject());
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('INV-1');
    expect(api.paymentsRegister).toHaveBeenCalledWith(jasmine.objectContaining({ page: 1, limit: 25 }));
    expect(api.workspace).not.toHaveBeenCalled();
    expect(api.xeroStatus).not.toHaveBeenCalled();
    expect(api.xeroStudentInvoices).not.toHaveBeenCalled();
    expect(api.students).not.toHaveBeenCalled();
    expect(fixture.componentInstance.loadingInvoices).toBeFalse();
  });

  it('does not fall back to older routes after an access failure', () => {
    api.paymentsRegister.and.returnValue(throwError(() => ({ status: 403 })));
    fixture.detectChanges();
    expect(api.workspace).not.toHaveBeenCalled();
    expect(api.xeroStatus).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('does not have Student Operations workspace access');
  });

  it('uses current filters when they change before the initial register arrives', fakeAsync(() => {
    const initial = new Subject<any>();
    api.paymentsRegister.and.returnValue(initial);
    fixture.detectChanges();
    fixture.componentInstance.search.setValue('Updated search'); tick(300);
    expect(api.students).not.toHaveBeenCalled();
    initial.next({ workspace: { role: 'chief_executive' },
      connection: { connectionId: 'connection-1', status: 'active', missingStudentDiscoveryScopes: [] },
      invoices: { invoices: [], page: 1, limit: 25, total: 0, totalPages: 0 }, connectionIssue: null });
    expect(api.xeroStudentInvoices).toHaveBeenCalledWith('connection-1', jasmine.objectContaining({ page: 1, q: 'Updated search' }));
    expect(api.paymentsRegister).toHaveBeenCalledTimes(1);
    initial.complete(); fixture.destroy();
  }));

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

  it('links an accepted Xero candidate after the student is created', () => {
    const connectionId = '44444444-4444-4444-8444-444444444444';
    const contactId = '55555555-5555-4555-8555-555555555555';
    api.xeroStatus.and.returnValue(of({
      configured: true,
      connections: [{
        connectionId, tenantId: 'xero-tenant', tenantName: 'Agency Trust',
        tenantType: 'ORGANISATION', tenantShortCode: null, status: 'active',
        healthStatus: 'healthy', lastTestedAt: null, lastErrorCode: null,
        organisationRole: 'trust', missingStudentDiscoveryScopes: [],
      }],
    }));
    api.workspace.and.returnValue(of({
      packId: 'student-operations', version: '0.1.0', tenantId: 'tenant-1',
      role: 'chief_executive', authorizationRevision: 1, workspaceRoutes: ['students'],
    }));
    api.createStudent.and.returnValue(of({ studentId: 'student-1' }));
    fixture.detectChanges();
    fixture.componentInstance.reviewXeroInvoice({
      xeroInvoiceId: '77777777-7777-4777-8777-777777777777', xeroContactId: contactId,
      invoiceNumber: 'INV-1', reference: 'College One', studentName: 'Candidate Student',
      studentEmail: 'candidate@example.invalid', suggestedStudentReference: 'STU-XERO',
      invoiceDate: '2026-10-01', dueDate: '2026-10-10', status: 'paid', currencyCode: 'AUD',
      total: 100, amountPaid: 100, amountDue: 0, sentToContact: true, concept: 'Tuition',
      advisorName: 'Advisor One', collegeName: 'College One', paymentTrack: 'Paid',
      reviewStatus: 'pending', studentId: null,
    });
    fixture.componentInstance.saveStudent();

    expect(api.createStudent).toHaveBeenCalledWith(
      jasmine.objectContaining({
        xeroCandidateSource: { connectionId, contactId },
      }),
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

    expect(fixture.nativeElement.textContent).toContain('Payments and Control');
    expect(fixture.nativeElement.textContent).toContain('Review TRUST transactions and associated student records.');
    expect(fixture.nativeElement.querySelector('app-manager-list-loader .loader-ring')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-manager-list-loader .loader-bar')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.screen-loader')).toBeNull();
  });

  it('collapses only the transaction summary while keeping filters usable without fetching again', () => {
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('.section-toggle') as HTMLButtonElement;
    const sections = fixture.nativeElement.querySelector('#payment-summary-filters') as HTMLElement;
    const search = sections.querySelector('.search-field input') as HTMLInputElement;
    const invoiceRequests = api.xeroStudentInvoices.calls.count();
    expect(button.parentElement?.classList.contains('filters')).toBeTrue();
    expect(button.previousElementSibling?.tagName.toLowerCase()).toBe('app-manager-select');
    button.click();
    fixture.detectChanges();
    expect((sections.querySelector('.overview') as HTMLElement).hidden).toBeTrue();
    expect(sections.querySelector('.search-field input')).toBe(search);
    expect(sections.querySelectorAll('app-manager-select').length).toBe(2);
    expect(sections.querySelector('p-datepicker')).not.toBeNull();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(api.xeroStudentInvoices.calls.count()).toBe(invoiceRequests);
    button.click();
    fixture.detectChanges();
    expect((sections.querySelector('.overview') as HTMLElement).hidden).toBeFalse();
    expect(sections.querySelector('.search-field input')).toBe(search);
    expect(button.getAttribute('aria-expanded')).toBe('true');
  });

  it('pins the list header and table headings above the scrolling register', () => {
    fixture.nativeElement.style.height = '760px';
    fixture.detectChanges();
    fixture.componentInstance.xeroInvoices = {
      page: 1, limit: 25, total: 1, totalPages: 1,
      invoices: [{
        xeroInvoiceId: 'invoice-1', invoiceNumber: 'INV-1', reference: 'ATI',
        studentName: 'Student One', studentEmail: null, invoiceDate: '2026-10-01',
        dueDate: '2026-10-10', status: 'draft', currencyCode: 'AUD',
        amountPaid: 0, amountDue: 100, sentToContact: false,
        advisorName: null, paymentTrack: null, reviewStatus: 'pending',
      }],
    } as any;
    fixture.detectChanges();

    const header = fixture.nativeElement.querySelector('.list-header') as HTMLElement;
    const register = fixture.nativeElement.querySelector('.invoice-table-scroll') as HTMLElement;
    const tableHeading = fixture.nativeElement.querySelector('.invoice-table th') as HTMLElement;
    expect(getComputedStyle(header).position).toBe('sticky');
    expect(getComputedStyle(register).overflowY).toBe('auto');
    expect(getComputedStyle(tableHeading).position).toBe('sticky');
    expect(header.querySelector('.filters')).not.toBeNull();
    expect(register.getBoundingClientRect().height).toBeGreaterThan(100);
    const shell = fixture.nativeElement.querySelector('.students-shell') as HTMLElement;
    const card = fixture.nativeElement.querySelector('.xero-candidates') as HTMLElement;
    expect(shell.getBoundingClientRect().bottom - card.getBoundingClientRect().bottom).toBeLessThan(30);
    expect(register.querySelector('tbody tr')).not.toBeNull();
    fixture.componentInstance.loadingInvoices = true;
    fixture.detectChanges();
    expect(register.querySelector('app-manager-list-loader.overlay-host .loader-ring')).not.toBeNull();
    expect(register.querySelector('tbody tr')).not.toBeNull();
  });

  it('does not flash the empty state while the Xero register is still loading', () => {
    const xeroStatus$ = new Subject<any>();
    const xeroInvoices$ = new Subject<any>();
    api.workspace.and.returnValue(of({
      packId: 'student-operations', version: '0.1.0', tenantId: 'tenant-1',
      role: 'chief_executive', authorizationRevision: 1, workspaceRoutes: ['students'],
    }));
    api.xeroStatus.and.returnValue(xeroStatus$);
    api.xeroStudentInvoices.and.returnValue(xeroInvoices$);

    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-manager-list-loader')).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('No students found');

    xeroStatus$.next({
      configured: true,
      connections: [{
        connectionId: 'connection-1', tenantName: 'Example TRUST', status: 'active',
        organisationRole: 'trust', missingStudentDiscoveryScopes: [],
      }],
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-manager-list-loader')).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('No students found');

    xeroInvoices$.next({
      page: 1, limit: 25, total: 1, totalPages: 1,
      invoices: [{
        xeroInvoiceId: '77777777-7777-4777-8777-777777777777',
        xeroContactId: '44444444-4444-4444-8444-444444444444',
        invoiceNumber: 'INV-1', reference: 'ATI', studentName: 'Student One',
        studentEmail: null, suggestedStudentReference: null, invoiceDate: '2026-10-01',
        dueDate: '2026-10-10', status: 'draft', currencyCode: 'AUD', total: 100,
        amountPaid: 0, amountDue: 100, sentToContact: false, concept: 'Tuition',
        advisorName: null, collegeName: 'ATI', paymentTrack: null,
        reviewStatus: 'pending', studentId: null,
      }],
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-manager-list-loader')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('INV-1');
    expect(fixture.nativeElement.textContent).not.toContain('No students found');
  });

  it('allows the privacy notice to be dismissed', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.privacy-toast-wrap')).not.toBeNull();
    fixture.nativeElement.querySelector('.privacy-dismiss').click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain(
      'This register excludes restricted identity documents',
    );
  });

  it('automatically removes the privacy toast after a few seconds', fakeAsync(() => {
    fixture.detectChanges();
    tick(4220);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.privacy-toast-wrap')).toBeNull();
  }));

  it('starts the TRUST invoice register without waiting for unrelated student or dashboard reads', () => {
    api.workspace.and.returnValue(of({
      packId: 'student-operations', version: '0.1.0', tenantId: 'tenant-1',
      role: 'chief_executive', authorizationRevision: 1, workspaceRoutes: ['students'],
    }));
    api.xeroStatus.and.returnValue(of({ configured: true, connections: [{
      connectionId: 'connection-1', tenantName: 'Example TRUST', status: 'active',
      organisationRole: 'trust', missingStudentDiscoveryScopes: [],
    }] }));
    fixture.detectChanges();
    expect(api.xeroStudentInvoices).toHaveBeenCalled();
    expect(api.students).not.toHaveBeenCalled();
    expect(api.dashboard).not.toHaveBeenCalled();
  });

  it('shows compact Xero totals once, without the unrelated student dashboard cards', () => {
    fixture.detectChanges();
    fixture.componentInstance.xeroInvoices = {
      invoices: [], page: 1, limit: 25, total: 7784, totalPages: 312,
      invoiceTotal: 7536, creditNoteTotal: 31, prepaymentTotal: 0, overpaymentTotal: 217,
      statusTotals: { draft: 1262, awaitingApproval: 14, awaitingPayment: 653, paid: 5855 },
    };
    fixture.detectChanges();

    const cards = Array.from(fixture.nativeElement.querySelectorAll('.metric')) as HTMLElement[];
    expect(cards.length).toBe(8);
    expect(cards.map((card) => card.textContent?.trim())).toEqual([
      'Invoices7536', 'Credit notes31', 'Prepayments0', 'Overpayments217',
      'Draft1262', 'Awaiting approval14', 'Awaiting payment653', 'Paid5855',
    ]);
    expect(fixture.nativeElement.querySelector('.candidate-header')?.textContent).not.toContain('7536 invoices');
    expect(fixture.nativeElement.textContent).not.toContain('Active students');
  });

  it('shows one paged row per Xero invoice and preserves server sorting', () => {
    api.xeroStudentSyncStatus.and.returnValue(of({
      configured: true, organisationRole: 'trust',
      lastSuccessfulSyncAt: '2026-10-10T10:23:00Z',
      lastFullSyncAt: '2026-10-10T08:22:00Z',
      lastErrorCode: null, nextScheduledSyncAt: null, latestRun: null,
    }));
    api.workspace.and.returnValue(of({
      packId: 'student-operations', version: '0.1.0', tenantId: 'tenant-1',
      role: 'chief_executive', authorizationRevision: 1, workspaceRoutes: ['students'],
    }));
    api.xeroStatus.and.returnValue(of({
      configured: true,
      connections: [{
        connectionId: 'connection-1', tenantName: 'Example TRUST', status: 'active',
        missingStudentDiscoveryScopes: [],
      }],
    }));
    api.xeroStudentInvoices.and.returnValue(of({
      page: 1, limit: 25, total: 7793, totalPages: 312,
      invoiceTotal: 7545, creditNoteTotal: 200,
      prepaymentTotal: 30, overpaymentTotal: 18,
      statusTotals: { draft: 1277, awaitingApproval: 14, awaitingPayment: 652, paid: 5850 },
      invoices: [{
        xeroInvoiceId: '77777777-7777-4777-8777-777777777777',
        xeroContactId: '44444444-4444-4444-8444-444444444444',
        invoiceNumber: 'INV-10035', reference: 'ATI', studentName: 'Student One',
        studentEmail: 'student.one@example.invalid', suggestedStudentReference: 'STU-100',
        invoiceDate: '2029-10-01', dueDate: '2029-10-01', status: 'draft', currencyCode: 'AUD',
        total: 2200, amountPaid: 0, amountDue: 2200, sentToContact: false,
        concept: 'Diploma tuition', advisorName: 'S15 Paulina', collegeName: 'ATI',
        paymentTrack: 'Pending', reviewStatus: 'pending', studentId: null,
      }],
    }));
    fixture.detectChanges();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('TRUST sales transactions (7793)');
    expect(fixture.nativeElement.textContent).toContain('Last checked:');
    expect(fixture.nativeElement.textContent).toContain('Last full refresh:');
    expect(fixture.nativeElement.querySelector('.metric')?.textContent).toContain('7545');
    expect(fixture.nativeElement.querySelectorAll('.metric')[5]?.textContent).toContain('14');
    expect(fixture.nativeElement.textContent).toContain('INV-10035');
    expect(fixture.nativeElement.textContent).toContain('Student One');
    expect(fixture.nativeElement.textContent).toContain('S15 Paulina');
    expect(fixture.nativeElement.textContent).toContain('Pending');
    expect(fixture.nativeElement.textContent).not.toContain('No students found');
    expect(fixture.nativeElement.querySelectorAll('.sort-indicator').length).toBe(11);
    expect(fixture.nativeElement.textContent).not.toContain('↕');

    fixture.componentInstance.sortXeroInvoices('dueDate');
    fixture.detectChanges();
    expect(api.xeroStudentInvoices).toHaveBeenCalledWith('connection-1', jasmine.objectContaining({
      page: 1, limit: 25, sort: 'dueDate', direction: 'desc',
    }));

    fixture.nativeElement.querySelector('.invoice-actions .btn.secondary').click();
    fixture.detectChanges();
    expect(fixture.componentInstance.studentForm.value).toEqual(jasmine.objectContaining({
      studentReference: 'STU-100', legalName: 'Student One', email: 'student.one@example.invalid', collegeName: 'ATI',
    }));
  });

  it('filters the invoice register on the server and debounces search without reloading students', fakeAsync(() => {
    api.workspace.and.returnValue(of({
      packId: 'student-operations', version: '0.1.0', tenantId: 'tenant-1',
      role: 'chief_executive', authorizationRevision: 1, workspaceRoutes: ['students'],
    }));
    api.xeroStatus.and.returnValue(of({
      configured: true,
      connections: [{ connectionId: 'connection-1', tenantName: 'Example TRUST', status: 'active',
        missingStudentDiscoveryScopes: [] }],
    }));
    fixture.detectChanges();
    const dateInput = fixture.nativeElement.querySelector('.invoice-date-range input') as HTMLInputElement;
    expect(dateInput).not.toBeNull();
    expect(dateInput.readOnly).toBeTrue();
    const datePicker = fixture.nativeElement.querySelector('.invoice-date-range') as HTMLElement;
    const calendarButton = datePicker.querySelector('.p-datepicker-dropdown') as HTMLElement;
    expect(getComputedStyle(datePicker).display).toBe('flex');
    expect(calendarButton).not.toBeNull();
    expect(calendarButton.getBoundingClientRect().top).toBeCloseTo(dateInput.getBoundingClientRect().top, 0);
    expect(fixture.nativeElement.querySelectorAll('.filters input[type="date"]').length).toBe(0);
    expect(fixture.componentInstance.paymentTrackOptions.map((option) => option.label))
      .toEqual(['All payment tracks', 'Pending']);
    expect(fixture.componentInstance.invoiceStatusLabel('submitted')).toBe('Awaiting approval');
    expect(fixture.componentInstance.invoiceStatusLabel('authorised')).toBe('Awaiting payment');
    api.xeroStudentInvoices.calls.reset();
    const studentRequests = api.students.calls.count();

    fixture.componentInstance.invoiceStatus.setValue('DRAFT');
    fixture.componentInstance.paymentTrack.setValue('Pending');
    tick(150);
    api.xeroStudentInvoices.calls.reset();
    fixture.componentInstance.invoiceDateRange.setValue([new Date(2026, 0, 1)]);
    tick(150);
    expect(api.xeroStudentInvoices).not.toHaveBeenCalled();
    fixture.componentInstance.invoiceDateRange.setValue([new Date(2026, 11, 31), new Date(2026, 0, 1)]);
    expect(api.xeroStudentInvoices).not.toHaveBeenCalled();
    fixture.componentInstance.invoiceDateRange.setValue([new Date(2026, 0, 1), new Date(2026, 11, 31)]);
    expect(api.xeroStudentInvoices).toHaveBeenCalledTimes(1);
    expect(api.xeroStudentInvoices).toHaveBeenCalledWith('connection-1', jasmine.objectContaining({
      page: 1, status: 'DRAFT', dateFrom: '2026-01-01', dateTo: '2026-12-31', paymentTrack: 'Pending',
    }));

    api.xeroStudentInvoices.calls.reset();
    fixture.componentInstance.invoiceDateRange.setValue(null);
    expect(api.xeroStudentInvoices).toHaveBeenCalledTimes(1);
    const clearedQuery = api.xeroStudentInvoices.calls.mostRecent().args[1];
    expect(clearedQuery.dateFrom).toBeUndefined();
    expect(clearedQuery.dateTo).toBeUndefined();

    api.xeroStudentInvoices.calls.reset();
    fixture.componentInstance.search.setValue('Fab');
    tick(100);
    fixture.componentInstance.search.setValue('Fabian');
    tick(299);
    expect(api.xeroStudentInvoices).not.toHaveBeenCalled();
    tick(1);
    expect(api.xeroStudentInvoices).toHaveBeenCalledOnceWith('connection-1', jasmine.objectContaining({
      q: 'Fabian', page: 1,
    }));
    expect(api.students.calls.count()).toBe(studentRequests);
  }));

  it('uses explicit pagination and keeps the selected server sort on the next page', () => {
    api.workspace.and.returnValue(of({
      packId: 'student-operations', version: '0.1.0', tenantId: 'tenant-1',
      role: 'chief_executive', authorizationRevision: 1, workspaceRoutes: ['students'],
    }));
    api.xeroStatus.and.returnValue(of({
      configured: true,
      connections: [{
        connectionId: 'connection-1', tenantName: 'Example TRUST', status: 'active',
        organisationRole: 'trust', missingStudentDiscoveryScopes: [],
      }],
    }));
    api.xeroStudentInvoices.and.callFake((_connectionId: string, input: { page: number }) => of({
      page: input.page,
      limit: 25, total: 50, totalPages: 2,
      invoices: [],
    }));

    fixture.detectChanges();
    fixture.componentInstance.sortXeroInvoices('invoiceNumber');
    fixture.componentInstance.goToInvoicePage(2);

    expect(api.xeroStudentInvoices).toHaveBeenCalledWith('connection-1', jasmine.objectContaining({
      page: 2,
      sort: 'invoiceNumber',
      direction: 'asc',
    }));
    fixture.destroy();
    api.xeroStudentInvoices.calls.reset();
    fixture = TestBed.createComponent(StudentOperationsStudentsPageComponent);
    fixture.detectChanges();
    expect(api.xeroStudentInvoices).toHaveBeenCalledOnceWith('connection-1', jasmine.objectContaining({
      page: 2, sort: 'invoiceNumber', direction: 'asc',
    }));
  });

  it('queues a background Xero refresh and keeps cached records visible', () => {
    api.workspace.and.returnValue(of({
      packId: 'student-operations', version: '0.1.0', tenantId: 'tenant-1',
      role: 'chief_executive', authorizationRevision: 1, workspaceRoutes: ['students'],
    }));
    api.xeroStatus.and.returnValue(of({
      configured: true,
      connections: [{
        connectionId: 'connection-1', tenantName: 'Example TRUST', status: 'active',
        missingStudentDiscoveryScopes: [],
      }],
    }));
    api.refreshXeroStudents.and.returnValue(of({
      syncRunId: 'run-1', connectionId: 'connection-1', mode: 'initial', triggerType: 'manual',
      status: 'queued', contactCount: 0, invoiceCount: 0, candidateCount: 0,
      errorCode: null, createdAt: '2026-10-10T00:00:00Z', startedAt: null, completedAt: null,
    }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.list-header .xero-sync')).toBeNull();
    expect(fixture.nativeElement.querySelector('.candidate-title-row .source-badge')?.textContent)
      .toContain('Example TRUST');
    expect(fixture.nativeElement.querySelector('.candidate-header .xero-sync-details')?.textContent)
      .toContain('Last checked:');
    fixture.nativeElement.querySelector('.xero-sync .btn').click();
    fixture.detectChanges();

    expect(api.refreshXeroStudents).toHaveBeenCalledWith('connection-1');
    expect(fixture.nativeElement.textContent).toContain('Waiting for the background worker');
    expect(fixture.nativeElement.textContent).toContain('No invoices match the current search');
    expect(fixture.nativeElement.textContent).not.toContain('No students found');
  });

  function configureSync(run: XeroStudentSyncRun): XeroStudentSyncStatus {
    api.paymentsRegister.and.returnValue(of({workspace:{role:'chief_executive'},
      connection:{connectionId:'connection-1',tenantName:'Example TRUST',status:'active',organisationRole:'trust',missingStudentDiscoveryScopes:[]},
      invoices:{invoices:[{xeroInvoiceId:'invoice-1',invoiceNumber:'INV-1',studentName:'Student',status:'draft',amountDue:100,amountPaid:0,currencyCode:'AUD'}],
        page:1,limit:25,total:1,totalPages:1},connectionIssue:null}));
    const status: XeroStudentSyncStatus = {configured:true,organisationRole:'trust',lastSuccessfulSyncAt:'2026-10-20T00:00:00Z',
      lastErrorCode:null,nextScheduledSyncAt:null,latestRun:run};
    api.xeroStudentSyncStatus.and.returnValue(of(status));
    return status;
  }

  function queuedRun(triggerType: XeroStudentSyncRun['triggerType'] = 'webhook'): XeroStudentSyncRun {
    return {syncRunId:'parked-run',connectionId:'connection-1',mode:'incremental',triggerType,status:'queued',
      contactCount:0,invoiceCount:0,candidateCount:0,errorCode:null,createdAt:'2026-10-20T19:23:47Z',startedAt:null,completedAt:null};
  }

  for (const [code, message] of [
    ['xero_rate_limited', 'an API limit was reached'],
    ['xero_quota_exhausted', 'daily API allowance is unavailable'],
    ['xero_quota_reserved', 'preserve API allowance for updates and downloads'],
    ['xero_quota_unknown', 'allowance to be confirmed'],
  ]) {
    it(`shows ${code} as a pause, preserving records without extra polling or provider commands`, fakeAsync(() => {
      const status=configureSync({...queuedRun('manual'),status:'failed',errorCode:code});
      status.lastErrorCode='xero_unavailable';fixture.detectChanges();
      const panel:HTMLElement=fixture.nativeElement.querySelector('.xero-sync');
      expect(panel.querySelector('.xero-pause')?.textContent).toContain(message);
      expect(panel.querySelector('[role="alert"]')).toBeNull();
      expect(panel.classList.contains('xero-sync-error')).toBeFalse();
      expect(panel.textContent).toContain('Existing student information remains available');
      expect(panel.textContent).not.toContain('temporarily unavailable');
      expect(fixture.nativeElement.textContent).toContain('INV-1');
      tick(60000);expect(api.xeroStudentSyncStatus).toHaveBeenCalledTimes(1);
      expect(api.refreshXeroStudents).not.toHaveBeenCalled();expect(api.beginXeroAuthorization).not.toHaveBeenCalled();
      fixture.destroy();
    }));
  }

  it('shows retry eligibility in Brisbane time without promising an automatic start or a midnight reset',()=>{
    spyOn(Date,'now').and.returnValue(new Date('2026-10-21T01:00:00Z').getTime());
    const status=configureSync({...queuedRun('manual'),status:'failed',errorCode:'xero_quota_exhausted'});
    status.nextScheduledSyncAt='2026-10-21T08:44:00Z';fixture.detectChanges();
    const text=fixture.nativeElement.querySelector('.xero-pause').textContent;
    expect(text).toContain('eligible no earlier than');expect(text).toMatch(/6:44\s*pm/);
    expect(text).toContain('Brisbane time');expect(text).toContain('01:00–06:00 Brisbane');
    expect(text).not.toContain('scheduled for');expect(text).not.toContain('midnight');
  });

  for (const retry of [null,'invalid-date','2020-01-01T00:00:00Z']) {
    it(`does not invent a retry deadline from ${retry}`,()=>{
      const status=configureSync({...queuedRun('manual'),status:'failed',errorCode:'xero_quota_unknown'});
      status.nextScheduledSyncAt=retry;fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.xero-pause').textContent).toContain('worker will recheck retry eligibility');
      expect(fixture.nativeElement.textContent).not.toContain('Invalid Date');
    });
  }

  it('recognizes a sanitized provider 429 even without a known error code',()=>{
    configureSync({...queuedRun('manual'),status:'failed',errorCode:null,providerStatus:429});fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.xero-pause')?.textContent).toContain('API limit was reached');
    expect(fixture.nativeElement.textContent).not.toContain('daily API allowance');
  });

  it('keeps unknown failures actionable without exposing internal codes or inventing quota state',()=>{
    configureSync({...queuedRun('manual'),status:'failed',errorCode:'private-database-secret'});fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.xero-error')?.textContent).toContain('refresh failed');
    expect(fixture.nativeElement.querySelector('.xero-pause')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('private-database-secret');
  });

  it('clears an old pause only on an explicit enqueue and keeps the new processing status separate',fakeAsync(()=>{
    configureSync({...queuedRun('manual'),status:'failed',errorCode:'xero_quota_unknown'});fixture.detectChanges();
    api.refreshXeroStudents.and.returnValue(of(queuedRun('manual')));
    fixture.nativeElement.querySelector('.xero-sync .btn').click();fixture.detectChanges();
    expect(api.refreshXeroStudents).toHaveBeenCalledOnceWith('connection-1');
    expect(fixture.nativeElement.querySelector('.xero-pause')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Waiting for the background worker');fixture.destroy();
  }));

  it('clears stale quota configuration errors after a successful run',()=>{
    const status=configureSync({...queuedRun('manual'),status:'succeeded'});status.lastErrorCode='xero_quota_exhausted';
    fixture.detectChanges();expect(fixture.nativeElement.querySelector('.xero-pause')).toBeNull();
    expect(fixture.nativeElement.querySelector('.xero-error')).toBeNull();
  });

  it('handles a quota pause returned by bounded progress polling without re-enqueueing',fakeAsync(()=>{
    const status=configureSync({...queuedRun('manual'),status:'processing'});fixture.detectChanges();
    api.xeroStudentSyncStatus.and.returnValue(of({...status,latestRun:{...status.latestRun!,status:'failed',errorCode:'xero_quota_exhausted'}}));
    tick(2000);fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.xero-pause')?.textContent).toContain('daily API allowance');
    tick(60000);expect(api.xeroStudentSyncStatus).toHaveBeenCalledTimes(2);
    expect(api.refreshXeroStudents).not.toHaveBeenCalled();expect(fixture.nativeElement.textContent).toContain('INV-1');fixture.destroy();
  }));

  for (const trigger of ['webhook','schedule','connection'] as const) {
    it(`shows ${trigger} queued for overnight sync without disabling Refresh or continuously polling`, fakeAsync(() => {
      configureSync(queuedRun(trigger)); fixture.detectChanges();
      const button:HTMLButtonElement=fixture.nativeElement.querySelector('.xero-sync .btn');
      expect(fixture.nativeElement.textContent).toContain('Queued for overnight sync (01:00–06:00 Brisbane)');
      expect(fixture.nativeElement.textContent).not.toContain('Waiting for the background worker');
      expect(button.disabled).toBeFalse();expect(button.textContent?.trim()).toBe('Refresh');
      expect(fixture.componentInstance.loadingXero).toBeFalse();
      tick(16*60*1000);
      expect(api.xeroStudentSyncStatus).toHaveBeenCalledTimes(1);
      expect(api.refreshXeroStudents).not.toHaveBeenCalled();
      expect(fixture.nativeElement.textContent).toContain('INV-1');
      fixture.destroy();
    }));
  }

  it('promotes an automatic queue only on explicit Refresh and guards double clicks', fakeAsync(() => {
    const status=configureSync(queuedRun());fixture.detectChanges();
    const pending=new Subject<XeroStudentSyncRun>();api.refreshXeroStudents.and.returnValue(pending);
    fixture.nativeElement.querySelector('.xero-sync .btn').click();fixture.detectChanges();
    fixture.componentInstance.refreshStudentsFromXero();
    expect(api.refreshXeroStudents).toHaveBeenCalledOnceWith('connection-1');
    expect(fixture.nativeElement.querySelector('.xero-sync .btn').disabled).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('Queueing…');
    pending.next({...status.latestRun!,triggerType:'manual'});pending.complete();fixture.detectChanges();
    expect(fixture.componentInstance.xeroSync?.latestRun?.syncRunId).toBe('parked-run');
    expect(fixture.nativeElement.textContent).toContain('Waiting for the background worker');
    expect(fixture.nativeElement.querySelector('.xero-sync .btn').textContent.trim()).toBe('Check progress');
    api.xeroStudentSyncStatus.and.returnValue(of({...status,latestRun:{...status.latestRun!,triggerType:'manual',status:'processing',contactCount:10}}));
    tick(2000);fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('10 contacts processed');
    expect(fixture.nativeElement.textContent).toContain('INV-1');
    expect(api.refreshXeroStudents).toHaveBeenCalledTimes(1);
    fixture.destroy();
  }));

  it('Check progress reads status without submitting another manual refresh', fakeAsync(() => {
    configureSync({...queuedRun('manual'),status:'processing'});fixture.detectChanges();
    const pending=new Subject<XeroStudentSyncStatus>();api.xeroStudentSyncStatus.and.returnValue(pending);
    fixture.nativeElement.querySelector('.xero-sync .btn').click();fixture.detectChanges();
    expect(api.xeroStudentSyncStatus).toHaveBeenCalledTimes(2);
    expect(api.refreshXeroStudents).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.xero-sync .btn').textContent.trim()).toBe('Checking…');
    fixture.componentInstance.refreshStudentsFromXero();
    expect(api.xeroStudentSyncStatus).toHaveBeenCalledTimes(2);
    fixture.destroy();
  }));

  it('releases the manual action and preserves overnight queue/rows after enqueue failure', fakeAsync(() => {
    configureSync(queuedRun());fixture.detectChanges();
    api.refreshXeroStudents.and.returnValue(throwError(()=>({status:503})));
    fixture.nativeElement.querySelector('.xero-sync .btn').click();fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.xero-sync .btn').disabled).toBeFalse();
    expect(fixture.nativeElement.textContent).toContain('could not be queued');
    expect(fixture.nativeElement.textContent).toContain('Queued for overnight sync');
    expect(fixture.nativeElement.textContent).toContain('INV-1');
    tick(60000);expect(api.xeroStudentSyncStatus).toHaveBeenCalledTimes(1);
    fixture.destroy();
  }));

  it('keeps status checking retryable after a read error without creating a refresh', fakeAsync(() => {
    configureSync(queuedRun('manual'));fixture.detectChanges();
    api.xeroStudentSyncStatus.and.returnValue(throwError(()=>({status:503})));
    fixture.nativeElement.querySelector('.xero-sync .btn').click();fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.xero-sync .btn').disabled).toBeFalse();
    expect(fixture.nativeElement.textContent).toContain('status could not be loaded');
    expect(fixture.nativeElement.textContent).toContain('INV-1');
    tick(60000);expect(api.xeroStudentSyncStatus).toHaveBeenCalledTimes(2);
    expect(api.refreshXeroStudents).not.toHaveBeenCalled();fixture.destroy();
  }));

  it('refreshes local records when Check progress observes completion', fakeAsync(() => {
    const status=configureSync(queuedRun('manual'));fixture.detectChanges();
    api.xeroStudentSyncStatus.and.returnValue(of({...status,latestRun:{...status.latestRun!,status:'succeeded'}}));
    fixture.nativeElement.querySelector('.xero-sync .btn').click();fixture.detectChanges();
    expect(api.xeroStudentInvoices).toHaveBeenCalledOnceWith('connection-1',jasmine.objectContaining({page:1,limit:25}));
    expect(fixture.nativeElement.textContent).toContain('Last checked:');
    expect(fixture.nativeElement.querySelector('.xero-sync .btn').textContent.trim()).toBe('Refresh');
    tick(60000);expect(api.xeroStudentSyncStatus).toHaveBeenCalledTimes(2);
    expect(api.refreshXeroStudents).not.toHaveBeenCalled();fixture.destroy();
  }));

  it('does not allow non-Chief Executives to promote an automatic queue', fakeAsync(() => {
    configureSync(queuedRun());fixture.detectChanges();
    fixture.componentInstance.workspace!.role='operations';
    fixture.componentInstance.refreshStudentsFromXero();
    expect(api.refreshXeroStudents).not.toHaveBeenCalled();fixture.destroy();
  }));

  it('stops polling if the returned job becomes automatic queued work', fakeAsync(() => {
    const status=configureSync({...queuedRun('manual'),status:'processing'});fixture.detectChanges();
    api.xeroStudentSyncStatus.and.returnValue(of({...status,latestRun:queuedRun()}));
    tick(2000);fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Queued for overnight sync');
    expect(fixture.nativeElement.querySelector('.xero-sync .btn').disabled).toBeFalse();
    tick(60000);expect(api.xeroStudentSyncStatus).toHaveBeenCalledTimes(2);
    fixture.destroy();
  }));

  it('bounds manual progress polling and cancels it on navigation', fakeAsync(() => {
    configureSync(queuedRun('manual'));fixture.detectChanges();
    tick(16*60*1000);fixture.detectChanges();
    const count=api.xeroStudentSyncStatus.calls.count();
    expect(fixture.nativeElement.textContent).toContain('Automatic progress checks paused');
    expect(fixture.nativeElement.querySelector('.xero-sync .btn').disabled).toBeFalse();
    tick(60000);expect(api.xeroStudentSyncStatus.calls.count()).toBe(count);
    fixture.nativeElement.querySelector('.xero-sync .btn').click();
    expect(api.xeroStudentSyncStatus.calls.count()).toBe(count+1);
    fixture.destroy();tick(60000);
    expect(api.xeroStudentSyncStatus.calls.count()).toBe(count+1);
    expect(api.refreshXeroStudents).not.toHaveBeenCalled();
  }));

  it('skips active-job status requests while the tab is hidden', fakeAsync(() => {
    configureSync(queuedRun('manual'));fixture.detectChanges();
    const hidden=spyOnProperty(document,'hidden','get').and.returnValue(true);
    tick(60000);expect(api.xeroStudentSyncStatus).toHaveBeenCalledTimes(1);
    hidden.and.returnValue(false);tick(16000);
    expect(api.xeroStudentSyncStatus.calls.count()).toBeGreaterThan(1);
    fixture.destroy();
  }));

  for (const width of [390,1280]) for (const dark of [false,true]) {
    it(`keeps long quota pause feedback readable at ${width}px in ${dark?'dark':'light'} mode`,()=>{
      const status=configureSync({...queuedRun('manual'),status:'failed',errorCode:'xero_quota_unknown'});
      status.nextScheduledSyncAt='2099-10-21T08:44:00Z';fixture.detectChanges();
      const frame=document.createElement('iframe');frame.style.width=`${width}px`;frame.style.height='900px';
      document.body.appendChild(frame);
      try {
        const doc=frame.contentDocument!,win=frame.contentWindow!;
        document.querySelectorAll('style').forEach(style=>doc.head.appendChild(style.cloneNode(true)));
        doc.documentElement.classList.toggle('dark',dark);
        const host=fixture.nativeElement.cloneNode(true) as HTMLElement;
        host.style.display='block';host.style.width='100%';doc.body.appendChild(host);
        const panel=doc.querySelector('.xero-sync') as HTMLElement;
        const pause=panel.querySelector('.xero-pause') as HTMLElement;
        const button=panel.querySelector('button') as HTMLButtonElement;
        expect(panel.getAttribute('aria-live')).toBe('polite');expect(panel.querySelector('[role="alert"]')).toBeNull();
        expect(pause.textContent).toContain('allowance to be confirmed');
        expect(pause.textContent).toContain('Brisbane time');expect(button.disabled).toBeFalse();
        expect(panel.scrollWidth).toBeLessThanOrEqual(panel.clientWidth+1);
        expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
        expect(button.getBoundingClientRect().right).toBeLessThanOrEqual(panel.getBoundingClientRect().right+1);
        expect(win.getComputedStyle(pause).color).toBe(dark?'rgb(255, 215, 149)':'rgb(128, 82, 10)');
      } finally {frame.remove();}
    });
    it(`keeps overnight status and Refresh usable at ${width}px in ${dark?'dark':'light'} mode`, () => {
      configureSync(queuedRun());fixture.detectChanges();
      // A same-origin iframe exercises real viewport media queries and the
      // component's existing scoped styles without changing the runner window.
      const frame=document.createElement('iframe');frame.style.width=`${width}px`;frame.style.height='900px';
      document.body.appendChild(frame);
      try {
        const doc=frame.contentDocument!,win=frame.contentWindow!;
        document.querySelectorAll('style').forEach(style=>doc.head.appendChild(style.cloneNode(true)));
        doc.documentElement.classList.toggle('dark',dark);
        const host=fixture.nativeElement.cloneNode(true) as HTMLElement;
        host.style.display='block';host.style.width='100%';doc.body.appendChild(host);
        const panel=doc.querySelector('.xero-sync') as HTMLElement;
        const details=panel.querySelector('.xero-sync-details') as HTMLElement;
        const button=panel.querySelector('button') as HTMLButtonElement;
        const box=panel.getBoundingClientRect(),action=button.getBoundingClientRect(),text=details.getBoundingClientRect();
        expect(panel.textContent).toContain('Queued for overnight sync');
        expect(panel.getAttribute('aria-live')).toBe('polite');
        expect(button.disabled).toBeFalse();expect(button.textContent?.trim()).toBe('Refresh');
        expect(action.height).toBeGreaterThanOrEqual(44);
        expect(action.right).toBeLessThanOrEqual(box.right+1);
        expect(text.right<=action.left+1 || text.bottom<=action.top+1).toBeTrue();
        expect(panel.scrollWidth).toBeLessThanOrEqual(panel.clientWidth+1);
        expect(win.getComputedStyle(details.querySelector('span')!).color)
          .toBe(dark?'rgb(156, 173, 195)':'rgb(102, 117, 138)');
      } finally {frame.remove();}
    });
  }

  it('shows page-level Xero progress while preserving the student register', () => {
    api.workspace.and.returnValue(of({
      packId: 'student-operations', version: '0.1.0', tenantId: 'tenant-1',
      role: 'chief_executive', authorizationRevision: 1, workspaceRoutes: ['students'],
    }));
    api.xeroStatus.and.returnValue(of({
      configured: true,
      connections: [{
        connectionId: 'connection-1', tenantName: 'Example TRUST', status: 'active',
        organisationRole: 'trust', missingStudentDiscoveryScopes: [],
      }],
    }));
    api.xeroStudentSyncStatus.and.returnValue(of({
      configured: true, organisationRole: 'trust', lastSuccessfulSyncAt: null,
      lastErrorCode: null, nextScheduledSyncAt: null,
      latestRun: {
        syncRunId: 'run-1', connectionId: 'connection-1', mode: 'initial', triggerType: 'manual',
        status: 'processing', contactCount: 500, invoiceCount: 125, candidateCount: 0,
        errorCode: null, createdAt: '2026-10-10T00:00:00Z',
        startedAt: '2026-10-10T00:00:01Z', completedAt: null,
      },
    }));

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('500 contacts and 125 invoices processed');
    expect(fixture.nativeElement.textContent).toContain('No invoices match the current search');
    expect(fixture.nativeElement.textContent).not.toContain('No students found');
  });

  it('explains transient Xero failures and the scheduled retry', () => {
    api.workspace.and.returnValue(of({
      packId: 'student-operations', version: '0.1.0', tenantId: 'tenant-1',
      role: 'chief_executive', authorizationRevision: 1, workspaceRoutes: ['students'],
    }));
    api.xeroStatus.and.returnValue(of({
      configured: true,
      connections: [{
        connectionId: 'connection-1', tenantName: 'Example TRUST', status: 'active',
        organisationRole: 'trust', missingStudentDiscoveryScopes: [],
      }],
    }));
    api.xeroStudentSyncStatus.and.returnValue(of({
      configured: true, organisationRole: 'trust', lastSuccessfulSyncAt: null,
      lastErrorCode: 'xero_unavailable', nextScheduledSyncAt: '2026-10-10T01:33:34Z',
      latestRun: {
        syncRunId: 'run-1', connectionId: 'connection-1', mode: 'initial', triggerType: 'manual',
        status: 'failed', contactCount: 1000, invoiceCount: 0, candidateCount: 0,
        errorCode: 'xero_unavailable', createdAt: '2026-10-10T01:18:17Z',
        startedAt: '2026-10-10T01:18:18Z', completedAt: '2026-10-10T01:18:34Z',
      },
    }));

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Xero is temporarily unavailable');
    expect(fixture.nativeElement.textContent).toContain('recheck retry eligibility');
    expect(fixture.nativeElement.textContent).not.toContain('automatic retry is scheduled');
    expect(fixture.nativeElement.textContent).toContain('Existing student information remains available');
  });

  it('backs off status polling while a Xero refresh remains active', fakeAsync(() => {
    api.workspace.and.returnValue(of({
      packId: 'student-operations', version: '0.1.0', tenantId: 'tenant-1',
      role: 'chief_executive', authorizationRevision: 1, workspaceRoutes: ['students'],
    }));
    api.xeroStatus.and.returnValue(of({
      configured: true,
      connections: [{
        connectionId: 'connection-1', tenantName: 'Example TRUST', status: 'active',
        organisationRole: 'trust', missingStudentDiscoveryScopes: [],
      }],
    }));
    api.xeroStudentSyncStatus.and.returnValue(of({
      configured: true, organisationRole: 'trust', lastSuccessfulSyncAt: null,
      lastErrorCode: null, nextScheduledSyncAt: null,
      latestRun: {
        syncRunId: 'run-1', connectionId: 'connection-1', mode: 'initial', triggerType: 'manual',
        status: 'processing', contactCount: 0, invoiceCount: 0, candidateCount: 0,
        errorCode: null, createdAt: '2026-10-10T00:00:00Z',
        startedAt: '2026-10-10T00:00:01Z', completedAt: null,
      },
    }));
    fixture.detectChanges();
    expect(api.xeroStudentSyncStatus).toHaveBeenCalledTimes(1);

    tick(2000);
    expect(api.xeroStudentSyncStatus).toHaveBeenCalledTimes(2);
    tick(2000);
    expect(api.xeroStudentSyncStatus).toHaveBeenCalledTimes(3);
    tick(3999);
    expect(api.xeroStudentSyncStatus).toHaveBeenCalledTimes(3);
    tick(1);
    expect(api.xeroStudentSyncStatus).toHaveBeenCalledTimes(4);

    fixture.destroy();
  }));
});
