import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {of,Subject,throwError} from 'rxjs';
import {PaymentCaseInvoices} from './payment-case-invoices.component';
import {StudentOperationsService} from '../student-operations.service';

describe('Case invoices inside payment review',()=>{
  const row={invoiceId:'same',invoiceNumber:'INV-1',organisation:'TRUST',connectionId:'trust',coverage:'imported',
    amountPaid:'0',amountDue:'25',currency:'AUD'};
  const other={...row,organisation:'PTY',connectionId:'pty',coverage:'awaiting_import',amountPaid:null,amountDue:null};
  function setup() {
    const list=jasmine.createSpy().and.returnValue(of({invoices:[row,other],page:1,total:2,limit:25}));
    const detail=jasmine.createSpy().and.returnValue(of({invoiceId:'same',invoiceNumber:'INV-1',status:'PAID',lineItems:[{description:'College commission'}]}));
    TestBed.configureTestingModule({imports:[PaymentCaseInvoices],providers:[provideRouter([]),{provide:StudentOperationsService,
      useValue:{caseInvoices:list,caseInvoiceDetail:detail}}]});
    const f=TestBed.createComponent(PaymentCaseInvoices);
    f.componentRef.setInput('caseId','first');f.componentRef.setInput('reference','CASE-1');f.detectChanges();
    const buttons=(label:string)=>Array.from<HTMLButtonElement>(f.nativeElement.querySelectorAll('button')).filter(b=>b.textContent?.trim()===label);
    const click=(label:string,index=0)=>{buttons(label)[index].click();f.detectChanges();};
    return {f,list,detail,click};
  }
  it('opens the confirmed organisation identity on demand and returns without reloading the queue',()=>{
    const {f,list,detail,click}=setup();expect(list).not.toHaveBeenCalled();
    click('Case CASE-1 · linked invoices');expect(list).toHaveBeenCalledOnceWith('first',1,'both');
    expect(f.nativeElement.textContent).toContain('Awaiting import');expect(f.nativeElement.textContent).toContain('Unknown');
    click('INV-1',1);expect(detail).toHaveBeenCalledOnceWith('first','pty','same');
    expect(f.nativeElement.textContent).toContain('College commission');
    expect(f.nativeElement.querySelector('a').getAttribute('href')).toBe('/manager/students/cases/first');
    click('Return to receipt or invoice');expect(f.nativeElement.querySelector('table')).toBeNull();
    expect(list.calls.count()).toBe(1);
  });
  it('retries failed reads and cancels obsolete detail when the case changes',()=>{
    const {f,list,detail,click}=setup();list.and.returnValues(throwError(()=>({status:503})),of({invoices:[row],total:1,page:1,limit:25}));
    click('Case CASE-1 · linked invoices');click('Retry case invoices');
    const pending=new Subject();detail.and.returnValues(throwError(()=>({status:503})),pending);
    click('INV-1');click('Retry document');expect(pending.observed).toBeTrue();
    f.componentRef.setInput('caseId','second');f.detectChanges();expect(pending.observed).toBeFalse();
    expect(f.nativeElement.querySelector('table')).toBeNull();
  });
  it('shows linked invoices as mobile cards and a desktop table in both themes',()=>{
    const {f,click}=setup();click('Case CASE-1 · linked invoices');
    const frame=document.createElement('iframe');document.body.appendChild(frame);
    try {
      const doc=frame.contentDocument!;
      for(const style of document.head.querySelectorAll('style'))doc.head.appendChild(style.cloneNode(true));
      doc.body.appendChild(f.nativeElement.cloneNode(true));
      for(const width of [375,1280]){
        frame.style.width=width+'px';
        for(const dark of [false,true]){
          doc.documentElement.classList.toggle('dark',dark);
          expect(frame.contentWindow!.getComputedStyle(doc.querySelector('thead')!).display==='none').toBe(width===375);
          expect(doc.querySelector('table')!.getBoundingClientRect().right).toBeLessThanOrEqual(width);
        }
      }
    } finally {frame.remove();}
  });
});
