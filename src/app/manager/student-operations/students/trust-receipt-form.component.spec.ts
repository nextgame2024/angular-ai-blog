import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { StudentOperationsService } from '../student-operations.service';
import { TrustReceiptForm } from './trust-receipt-form.component';

describe('TRUST receipt form', () => {
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
    expect(fixture.nativeElement.textContent).toContain('Above invoice balance AUD 0.20');
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
    c.date = '2026-11-13';
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('AUD 0.20');
    c.save();
    const [connection,invoice,body] = api.verifyTrustReceipt.calls.mostRecent().args;
    expect([connection,invoice,body.get('amount'),body.get('reference')]).toEqual(['trust','inv','2742.00','']);
    expect(body.has('file')).toBeFalse();
    expect(api.trustReceipts).toHaveBeenCalledTimes(2);
  });
});
