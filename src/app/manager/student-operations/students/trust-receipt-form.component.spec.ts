import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { StudentOperationsService } from '../student-operations.service';
import { TrustReceiptForm } from './trust-receipt-form.component';

describe('TRUST receipt form', () => {
  it('loads ownership history on demand and retries older claims without losing the current page', () => {
    const receipt = {id:'receipt',amount:'10',invoiceDue:'10',linkedPaymentId:'payment',linkedPaymentReconciled:true,candidateIds:['payment']};
    const entry = {id:'first',ownerName:'Fixture Reviewer',claimedAt:'2026-11-20T10:00:00Z',releasedAt:null};
    const api = {trustReceipts:()=>of([receipt]),trustClaimHistory:jasmine.createSpy().and.returnValues(
      of({entries:[entry],nextCursor:'first'}),throwError(()=>new Error('offline')),
      of({entries:[{...entry,id:'older',ownerName:null,releasedAt:entry.claimedAt}],nextCursor:null}))};
    TestBed.configureTestingModule({imports:[TrustReceiptForm],providers:[{provide:StudentOperationsService,useValue:api}]});
    const fixture=TestBed.createComponent(TrustReceiptForm);
    fixture.componentRef.setInput('connection','trust');
    fixture.componentRef.setInput('invoice',{xeroInvoiceId:'invoice',status:'PAID',amountDue:0});
    fixture.detectChanges();
    const section=fixture.nativeElement.querySelector('app-trust-claim-history');
    const click = (label:string) => {
      Array.from<HTMLButtonElement>(section.querySelectorAll('button')).find(b=>b.textContent?.trim()===label)!.click();
      fixture.detectChanges();
    };
    expect(api.trustClaimHistory).not.toHaveBeenCalled();
    click('Follow-up history');
    click('Show older claims');
    expect(section.textContent).toContain('Fixture Reviewer');
    click('Retry loading history');
    expect(section.querySelectorAll('li').length).toBe(2);
    expect(section.textContent).toContain('Staff member unavailable');
    expect(api.trustClaimHistory.calls.mostRecent().args).toEqual(['trust','invoice','receipt','payment','first']);
  });

  it('refreshes the open invoice on return, preserving the draft and coalescing duplicate requests', () => {
    const receipt = {id:'receipt',amount:'10',invoiceDue:'50',linkedPaymentId:'payment',candidateIds:['payment']};
    const refreshed = new Subject<Array<typeof receipt & {linkedPaymentReconciled: boolean}>>();
    const invoice = {xeroInvoiceId:'invoice',status:'AUTHORISED',amountDue:50};
    const api = {trustReceipts:jasmine.createSpy().and.returnValues(of([receipt]),refreshed,throwError(()=>new Error('offline')),of([])),
      xeroStudentInvoice:jasmine.createSpy().and.returnValue(of({...invoice,amountDue:40}))};
    TestBed.configureTestingModule({imports:[TrustReceiptForm],providers:[{provide:StudentOperationsService,useValue:api}]});
    const fixture = TestBed.createComponent(TrustReceiptForm);
    fixture.componentRef.setInput('connection','trust');
    fixture.componentRef.setInput('invoice',invoice);
    fixture.detectChanges();
    const form = fixture.componentInstance;
    form.amount='12.50';
    const invoiceChanged = jasmine.createSpy();
    form.invoiceRefreshed.subscribe(invoiceChanged);
    const visibility = spyOnProperty(document,'visibilityState','get').and.returnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(api.xeroStudentInvoice).not.toHaveBeenCalled();
    visibility.and.returnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    form.load(true);
    expect(api.xeroStudentInvoice).toHaveBeenCalledOnceWith('trust','invoice');
    expect(form.ready).toBeFalse();
    refreshed.next([{...receipt,linkedPaymentReconciled:true}]); refreshed.complete();
    fixture.detectChanges();
    expect(invoiceChanged).toHaveBeenCalledWith({...invoice,amountDue:40});
    expect(fixture.nativeElement.textContent).toContain('Bank reconciliation confirmed');
    form.load(true);
    fixture.detectChanges();
    expect(form.ready).toBeFalse();
    expect(form.amount).toBe('12.50');
    expect(fixture.nativeElement.querySelector('input[name="amount"]')).toBeTruthy();
    const retry = Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button'))
      .find(button=>button.textContent?.includes('Retry loading imported details'));
    retry!.click();
    expect(form.ready).toBeTrue();
    expect(form.receipts).toEqual([]);
    fixture.destroy();
    document.dispatchEvent(new Event('visibilitychange'));
    expect(api.trustReceipts).toHaveBeenCalledTimes(4);
  });

  it('claims a follow-up and releases only the displayed claim', () => {
    const receipt = {id:'receipt',amount:'10',invoiceDue:'10',linkedPaymentId:'payment',candidateIds:['payment']};
    const api = {trustReceipts:jasmine.createSpy().and.returnValues(of([receipt]),
      of([{...receipt,reviewClaimId:'claim',reviewOwnedByMe:true}]),of([receipt])),
      changeTrustReviewClaim:jasmine.createSpy().and.returnValue(of({claimId:'claim'}))};
    TestBed.configureTestingModule({imports:[TrustReceiptForm],providers:[{provide:StudentOperationsService,useValue:api}]});
    const fixture = TestBed.createComponent(TrustReceiptForm);
    fixture.componentRef.setInput('connection','trust');
    fixture.componentRef.setInput('invoice',{xeroInvoiceId:'invoice',status:'PAID',amountDue:0});
    fixture.detectChanges();
    const button = (label:string) => Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button')).find(b=>b.textContent?.trim()===label);
    button('Claim follow-up')!.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Follow-up owner · You');
    button('Release follow-up')!.click();
    expect(api.changeTrustReviewClaim.calls.allArgs()).toEqual([
      ['trust','invoice','receipt','payment',undefined], ['trust','invoice','receipt','payment','claim'],
    ]);
  });

  it('opens invoice and payment records in the selected Xero organisation', () => {
    const invoiceId = '00000000-0000-4000-8000-000000000001';
    const paymentId = '00000000-0000-4000-8000-000000000002';
    const receipt = {id:'r', amount:'100', invoiceDue:'100', candidateIds:[paymentId]};
    const api = {trustReceipts:() => of([receipt]), linkTrustPayment:jasmine.createSpy()};
    TestBed.configureTestingModule({imports:[TrustReceiptForm],providers:[{provide:StudentOperationsService,useValue:api}]});
    const fixture = TestBed.createComponent(TrustReceiptForm);
    fixture.componentRef.setInput('connection','trust');
    fixture.componentRef.setInput('invoice',{xeroInvoiceId:invoiceId,status:'PAID',amountDue:0});
    fixture.detectChanges();
    const anchors = (): HTMLAnchorElement[] => Array.from(fixture.nativeElement.querySelectorAll('a'));
    expect(anchors().length).toBe(0);
    fixture.componentRef.setInput('shortCode','!TRUST-1');
    fixture.detectChanges();
    expect(anchors()[0].href).toBe('https://go.xero.com/app/!TRUST-1/invoicing/view/' + invoiceId);
    const candidate = new URL(anchors()[1].href);
    expect(candidate.origin + candidate.pathname).toBe('https://go.xero.com/organisationlogin/default.aspx');
    expect(candidate.searchParams.get('shortcode')).toBe('!TRUST-1');
    expect(candidate.searchParams.get('redirecturl')).toBe('/Bank/ViewTransaction.aspx?bankTransactionID=' + paymentId);
    fixture.componentInstance.receipts[0].linkedPaymentId = paymentId;
    fixture.detectChanges();
    expect(anchors()[1].textContent).toContain('View linked payment in Xero');
    expect(anchors()[1].href).toBe(candidate.href);
    expect(anchors()[1].target).toBe('_blank');
    expect(api.linkTrustPayment).not.toHaveBeenCalled();
    fixture.componentRef.setInput('shortCode','../another-org');
    fixture.detectChanges();
    expect(anchors().length).toBe(0);
  });

  it('records an explicit manager observation while awaiting imported confirmation', () => {
    const receipt = {id:'receipt',amount:'10',invoiceDue:'10',linkedPaymentId:'payment',candidateIds:['payment']};
    const checked = {...receipt,reconciliationCheckedByName:'Fixture Reviewer',reconciliationCheckedAt:'2026-11-27T01:00:00Z'};
    const api = {trustReceipts:jasmine.createSpy().and.returnValues(of([receipt]),of([checked])),
      attestTrustReconciliation:jasmine.createSpy().and.returnValue(of({checkedAt:checked.reconciliationCheckedAt}))};
    TestBed.configureTestingModule({imports:[TrustReceiptForm],providers:[{provide:StudentOperationsService,useValue:api}]});
    const fixture = TestBed.createComponent(TrustReceiptForm);
    fixture.componentRef.setInput('connection','trust');
    fixture.componentRef.setInput('invoice',{xeroInvoiceId:'invoice',status:'PAID',amountDue:0});
    fixture.detectChanges();
    expect(api.attestTrustReconciliation).not.toHaveBeenCalled();
    fixture.nativeElement.querySelector('details button').click();
    fixture.detectChanges();
    expect(api.attestTrustReconciliation).toHaveBeenCalledWith('trust','invoice','receipt','payment');
    expect(fixture.nativeElement.textContent).toContain('Reported reconciled in Xero by Fixture Reviewer');
    expect(fixture.nativeElement.textContent).toContain('Awaiting reconciliation confirmation from the Xero import');
    expect(fixture.nativeElement.querySelector('details button')).toBeNull();
  });

  it('requires a manager click before linking and retains the excess after linking', () => {
    const receipt = {id:'receipt', amount:'2742.00', invoiceDue:'2741.80', receivedOn:'2026-11-13',
      account:'Trust', reference:'', verifiedAt:'2026-11-13', candidateIds:['payment']};
    const api = {trustReceipts:jasmine.createSpy().and.returnValues(of([receipt]),
      of([{...receipt,linkedPaymentId:'payment',linkedAmount:'2741.80'}])),
      linkTrustPayment:jasmine.createSpy().and.returnValue(of({paymentId:'payment'}))};
    TestBed.configureTestingModule({imports:[TrustReceiptForm],providers:[{provide:StudentOperationsService,useValue:api}]});
    const fixture=TestBed.createComponent(TrustReceiptForm);
    fixture.componentRef.setInput('connection','trust');
    fixture.componentRef.setInput('invoice',{xeroInvoiceId:'invoice',status:'PAID',amountDue:0});
    fixture.detectChanges();
    expect(api.linkTrustPayment).not.toHaveBeenCalled();
    const button=fixture.nativeElement.querySelector('details button') as HTMLButtonElement;
    button.click();
    fixture.detectChanges();
    expect(api.linkTrustPayment).toHaveBeenCalledWith('trust','invoice','receipt','payment');
    expect(fixture.nativeElement.textContent).toContain('Linked Xero invoice payment');
    expect(fixture.nativeElement.textContent).toContain('Bank reconciliation status unknown');
    fixture.componentInstance.receipts[0].linkedPaymentReconciled = false;
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Find & Match');
    fixture.componentInstance.receipts[0].linkedPaymentReconciled = true;
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Bank reconciliation confirmed');
    expect(fixture.nativeElement.textContent).toContain('Above invoice balance AUD 0.20');
  });
  it('compares a mismatched payment by ID and refreshes the comparison when the invoice changes', () => {
    const receipt = {id:'r', receivedOn:'2026-11-13', amount:'2742.00', invoiceDue:'2741.80',
      linkedPaymentId:'linked', linkedAmount:'2741.80', candidateIds:[]};
    TestBed.configureTestingModule({imports:[TrustReceiptForm], providers:[{provide:StudentOperationsService,
      useValue:{trustReceipts:() => of([receipt])}}]});
    const fixture = TestBed.createComponent(TrustReceiptForm);
    const invoice = {xeroInvoiceId:'invoice', status:'PAID', amountDue:0, currencyCode:'AUD'};
    const imported = {id:'linked', kind:'payment', date:'2026-11-14', amount:2740};
    const show = (entries: (typeof imported)[] | null) => {
      fixture.componentRef.setInput('invoice',{...invoice,settlement:entries && {entries}});
      fixture.detectChanges();
      return fixture.nativeElement.textContent.replace(/\s+/g,' ');
    };
    fixture.componentRef.setInput('connection','trust');
    expect(show([{...imported,id:'another'},imported])).toContain('Imported payment · AUD 2,740.00 · 2026-11-14');
    expect(fixture.nativeElement.textContent).toContain('At linking · AUD 2,741.80 · 2026-11-13');
    expect(show([{...imported,kind:'credit_note'}])).toContain('no payment with this ID');
    expect(show(null)).toContain('Imported settlement details are unavailable');
  });

  it('records the excess link on confirmation and flags a missing imported credit', () => {
    const receipt = {id:'r', amount:'100.20', invoiceDue:'100', possibleOverpaymentIds:['credit']};
    const api = {trustReceipts:jasmine.createSpy().and.returnValues(of([receipt]),
      of([{...receipt,linkedOverpaymentId:'credit',possibleOverpaymentIds:[]}])),
      linkTrustOverpayment:jasmine.createSpy().and.returnValue(of({overpaymentId:'credit'}))};
    TestBed.configureTestingModule({imports:[TrustReceiptForm],providers:[{provide:StudentOperationsService,useValue:api}]});
    const fixture=TestBed.createComponent(TrustReceiptForm);
    fixture.componentRef.setInput('connection','trust');
    fixture.componentRef.setInput('invoice',{xeroInvoiceId:'invoice',status:'PAID',amountDue:0});
    fixture.detectChanges();
    expect(api.linkTrustOverpayment).not.toHaveBeenCalled();
    fixture.nativeElement.querySelector('details button').click();
    fixture.detectChanges();
    expect(api.linkTrustOverpayment).toHaveBeenCalledWith('trust','invoice','r','credit');
    expect(fixture.nativeElement.textContent).toContain('Linked Xero overpayment');
    expect(fixture.nativeElement.textContent).toContain('no longer matches');
  });

  it('previews a partial receipt and preserves its original expected balance after a later Xero update', () => {
    const receipt = {id:'r', amount:'3000.00', invoiceDue:'3500.0000', paymentPurpose:'Tuition instalment'};
    TestBed.configureTestingModule({imports:[TrustReceiptForm],providers:[{provide:StudentOperationsService,
      useValue:{trustReceipts:() => of([receipt])}}]});
    const fixture = TestBed.createComponent(TrustReceiptForm);
    fixture.componentRef.setInput('connection','trust');
    fixture.componentRef.setInput('invoice',{xeroInvoiceId:'inv', amountDue:250, status:'AUTHORISED'});
    fixture.detectChanges();
    fixture.componentInstance.amount = '200.01';
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Payment purpose · Tuition instalment');
    expect(fixture.nativeElement.textContent).toContain('after this receipt at verification AUD 500.00');
    expect(fixture.nativeElement.textContent).toContain('after this receipt AUD 49.99');
    const component = fixture.componentInstance;
    expect(component.balanceAfterReceipt('1', '1.0050')).toBe(0.01);
    expect(component.balanceAfterReceipt('250.00', 250)).toBe(0);
    for (const invalid of ['', '0.00', '1.234', '-1']) {
      expect(component.balanceAfterReceipt(invalid, 250)).toBeNull();
    }
  });

  it('keeps the full receipt for a partly excess payment and permits a blank bank reference', async () => {
    const api = {trustReceipts: jasmine.createSpy().and.returnValue(of([])),
      verifyTrustReceipt: jasmine.createSpy().and.returnValue(of({id:'receipt'}))};
    TestBed.configureTestingModule({imports:[TrustReceiptForm],providers:[{provide:StudentOperationsService,useValue:api}]});
    const f = TestBed.createComponent(TrustReceiptForm);
    f.componentRef.setInput('connection','trust');
    f.componentRef.setInput('invoice',{xeroInvoiceId:'inv',amountDue:2741.8,status:'AUTHORISED'});
    f.detectChanges();
    const c = f.componentInstance;
    c.amount = '2742.00';
    c.account = 'Open for Australia TRUST';
    c.paymentPurpose = '  Tuition instalment  ';
    c.date = '2026-11-13';
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('AUD 0.20');
    c.save();
    const [connection,invoice,body] = api.verifyTrustReceipt.calls.mostRecent().args;
    expect([connection,invoice,body.get('amount'),body.get('reference')]).toEqual(['trust','inv','2742.00','']);
    expect(body.get('paymentPurpose')).toBe('Tuition instalment');
    expect(c.paymentPurpose).toBe('');
    expect(body.has('file')).toBeFalse();
    expect(api.trustReceipts).toHaveBeenCalledTimes(2);
  });
});
