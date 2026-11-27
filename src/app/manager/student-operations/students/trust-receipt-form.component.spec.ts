import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { StudentOperationsService } from '../student-operations.service';
import { TrustReceiptForm } from './trust-receipt-form.component';

describe('TRUST receipt form', () => {
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
