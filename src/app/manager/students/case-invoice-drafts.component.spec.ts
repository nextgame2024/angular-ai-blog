import { TestBed } from '@angular/core/testing';
import { of,Subject,throwError } from 'rxjs';
import { CaseInvoiceDraftsComponent } from './case-invoice-drafts.component';
import { StudentOperationsService } from '../student-operations/student-operations.service';
import type { CaseInvoiceDraftData } from '../student-operations/student-operations.types';

const data:CaseInvoiceDraftData={batches:[],canCreateXero:true,preparation:{offerId:'offer',offerVersion:1,caseVersion:3,today:'2026-10-26',student:{name:'Fixture Student',advisorId:null},advisors:[{advisorId:'advisor',code:'S15',name:'Fixture Advisor'}],
  colleges:[{collegeId:'case-college',name:'Australian College of Commerce & Information Technology Pty Ltd',isPrimary:true},{collegeId:'offer-college',name:'East Coast College Pty. Ltd',isPrimary:false}],
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
    api={caseInvoiceDrafts:jasmine.createSpy().and.returnValue(of(structuredClone(data))),prepareCaseInvoiceDrafts:jasmine.createSpy().and.returnValue(of({batchId:'batch',count:8,revision:1,updatedAt:'2026-10-26T00:00:00Z'})),createCaseXeroInvoices:jasmine.createSpy().and.callFake((_caseId:string,_batchId:string,sequences:number[])=>of({created:sequences.length,skipped:0,results:sequences.map(sequence=>({sequence,status:'created',invoiceId:`xero-${sequence}`,invoiceNumber:`XERO-${sequence}`}))})),reconcileCaseXeroInvoice:jasmine.createSpy().and.returnValue(of({created:1,skipped:0,results:[{sequence:1,status:'created',invoiceId:'xero-1',invoiceNumber:'INV-10577',message:'Confirmed against the exact invoice in Xero.'}]}))};
    api.commissionOptions=jasmine.createSpy().and.returnValue(of({available:false,issue:null}));
    api.commissionDrafts=jasmine.createSpy().and.returnValue(of({items:[]}));
    api.prepareCommissions=jasmine.createSpy().and.returnValue(of({prepared:8}));
    api.createPairedInvoices=jasmine.createSpy().and.returnValue(of({trust:{created:0,skipped:0,results:[]},pty:{created:0,skipped:0,results:[]}}));
    api.reconcileCommission=jasmine.createSpy().and.returnValue(of({created:0,skipped:0,results:[]}));
    api.caseInvoiceDetail=jasmine.createSpy().and.returnValue(of({invoiceId:'xero-id',invoiceNumber:'XERO-1',studentName:'Fixture Student',advisorName:'Fixture Advisor',reference:'Fixture College',status:'PAID',type:'ACCREC',date:'2026-10-26',dueDate:'2026-10-26',currency:'AUD',total:'100',amountPaid:'100',amountDue:'0',paymentTrack:'Paid out',lineItems:[]}));
    api.manualCaseInvoiceOptions=jasmine.createSpy().and.returnValue(of({caseVersion:3,advisors:data.preparation!.advisors,student:data.preparation!.student,catalogue:data.preparation!.catalogue,
      colleges:[{collegeId:'college',name:'Fixture College'}],brandingThemes:[{brandingThemeId:'theme',name:'Fixture Theme'}]}));
    api.prepareManualCaseInvoice=jasmine.createSpy().and.returnValue(of({batchId:'manual-batch',count:1,revision:1}));
    api.caseInvoiceEditOptions=jasmine.createSpy().and.returnValue(of({caseVersion:3,advisors:data.preparation!.advisors,student:data.preparation!.student,catalogue:data.preparation!.catalogue,colleges:[{collegeId:'college',name:'Fixture College'}],brandingThemes:[{brandingThemeId:'theme',name:'Theme'}],expectedFingerprint:'fingerprint',invoice:{invoiceId:'existing',invoiceNumber:'INV-42',status:'SUBMITTED',invoiceDate:'2026-10-28',dueDate:'2026-11-04',currencyCode:'AUD',invoiceReference:'Fixture College',brandingThemeId:'theme',advisorName:'S15 Fixture Advisor',paymentTrack:'Pending',lineItems:[{lineItemId:'original-line',itemCode:'ELICOS ON-SHORE',description:'Existing tuition',quantity:2,unitAmount:50,accountCode:'812',taxType:'BASEXCLUDED',taxAmount:0,tracking:[]}]}}));
    api.updateCaseInvoice=jasmine.createSpy().and.returnValue(of({invoiceId:'existing',status:'updated'}));
    await TestBed.configureTestingModule({imports:[CaseInvoiceDraftsComponent],providers:[{provide:StudentOperationsService,useValue:api}]}).compileComponents();
  });
  function setup(){const f=TestBed.createComponent(CaseInvoiceDraftsComponent);f.componentRef.setInput('caseId','case');f.detectChanges();return f;}
  it('opens the affected TRUST instalment when the server requires a review note',()=>{
    api.prepareCaseInvoiceDrafts.and.returnValue(throwError(()=>({status:400,error:{errorCode:'invoice_review_note_required',sequence:2,message:'INV-2 (TRUST): Explain the difference.'}})));
    const c=setup().componentInstance;c.open();complete(c);c.save();
    expect(c.activePayment).toBe(1);expect(c.ptySide).toBeFalse();
    expect(c.message).toContain('INV-2 (TRUST)');expect(c.form.controls.reviewNote.touched).toBeTrue();
    expect(api.createCaseXeroInvoices).not.toHaveBeenCalled();
  });
  it('defaults an additional conditional transfer fee from the approved fee list',()=>{
    const fixture=structuredClone(data);fixture.preparation!.source.fees.push({label:'Transfer fee',amountMinor:2500,conditional:true,condition:'When applicable'});
    fixture.preparation!.source.instalments.forEach(i=>i.includedConditionalFeeMinor=0);
    api.caseInvoiceDrafts.and.returnValue(of(fixture));const c=setup().componentInstance;c.open();
    expect(c.form.controls.invoices.at(1).controls.fee.value).toBe('25.00');
  });
  it('preselects the case college, lists all colleges and saves the operator selection for offer invoices',()=>{
    const fixture=structuredClone(data);fixture.preparation!.source.collegeName='East Coast College Pty. Ltd';
    api.caseInvoiceDrafts.and.returnValue(of(fixture));
    const f=setup(),c=f.componentInstance;c.open();f.detectChanges();
    expect(c.manualCollege.value).toBe('case-college');expect(c.collegeOptions.length).toBe(2);
    const select=f.nativeElement.querySelector('[aria-label="Reference / College"]') as HTMLButtonElement;
    expect(select.textContent).toContain('Australian College of Commerce');expect(select.disabled).toBeFalse();
    select.click();f.detectChanges();
    const options=Array.from(f.nativeElement.querySelectorAll('.select-option')) as HTMLButtonElement[];
    expect(options.map(option=>option.textContent)).toEqual(jasmine.arrayContaining([jasmine.stringMatching('Australian College'),jasmine.stringMatching('East Coast')]));
    options.find(option=>option.textContent?.includes('East Coast'))!.click();
    const pending=new Subject<any>();api.prepareCaseInvoiceDrafts.and.returnValue(pending);
    complete(c);c.save();f.detectChanges();expect(select.disabled).toBeTrue();
    expect(api.prepareCaseInvoiceDrafts.calls.mostRecent().args[1].collegeId).toBe('offer-college');
    pending.next({batchId:'batch',count:8,revision:1});pending.complete();f.detectChanges();expect(select.disabled).toBeFalse();
    expect(c.preparation!.source.collegeName).toBe('East Coast College Pty. Ltd');
  });
  it('retains an explicitly saved invoice college and corrects legacy drafts without a selection',()=>{
    const fixture=savedData();fixture.preparation!.savedBatch!.snapshot.collegeId='offer-college';
    api.caseInvoiceDrafts.and.returnValue(of(fixture));const c=setup().componentInstance;c.open();
    expect(c.manualCollege.value).toBe('offer-college');c.close();
    api.caseInvoiceDrafts.and.returnValue(of(savedData()));c.load();c.open();expect(c.manualCollege.value).toBe('case-college');
  });
  it('requires an available college when the case has none and never selects the first list entry',()=>{
    const fixture=structuredClone(data);fixture.preparation!.colleges!.forEach(college=>college.isPrimary=false);
    api.caseInvoiceDrafts.and.returnValue(of(fixture));const c=setup().componentInstance;c.open();complete(c);c.save();
    expect(c.manualCollege.value).toBe('');expect(api.prepareCaseInvoiceDrafts).not.toHaveBeenCalled();expect(c.message).toContain('Select an available college');
    c.manualCollege.setValue('unavailable');c.save();expect(api.prepareCaseInvoiceDrafts).not.toHaveBeenCalled();
  });
  it('edits an existing invoice with its saved values and line identity, then returns to the refreshed list',()=>{
    const f=setup(),c=f.componentInstance;spyOn(c.changed,'emit');c.openEdit('connection','existing');f.detectChanges();
    expect(f.nativeElement.querySelector('dialog h2').textContent).toBe('Edit INV-42');
    expect(c.form.controls.advisorId.value).toBe('advisor');expect(c.manualCollege.value).toBe('college');
    expect(c.activeInvoice.controls.issueDate.value).toBe('2026-10-28');expect(c.activeInvoice.controls.dueDate.value).toBe('2026-11-04');
    const line=c.activeInvoice.controls.lines.at(0);expect(line.getRawValue()).toEqual(jasmine.objectContaining({lineItemId:'original-line',quantity:'2',price:'50.00',description:'Existing tuition'}));
    line.controls.price.setValue('75.00');c.form.controls.confirmed.setValue(true);c.createAll();
    const args=api.updateCaseInvoice.calls.mostRecent().args;
    expect(args.slice(0,3)).toEqual(['case','connection','existing']);expect(args[3]).toEqual(jasmine.objectContaining({expectedFingerprint:'fingerprint',advisorId:'advisor',collegeId:'college',confirmed:true,lines:[jasmine.objectContaining({lineItemId:'original-line',unitPrice:'75.00'})]}));
    expect(api.prepareManualCaseInvoice).not.toHaveBeenCalled();expect(api.createCaseXeroInvoices).not.toHaveBeenCalled();
    expect(c.modal.nativeElement.open).toBeFalse();expect(c.changed.emit).toHaveBeenCalledTimes(1);
  });
  it('edits PTY using its college recipient and student reference without TRUST payment tracking',()=>{
    const options=api.caseInvoiceEditOptions('case','pty','existing') as any;
    let fixture:any;options.subscribe((v:any)=>fixture=structuredClone(v));api.caseInvoiceEditOptions.calls.reset();
    fixture.organisation='PTY';fixture.contactName='Fixture College - 2';fixture.invoice.invoiceReference='Student Reference';fixture.invoice.lineItems[0].tracking=[{name:'Type of Sale',option:'Instalment'}];
    api.caseInvoiceEditOptions.and.returnValue(of(fixture));
    const f=setup(),c=f.componentInstance;c.openEdit('pty','existing');f.detectChanges();
    expect(c.editingPty).toBeTrue();expect(f.nativeElement.querySelector('.reference-options')).toBeNull();expect(f.nativeElement.querySelector('.fee-choice')).toBeNull();expect(c.referenceMode.value).toBe('reference');expect(c.manualReference.value).toBe('Student Reference');
    expect(c.invoiceHeaderLabel).toContain('(PTY)');expect(f.nativeElement.querySelector('.invoice-meta input').value).toBe('Fixture College - 2');
    expect(f.nativeElement.querySelector('.line-editor').textContent).toContain('Type of Sale');expect(f.nativeElement.querySelector('.line-editor').textContent).toContain('Instalment');
    c.form.controls.confirmed.setValue(true);c.createAll();expect(api.updateCaseInvoice.calls.mostRecent().args.slice(0,3)).toEqual(['case','pty','existing']);
    expect(api.updateCaseInvoice.calls.mostRecent().args[3].reference).toBe('Student Reference');
  });
  it('retains changes and the same retry identity after an uncertain edit response',()=>{
    api.updateCaseInvoice.and.returnValue(throwError(()=>({status:502})));const c=setup().componentInstance;c.openEdit('connection','existing');c.form.controls.confirmed.setValue(true);
    c.createAll();expect(c.modal.nativeElement.open).toBeTrue();expect(c.busy).toBeFalse();expect(c.message).toContain('Retry the same changes');
    c.createAll();expect(api.updateCaseInvoice.calls.argsFor(0)[4]).toBe(api.updateCaseInvoice.calls.argsFor(1)[4]);
  });
  it('restores an unconfirmed save after reopening and retains its original retry key',()=>{
    const pending={expectedFingerprint:'earlier',confirmed:true,advisorId:'advisor',referenceMode:'reference',reference:'Pending reference',currency:'AUD',reviewNote:'Saved note',issueDate:'2026-10-28',dueDate:'2026-11-04',conditionalFeeMinor:0,lines:[{lineItemId:'original-line',itemCode:'ELICOS ON-SHORE',description:'Earlier edit',quantity:'2',unitPrice:'75.00',accountCode:'812',taxType:'BASEXCLUDED'}]};
    api.caseInvoiceEditOptions.and.returnValue(of({caseVersion:3,advisors:data.preparation!.advisors,student:data.preparation!.student,catalogue:data.preparation!.catalogue,colleges:[],brandingThemes:[],expectedFingerprint:'latest',pending:{key:'original-save-key',input:pending},invoice:{invoiceId:'existing',invoiceNumber:'INV-42',status:'DRAFT',invoiceDate:'2026-10-28',dueDate:'2026-11-04',currencyCode:'AUD',invoiceReference:'Original',advisorName:'S15 Fixture Advisor',paymentTrack:'Pending',lineItems:[]}}));
    const c=setup().componentInstance;c.openEdit('connection','existing');
    expect(c.activeInvoice.controls.lines.at(0).controls.price.value).toBe('75.00');expect(c.manualReference.value).toBe('Pending reference');expect(c.form.controls.reviewNote.value).toBe('Saved note');
    c.form.controls.confirmed.setValue(true);c.createAll();expect(api.updateCaseInvoice.calls.mostRecent().args[4]).toBe('original-save-key');
  });
  it('uses the local current date and editable row defaults, with currency in the date row',()=>{
    jasmine.clock().install();
    try{
      jasmine.clock().mockDate(new Date(2026,10,1,0,30));
      const f=setup(),c=f.componentInstance;c.openManual();c.referenceMode.setValue('college');f.detectChanges();
      const payment=c.activeInvoice;
      expect(payment.controls.issueDate.value).toBe('2026-11-01');expect(payment.controls.dueDate.value).toBe('2026-11-01');
      expect(Array.from(f.nativeElement.querySelectorAll('.invoice-dates label')).map((el:any)=>el.textContent.trim())).toEqual(['Issue date','Due date','Payment Track','Currency']);
      const selects=f.nativeElement.querySelectorAll('.invoice-meta .select-trigger');
      expect(getComputedStyle(selects[1]).fontSize).toBe(getComputedStyle(selects[0]).fontSize);
      expect(getComputedStyle(selects[1]).fontFamily).toBe(getComputedStyle(selects[0]).fontFamily);
      payment.patchValue({issueDate:'2026-11-02',dueDate:'2026-11-03'});
      c.addLine(payment);expect(payment.controls.lines.at(1).getRawValue()).toEqual(jasmine.objectContaining({quantity:'1',price:'0.00'}));
      expect(payment.controls.issueDate.value).toBe('2026-11-02');expect(payment.controls.dueDate.value).toBe('2026-11-03');
    }finally{jasmine.clock().uninstall();}
  });
  it('renders the synchronized subtotal, tax, paid and due as readonly inputs',()=>{
    const f=setup(),c=f.componentInstance;c.showInvoice('connection','invoice');
    c.detail!.lineItems=[{taxAmount:10,tracking:[]} as any];c.detail!.total='110';c.detail!.amountPaid='30';c.detail!.amountDue='80';f.detectChanges();
    const fields=Array.from(f.nativeElement.querySelectorAll('.detail-totals input')) as HTMLInputElement[];
    expect(fields.map(input=>input.getAttribute('aria-label'))).toEqual(['Subtotal','Tax','Paid','Due']);
    expect(fields.every(input=>input.readOnly)).toBeTrue();
    expect(fields.map(input=>input.value)).toEqual(['$100.00','$10.00','$30.00','$80.00']);
  });
  it('keeps fee and review controls beside readonly totals that update for the active invoice',()=>{
    const f=setup(),c=f.componentInstance;completeManual(c);const payment=c.activeInvoice;
    payment.controls.lines.at(0).controls.price.setValue('100.00');f.detectChanges();
    const root=f.nativeElement as HTMLElement;
    (root.querySelector('.fee-choice .select-trigger') as HTMLButtonElement).click();f.detectChanges();
    const apply=Array.from(root.querySelectorAll('.fee-choice .select-option')).find(option=>option.textContent?.trim()==='Apply fee') as HTMLButtonElement;
    apply.click();f.detectChanges();
    const fee=root.querySelector('.fee-choice input') as HTMLInputElement;fee.value='25.00';fee.dispatchEvent(new Event('input'));f.detectChanges();
    const note=root.querySelector('.invoice-review textarea') as HTMLTextAreaElement;note.value='Optional note';note.dispatchEvent(new Event('input'));
    expect(c.form.controls.reviewNote.value).toBe('Optional note');expect(payment.controls.fee.value).toBe('25.00');
    const totals=Array.from(root.querySelectorAll('.editor-totals input')) as HTMLInputElement[];
    expect(totals.every(input=>input.readOnly)).toBeTrue();expect(totals.map(input=>input.value)).toEqual(['$100.00','$0.00','$25.00']);
    expect(root.querySelector('.invoice-summary > .invoice-review .check')).not.toBeNull();
    c.close();c.open();complete(c);c.activePayment=1;f.detectChanges();
    expect((root.querySelector('.fee-choice app-manager-select') as any)).not.toBeNull();
    c.activeInvoice.controls.lines.at(0).controls.price.setValue('200.00');f.detectChanges();
    expect(root.querySelector('.editor-totals .total-row strong')?.textContent).toBe('$200.00');
  });
  it('defaults to the current advisor and primary case college, with editable selections',()=>{
    api.manualCaseInvoiceOptions.and.returnValue(of({caseVersion:3,advisors:data.preparation!.advisors,student:{name:'Student',advisorId:'advisor'},catalogue:data.preparation!.catalogue,colleges:[{collegeId:'college',name:'East Coast',isPrimary:true}],brandingThemes:[]}));
    const c=setup().componentInstance;c.openManual();
    expect(c.form.controls.advisorId.value).toBe('advisor');expect(c.referenceMode.value).toBe('college');expect(c.manualCollege.value).toBe('college');
    expect(c.form.controls.advisorId.enabled).toBeTrue();expect(c.manualCollege.enabled).toBeTrue();
    expect(c.paymentTracking([{name:'Sales Representative',option:'Advisor'},{name:'Payment Track',option:'Pending'}])).toBe('Pending');
  });
  it('opens a blank independent invoice when offer preparation is unavailable and returns after creation',()=>{
    api.caseInvoiceDrafts.and.returnValue(of({batches:[],preparation:null,canCreateXero:true}));
    const f=setup(),c=f.componentInstance;spyOn(c.changed,'emit');c.openManual();f.detectChanges();
    expect(c.modal.nativeElement.open).toBeTrue();expect(c.form.controls.invoices.length).toBe(1);
    const payment=c.activeInvoice,line=payment.controls.lines.at(0);
    const now=new Date(),today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    expect(payment.controls.issueDate.value).toBe(today);expect(payment.controls.dueDate.value).toBe(today);
    expect(c.form.controls.advisorId.value).toBe('');expect(c.manualReference.value).toBe('');
    expect(line.getRawValue()).toEqual(jasmine.objectContaining({description:'',itemId:'',quantity:'1',price:'0.00'}));
    c.createAll();expect(api.prepareManualCaseInvoice).not.toHaveBeenCalled();
    c.manualReference.setValue('Additional service');c.manualBrandingTheme.setValue('theme');c.form.patchValue({advisorId:'advisor',confirmed:true});
    payment.patchValue({issueDate:'2026-10-26',dueDate:'2026-11-01'});line.controls.description.setValue('Additional service');
    line.controls.itemId.setValue('item');line.controls.quantity.setValue('1');line.controls.price.setValue('100.00');
    c.createAll();f.detectChanges();
    const payload=api.prepareManualCaseInvoice.calls.mostRecent().args[1];
    expect(payload.reference).toBe('Additional service');expect(payload.invoices.length).toBe(1);expect(payload.offerId).toBeUndefined();
    expect(api.prepareCaseInvoiceDrafts).not.toHaveBeenCalled();expect(api.createCaseXeroInvoices).toHaveBeenCalledWith('case','manual-batch',[1]);
    expect(c.modal.nativeElement.open).toBeFalse();expect(c.changed.emit).toHaveBeenCalled();
    c.openManual();expect(c.activeInvoice.controls.issueDate.value).toBe(today);expect(c.manualReference.value).toBe('');
  });
  function completeManual(c:CaseInvoiceDraftsComponent){
    c.openManual();c.manualReference.setValue('Reference text');c.manualBrandingTheme.setValue('theme');c.form.patchValue({advisorId:'advisor',confirmed:true});
    const payment=c.activeInvoice,line=payment.controls.lines.at(0);
    payment.patchValue({issueDate:'2029-07-29',dueDate:'2029-08-01'});
    line.controls.itemId.setValue('item');line.patchValue({description:'Service',quantity:'1',price:'2000'});
    return {payment,line};
  }
  it('clears hidden fee errors after switching to Do not apply and submits a complete form',()=>{
    const c=setup().componentInstance,{payment}=completeManual(c);
    payment.controls.feeApplies.setValue('yes');c.createAll();expect(api.prepareManualCaseInvoice).not.toHaveBeenCalled();
    expect(c.message).toContain('fee amount greater than zero');
    payment.controls.feeApplies.setValue('no');c.createAll();expect(api.prepareManualCaseInvoice).toHaveBeenCalledTimes(1);
  });
  it('shows a precise date error and permits correction',()=>{
    const c=setup().componentInstance,{payment}=completeManual(c);
    payment.controls.dueDate.setValue('2029-07-01');c.createAll();expect(c.message).toBe('Due date must be on or after the issue date.');
    expect(api.prepareManualCaseInvoice).not.toHaveBeenCalled();payment.controls.dueDate.setValue('2029-08-01');c.createAll();expect(api.prepareManualCaseInvoice).toHaveBeenCalledTimes(1);
  });
  it('uses a selected college instead of requiring free text, and includes the chosen branding theme',()=>{
    const f=setup(),c=f.componentInstance;completeManual(c);c.manualReference.reset('');c.referenceMode.setValue('college');f.detectChanges();
    expect(f.nativeElement.querySelector('[aria-label="Invoice reference"]')).toBeNull();
    expect(f.nativeElement.querySelector('app-manager-select [aria-label="College"]')).not.toBeNull();
    c.createAll();expect(c.message).toBe('Select a college.');
    c.manualCollege.setValue('college');c.createAll();
    expect(api.prepareManualCaseInvoice.calls.mostRecent().args[1]).toEqual(jasmine.objectContaining({referenceMode:'college',collegeId:'college',brandingThemeId:'theme'}));
  });
  it('does not overwrite manually entered prices with item catalogue defaults',()=>{
    const c=setup().componentInstance;c.openManual();const line=c.activeInvoice.controls.lines.at(0);
    line.controls.itemId.setValue('item');expect(line.controls.price.value).toBe('0.00');
    line.controls.price.setValue('50');line.controls.itemId.setValue('item');expect(line.controls.price.value).toBe('50');
    expect(line.controls.accountCode.value).toBe('812');expect(line.controls.taxType.value).toBe('BASEXCLUDED');
  });
  function complete(c:CaseInvoiceDraftsComponent,confirmed=true){
    c.form.patchValue({advisorId:'advisor',confirmed});
    for(const p of c.form.controls.invoices.controls){p.patchValue({dueDate:'2026-10-26',feeApplies:'no'});p.controls.lines.at(0).controls.itemId.setValue('item');}
  }
  const instalmentOptionId='11111111-1111-4111-8111-111111111111',marketingOptionId='22222222-2222-4222-8222-222222222222';
  const ptyOptions={available:true,issue:null,typeOfSaleIssue:null,typeOfSaleOptions:[{value:instalmentOptionId,label:'Instalment'},{value:marketingOptionId,label:'Marketing'}],defaultTypeOfSaleOptionId:instalmentOptionId,collegeId:'case-college',collegeName:'Fixture College',rule:{rule_id:'rule',commission_basis_points:3000,application_conditions:null},accounts:[{code:'200',name:'Sales Commissions',taxType:'OUTPUT'}],items:[{itemId:'pty-item',code:'ELICOS ON-SHORE',name:'English onshore',description:'',unitPrice:null,accountCode:'200',taxType:'OUTPUT'}],tax:{name:'GST on Income',taxType:'OUTPUT',rate:'10'}};
  it('labels TRUST tabs and the header immediately while PTY settings are pending',()=>{
    const options=new Subject<any>();api.commissionOptions.and.returnValue(options);const f=setup(),c=f.componentInstance;c.open();f.detectChanges();
    const labels=()=>Array.from(f.nativeElement.querySelectorAll('.payment-tabs button') as NodeListOf<HTMLButtonElement>).filter(b=>b.textContent?.includes('TRUST')).map(b=>b.textContent!.trim());
    expect(labels()).toEqual(Array.from({length:8},(_,i)=>`INV-${i+1} (TRUST)`));expect(f.nativeElement.querySelector('.invoice-header-state').textContent).toBe('INV-1 (TRUST) · Draft');
    options.next(ptyOptions);f.detectChanges();expect(labels()).toEqual(Array.from({length:8},(_,i)=>`INV-${i+1} (TRUST)`));expect(api.commissionOptions).toHaveBeenCalledTimes(1);
  });
  it('combines pending PTY prerequisites into one notice and disables the empty dropdown',()=>{
    api.commissionOptions.and.returnValue(of({...ptyOptions,typeOfSaleOptions:[],defaultTypeOfSaleOptionId:null,typeOfSaleIssue:'Type of Sale options are waiting for background import.'}));
    const f=setup(),c=f.componentInstance;c.open();c.selectPayment(0,true);f.detectChanges();
    const notices=f.nativeElement.querySelectorAll('.commission-preview .notice');expect(notices.length).toBe(1);expect(notices[0].textContent).toContain('Select a tuition item');expect(notices[0].textContent).toContain('Type of Sale options');
    const select=f.nativeElement.querySelector('[aria-label="PTY Type of Sale"]') as HTMLButtonElement;expect(select.disabled).toBeTrue();expect(select.textContent).toContain('Options pending');select.click();f.detectChanges();expect(f.nativeElement.querySelector('.commission-preview .select-menu')).toBeNull();
    c.activeInvoice.controls.lines.at(0).controls.itemId.setValue('item');f.detectChanges();expect(f.nativeElement.querySelectorAll('.commission-preview .notice').length).toBe(1);expect(f.nativeElement.querySelector('.commission-preview .notice').textContent).not.toContain('Select a tuition item');
  });
  it('alternates TRUST and PTY tabs and reuses local settings while switching',()=>{
    api.commissionOptions.and.returnValue(of(ptyOptions));const f=setup(),c=f.componentInstance;c.open();f.detectChanges();
    const labels=Array.from(f.nativeElement.querySelectorAll('.payment-tabs button') as NodeListOf<HTMLButtonElement>).map(b=>b.textContent!.trim());
    expect(labels.slice(0,4)).toEqual(['INV-1 (TRUST)','INV-1 (PTY)','INV-2 (TRUST)','INV-2 (PTY)']);
    c.selectPayment(1,true);f.detectChanges();c.selectPayment(0,true);f.detectChanges();expect(api.commissionOptions).toHaveBeenCalledTimes(1);
    expect(c.ptyCalculation).toEqual({tuitionMinor:10000,basisPoints:3000,commissionMinor:3000});expect(c.ptyTax).toBe(300);
  });
  it('places the same invoice/status typography immediately before Close on TRUST and PTY',()=>{
    api.commissionOptions.and.returnValue(of(ptyOptions));const f=setup(),c=f.componentInstance;c.open();f.detectChanges();
    let state=f.nativeElement.querySelector('header .invoice-header-state') as HTMLElement;
    expect(state.textContent).toBe('INV-1 (TRUST) · Draft');expect(state.nextElementSibling?.getAttribute('aria-label')).toBe('Close invoice preview');
    const style=getComputedStyle(state);const font=[style.fontFamily,style.fontSize,style.fontWeight];
    expect(getComputedStyle(f.nativeElement.querySelector('legend')).position).toBe('absolute');
    c.selectPayment(1,true);f.detectChanges();state=f.nativeElement.querySelector('header .invoice-header-state');
    expect(state.textContent).toBe('INV-2 (PTY) · Draft');expect(f.nativeElement.querySelector('.commission-preview h3')).toBeNull();
    const other=getComputedStyle(state);expect([other.fontFamily,other.fontSize,other.fontWeight]).toEqual(font);
  });
  it('renders the PTY fields, line table and totals in order with 12 units at 80 dollars',()=>{
    api.commissionOptions.and.returnValue(of({...ptyOptions,rule:{...ptyOptions.rule,commission_basis_points:2500}}));
    const f=setup(),c=f.componentInstance;c.open();complete(c);
    c.activeInvoice.controls.lines.at(0).patchValue({quantity:'12',price:'320.00'});c.selectPayment(0,true);f.detectChanges();
    const panel=f.nativeElement.querySelector('.commission-preview') as HTMLElement;
    expect((panel.querySelector('[aria-label="PTY quantity"]') as HTMLInputElement).value).toBe('12');
    expect((panel.querySelector('[aria-label="PTY unit price"]') as HTMLInputElement).value).toBe('80.00');
    expect(panel.querySelector('td[data-label="Amount"]')?.textContent).toContain('$960.00');
    expect(panel.querySelector('td[data-label="Account"]')?.textContent).toContain('200 — Sales Commissions');
    expect((panel.querySelector('[aria-label="PTY tax total"]') as HTMLInputElement).value).toBe('$96.00');
    expect(panel.querySelector('.total-row')?.textContent).toContain('$1,056.00');
    const fields=panel.querySelector('.invoice-meta')!,table=panel.querySelector('table')!,summary=panel.querySelector('.invoice-summary')!;
    expect(fields.compareDocumentPosition(table)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();expect(table.compareDocumentPosition(summary)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    for(const input of panel.querySelectorAll('table input'))expect((input as HTMLInputElement).readOnly).toBeTrue();
  });
  it('keeps recorded PTY quantities and prices unchanged after creation',()=>{
    api.caseInvoiceDrafts.and.returnValue(of(savedData({'1':{status:'created',invoiceId:'trust-1',invoiceNumber:'TRUST-1'}})));
    api.commissionOptions.and.returnValue(of(ptyOptions));
    api.commissionDrafts.and.returnValue(of({items:[{sequence:1,status:'created',snapshot:{collegeName:'Recorded college',calculation:{tuitionMinor:384000,basisPoints:2500,commissionMinor:96000},taxMinor:9600,value:{lines:[{itemCode:'ELICOS ON-SHORE',quantity:'1',unitAmount:'960.00',description:'Recorded description',accountCode:'200'}]}}}]}));
    const f=setup(),c=f.componentInstance;c.open();c.selectPayment(0,true);f.detectChanges();
    expect((f.nativeElement.querySelector('[aria-label="PTY quantity"]') as HTMLInputElement).value).toBe('1');
    expect((f.nativeElement.querySelector('[aria-label="PTY unit price"]') as HTMLInputElement).value).toBe('960.00');
    expect((f.nativeElement.querySelector('[aria-label="PTY line description"]') as HTMLTextAreaElement).value).toBe('Recorded description');
  });
  it('uses Xero Type of Sale options with Instalment default and keeps choices per invoice',()=>{
    api.commissionOptions.and.returnValue(of(ptyOptions));const f=setup(),c=f.componentInstance;c.open();complete(c);c.selectPayment(0,true);f.detectChanges();
    const select=f.nativeElement.querySelector('[aria-label="PTY Type of Sale"]') as HTMLButtonElement;
    expect(select.textContent).toContain('Instalment');select.click();f.detectChanges();
    const options=Array.from(f.nativeElement.querySelectorAll('.select-option')) as HTMLButtonElement[];
    expect(options.map(o=>o.textContent?.trim())).toEqual(['Instalment','Marketing']);options[1].click();f.detectChanges();
    expect(c.activePtyTypeOfSale.value).toBe(marketingOptionId);expect(c.form.controls.confirmed.value).toBeFalse();
    c.selectPayment(1,true);f.detectChanges();expect(c.activePtyTypeOfSale.value).toBe(instalmentOptionId);c.selectPayment(0,true);expect(c.activePtyTypeOfSale.value).toBe(marketingOptionId);
    c.form.controls.confirmed.setValue(true);c.createAll();
    const selected=api.prepareCommissions.calls.mostRecent().args[3];expect(selected[0]).toEqual({sequence:1,typeOfSaleOptionId:marketingOptionId});expect(selected[1]).toEqual({sequence:2,typeOfSaleOptionId:instalmentOptionId});
    expect(api.commissionOptions).toHaveBeenCalledTimes(1);
  });
  it('restores saved sale choices and locks created PTY tracking independently of TRUST',()=>{
    api.caseInvoiceDrafts.and.returnValue(of(savedData()));api.commissionOptions.and.returnValue(of(ptyOptions));
    api.commissionDrafts.and.returnValue(of({items:[{sequence:1,status:null,snapshot:{value:{lines:[{tracking:[{name:'Type of Sale',option:'Marketing',trackingOptionId:marketingOptionId}]}]}}},{sequence:2,status:'created',snapshot:{value:{lines:[{tracking:[{name:'Type of Sale',option:'Retired option',trackingOptionId:'33333333-3333-4333-8333-333333333333'}]}]}}}]}));
    const f=setup(),c=f.componentInstance;c.open();c.selectPayment(0,true);expect(c.activePtyTypeOfSale.value).toBe(marketingOptionId);expect(c.activePtyTypeOfSale.disabled).toBeFalse();
    c.selectPayment(1,true);expect(c.activePtyTypeOfSale.disabled).toBeTrue();expect(c.activePtyTypeOfSaleOptions.some(o=>o.label==='Retired option')).toBeTrue();
    c.selectPayment(2,true);expect(c.activePtyTypeOfSaleOptions.some(o=>o.label==='Retired option')).toBeFalse();
  });
  it('keeps unknown or unavailable sale choices pending instead of inventing options',()=>{
    api.commissionOptions.and.returnValue(of({...ptyOptions,typeOfSaleOptions:[],defaultTypeOfSaleOptionId:null,typeOfSaleIssue:'Type of Sale options are waiting for background import.'}));
    const c=setup().componentInstance;c.open();complete(c);c.createAll();expect(c.message).toContain('background import');expect(api.prepareCommissions).not.toHaveBeenCalled();
  });
  it('saves both proposals then uses server orchestration for bulk creation',()=>{
    api.commissionOptions.and.returnValue(of(ptyOptions));const c=setup().componentInstance;c.open();complete(c);c.createAll();
    expect(api.prepareCommissions).toHaveBeenCalledWith('case','batch',1,Array.from({length:8},(_,i)=>({sequence:i+1,typeOfSaleOptionId:instalmentOptionId})));
    expect(api.createPairedInvoices).toHaveBeenCalledWith('case','batch',[1,2,3,4,5,6,7,8],[1,2,3,4,5,6,7,8]);expect(api.createCaseXeroInvoices).not.toHaveBeenCalled();
  });
  it('closes the modal after all TRUST and PTY receipts are confirmed',()=>{
    api.commissionOptions.and.returnValue(of(ptyOptions));
    const results=Array.from({length:8},(_,i)=>({sequence:i+1,status:'created',invoiceId:`id-${i}`}));
    api.createPairedInvoices.and.returnValue(of({trust:{created:8,skipped:0,results},pty:{created:8,skipped:0,results}}));
    const f=setup(),c=f.componentInstance;c.open();complete(c);const changed=spyOn(c.changed,'emit');c.createAll();
    expect(f.nativeElement.querySelector('dialog').open).toBeFalse();expect(changed).toHaveBeenCalledTimes(1);expect(c.tone).toBe('success');
  });
  it('keeps the modal open when a paired result needs review',()=>{
    api.commissionOptions.and.returnValue(of(ptyOptions));
    const results=Array.from({length:8},(_,i)=>({sequence:i+1,status:'created',invoiceId:`id-${i}`}));
    api.createPairedInvoices.and.returnValue(of({trust:{created:8,skipped:0,results},pty:{created:7,skipped:1,results:results.map(r=>r.sequence===3?{...r,status:'review_required',message:'Check this invoice before retrying.'}:r)}}));
    const f=setup(),c=f.componentInstance;c.open();complete(c);c.createAll();expect(f.nativeElement.querySelector('dialog').open).toBeTrue();expect(c.tone).toBe('error');expect(c.message).toContain('Check this invoice');
  });
  it('blocks individual PTY creation until TRUST is created',()=>{
    api.commissionOptions.and.returnValue(of(ptyOptions));const c=setup().componentInstance;c.open();complete(c);c.selectPayment(0,true);c.createCurrent();
    expect(c.message).toContain('TRUST invoice first');expect(api.prepareCommissions).not.toHaveBeenCalled();expect(api.createPairedInvoices).not.toHaveBeenCalled();
  });
  it('keeps TRUST bulk creation available when the commission rule is blocked',()=>{
    api.commissionOptions.and.returnValue(of({...ptyOptions,issue:'Cashback needs review'}));const c=setup().componentInstance;c.open();complete(c);c.createAll();expect(api.createCaseXeroInvoices).toHaveBeenCalled();expect(api.createPairedInvoices).not.toHaveBeenCalled();
  });
  it('removes the opt-in controls and shows the inherited PTY item as read only',()=>{
    api.commissionOptions.and.returnValue(of(ptyOptions));const f=setup(),c=f.componentInstance;c.open();complete(c);c.selectPayment(0,true);f.detectChanges();
    expect(f.nativeElement.textContent).not.toContain('Include PTY commissions');expect(f.nativeElement.textContent).not.toContain('PTY sales item ·');
    const item=f.nativeElement.querySelector('[aria-label="PTY invoice item"]') as HTMLInputElement;
    expect(item.readOnly).toBeTrue();expect(item.value).toBe('ELICOS ON-SHORE — English onshore');
    const button=f.nativeElement.querySelector('.commission-preview .btn.xero') as HTMLButtonElement;
    expect(button.textContent?.trim()).toBe('Create Xero Invoice');expect(button.disabled).toBeTrue();
  });
  it('propagates the first TRUST tuition selection to matching PTY previews without sharing organisation IDs',()=>{
    const trust=structuredClone(data);trust.preparation!.catalogue!.items.push({...trust.preparation!.catalogue!.items[0],itemId:'vet-trust',code:'VET',name:'Vocational'});
    api.caseInvoiceDrafts.and.returnValue(of(trust));api.commissionOptions.and.returnValue(of({...ptyOptions,items:[...ptyOptions.items,{...ptyOptions.items[0],itemId:'vet-pty',code:'VET',name:'Vocational'}]}));
    const c=setup().componentInstance;c.open();c.activeInvoice.controls.lines.at(0).controls.itemId.setValue('item');
    expect(c.form.controls.invoices.controls.every(p=>p.controls.lines.at(0).controls.itemId.value==='item')).toBeTrue();
    c.selectPayment(7,true);expect(c.ptySalesItemLabel).toContain('ELICOS ON-SHORE');
    c.form.controls.invoices.at(1).controls.lines.at(0).controls.itemId.setValue('vet-trust');c.selectPayment(1,true);expect(c.ptySalesItemLabel).toBe('VET — Vocational');
    c.selectPayment(0,true);expect(c.ptySalesItemLabel).toContain('ELICOS ON-SHORE');
  });
  it('enables only the PTY invoice whose matching TRUST receipt has been created',()=>{
    api.commissionOptions.and.returnValue(of(ptyOptions));const f=setup(),c=f.componentInstance;c.open();complete(c);c.selectPayment(1,true);f.detectChanges();
    expect((f.nativeElement.querySelector('.commission-preview .btn.xero') as HTMLButtonElement).disabled).toBeTrue();
    c.selectPayment(0);c.createCurrent();expect(api.createCaseXeroInvoices).toHaveBeenCalledWith('case','batch',[1]);expect(api.prepareCommissions).not.toHaveBeenCalled();
    c.selectPayment(0,true);c.form.controls.confirmed.setValue(true);f.detectChanges();expect(c.canCreateCurrentPty).toBeTrue();
    expect((f.nativeElement.querySelector('.commission-preview .btn.xero') as HTMLButtonElement).disabled).toBeFalse();
    c.createCurrent();expect(api.createPairedInvoices).toHaveBeenCalledWith('case','batch',[],[1]);
    c.selectPayment(1,true);expect(c.canCreateCurrentPty).toBeFalse();
  });
  it('saves TRUST drafts before preparing their commissions without creating any Xero invoices',()=>{
    const order:string[]=[];api.commissionOptions.and.returnValue(of(ptyOptions));
    api.prepareCaseInvoiceDrafts.and.callFake(()=>{order.push('trust saved');return of({batchId:'batch',count:8,revision:1});});
    api.prepareCommissions.and.callFake(()=>{order.push('pty prepared');return of({prepared:8});});
    const c=setup().componentInstance;c.open();complete(c);c.save();expect(order).toEqual(['trust saved','pty prepared']);expect(api.createPairedInvoices).not.toHaveBeenCalled();expect(api.createCaseXeroInvoices).not.toHaveBeenCalled();
  });
  it('keeps a missing PTY item blocked instead of choosing another sales item',()=>{
    api.commissionOptions.and.returnValue(of({...ptyOptions,items:[{...ptyOptions.items[0],code:'DIFFERENT'}]}));
    const c=setup().componentInstance;c.open();complete(c);c.createAll();expect(c.message).toContain('one matching item');expect(api.prepareCaseInvoiceDrafts).not.toHaveBeenCalled();expect(api.prepareCommissions).not.toHaveBeenCalled();
    c.selectPayment(0);c.createCurrent();expect(api.createCaseXeroInvoices).toHaveBeenCalledWith('case','batch',[1]);
    c.selectPayment(0,true);expect(c.canCreateCurrentPty).toBeFalse();
  });
  it('does not propagate an edited item into a frozen TRUST invoice',()=>{
    const source=savedData({'2':{status:'created',invoiceId:'existing-2',invoiceNumber:'TRUST-2'}});
    source.preparation!.catalogue!.items.push({...source.preparation!.catalogue!.items[0],itemId:'vet',code:'VET',name:'Vocational'});
    api.caseInvoiceDrafts.and.returnValue(of(source));const c=setup().componentInstance;c.open();c.activeInvoice.controls.lines.at(0).controls.itemId.setValue('vet');
    expect(c.form.controls.invoices.at(1).controls.lines.at(0).controls.itemId.value).toBe('item');expect(c.form.controls.invoices.at(2).controls.lines.at(0).controls.itemId.value).toBe('vet');
  });
  it('cancels stale college-option requests after a new selection',()=>{
    const first=new Subject<any>(),second=new Subject<any>();api.commissionOptions.and.returnValues(first,second);const c=setup().componentInstance;c.open();c.manualCollege.setValue('offer-college');
    second.next({...ptyOptions,collegeName:'Selected College'});first.next({...ptyOptions,collegeName:'Stale College'});expect(c.ptyOptions?.collegeName).toBe('Selected College');
  });
  for(const width of [390,1440])for(const dark of [false,true])it(`renders PTY at ${width}px with dark=${dark}`,()=>{
    api.commissionOptions.and.returnValue(of(ptyOptions));const f=setup(),c=f.componentInstance;c.open();complete(c);c.selectPayment(0,true);f.detectChanges();
    const frame=document.createElement('iframe');frame.style.width=`${width}px`;frame.style.height='900px';document.body.appendChild(frame);
    try{const doc=frame.contentDocument!;document.querySelectorAll('style').forEach(style=>doc.head.appendChild(style.cloneNode(true)));doc.documentElement.classList.toggle('dark',dark);
      const host=f.nativeElement.cloneNode(true) as HTMLElement;doc.body.appendChild(host);const dialog=host.querySelector<HTMLDialogElement>('dialog')!;dialog.removeAttribute('open');dialog.showModal();
      expect(dialog.scrollWidth).toBeLessThanOrEqual(dialog.clientWidth+1);const state=dialog.querySelector<HTMLElement>('.invoice-header-state')!,close=dialog.querySelector<HTMLElement>('.btn.close')!;expect(state.getBoundingClientRect().right).toBeLessThanOrEqual(close.getBoundingClientRect().left);const panel=dialog.querySelector<HTMLElement>('.commission-preview')!;const current=dialog.querySelector<HTMLElement>('.payment-tabs [aria-current=step]')!;const currentStyle=frame.contentWindow!.getComputedStyle(current);expect(currentStyle.backgroundColor).toBe(dark?'rgb(22, 78, 63)':'rgb(229, 247, 239)');expect(parseFloat(currentStyle.fontSize)).toBeLessThan(13);expect(current.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
      expect(panel.scrollWidth).toBeLessThanOrEqual(panel.clientWidth+1);expect(frame.contentWindow!.getComputedStyle(panel.querySelector('table')!).display).toBe(width===390?'block':'table');expect(panel.textContent).toContain('Tuition base');expect(panel.textContent).toContain('GST on Income');
      expect(dialog.querySelectorAll('.payment-tabs button').length).toBe(16);
      const sale=panel.querySelector<HTMLButtonElement>('[aria-label="PTY Type of Sale"]')!;const saleBounds=sale.getBoundingClientRect();expect(sale.disabled).toBeFalse();expect(sale.textContent).toContain('Instalment');expect(saleBounds.height).toBeGreaterThanOrEqual(44);expect(saleBounds.width).toBeGreaterThanOrEqual(width===390?100:125);expect(saleBounds.right).toBeLessThanOrEqual(panel.getBoundingClientRect().right+1);
      const ptyButton=panel.querySelector<HTMLButtonElement>('.btn.xero')!;expect(ptyButton.textContent?.trim()).toBe('Create Xero Invoice');expect(ptyButton.disabled).toBeTrue();
      expect(Math.abs(ptyButton.getBoundingClientRect().right-panel.getBoundingClientRect().right)).toBeLessThan(2);
      const trust=dialog.querySelector<HTMLElement>('[hidden]')!;trust.removeAttribute('hidden');
      const trustAction=trust.querySelector<HTMLElement>('.invoice-create-action')!,trustButton=trustAction.querySelector<HTMLElement>('.btn.xero')!;
      expect(Math.abs(trustButton.getBoundingClientRect().right-trustAction.getBoundingClientRect().right)).toBeLessThan(2);
      for(const button of dialog.querySelectorAll('footer button'))expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    }finally{frame.remove();f.destroy();}
  });
  it('renders the active invoice number safely before and after switching instalments',()=>{
    const f=setup(),c=f.componentInstance;expect(c.activeInvoiceNumber).toBe('—');
    c.open();f.detectChanges();expect(f.nativeElement.querySelector('.footer-total').textContent).toContain('INV-1');
    c.activePayment=1;f.detectChanges();expect(f.nativeElement.querySelector('.footer-total').textContent).toContain('INV-2');
    c.form.controls.invoices.clear();f.detectChanges();expect(c.activeInvoiceNumber).toBe('—');
  });
  it('previews eight instalments without saving and requires confirmation of missing data',()=>{
    const f=setup(),c=f.componentInstance;c.open();f.detectChanges();expect(c.form.controls.invoices.length).toBe(8);expect(api.prepareCaseInvoiceDrafts).not.toHaveBeenCalled();
    expect(f.nativeElement.querySelector('[formControlName="category"]')).toBeNull();expect(f.nativeElement.querySelector('[formControlName="location"]')).toBeNull();expect(c.form.controls.invoices.at(0).controls.feeApplies.value).toBe('');
    c.save();expect(api.prepareCaseInvoiceDrafts).not.toHaveBeenCalled();expect(c.message).toBe('Select an advisor.');
    expect(f.nativeElement.querySelector('dialog').open).toBeTrue();
  });
  it('defaults undated payments to today and formats the editable course, campus and start-date description',()=>{
    const c=setup().componentInstance;c.open();const first=c.form.controls.invoices.at(0);
    expect(first.controls.issueDate.value).toBe('2026-10-26');expect(first.controls.dueDate.value).toBe('2026-10-26');
    expect(first.controls.lines.at(0).controls.description.value).toBe('Course Name: GENERAL ENGLISH - 48 weeks\nCampus: 16 Cook St, MORTDALE, NSW, 2223\nStart Date: 25 Jan 2027');
    const withoutAddress=structuredClone(data);delete withoutAddress.preparation!.source.campusAddress;api.caseInvoiceDrafts.and.returnValue(of(withoutAddress));const other=setup().componentInstance;other.open();expect(other.form.controls.invoices.at(0).controls.lines.at(0).controls.description.value).toContain('\nCampus: \n');
    const legacy=structuredClone(withoutAddress);legacy.preparation!.source.evidence=[{page:1,quote:'Address: 16 Cook St, MORTDALE, NSW, 2223'}];api.caseInvoiceDrafts.and.returnValue(of(legacy));const fallback=setup().componentInstance;fallback.open();expect(fallback.form.controls.invoices.at(0).controls.lines.at(0).controls.description.value).toContain('\nCampus: 16 Cook St, MORTDALE, NSW, 2223\n');
  });
  it('uses each dated instalment schedule rather than today and sends operator-selected dates unchanged',()=>{
    const source=structuredClone(data);
    source.preparation!.source.instalments[1].dueOn='2027-02-15';
    source.preparation!.source.instalments[2].dueOn='2027-04-19';
    api.caseInvoiceDrafts.and.returnValue(of(source));
    const c=setup().componentInstance;c.open();
    expect(c.form.controls.invoices.at(1).getRawValue()).toEqual(jasmine.objectContaining({issueDate:'2027-02-15',dueDate:'2027-02-15'}));
    expect(c.form.controls.invoices.at(2).getRawValue()).toEqual(jasmine.objectContaining({issueDate:'2027-04-19',dueDate:'2027-04-19'}));
    complete(c);
    c.form.controls.invoices.at(1).patchValue({issueDate:'2027-02-01',dueDate:'2027-02-15'});
    c.form.controls.invoices.at(2).patchValue({issueDate:'2027-04-01',dueDate:'2027-04-19'});
    c.createAll();
    const sent=api.prepareCaseInvoiceDrafts.calls.mostRecent().args[1].invoices;
    expect(sent[1]).toEqual(jasmine.objectContaining({sequence:2,issueDate:'2027-02-01',dueDate:'2027-02-15'}));
    expect(sent[2]).toEqual(jasmine.objectContaining({sequence:3,issueDate:'2027-04-01',dueDate:'2027-04-19'}));
  });
  it('restores saved issue and due dates independently without replacing them with today or the offer schedule',()=>{
    const saved=savedData();saved.preparation!.source.instalments[1].dueOn='2027-03-01';
    saved.preparation!.savedBatch!.snapshot.invoices[1].issueDate='2027-02-01';
    saved.preparation!.savedBatch!.snapshot.invoices[1].dueDate='2027-02-15';
    api.caseInvoiceDrafts.and.returnValue(of(saved));const c=setup().componentInstance;c.open();
    expect(c.form.controls.invoices.at(1).getRawValue()).toEqual(jasmine.objectContaining({issueDate:'2027-02-01',dueDate:'2027-02-15'}));
    c.save();expect(api.prepareCaseInvoiceDrafts.calls.mostRecent().args[1].invoices[1]).toEqual(jasmine.objectContaining({issueDate:'2027-02-01',dueDate:'2027-02-15'}));
  });
  it('requires review confirmation and creates either the active Xero invoice or all invoices after saving one immutable batch',()=>{
    const f=setup(),c=f.componentInstance;c.open();f.detectChanges();expect(f.nativeElement.querySelector('.invoice-create-action .xero').disabled).toBeTrue();complete(c);f.detectChanges();
    expect(f.nativeElement.querySelector('.invoice-create-action .xero').disabled).toBeFalse();c.activePayment=2;c.createCurrent();
    expect(api.prepareCaseInvoiceDrafts).toHaveBeenCalledTimes(1);expect(api.createCaseXeroInvoices).toHaveBeenCalledWith('case','batch',[3]);expect(c.modal.nativeElement.open).toBeTrue();expect(c.activeInvoiceNumber).toBe(1);
    f.detectChanges();expect(f.nativeElement.querySelector('.payment-tabs').textContent).not.toContain('INV-3');expect(f.nativeElement.querySelector('.payment-tabs').textContent).toContain('INV-1');
    const second=setup().componentInstance;second.open();complete(second);second.createAll();expect(api.createCaseXeroInvoices).toHaveBeenCalledWith('case','batch',[1,2,3,4,5,6,7,8]);expect(second.modal.nativeElement.open).toBeFalse();
  });
  it('keeps a pre-send failure editable and shows the connector setup reason',()=>{
    api.createCaseXeroInvoices.and.returnValue(of({created:0,skipped:1,results:[{sequence:1,status:'not_attempted',errorCode:'xero_invoice_write_scope_missing',message:'An administrator must reconnect Xero and authorize invoice creation.'}]}));
    const f=setup(),c=f.componentInstance;c.open();complete(c);c.createCurrent();f.detectChanges();
    expect(c.modal.nativeElement.open).toBeTrue();expect(c.activeInvoiceNumber).toBe(1);expect(c.message).toContain('reconnect Xero');expect(f.nativeElement.querySelector('.payment-tabs').textContent).toContain('INV-1');
  });
  it('shows an actionable contact conflict without exposing arbitrary provider or server errors',()=>{
    const pending=new Subject<any>();api.createCaseXeroInvoices.and.returnValue(pending);
    const f=setup(),c=f.componentInstance;c.open();complete(c);c.createCurrent();
    pending.error({status:409,error:{errorCode:'student_invoice_contact_unavailable',message:'private provider payload'}});
    expect(c.message).toContain('active linked Xero Contact');expect(c.message).not.toContain('private');expect(c.busy).toBeFalse();expect(c.modal.nativeElement.open).toBeTrue();
  });
  it('preserves uncertain-send guidance for unknown failures and never retries automatically',()=>{
    const pending=new Subject<any>();api.createCaseXeroInvoices.and.returnValue(pending);
    const f=setup(),c=f.componentInstance;c.open();complete(c);c.createCurrent();
    pending.error({status:500,error:{errorCode:'student_invoice_contact_unavailable',message:'private database error'}});
    expect(c.message).toContain('could not be confirmed');expect(c.message).not.toContain('private');expect(api.createCaseXeroInvoices).toHaveBeenCalledTimes(1);
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
  it('saves complete drafts without requiring the Xero creation confirmation',()=>{
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
    expect(rows[0].querySelector('.link').textContent).toBe('XERO-1');
    expect(f.nativeElement.querySelector('dialog header h2').textContent).toContain('XERO-1');expect(f.nativeElement.querySelector('dialog .xero')).toBeNull();expect(f.nativeElement.querySelector('dialog .notice')).toBeNull();
    expect(c.invoiceLabel({...fixture.batches[0],exports:{}},fixture.batches[0].snapshot.invoices[0])).toBe('INV-1');
    expect(c.invoiceLabel({...fixture.batches[0],exports:{'1':{status:'created',invoiceNumber:null,invoiceId:'xero-id'}}},fixture.batches[0].snapshot.invoices[0])).toBe('Created in Xero');
  });
  it('can use the shared case table while retaining read-only receipt details',()=>{
    const fixture=savedData({'1':{status:'created',invoiceId:'xero-id',invoiceNumber:'XERO-1'},'2':{status:'review_required',invoiceId:null,invoiceNumber:null}});api.caseInvoiceDrafts.and.returnValue(of(fixture));
    const f=setup(),c=f.componentInstance;c.showCreatedInvoices=false;f.detectChanges();
    expect(f.nativeElement.querySelector('.draft-section table')).toBeNull();expect(c.createdInvoice('missing')).toBeNull();
    const created=c.createdInvoice('xero-id')!;c.show(created.batch,created.invoice);f.detectChanges();
    expect(f.nativeElement.querySelector('dialog header h2').textContent).toContain('XERO-1');expect(f.nativeElement.querySelector('dialog .notice')).toBeNull();
    expect(f.nativeElement.querySelectorAll('dialog input:not([readonly])').length).toBe(0);
  });
  it('opens imported invoices without loading proposals and reads the latest cached provider status',()=>{
    const f=setup(),c=f.componentInstance;c.showInvoice('connection','imported-invoice');f.detectChanges();
    expect(api.caseInvoiceDetail).toHaveBeenCalledWith('case','connection','imported-invoice');expect(c.detail?.status).toBe('PAID');
    expect(f.nativeElement.querySelectorAll('dialog input:not([readonly])').length).toBe(0);expect(f.nativeElement.querySelector('dialog').textContent).toContain('Paid out');
  });
  it('cancels a closed detail request and provides a retry for failed cached details',()=>{
    const pending=new Subject<any>();api.caseInvoiceDetail.and.returnValue(pending);const f=setup(),c=f.componentInstance;
    c.showInvoice('connection','invoice');f.detectChanges();expect(f.nativeElement.querySelectorAll('dialog app-manager-list-loader').length).toBe(1);
    c.close();pending.next({invoiceNumber:'stale'});expect(c.detail).toBeNull();
    api.caseInvoiceDetail.and.returnValue(throwError(()=>({status:503})));c.showInvoice('connection','invoice');f.detectChanges();
    expect(c.detailFailed).toBeTrue();expect(f.nativeElement.querySelector('dialog form')).toBeNull();
    c.reloadInvoice();expect(api.caseInvoiceDetail).toHaveBeenCalledTimes(3);
  });
  it('keeps review-required invoices inside the preparation modal and out of the created table',()=>{
    const fixture=savedData({'1':{status:'review_required',invoiceId:null,invoiceNumber:null}});api.caseInvoiceDrafts.and.returnValue(of(fixture));
    const f=setup(),c=f.componentInstance;f.detectChanges();expect(f.nativeElement.querySelector('.draft-section table')).toBeNull();
    c.open();f.detectChanges();expect(c.activeInvoiceNumber).toBe(2);expect(f.nativeElement.querySelector('.payment-tabs').textContent).toContain('INV-1 (TRUST) · Review');
    const reviewButtons=Array.from(f.nativeElement.querySelectorAll('.payment-tabs button')) as HTMLButtonElement[];const reviewButton=reviewButtons.find(button=>button.textContent?.includes('INV-1'))!;reviewButton.click();f.detectChanges();
    expect(c.activeNeedsReview).toBeTrue();expect(c.form.controls.invoices.at(0).disabled).toBeTrue();expect(f.nativeElement.querySelector('fieldset:not([hidden]) .notice').textContent).toContain('not yet been linked');expect(f.nativeElement.querySelector('fieldset:not([hidden]) .notice').textContent).not.toContain('Sophia');expect(f.nativeElement.querySelector('.invoice-create-action .xero').disabled).toBeTrue();
    (f.nativeElement.querySelector('.review-notice button') as HTMLButtonElement).click();f.detectChanges();
    expect(api.reconcileCaseXeroInvoice).toHaveBeenCalledWith('case','batch',1);expect(c.message).toContain('Confirmed against the exact invoice');expect(f.nativeElement.querySelector('.payment-tabs').textContent).not.toContain('INV-1');
  });
  it('keeps an ambiguous Xero result in the modal while advancing to another editable invoice',()=>{
    api.createCaseXeroInvoices.and.returnValue(of({created:0,skipped:1,results:[{sequence:1,status:'review_required'}]}));
    const f=setup(),c=f.componentInstance;c.open();complete(c);c.createCurrent();f.detectChanges();
    expect(c.modal.nativeElement.open).toBeTrue();expect(c.activeInvoiceNumber).toBe(2);expect(f.nativeElement.querySelector('.payment-tabs').textContent).toContain('INV-1 (TRUST) · Review');expect(f.nativeElement.querySelector('.draft-section table')).toBeNull();
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
