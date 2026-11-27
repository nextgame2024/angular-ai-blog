import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { StudentOperationsService } from '../student-operations.service';
import { XeroStudentInvoiceResult } from '../student-operations.types';
import { PaymentOperationsPanel } from './payment-operations-panel.component';

describe('PaymentOperationsPanel', () => {
  it('discards a late response from the previous organisation', () => {
    const first = new Subject<XeroStudentInvoiceResult>();
    const second = new Subject<XeroStudentInvoiceResult>();
    const invoices = jasmine.createSpy().and.returnValues(first, second);
    TestBed.configureTestingModule({imports: [PaymentOperationsPanel], providers: [
      {provide: StudentOperationsService, useValue: {xeroStudentInvoices: invoices,
        xeroStudentSyncStatus: () => of({lastSuccessfulSyncAt: null})}},
    ]});
    const fixture = TestBed.createComponent(PaymentOperationsPanel);
    fixture.componentRef.setInput('connection', { connectionId: 'trust', organisationRole: 'trust' });
    fixture.detectChanges();
    fixture.componentRef.setInput('connection', { connectionId: 'pty', organisationRole: 'operating' });
    fixture.detectChanges();
    const result = {invoices: [], page: 1, limit: 25, total: 0, totalPages: 0};
    second.next(result);
    first.next({...result, total: 32});
    expect(fixture.componentInstance.result()).toBe(result);
    expect(invoices).toHaveBeenCalledWith('pty', {
      queue: 'outstanding_invoices', page: 1, limit: 25, sort: 'dueDate', direction: 'asc',
    });
  });
});
