import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { StudentOperationsService } from '../student-operations.service';
import { XeroStudentInvoiceResult } from '../student-operations.types';
import { PaymentOperationsPanel } from './payment-operations-panel.component';

describe('PaymentOperationsPanel', () => {
  it('opens a paid TRUST invoice from the receipt queue and refreshes after confirmation', () => {
    const paid = {xeroInvoiceId:'invoice', invoiceNumber:'INV-1', status:'PAID', amountDue:0};
    const page = {page:1, totalPages:1, invoices:[paid], total:1};
    const invoices = jasmine.createSpy().and.returnValues(of({...page, invoices:[]}), of(page), of({...page, invoices:[]}));
    TestBed.configureTestingModule({imports:[PaymentOperationsPanel], providers:[{provide:StudentOperationsService,
      useValue:{xeroStudentInvoices:invoices,xeroStudentSyncStatus:() => of({lastSuccessfulSyncAt:null})}}]});
    const fixture = TestBed.createComponent(PaymentOperationsPanel);
    fixture.componentRef.setInput('connection',{connectionId:'trust',organisationRole:'trust'});
    fixture.componentRef.setInput('receiptRevision',0);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('header button').click();
    fixture.detectChanges();
    expect(invoices.calls.mostRecent().args[1].queue).toBe('receipts_awaiting_link');
    const reviewed = jasmine.createSpy();
    fixture.componentInstance.review.subscribe(reviewed);
    fixture.nativeElement.querySelector('.invoice-link').click();
    expect(reviewed).toHaveBeenCalledWith(paid);
    fixture.componentRef.setInput('receiptRevision',1);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No verified receipts awaiting a payment link.');
  });

  it('shows the verified excess even when the invoice balance is zero', () => {
    const page = {page:1, totalPages:1, total:1, invoices:[
      {xeroInvoiceId:'invoice', invoiceNumber:'INV-10635', currencyCode:'AUD', amountDue:0, receiptExcess:0.20},
    ]};
    const invoices = jasmine.createSpy().and.returnValue(of(page));
    TestBed.configureTestingModule({imports:[PaymentOperationsPanel], providers:[{provide:StudentOperationsService,
      useValue:{xeroStudentInvoices:invoices,xeroStudentSyncStatus:() => of({lastSuccessfulSyncAt:null})}}]});
    const fixture = TestBed.createComponent(PaymentOperationsPanel);
    fixture.componentRef.setInput('connection',{connectionId:'trust',organisationRole:'trust'});
    fixture.detectChanges();
    fixture.nativeElement.querySelectorAll('header button')[1].click();
    fixture.detectChanges();
    expect(invoices.calls.mostRecent().args[1].queue).toBe('excess_receipts');
    expect(fixture.nativeElement.querySelector('[data-label="Receipt excess"]').textContent).toContain('AUD 0.20');
  });

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
