import {TestBed,ComponentFixture} from '@angular/core/testing';
import {of,Subject,throwError} from 'rxjs';
import {SupplierInvoicesComponent} from './supplier-invoices.component';
import {StudentOperationsService} from '../../student-operations/student-operations.service';
import type {XeroStudentInvoiceResult,XeroStudentInvoiceDetail} from '../../student-operations/student-operations.types';

describe('Supplier invoices',()=>{
 let fixture:ComponentFixture<SupplierInvoicesComponent>;
 const invoice={xeroInvoiceId:'invoice',invoiceNumber:'INV-2628',contactName:'2Stay',studentName:'Student',reference:'Student reference',status:'paid',invoiceDate:'2023-01-24',dueDate:'2023-01-24',amountPaid:49.5,amountDue:0,total:49.5,currencyCode:'AUD',sentToContact:true,lineItems:[],advisorName:'Advisor'} as unknown as XeroStudentInvoiceDetail;
 const result={invoices:[invoice],total:5,page:1,limit:25,totalPages:1} as XeroStudentInvoiceResult;
 let api:{xeroStatus:jasmine.Spy;xeroStudentInvoices:jasmine.Spy;xeroStudentInvoice:jasmine.Spy};
 beforeEach(async()=>{
  api={xeroStatus:jasmine.createSpy().and.returnValue(of({connections:[{connectionId:'pty',status:'active',organisationRole:'operating'}]})),xeroStudentInvoices:jasmine.createSpy().and.returnValue(of(result)),xeroStudentInvoice:jasmine.createSpy().and.returnValue(of(invoice))};
  await TestBed.configureTestingModule({imports:[SupplierInvoicesComponent],providers:[{provide:StudentOperationsService,useValue:api}]}).compileComponents();
  fixture=TestBed.createComponent(SupplierInvoicesComponent);fixture.componentRef.setInput('supplierId','supplier');fixture.detectChanges();
 });
 afterEach(()=>fixture.destroy());
 it('loads only mapped supplier invoices and delegates sorting and pagination to the server',()=>{
  expect(api.xeroStudentInvoices).toHaveBeenCalledOnceWith('pty',{supplierId:'supplier',page:1,limit:25,sort:'date',direction:'desc'});
  const c=fixture.componentInstance;c.sortXeroInvoices('paid');expect(api.xeroStudentInvoices.calls.mostRecent().args[1]).toEqual(jasmine.objectContaining({supplierId:'supplier',page:1,sort:'paid',direction:'asc'}));
  c.invoicePageSize.setValue('50');expect(api.xeroStudentInvoices.calls.mostRecent().args[1].limit).toBe(50);
  expect(fixture.nativeElement.textContent).toContain('INV-2628');
 });
 it('opens invoice details with lines and totals',()=>{
  (fixture.nativeElement.querySelector('.invoice-link') as HTMLButtonElement).click();fixture.detectChanges();
  expect(api.xeroStudentInvoice).toHaveBeenCalledWith('pty','invoice');
  const dialog=fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
  expect(dialog.open).toBeTrue();expect(dialog.textContent).toContain('49.50');expect(dialog.textContent).toContain('INV-2628');
  dialog.dispatchEvent(new Event('cancel',{cancelable:true}));fixture.detectChanges();expect(fixture.nativeElement.querySelector('dialog')).toBeNull();
 });
 it('cancels stale supplier and closed detail requests',()=>{
  const stale=new Subject<XeroStudentInvoiceResult>();api.xeroStudentInvoices.and.returnValue(stale);fixture.componentInstance.load();
  api.xeroStudentInvoices.and.returnValue(of({...result,total:0,invoices:[]}));fixture.componentRef.setInput('supplierId','other');fixture.detectChanges();
  stale.next(result);expect(fixture.componentInstance.xeroInvoices?.total).toBe(0);expect(stale.observed).toBeFalse();
  const detail=new Subject<XeroStudentInvoiceDetail>();api.xeroStudentInvoice.and.returnValue(detail);fixture.componentInstance.openInvoiceDetail(invoice);fixture.componentInstance.closeInvoiceDetail();detail.next(invoice);expect(fixture.componentInstance.selectedXeroInvoice).toBeNull();expect(detail.observed).toBeFalse();
 });
 it('reports failures without treating an error as an empty invoice list and can retry',()=>{
  const c=fixture.componentInstance;spyOn(c.failed,'emit');spyOn(c.availability,'emit');api.xeroStudentInvoices.and.returnValue(throwError(()=>({status:500})));c.load();
  expect(c.failed.emit).toHaveBeenCalled();expect(c.availability.emit).not.toHaveBeenCalled();
  api.xeroStudentInvoices.and.returnValue(of(result));c.load();expect(c.availability.emit).toHaveBeenCalledWith(5);
 });
 for(const width of [390,1440])for(const dark of [false,true])it(`renders invoices and details at ${width}px in ${dark?'dark':'light'} mode`,()=>{
  fixture.componentInstance.openInvoiceDetail(invoice);fixture.detectChanges();const frame=document.createElement('iframe');frame.style.width=`${width}px`;frame.style.height='650px';document.body.appendChild(frame);
  try{const doc=frame.contentDocument!,win=frame.contentWindow!;document.querySelectorAll('style').forEach(s=>doc.head.appendChild(s.cloneNode(true)));doc.documentElement.classList.toggle('dark',dark);doc.body.style.margin='0';doc.body.appendChild(fixture.nativeElement.cloneNode(true));
   const dialog=doc.querySelector('dialog') as HTMLDialogElement;dialog.close();dialog.showModal();
   const section=doc.querySelector('.supplier-invoices') as HTMLElement;expect(section.scrollWidth).toBeLessThanOrEqual(section.clientWidth+1);
   expect(win.getComputedStyle(doc.querySelector('.invoice-table thead')!).display).toBe(width===390?'none':'table-header-group');
   const close=doc.querySelector('.dialog-close') as HTMLElement;expect(close.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);expect(close.getBoundingClientRect().bottom).toBeLessThanOrEqual(650);
   expect(win.getComputedStyle(section).backgroundColor).toBe(dark?'rgb(17, 27, 43)':'rgb(255, 255, 255)');
  }finally{frame.remove();}
 });
});
