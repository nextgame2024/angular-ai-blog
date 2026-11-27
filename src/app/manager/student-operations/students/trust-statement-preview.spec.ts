import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { StudentOperationsService } from '../student-operations.service';
import { TrustReceiptForm } from './trust-receipt-form.component';
import { TrustStatementSourceCheck } from './trust-statement-source-check.component';
import { TrustStatementPreview } from './trust-statement-preview.component';
import { previewStatement, statementHeaders } from './trust-statement-preview';

const header = statementHeaders.join(',');
const row = '2026-11-13,2742,AUD,Booked,Test TRUST,tx-1,Deposit';
const read = (...rows: string[]) => previewStatement([header,...rows].join('\r\n'),'test trust','2026-11-27');

describe('TRUST statement preview', () => {
  it('supports BOM, reordered columns, quotes, commas and embedded newlines', () => {
    const result = previewStatement('\uFEFFStatus,Date,Amount,Account,Reference,Currency,Transaction ID\n' +
      'posted,2024-02-29,0.20,TRUST,"College, ""A""\nFee",aud,id', 'trust','2026-11-27');
    expect(result.deposits).toEqual([{row:2,amount:'0.20',date:'2024-02-29',reference:'College, "A"\nFee',transactionId:'id'}]);
  });
  it('rejects malformed headers, ambiguous rows, unterminated fields and oversized row counts', () => {
    for (const csv of [header+',Date', 'Date,Amount', header+'\n'+row+',extra', header+'\n"open',
      header+'\n'+Array(1001).fill(row).join('\n')]) {
      expect(()=>previewStatement(csv,'Test TRUST','2026-11-27')).toThrow();
    }
  });
  it('excludes pending, debits, other currencies or accounts, invalid cents, dates and absent IDs', () => {
    for (const [before,after] of [['Booked','pending'],['2742','-10'],['2742','0'],['2742','0.009'],['AUD','USD'],
      ['Test TRUST','PTY'],['2026-11-13','2026-02-30'],['2026-11-13','2026-11-28'],['tx-1','']]) {
      const result=read(row.replace(before,after));
      expect(result.deposits).toEqual([]);
      expect(result.reasons.length).toBe(1);
    }
  });
  it('deduplicates consistent IDs and keeps distinct same-day equal deposits', () => {
    const result=read(row,row.replace('2742','2742.00'),row.replace('tx-1','tx-2'));
    expect(result.deposits.map(d=>d.transactionId)).toEqual(['tx-1','tx-2']);
    expect(result.reasons).toEqual([{label:'Repeated statement row',count:1}]);
  });
  it('quarantines every occurrence of a conflicting ID regardless of row order', () => {
    for (const conflict of [row.replace('2742','2743'),row.replace('Booked','pending'),row.replace('Deposit','Other')]) {
      for (const pair of [[row,conflict],[conflict,row]]) {
        expect(read(...pair)).toEqual({deposits:[],reasons:[{label:'Conflicting entries for one transaction ID',count:2}]});
      }
    }
  });
  it('discards an unfinished file read after the receiving account changes', async () => {
    const fixture=TestBed.createComponent(TrustStatementPreview);
    fixture.componentRef.setInput('account','Test TRUST');
    fixture.detectChanges();
    const component=fixture.componentInstance;
    let finish!: (bytes:ArrayBuffer)=>void;
    const file={name:'test.csv',size:100,arrayBuffer:()=>new Promise<ArrayBuffer>(resolve=>finish=resolve)};
    const task=component.read({target:{files:[file]}} as unknown as Event);
    fixture.componentRef.setInput('account','Another account');
    fixture.detectChanges();
    finish(new TextEncoder().encode(header+'\n'+row).buffer);
    await task;
    expect(component.preview).toBeUndefined();
  });
  it('omits receipts already verified for this account and fits the review controls in both themes', async () => {
    const fixture=TestBed.createComponent(TrustStatementPreview);
    fixture.componentRef.setInput('account','Test TRUST');
    fixture.componentRef.setInput('today','2026-11-27');
    fixture.componentRef.setInput('receipts',[{account:'Test TRUST',bankTransactionId:'tx-1'},{account:'Other',bankTransactionId:'tx-2'}]);
    fixture.detectChanges();
    const component=fixture.componentInstance;
    const file=new File([header+'\n'+row+'\n'+row.replace('tx-1','tx-2')],'test.csv');
    await component.read({target:{files:[file]}} as unknown as Event);
    fixture.detectChanges();
    expect(component.preview?.reasons).toContain({label:'Already verified on this invoice',count:1});
    expect(component.options.length).toBe(1);
    const frame=document.createElement('iframe');
    document.body.appendChild(frame);
    try {
      const doc=frame.contentDocument!;
      for (const style of document.head.querySelectorAll('style')) doc.head.appendChild(style.cloneNode(true));
      doc.body.appendChild(fixture.nativeElement.cloneNode(true));
      doc.querySelector('details')!.open=true;
      for (const width of [375,1280]) {
        frame.style.width=width+'px';
        for (const dark of [false,true]) {
          doc.documentElement.classList.toggle('dark',dark);
          for (const control of doc.querySelectorAll('input,button')) {
            const rect=control.getBoundingClientRect();
            expect(rect.width).toBeGreaterThan(0);
            expect(rect.right).toBeLessThanOrEqual(width);
          }
        }
      }
    } finally {frame.remove();}
  });
  it('checks a saved source against a renamed original, changed bytes and conflicting receipt details', async () => {
    const fixture=TestBed.createComponent(TrustStatementSourceCheck);
    const receipt={account:'Test TRUST',amount:'2742.00',receivedOn:'2026-11-13',reference:'Deposit',bankTransactionId:'tx-1',
      statementSource:{name:'bank.csv',record:2,sha256:'8854cf5f5b6e1aac3e9ada3b139e9d6b86b6051dddde99025beae2a2f9d6823a'}};
    fixture.componentRef.setInput('receipt',receipt);
    fixture.detectChanges();
    const compare=(contents:string)=>fixture.componentInstance.compare({target:{files:[new File([contents],'renamed.csv')]}} as unknown as Event);
    const original=header+'\n'+row;
    await compare(original);
    expect(fixture.componentInstance.message).toContain('file and deposit details match');
    await compare(original+'\n');
    expect(fixture.componentInstance.message).toContain('file contents differ');
    fixture.componentRef.setInput('receipt',{...receipt,amount:'2000.00'});
    fixture.detectChanges();
    await compare(original);
    expect(fixture.componentInstance.message).toContain('deposit details differ');
  });

  it('previews eligible rows locally, fills the draft and verifies only on explicit submission', async () => {
    const verify=jasmine.createSpy().and.returnValue(of({id:'new'}));
    TestBed.configureTestingModule({imports:[TrustReceiptForm],providers:[{provide:StudentOperationsService,useValue:{
      trustReceipts:()=>of([]),verifyTrustReceipt:verify}}]});
    const fixture=TestBed.createComponent(TrustReceiptForm);
    fixture.componentRef.setInput('connection','trust');
    fixture.componentRef.setInput('invoice',{xeroInvoiceId:'inv',currencyCode:'AUD',status:'AUTHORISED',amountDue:2741.80});
    fixture.detectChanges();
    const form=fixture.componentInstance;
    form.account='Test TRUST';
    fixture.detectChanges();
    const component=fixture.debugElement.query(By.directive(TrustStatementPreview)).componentInstance as TrustStatementPreview;
    const file=new File([header+'\n'+row],'bank.csv');
    await component.read({target:{files:[file]}} as unknown as Event);
    expect(component.options.length).toBe(1);
    expect(form.amount).toBe('');
    component.selected='2';
    component.apply();
    expect(form.amount).toBe('2742.00');
    expect(form.date).toBe('2026-11-13');
    expect(form.bankTransactionId).toBe('tx-1');
    expect(form.reference).toBe('Deposit');
    expect(verify).not.toHaveBeenCalled();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('input[name="amount"]').readOnly).toBeTrue();
    const detach=Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button')).find(b=>b.textContent?.includes('Detach source'))!;
    detach.click(); fixture.detectChanges();
    expect(form.statementSource).toBeUndefined();
    expect(fixture.nativeElement.querySelector('input[name="amount"]').readOnly).toBeFalse();
    await component.read({target:{files:[file]}} as unknown as Event);
    component.selected='2'; component.apply();
    form.save();
    expect(form.statementSource).toBeUndefined();
    expect(verify.calls.first().args[2].get('statementFileName')).toBe('bank.csv');
    expect(verify.calls.first().args[2].get('statementRecord')).toBe('2');
    expect(verify.calls.first().args[2].get('statementFileSha256')).toBe('8854cf5f5b6e1aac3e9ada3b139e9d6b86b6051dddde99025beae2a2f9d6823a');
    expect(verify).toHaveBeenCalledTimes(1);
    expect(verify.calls.first().args[2].get('bankTransactionId')).toBe('tx-1');
  });
});
