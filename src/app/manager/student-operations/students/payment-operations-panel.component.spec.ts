import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { StudentOperationsService } from '../student-operations.service';
import { XeroStudentInvoiceResult } from '../student-operations.types';
import { PaymentOperationsPanel } from './payment-operations-panel.component';

describe('PaymentOperationsPanel', () => {
  it('filters imported payments by date and amount and clears both filters', async () => {
    const invoices = jasmine.createSpy().and.returnValue(of({page:1,totalPages:1,total:1,invoices:[
      {xeroInvoiceId:'invoice',availablePayments:{count:2,amount:2766.8,latestDate:'2020-01-03'}}
    ]}));
    TestBed.configureTestingModule({imports:[PaymentOperationsPanel],providers:[{provide:StudentOperationsService,
      useValue:{xeroStudentInvoices:invoices,xeroStudentSyncStatus:()=>of({lastSuccessfulSyncAt:null})}}]});
    const fixture = TestBed.createComponent(PaymentOperationsPanel);
    fixture.componentRef.setInput('connection',{connectionId:'trust',organisationRole:'trust'});
    fixture.detectChanges();
    const button = (label:string) => Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button'))
      .find(item => item.textContent?.trim() === label)!;
    button('Review payments without receipt links').click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('AUD 2,766.80');
    for (const [name,value] of [['paymentDate','2020-01-02'],['paymentAmount','2741.80']]) {
      const field=fixture.nativeElement.querySelector('[name='+name+']');
      field.value=value;
      field.dispatchEvent(new Event('input'));
    }
    fixture.detectChanges();
    button('Apply filters').click();
    expect(invoices.calls.mostRecent().args[1]).toEqual({queue:'payments_without_receipts',page:1,limit:25,
      importedPaymentDate:'2020-01-02',importedPaymentAmount:'2741.80'});
    button('Clear filters').click();
    expect(invoices.calls.mostRecent().args[1]).toEqual({queue:'payments_without_receipts',page:1,limit:25});
  });

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
      {xeroInvoiceId:'invoice', invoiceNumber:'INV-10635', currencyCode:'USD', amountDue:0, receiptExcess:0.20, unlinkedExcess:0.10, unlinkedExcessDays:3,
       confirmedPayments:{count:1,amount:2741.80},
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
    fixture.nativeElement.querySelectorAll('header button')[3].click();
    fixture.detectChanges();
    expect(invoices.calls.mostRecent().args[1].queue).toBe('reconciled_payments');
    expect(fixture.nativeElement.querySelector('[data-label="Confirmed amount"]').textContent).toContain('AUD 2,741.80');
    expect(fixture.nativeElement.querySelector('[data-label="Confirmed payments"]').textContent.trim()).toBe('1');
  });

  it('opens the verified receipts for a missing invoice without showing a current balance', () => {
    const row={xeroInvoiceId:'i',invoiceNumber:'INV-MISSING',amountDue:400,
      receiptException:{reason:'not_current',count:2,amount:150,latestReceiptOn:'2026-11-13'}};
    const invoices=jasmine.createSpy().and.returnValue(of({page:1,totalPages:1,total:1,invoices:[row]}));
    TestBed.configureTestingModule({imports:[PaymentOperationsPanel],providers:[{provide:StudentOperationsService,
      useValue:{xeroStudentInvoices:invoices,xeroStudentSyncStatus:()=>of({lastSuccessfulSyncAt:null})}}]});
    const fixture=TestBed.createComponent(PaymentOperationsPanel);
    fixture.componentRef.setInput('connection',{connectionId:'trust',organisationRole:'trust'});
    fixture.detectChanges();
    Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('header button'))
      .find(button=>button.textContent?.includes('Review invoice exceptions'))!.click();
    fixture.detectChanges();
    expect(invoices.calls.mostRecent().args[1].queue).toBe('receipt_exceptions');
    expect(fixture.nativeElement.textContent).toContain('Contact unavailable');
    expect(fixture.nativeElement.querySelector('[data-label="Verified receipts"]').textContent).toContain('2 · AUD 150.00');
    expect(fixture.nativeElement.querySelector('[data-label="Invoice exception"]').textContent).toContain('missing from the current import');
    expect(fixture.nativeElement.querySelector('[data-label="Balance due"]')).toBeNull();
    const review=jasmine.createSpy();
    fixture.componentInstance.review.subscribe(review);
    fixture.nativeElement.querySelector('.invoice-link').click();
    expect(review).toHaveBeenCalledOnceWith(row);
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
    fixture.nativeElement.querySelector('[aria-label="Follow-up age"]').click();
    fixture.detectChanges();
    const ages = Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('.select-option'));
    ages.find(option=>option.textContent?.trim()==='At least 7 days')!.click();
    fixture.detectChanges();
    expect(invoices.calls.mostRecent().args[1]).toEqual(jasmine.objectContaining({page:1,minFollowUpDays:7,followUpOwner:'mine'}));
    selectStatus('Link no longer matches');
    expect(invoices.calls.mostRecent().args[1]).toEqual(jasmine.objectContaining({
      queue:'reconciliation_review', followUpOwner:'mine', reconciliationStatus:'link_mismatch', page:1
    }));
    for (const [label,status] of [
      ['No manager check · Xero pending','unchecked_pending'],
      ['No manager check · Xero status unavailable','unchecked_unknown'],
    ]) {
      selectStatus(label);
      expect(invoices.calls.mostRecent().args[1]).toEqual(jasmine.objectContaining({
        queue:'reconciliation_review', followUpOwner:'mine', reconciliationStatus:status, page:1
      }));
    }
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
    expect(invoices.calls.mostRecent().args[1].minFollowUpDays).toBeUndefined();
    expect(invoices.calls.mostRecent().args[1].followUpOwner).toBeUndefined();
    expect(invoices.calls.mostRecent().args[1].reconciliationStatus).toBeUndefined();
  });

  it('keeps the selected page and its rows visible while reloading a completed import or retrying a failure', async () => {
    const row = {xeroInvoiceId:'one',invoiceNumber:'INV-TEST'};
    const page = {page:1,limit:25,total:201,totalPages:9,invoices:[row]};
    const refreshed = new Subject<XeroStudentInvoiceResult>();
    const invoices = jasmine.createSpy().and.returnValue(of(page));
    TestBed.configureTestingModule({imports:[PaymentOperationsPanel], providers:[{provide:StudentOperationsService,
      useValue:{xeroStudentInvoices:invoices,xeroStudentSyncStatus:()=>of({lastSuccessfulSyncAt:null})}}]});
    const fixture=TestBed.createComponent(PaymentOperationsPanel);
    fixture.componentRef.setInput('connection',{connectionId:'trust',organisationRole:'trust'});
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.nativeElement.querySelector('[aria-label="Documents per page"]').click();
    fixture.detectChanges();
    Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('.select-option'))
      .find(option=>option.textContent?.trim()==='50 per page')!.click();
    fixture.detectChanges();
    expect(invoices.calls.mostRecent().args[1]).toEqual(jasmine.objectContaining({page:1,limit:50}));
    invoices.and.returnValue(of({...page,page:3,totalPages:5}));
    const jump = fixture.nativeElement.querySelector('[aria-label="Document page number"]');
    jump.value='3';
    jump.dispatchEvent(new Event('input'));
    jump.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter'}));
    fixture.detectChanges();
    expect(invoices.calls.mostRecent().args[1].page).toBe(3);
    invoices.and.returnValue(refreshed);
    fixture.componentRef.setInput('importTimestamp','2026-11-27T01:00:00Z');
    fixture.detectChanges();
    expect(invoices.calls.mostRecent().args[1]).toEqual(jasmine.objectContaining({page:3,limit:50}));
    expect(fixture.nativeElement.textContent).toContain('INV-TEST');
    refreshed.error(new Error('offline'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('INV-TEST');
    invoices.and.returnValue(of({...page,page:3,totalPages:5}));
    Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button')).find(b=>b.textContent?.trim()==='Retry')!.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    fixture.nativeElement.querySelector('[aria-label="Last page"]').click();
    expect(invoices.calls.mostRecent().args[1].page).toBe(5);
  });

  it('fits payment navigation at narrow and desktop widths in both themes', () => {
    const data = {page:1,limit:25,total:26,totalPages:2,invoices:[{xeroInvoiceId:'test',invoiceNumber:'INV-TEST'}]};
    TestBed.configureTestingModule({imports:[PaymentOperationsPanel],providers:[{provide:StudentOperationsService,
      useValue:{xeroStudentInvoices:()=>of(data),xeroStudentSyncStatus:()=>of({lastSuccessfulSyncAt:null})}}]});
    const fixture=TestBed.createComponent(PaymentOperationsPanel);
    fixture.componentRef.setInput('connection',{connectionId:'trust',tenantName:'Test TRUST',organisationRole:'trust'});
    fixture.detectChanges();
    const frame=document.createElement('iframe');
    frame.style.height='800px';
    document.body.appendChild(frame);
    try {
      const doc=frame.contentDocument!;
      for (const style of document.head.querySelectorAll('style')) doc.head.appendChild(style.cloneNode(true));
      doc.body.appendChild(fixture.nativeElement.cloneNode(true));
      const footer=doc.querySelector<HTMLElement>('footer')!;
      const header=doc.querySelector<HTMLElement>('thead')!;
      for(const width of [375,1280]) {
        frame.style.width=width+'px';
        for(const dark of [false,true]) {
          doc.documentElement.classList.toggle('dark',dark);
          expect(frame.contentWindow!.getComputedStyle(header).display==='none').toBe(width===375);
          for(const button of footer.querySelectorAll('button')) {
            const rect=button.getBoundingClientRect();
            expect(rect.width).toBeGreaterThan(0);
            expect(rect.left).toBeGreaterThanOrEqual(0);
            expect(rect.right).toBeLessThanOrEqual(width);
          }
        }
      }
    } finally { frame.remove(); }
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
