import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { StudentOperationsService } from '../student-operations.service';
import { XeroStudentInvoiceResult } from '../student-operations.types';
import { PaymentOperationsPanel } from './payment-operations-panel.component';

describe('PaymentOperationsPanel', () => {
  it('opens a paid TRUST invoice from the receipt queue and refreshes after confirmation', async () => {
    const paid = {xeroInvoiceId:'invoice', invoiceNumber:'INV-1', status:'PAID', amountDue:0, unlinkedReceipts:{count:2,amount:5484,withCandidates:1,withMultipleCandidates:1}};
    const page = {page:1, totalPages:1, invoices:[paid], total:1};
    const invoices = jasmine.createSpy().and.returnValues(of({...page, invoices:[]}), of(page), of({...page, invoices:[]}), of({...page, invoices:[]}), of({...page, invoices:[]}));
    TestBed.configureTestingModule({imports:[PaymentOperationsPanel], providers:[{provide:StudentOperationsService,
      useValue:{xeroStudentInvoices:invoices,xeroStudentSyncStatus:() => of({lastSuccessfulSyncAt:null})}}]});
    const fixture = TestBed.createComponent(PaymentOperationsPanel);
    fixture.componentRef.setInput('connection',{connectionId:'trust',organisationRole:'trust'});
    fixture.componentRef.setInput('receiptRevision',0);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('header button').click();
    fixture.detectChanges();
    expect(invoices.calls.mostRecent().args[1].queue).toBe('receipts_awaiting_link');
    expect(fixture.nativeElement.querySelector('[data-label="Verified receipts awaiting a link"]').textContent)
      .toContain('AUD 5,484.00 · 2 receipts');
    expect(fixture.nativeElement.textContent).toContain('1 of 2 with a possible Xero payment');
    expect(fixture.nativeElement.textContent).toContain('1 with multiple possible payments');
    const reviewed = jasmine.createSpy();
    fixture.componentInstance.review.subscribe(reviewed);
    fixture.nativeElement.querySelector('.invoice-link').click();
    expect(reviewed).toHaveBeenCalledWith(paid);
    fixture.componentRef.setInput('receiptRevision',1);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No verified receipts awaiting a payment link.');
    await fixture.whenStable();
    fixture.nativeElement.querySelector('[aria-label="Possible Xero payments"]').click();
    fixture.detectChanges();
    const choices = Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('.select-option'));
    choices.find(item => item.textContent?.trim() === 'Has a possible Xero payment')!.click();
    fixture.detectChanges();
    expect(invoices.calls.mostRecent().args[1]).toEqual(jasmine.objectContaining({paymentCandidateStatus:'available',page:1}));
    fixture.nativeElement.querySelector('[aria-label="Possible Xero payments"]').click();
    fixture.detectChanges();
    const options = Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('.select-option'));
    options.find(item => item.textContent?.trim() === 'Receipt with multiple possible payments')!.click();
    fixture.detectChanges();
    expect(invoices.calls.mostRecent().args[1]).toEqual(jasmine.objectContaining({paymentCandidateStatus:'multiple',page:1}));
    expect(fixture.nativeElement.textContent).toContain('No invoices match this payment filter.');
    invoices.and.returnValue(of(page));
    fixture.nativeElement.querySelector('[aria-label="Possible Xero payments"]').click();
    fixture.detectChanges();
    const partial = Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('.select-option'))
      .find(item => item.textContent?.trim() === 'Only some receipts have a possible payment');
    partial!.click();
    fixture.detectChanges();
    expect(invoices.calls.mostRecent().args[1]).toEqual(jasmine.objectContaining({paymentCandidateStatus:'partial',page:1}));
    expect(fixture.nativeElement.textContent).toContain('1 of 2 with a possible Xero payment');
  });

  it('shows the verified excess even when the invoice balance is zero', async () => {
    const page = {page:1, totalPages:1, total:1, invoices:[
      {xeroInvoiceId:'invoice', invoiceNumber:'INV-10635', currencyCode:'AUD', amountDue:0, receiptExcess:0.20, unlinkedExcess:0.10, unlinkedExcessDays:3,
       reconciliation:{oldestLinkedAt:"2026-11-16T18:00:00Z",pendingDays:10,amount:2741.80,payments:2,managerChecks:1,latestReportedReconciledOn:"2026-11-17",statusUnknown:1,linkMismatch:1,xeroPending:0}},
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
    expect(fixture.nativeElement.querySelector('[data-label="Excess without a Xero link"]').textContent).toContain('AUD 0.10');
    expect(fixture.nativeElement.textContent).toContain('Oldest receipt · 3 days ago');
    await fixture.whenStable();
    fixture.nativeElement.querySelector('[aria-label="Overpayment link status"]').click();
    fixture.detectChanges();
    const options = Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('.select-option'));
    options.find(button => button.textContent?.trim() === 'Needs an overpayment link')!.click();
    fixture.detectChanges();
    expect(invoices.calls.mostRecent().args[1]).toEqual(jasmine.objectContaining({excessLinkStatus:'needs_link',page:1}));
    expect(invoices.calls.mostRecent().args[1].sort).toBeUndefined();
    fixture.nativeElement.querySelector('[aria-label="Overpayment link status"]').click();
    fixture.detectChanges();
    const linkedOptions = Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('.select-option'));
    linkedOptions.find(button => button.textContent?.trim() === 'Fully linked')!.click();
    fixture.detectChanges();
    expect(invoices.calls.mostRecent().args[1]).toEqual(jasmine.objectContaining({excessLinkStatus:'fully_linked',sort:'dueDate'}));
    fixture.nativeElement.querySelector('[aria-label="Overpayment link status"]').click();
    fixture.detectChanges();
    const statusesOffered = Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('.select-option'));
    statusesOffered.find(button => button.textContent?.trim() === 'Overpayment link no longer matches')!.click();
    fixture.detectChanges();
    expect(invoices.calls.mostRecent().args[1]).toEqual(jasmine.objectContaining({excessLinkStatus:'link_mismatch',page:1}));
    fixture.nativeElement.querySelectorAll('header button')[2].click();
    fixture.detectChanges();
    expect(invoices.calls.mostRecent().args[1].queue).toBe('reconciliation_review');
    expect(invoices.calls.mostRecent().args[1].sort).toBeUndefined();
    expect(invoices.calls.mostRecent().args[1].excessLinkStatus).toBeUndefined();
    const oldest = fixture.nativeElement.querySelector('[data-label="Oldest pending link"]').textContent;
    expect(oldest).toContain('Nov 17, 2026');
    expect(oldest).toContain('10 days ago');
    expect(fixture.nativeElement.querySelector('[data-label="Awaiting confirmation"]').textContent).toContain('AUD 2,741.80');
    const statuses = fixture.nativeElement.querySelector('[data-label="Xero payment status"]').textContent;
    expect(statuses).toContain('1 · Status unavailable');
    expect(statuses).toContain('1 · Link no longer matches');
    expect(statuses).not.toContain('Pending reconciliation');
    expect(fixture.nativeElement.querySelector('[data-label="Manager checks"]').textContent).toContain('1 of 2');
    expect(fixture.nativeElement.querySelector('[data-label="Manager checks"]').textContent).toContain('Latest reported reconciliation date · 17 Nov 2026');
  });

  it('filters reconciliation by the selected owner from the first page', async () => {
    const invoices = jasmine.createSpy().and.returnValue(of({invoices:[],page:1,total:0,totalPages:0}));
    TestBed.configureTestingModule({imports:[PaymentOperationsPanel], providers:[{provide:StudentOperationsService,
      useValue:{xeroStudentInvoices:invoices,xeroStudentSyncStatus:()=>of({lastSuccessfulSyncAt:null})}}]});
    const fixture=TestBed.createComponent(PaymentOperationsPanel);
    fixture.componentRef.setInput('connection',{connectionId:'trust',organisationRole:'trust'});
    fixture.detectChanges();
    fixture.nativeElement.querySelectorAll('header button')[2].click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.nativeElement.querySelector('[aria-label="Follow-up owner"]').click();
    fixture.detectChanges();
    const options=Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('.select-option'));
    options.find(b=>b.textContent?.trim()==='My follow-ups')!.click();
    fixture.detectChanges();
    expect(invoices.calls.mostRecent().args[1]).toEqual(jasmine.objectContaining({queue:'reconciliation_review',followUpOwner:'mine',page:1}));
    expect(fixture.nativeElement.textContent).toContain('No follow-ups match this owner filter.');
    const selectStatus = (label: string) => {
      fixture.nativeElement.querySelector('[aria-label="Reconciliation status"]').click();
      fixture.detectChanges();
      const choices = Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('.select-option'));
      choices.find(choice => choice.textContent?.trim() === label)!.click();
      fixture.detectChanges();
    };
    selectStatus('Link no longer matches');
    expect(invoices.calls.mostRecent().args[1]).toEqual(jasmine.objectContaining({
      queue:'reconciliation_review', followUpOwner:'mine', reconciliationStatus:'link_mismatch', page:1
    }));
    selectStatus('Manager reported reconciled · Xero pending');
    expect(invoices.calls.mostRecent().args[1]).toEqual(jasmine.objectContaining({
      queue:'reconciliation_review', followUpOwner:'mine', reconciliationStatus:'checked_pending', page:1
    }));
    selectStatus('Manager reported reconciled · Xero status unavailable');
    expect(invoices.calls.mostRecent().args[1]).toEqual(jasmine.objectContaining({
      queue:'reconciliation_review', followUpOwner:'mine', reconciliationStatus:'checked_unknown', page:1
    }));
    expect(fixture.nativeElement.textContent).toContain('No follow-ups match these filters.');
    fixture.componentInstance.toggleQueue('excess_receipts');
    expect(invoices.calls.mostRecent().args[1].followUpOwner).toBeUndefined();
    expect(invoices.calls.mostRecent().args[1].reconciliationStatus).toBeUndefined();
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
