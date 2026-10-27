import { TestBed } from '@angular/core/testing';
import { of,Subject,throwError } from 'rxjs';
import { CaseInvoiceDraftsComponent } from './case-invoice-drafts.component';
import { StudentOperationsService } from '../student-operations/student-operations.service';
import type { CaseInvoiceDraftData } from '../student-operations/student-operations.types';

const data:CaseInvoiceDraftData={batches:[],canCreateXero:true,preparation:{offerId:'offer',offerVersion:1,caseVersion:3,today:'2026-10-26',student:{name:'Fixture Student',advisorId:null},advisors:[{advisorId:'advisor',code:'S15',name:'Fixture Advisor'}],
  catalogue:{connectionId:'connection',revision:1,lastSyncedAt:'2026-10-26T00:00:00Z',errorCode:null,items:[{itemId:'item',code:'ELICOS ON-SHORE',name:'English onshore',description:'Default course description',unitPrice:'100.0000',accountCode:'812',taxType:'BASEXCLUDED'}],accounts:[{code:'812',name:'Tuition fee',taxType:'BASEXCLUDED'}],taxRates:[{taxType:'BASEXCLUDED',name:'BAS Excluded',rate:'0'}]},
  savedBatch:null,
  source:{kind:'letter_of_offer',studentName:'Fixture Student',collegeName:'Fixture College',campusAddress:'16 Cook St, MORTDALE, NSW, 2223',abn:null,cricosProviderCode:null,currency:'AUD',statedTotalMinor:80000,evidence:[],issues:[],courses:[{name:'General English',code:'FIX',startsOn:'2027-01-25',endsOn:null,duration:'48 weeks'}],fees:[{label:'Total Tuition Fee',amountMinor:480000,conditional:false,condition:null}],
    instalments:Array.from({length:8},(_,i)=>({sequence:i+1,dueTerm:'Immediately',dueOn:null,totalMinor:i===0?12500:10000,includedConditionalFeeMinor:i===0?2500:0,components:[{label:'Tuition',amountMinor:10000}]}))}}};
function savedData(exports:CaseInvoiceDraftData['batches'][number]['exports']={}):CaseInvoiceDraftData{
  const fixture=structuredClone(data),invoices=fixture.preparation!.source.instalments.map(source=>({sequence:source.sequence,issueDate:'2026-10-26',dueDate:'2026-10-26',conditionalFeeApplies:false,conditionalFeeMinor:0,
    lines:[{kind:'tuition' as const,description:`Saved tuition ${source.sequence}`,itemId:'item',itemCode:'ELICOS ON-SHORE',quantity:'1.00',unitPrice:'100.00',unitAmountMinor:10000,taxAmountMinor:0,amountMinor:10000,accountCode:'812',taxType:'BASEXCLUDED'}],
    invoiceNumber:`INV-${source.sequence}`,status:'DRAFT' as const,paymentTrack:'PENDING' as const,sourceTotalMinor:source.totalMinor,sourceDueDate:source.dueOn,sourceDueTerm:source.dueTerm,
    sourceIncludedConditionalFeeMinor:source.includedConditionalFeeMinor,expectedTotalMinor:10000,differenceMinor:0,totalMinor:10000,subtotalMinor:10000,taxMinor:0}));
  const snapshot={studentName:'Fixture Student',advisorLabel:'S15 Fixture Advisor',category:null,location:null,billingUnit:null,currency:'AUD',collegeName:'Fixture College',reviewNote:'Persisted note',invoices};
  const batch={batchId:'batch',offerId:'offer',advisorId:'advisor',revision:3,currentOffer:true,createdAt:'2026-10-26T00:00:00Z',exports,snapshot};
  fixture.batches=[batch];fixture.preparation!.savedBatch={batchId:'batch',revision:3,advisorId:'advisor',exports,snapshot};return fixture;
}
describe('CaseInvoiceDraftsComponent',()=>{
  let api:any;
  beforeEach(async()=>{
    api={caseInvoiceDrafts:jasmine.createSpy().and.returnValue(of(structuredClone(data))),prepareCaseInvoiceDrafts:jasmine.createSpy().and.returnValue(of({batchId:'batch',count:8,revision:1,updatedAt:'2026-10-26T00:00:00Z'})),createCaseXeroInvoices:jasmine.createSpy().and.callFake((_caseId:string,_batchId:string,sequences:number[])=>of({created:sequences.length,skipped:0,results:sequences.map(sequence=>({sequence,status:'created',invoiceId:`xero-${sequence}`,invoiceNumber:`XERO-${sequence}`}))}))};
    await TestBed.configureTestingModule({imports:[CaseInvoiceDraftsComponent],providers:[{provide:StudentOperationsService,useValue:api}]}).compileComponents();
  });
  function setup(){const f=TestBed.createComponent(CaseInvoiceDraftsComponent);f.componentRef.setInput('caseId','case');f.detectChanges();return f;}
  function complete(c:CaseInvoiceDraftsComponent,confirmed=true){
    c.form.patchValue({advisorId:'advisor',confirmed});
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
  it('defaults both dates to today and formats the editable course, campus and start-date description',()=>{
    const c=setup().componentInstance;c.open();const first=c.form.controls.invoices.at(0);
    expect(first.controls.issueDate.value).toBe('2026-10-26');expect(first.controls.dueDate.value).toBe('2026-10-26');
    expect(first.controls.lines.at(0).controls.description.value).toBe('Course Name: GENERAL ENGLISH - 48 weeks\nCampus: 16 Cook St, MORTDALE, NSW, 2223\nStart Date: 25 Jan 2027');
    const withoutAddress=structuredClone(data);delete withoutAddress.preparation!.source.campusAddress;api.caseInvoiceDrafts.and.returnValue(of(withoutAddress));const other=setup().componentInstance;other.open();expect(other.form.controls.invoices.at(0).controls.lines.at(0).controls.description.value).toContain('\nCampus: \n');
    const legacy=structuredClone(withoutAddress);legacy.preparation!.source.evidence=[{page:1,quote:'Address: 16 Cook St, MORTDALE, NSW, 2223'}];api.caseInvoiceDrafts.and.returnValue(of(legacy));const fallback=setup().componentInstance;fallback.open();expect(fallback.form.controls.invoices.at(0).controls.lines.at(0).controls.description.value).toContain('\nCampus: 16 Cook St, MORTDALE, NSW, 2223\n');
  });
  it('requires review confirmation and creates either the active Xero invoice or all invoices after saving one immutable batch',()=>{
    const f=setup(),c=f.componentInstance;c.open();f.detectChanges();expect(f.nativeElement.querySelector('.review-action .xero').disabled).toBeTrue();complete(c);f.detectChanges();
    expect(f.nativeElement.querySelector('.review-action .xero').disabled).toBeFalse();c.activePayment=2;c.createCurrent();
    expect(api.prepareCaseInvoiceDrafts).toHaveBeenCalledTimes(1);expect(api.createCaseXeroInvoices).toHaveBeenCalledWith('case','batch',[3]);expect(c.modal.nativeElement.open).toBeTrue();expect(c.activeInvoiceNumber).toBe(1);
    f.detectChanges();expect(f.nativeElement.querySelector('.payment-tabs').textContent).not.toContain('INV-3');expect(f.nativeElement.querySelector('.payment-tabs').textContent).toContain('INV-1');
    const second=setup().componentInstance;second.open();complete(second);second.createAll();expect(api.createCaseXeroInvoices).toHaveBeenCalledWith('case','batch',[1,2,3,4,5,6,7,8]);expect(second.modal.nativeElement.open).toBeFalse();
  });
  it('keeps a pre-send failure editable and shows the connector setup reason',()=>{
    api.createCaseXeroInvoices.and.returnValue(of({created:0,skipped:1,results:[{sequence:1,status:'not_attempted',errorCode:'xero_invoice_write_scope_missing',message:'An administrator must reconnect Xero and authorize invoice creation.'}]}));
    const f=setup(),c=f.componentInstance;c.open();complete(c);c.createCurrent();f.detectChanges();
    expect(c.modal.nativeElement.open).toBeTrue();expect(c.activeInvoiceNumber).toBe(1);expect(c.message).toContain('reconnect Xero');expect(f.nativeElement.querySelector('.payment-tabs').textContent).toContain('INV-1');
  });
  it('uses the shared overlay loader and keeps action labels stable while creation is pending',()=>{
    const pending=new Subject<any>();api.createCaseXeroInvoices.and.returnValue(pending);const f=setup(),c=f.componentInstance;c.open();complete(c);c.createCurrent();f.detectChanges();
    expect(f.nativeElement.querySelector('app-manager-list-loader.overlay-host')).not.toBeNull();expect(f.nativeElement.querySelector('app-manager-list-loader').textContent).toContain('Creating Xero invoice');
    expect(Array.from(f.nativeElement.querySelectorAll('button')).some((button:any)=>button.textContent.trim()==='Creating…')).toBeFalse();
    pending.next({created:1,skipped:0,results:[{sequence:1,status:'created'}]});pending.complete();
  });
  it('saves local drafts, excludes zero optional fees and preserves source amounts',()=>{
    const f=setup(),c=f.componentInstance;c.open();complete(c);c.save();f.detectChanges();
    const value=api.prepareCaseInvoiceDrafts.calls.mostRecent().args[1];expect(value.invoices.length).toBe(8);expect(value.invoices[0].lines.length).toBe(1);expect(value.invoices[0].lines[0].itemCode).toBe('ELICOS ON-SHORE');
    expect(value.invoices[0].conditionalFeeApplies).toBeFalse();expect(value.invoices[0].conditionalFeeMinor).toBe(0);expect(c.data!.preparation!.source.instalments[0].totalMinor).toBe(12500);expect(c.modal.nativeElement.open).toBeTrue();expect(c.message).toContain('continue reviewing');
    expect(value.catalogueRevision).toBe(1);expect(value.category).toBeUndefined();expect(value.location).toBeUndefined();
  });
  it('saves complete Sophia drafts without requiring the Xero creation confirmation',()=>{
    const f=setup(),c=f.componentInstance;c.open();complete(c,false);c.save();
    expect(api.prepareCaseInvoiceDrafts).toHaveBeenCalledTimes(1);expect(api.createCaseXeroInvoices).not.toHaveBeenCalled();
    expect(c.message).toContain('continue reviewing');expect(c.modal.nativeElement.open).toBeTrue();
  });
  it('keeps saved but uncreated proposals out of the table and reopens their persisted editable values',()=>{
    api.caseInvoiceDrafts.and.returnValue(of(savedData()));const f=setup(),c=f.componentInstance;f.detectChanges();
    expect(c.canPrepare).toBeTrue();expect(f.nativeElement.querySelector('.draft-section table')).toBeNull();
    c.open();f.detectChanges();expect(c.form.controls.reviewNote.value).toBe('Persisted note');expect(c.form.controls.advisorId.value).toBe('advisor');
    expect(c.form.controls.invoices.at(1).controls.lines.at(0).controls.description.value).toBe('Saved tuition 2');
    c.form.controls.invoices.at(1).controls.lines.at(0).controls.description.setValue('Updated before Xero');c.save();
    const request=api.prepareCaseInvoiceDrafts.calls.mostRecent().args[1];expect(request.invoices[1].lines[0].description).toBe('Updated before Xero');expect(request).toEqual(jasmine.objectContaining({draftBatchId:'batch',draftRevision:3}));expect(c.modal.nativeElement.open).toBeTrue();
  });
  it('shows only created invoices in the table and opens them read-only',()=>{
    const fixture=savedData({'1':{status:'created',invoiceId:'xero-id',invoiceNumber:'XERO-1'}});api.caseInvoiceDrafts.and.returnValue(of(fixture));
    const f=setup(),c=f.componentInstance;f.detectChanges();const rows=f.nativeElement.querySelectorAll('.draft-section tbody tr');expect(rows.length).toBe(1);expect(rows[0].textContent).toContain('Created in Xero');
    c.open();f.detectChanges();expect(c.activeInvoiceNumber).toBe(2);expect(c.form.controls.advisorId.disabled).toBeTrue();expect(f.nativeElement.querySelector('.payment-tabs').textContent).not.toContain('INV-1');expect(f.nativeElement.querySelector('.payment-tabs').textContent).toContain('INV-2');
    c.close();(f.nativeElement.querySelector('.draft-section .link') as HTMLButtonElement).click();f.detectChanges();
    expect(f.nativeElement.querySelector('dialog header h2').textContent).toContain('INV-1');expect(f.nativeElement.querySelector('dialog .xero')).toBeNull();expect(f.nativeElement.querySelector('dialog').textContent).toContain('Created in Xero as XERO-1');
  });
  it('keeps review-required invoices inside the preparation modal and out of the created table',()=>{
    const fixture=savedData({'1':{status:'review_required',invoiceId:null,invoiceNumber:null}});api.caseInvoiceDrafts.and.returnValue(of(fixture));
    const f=setup(),c=f.componentInstance;f.detectChanges();expect(f.nativeElement.querySelector('.draft-section table')).toBeNull();
    c.open();f.detectChanges();expect(c.activeInvoiceNumber).toBe(2);expect(f.nativeElement.querySelector('.payment-tabs').textContent).toContain('INV-1 · Review');
    const reviewButtons=Array.from(f.nativeElement.querySelectorAll('.payment-tabs button')) as HTMLButtonElement[];const reviewButton=reviewButtons.find(button=>button.textContent?.includes('INV-1'))!;reviewButton.click();f.detectChanges();
    expect(c.activeNeedsReview).toBeTrue();expect(c.form.controls.invoices.at(0).disabled).toBeTrue();expect(f.nativeElement.querySelector('fieldset:not([hidden]) .notice').textContent).toContain('did not confirm');expect(f.nativeElement.querySelector('.review-action .xero').disabled).toBeTrue();
  });
  it('keeps an ambiguous Xero result in the modal while advancing to another editable invoice',()=>{
    api.createCaseXeroInvoices.and.returnValue(of({created:0,skipped:1,results:[{sequence:1,status:'review_required'}]}));
    const f=setup(),c=f.componentInstance;c.open();complete(c);c.createCurrent();f.detectChanges();
    expect(c.modal.nativeElement.open).toBeTrue();expect(c.activeInvoiceNumber).toBe(2);expect(f.nativeElement.querySelector('.payment-tabs').textContent).toContain('INV-1 · Review');expect(f.nativeElement.querySelector('.draft-section table')).toBeNull();
  });
  it('still requires confirmation before either Xero creation action',()=>{
    const current=setup().componentInstance;current.open();complete(current,false);current.createCurrent();
    expect(api.prepareCaseInvoiceDrafts).not.toHaveBeenCalled();expect(current.message).toContain('confirmation checkbox');
    const all=setup().componentInstance;all.open();complete(all,false);all.createAll();
    expect(api.prepareCaseInvoiceDrafts).not.toHaveBeenCalled();expect(all.message).toContain('confirmation checkbox');
  });
  it('protects a pending save and reuses the key when retrying an uncertain response',()=>{
    const f=setup(),c=f.componentInstance;c.open();complete(c);api.prepareCaseInvoiceDrafts.and.returnValue(throwError(()=>({status:0})));c.save();const key=api.prepareCaseInvoiceDrafts.calls.mostRecent().args[2];
    const pending=new Subject<any>();api.prepareCaseInvoiceDrafts.and.returnValue(pending);c.save();expect(api.prepareCaseInvoiceDrafts.calls.mostRecent().args[2]).toBe(key);c.close();expect(c.modal.nativeElement.open).toBeTrue();c.save();expect(api.prepareCaseInvoiceDrafts).toHaveBeenCalledTimes(2);
    pending.next({batchId:'batch',count:8,revision:1,updatedAt:'2026-10-26T00:00:00Z'});pending.complete();expect(c.modal.nativeElement.open).toBeTrue();
  });
  it('applies the first tuition item to every draft and prices ELICOS from total tuition per week',()=>{
    const fixtureData=structuredClone(data);fixtureData.preparation!.catalogue!.items.push({itemId:'other',code:'OTHER',name:'Manual override',description:'',unitPrice:'180.0000',accountCode:'812',taxType:'BASEXCLUDED'});
    fixtureData.preparation!.source.fees[0].amountMinor=864000;
    const quantities=[4,6,6,6,6,6,6,8];fixtureData.preparation!.source.instalments.forEach((payment,index)=>payment.components=[{label:'Tuition',amountMinor:quantities[index]*18000}]);
    api.caseInvoiceDrafts.and.returnValue(of(fixtureData));
    const f=setup(),c=f.componentInstance;c.open();
    const line=c.form.controls.invoices.at(0).controls.lines.at(0);line.controls.itemId.setValue('item');
    expect(line.controls.quantity.value).toBe('4.00');expect(line.controls.price.value).toBe('180.00');
    expect(c.lineAmount(line)).toBe(72000);expect(line.controls.accountCode.value).toBe('812');
    expect(c.form.controls.invoices.controls.map(payment=>payment.controls.lines.at(0).controls.itemId.value)).toEqual(Array(8).fill('item'));
    expect(c.form.controls.invoices.controls.map(payment=>Number(payment.controls.lines.at(0).controls.quantity.value))).toEqual(quantities);
    c.form.controls.invoices.at(1).controls.lines.at(0).controls.itemId.setValue('other');
    expect(c.form.controls.invoices.at(1).controls.lines.at(0).controls.itemId.value).toBe('other');expect(c.form.controls.invoices.at(2).controls.lines.at(0).controls.itemId.value).toBe('item');
  });
  it('applies the first conditional-fee choice to every draft while allowing later overrides',()=>{
    const c=setup().componentInstance;c.open();const invoices=c.form.controls.invoices.controls;
    invoices[0].controls.feeApplies.setValue('yes');
    expect(invoices.map(invoice=>invoice.controls.feeApplies.value)).toEqual(Array(8).fill('yes'));
    expect(invoices[1].controls.fee.value).toBe('25.00');
    invoices[1].controls.feeApplies.setValue('no');
    expect(invoices[1].controls.feeApplies.value).toBe('no');expect(invoices[2].controls.feeApplies.value).toBe('yes');
    invoices[0].controls.feeApplies.setValue('no');
    expect(invoices.map(invoice=>invoice.controls.feeApplies.value)).toEqual(Array(8).fill('no'));
  });
  it('uses one tuition-bearing instalment as a term or semester when no explicit count is present',()=>{
    for(const code of ['VET ON-SHORE','HIGHER EDUCATION']){
      const fixtureData=structuredClone(data);fixtureData.preparation!.catalogue!.items[0].code=code;fixtureData.preparation!.source.courses[0].duration='52 weeks';
      fixtureData.preparation!.source.fees[0].amountMinor=800000;fixtureData.preparation!.source.instalments=fixtureData.preparation!.source.instalments.slice(0,4);
      fixtureData.preparation!.source.instalments.forEach(payment=>payment.components=[{label:'Tuition',amountMinor:200000}]);api.caseInvoiceDrafts.and.returnValue(of(fixtureData));
      const component=setup().componentInstance;component.open();component.form.controls.invoices.at(0).controls.lines.at(0).controls.itemId.setValue('item');
      for(const payment of component.form.controls.invoices.controls){const tuition=payment.controls.lines.at(0);expect(tuition.controls.quantity.value).toBe('1.00');expect(tuition.controls.price.value).toBe('2000.00');}
      component.ngOnDestroy();
    }
  });
  it('shows the review note without disclosure interaction and uses the shorter save label',()=>{
    const f=setup(),c=f.componentInstance;c.open();f.detectChanges();
    expect(f.nativeElement.querySelector('details')).toBeNull();expect(f.nativeElement.querySelector('.review-note textarea')).not.toBeNull();
    expect(Array.from(f.nativeElement.querySelectorAll('button')).some((button:any)=>button.textContent.trim()==='Save drafts')).toBeTrue();
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
