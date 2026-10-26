import { TestBed } from '@angular/core/testing';
import { of,Subject,throwError } from 'rxjs';
import { CaseInvoiceDraftsComponent } from './case-invoice-drafts.component';
import { StudentOperationsService } from '../student-operations/student-operations.service';
import type { CaseInvoiceDraftData } from '../student-operations/student-operations.types';

const data:CaseInvoiceDraftData={batches:[],preparation:{offerId:'offer',offerVersion:1,caseVersion:3,today:'2026-10-26',student:{name:'Fixture Student',advisorId:null},advisors:[{advisorId:'advisor',code:'S15',name:'Fixture Advisor'}],
  catalogue:{connectionId:'connection',revision:1,lastSyncedAt:'2026-10-26T00:00:00Z',errorCode:null,items:[{itemId:'item',code:'ELICOS ON-SHORE',name:'English onshore',description:'Default course description',unitPrice:'100.0000',accountCode:'812',taxType:'BASEXCLUDED'}],accounts:[{code:'812',name:'Tuition fee',taxType:'BASEXCLUDED'}],taxRates:[{taxType:'BASEXCLUDED',name:'BAS Excluded',rate:'0'}]},
  source:{kind:'letter_of_offer',studentName:'Fixture Student',collegeName:'Fixture College',abn:null,cricosProviderCode:null,currency:'AUD',statedTotalMinor:80000,evidence:[],issues:[],courses:[{name:'English',code:'FIX',startsOn:null,endsOn:null,duration:'8 weeks'}],fees:[],
    instalments:Array.from({length:8},(_,i)=>({sequence:i+1,dueTerm:'Immediately',dueOn:null,totalMinor:i===0?12500:10000,includedConditionalFeeMinor:i===0?2500:0,components:[{label:'Tuition',amountMinor:10000}]}))}}};
describe('CaseInvoiceDraftsComponent',()=>{
  let api:any;
  beforeEach(async()=>{
    api={caseInvoiceDrafts:jasmine.createSpy().and.returnValue(of(structuredClone(data))),prepareCaseInvoiceDrafts:jasmine.createSpy().and.returnValue(of({batchId:'batch',count:8}))};
    await TestBed.configureTestingModule({imports:[CaseInvoiceDraftsComponent],providers:[{provide:StudentOperationsService,useValue:api}]}).compileComponents();
  });
  function setup(){const f=TestBed.createComponent(CaseInvoiceDraftsComponent);f.componentRef.setInput('caseId','case');f.detectChanges();return f;}
  function complete(c:CaseInvoiceDraftsComponent){
    c.form.patchValue({advisorId:'advisor',confirmed:true});
    for(const p of c.form.controls.invoices.controls){p.patchValue({dueDate:'2026-10-26',feeApplies:'no'});p.controls.lines.at(0).controls.itemId.setValue('item');}
  }
  it('renders the active invoice number safely before and after switching instalments',()=>{
    const f=setup(),c=f.componentInstance;expect(c.activeInvoiceNumber).toBe('—');
    c.open();f.detectChanges();expect(f.nativeElement.querySelector('.footer-total').textContent).toContain('INV-1');
    c.activePayment=1;f.detectChanges();expect(f.nativeElement.querySelector('.footer-total').textContent).toContain('INV-2');
    c.form.controls.invoices.clear();f.detectChanges();expect(c.activeInvoiceNumber).toBe('—');
  });
  it('previews eight instalments without saving and requires confirmation of missing data',()=>{
    const f=setup(),c=f.componentInstance;c.open();f.detectChanges();expect(c.form.controls.invoices.length).toBe(8);expect(api.prepareCaseInvoiceDrafts).not.toHaveBeenCalled();
    expect(f.nativeElement.querySelector('[formControlName="category"]')).toBeNull();expect(f.nativeElement.querySelector('[formControlName="location"]')).toBeNull();expect(c.form.controls.invoices.at(0).controls.feeApplies.value).toBe('');
    c.save();expect(api.prepareCaseInvoiceDrafts).not.toHaveBeenCalled();expect(c.message).toContain('Complete');
    expect(f.nativeElement.querySelector('dialog').open).toBeTrue();
  });
  it('saves local drafts only after confirmation, excludes zero optional fees and preserves source amounts',()=>{
    const f=setup(),c=f.componentInstance;c.open();complete(c);c.save();f.detectChanges();
    const value=api.prepareCaseInvoiceDrafts.calls.mostRecent().args[1];expect(value.invoices.length).toBe(8);expect(value.invoices[0].lines.length).toBe(1);expect(value.invoices[0].lines[0].itemCode).toBe('ELICOS ON-SHORE');
    expect(value.invoices[0].conditionalFeeApplies).toBeFalse();expect(value.invoices[0].conditionalFeeMinor).toBe(0);expect(c.data!.preparation!.source.instalments[0].totalMinor).toBe(12500);expect(c.modal.nativeElement.open).toBeFalse();expect(c.message).toContain('No invoices were created in Xero');
    expect(value.catalogueRevision).toBe(1);expect(value.category).toBeUndefined();expect(value.location).toBeUndefined();
  });
  it('protects a pending save and reuses the key when retrying an uncertain response',()=>{
    const f=setup(),c=f.componentInstance;c.open();complete(c);api.prepareCaseInvoiceDrafts.and.returnValue(throwError(()=>({status:0})));c.save();const key=api.prepareCaseInvoiceDrafts.calls.mostRecent().args[2];
    const pending=new Subject<any>();api.prepareCaseInvoiceDrafts.and.returnValue(pending);c.save();expect(api.prepareCaseInvoiceDrafts.calls.mostRecent().args[2]).toBe(key);c.close();expect(c.modal.nativeElement.open).toBeTrue();c.save();expect(api.prepareCaseInvoiceDrafts).toHaveBeenCalledTimes(2);
    pending.next({batchId:'batch',count:8});pending.complete();expect(c.modal.nativeElement.open).toBeFalse();
  });
  it('uses catalogue prices without changing the source tuition amount',()=>{
    const fixtureData=structuredClone(data);fixtureData.preparation!.catalogue!.items[0].unitPrice='180.0000';
    fixtureData.preparation!.source.instalments[0].components=[{label:'Tuition',amountMinor:72000}];
    api.caseInvoiceDrafts.and.returnValue(of(fixtureData));
    const f=setup(),c=f.componentInstance;c.open();
    const line=c.form.controls.invoices.at(0).controls.lines.at(0);line.controls.itemId.setValue('item');
    expect(Number(line.controls.quantity.value)).toBe(4);expect(Number(line.controls.price.value)).toBe(180);
    expect(c.lineAmount(line)).toBe(72000);expect(line.controls.accountCode.value).toBe('812');
  });
  it('fails closed when no synced catalogue is available',()=>{
    const fixtureData=structuredClone(data);fixtureData.preparation!.catalogue=null;
    api.caseInvoiceDrafts.and.returnValue(of(fixtureData));const f=setup(),c=f.componentInstance;c.open();complete(c);c.save();
    expect(api.prepareCaseInvoiceDrafts).not.toHaveBeenCalled();
  });
  it('keeps four-decimal prices and rounds the line only once',()=>{
    const f=setup(),c=f.componentInstance;c.open();const line=c.form.controls.invoices.at(0).controls.lines.at(0);
    line.patchValue({quantity:'3',price:'0.3333'});expect(c.lineAmount(line)).toBe(100);
  });
  it('does not allow preview while the parent case is being edited',()=>{
    const f=setup(),c=f.componentInstance;f.componentRef.setInput('disabled',true);f.detectChanges();c.open();expect(c.modal.nativeElement.open).toBeFalse();
  });
  it('never rebases an open preview onto a background case/offer refresh',()=>{
    const f=setup(),c=f.componentInstance;c.open();complete(c);
    const fresh=structuredClone(data);fresh.preparation!.caseVersion=9;fresh.preparation!.offerId='new-offer';api.caseInvoiceDrafts.and.returnValue(of(fresh));c.load();c.save();
    const payload=api.prepareCaseInvoiceDrafts.calls.mostRecent().args[1];expect(payload.caseVersion).toBe(3);expect(payload.offerId).toBe('offer');
  });
  it('blocks a conflicted preview and reloads only after closing it',()=>{
    const f=setup(),c=f.componentInstance;c.open();complete(c);api.prepareCaseInvoiceDrafts.and.returnValue(throwError(()=>({status:409})));c.save();expect(c.conflict).toBeTrue();
    c.save();expect(api.prepareCaseInvoiceDrafts).toHaveBeenCalledTimes(1);const before=api.caseInvoiceDrafts.calls.count();c.close();expect(api.caseInvoiceDrafts.calls.count()).toBe(before+1);expect(c.modal.nativeElement.open).toBeFalse();
  });
  for(const width of [390,1440])for(const dark of [false,true])it(`keeps preview fields and actions reachable at ${width}px ${dark?'dark':'light'}`,()=>{
    const f=setup(),c=f.componentInstance;c.open();f.detectChanges();const frame=document.createElement('iframe');frame.style.width=`${width}px`;frame.style.height='900px';document.body.appendChild(frame);
    try{const doc=frame.contentDocument!;document.querySelectorAll('style').forEach(s=>doc.head.appendChild(s.cloneNode(true)));doc.documentElement.classList.toggle('dark',dark);
      const host=f.nativeElement.cloneNode(true) as HTMLElement;doc.body.appendChild(host);const dialog=host.querySelector<HTMLDialogElement>('dialog')!;dialog.removeAttribute('open');dialog.showModal();
      expect(dialog.scrollWidth).toBeLessThanOrEqual(dialog.clientWidth+1);const scroll=dialog.querySelector<HTMLElement>('.scroll')!;scroll.scrollTop=scroll.scrollHeight;
      const footer=dialog.querySelector('footer')!;expect(footer.getBoundingClientRect().bottom).toBeLessThanOrEqual(dialog.getBoundingClientRect().bottom+1);
      expect(footer.querySelector('.grand-total')?.textContent).toContain('100.00');
      for(const button of footer.querySelectorAll('button'))expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
      expect(dialog.querySelector('.fields')!.scrollWidth).toBeLessThanOrEqual(dialog.querySelector('.fields')!.clientWidth+1);
    }finally{frame.remove();f.destroy();}
  });
});
