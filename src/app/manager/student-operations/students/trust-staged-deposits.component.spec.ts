import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, Subject, throwError } from 'rxjs';
import { StudentOperationsService } from '../student-operations.service';
import { TrustReceiptForm } from './trust-receipt-form.component';
import { TrustInvoiceSuggestionPanel } from './trust-invoice-suggestions.component';
import { TrustStagedDeposits } from './trust-staged-deposits.component';
import { TrustStatementPreview } from './trust-statement-preview.component';

const deposit={id:'saved',account:'Test TRUST',date:'2020-01-02',amount:'2742.00',reference:'College fee',
  transactionId:'BANK-1',source:{record:2,name:'bank.csv',sha256:'1'.repeat(64)}};

describe('TRUST deposits awaiting an invoice',()=>{
  it('loads on demand, saves only after review, and keeps the draft for a retry',()=>{
    const stage=jasmine.createSpy().and.returnValues(throwError(()=>({status:503})),of({id:'saved',created:true}));
    const list=jasmine.createSpy().and.returnValues(of({deposits:[],hasMore:false}),of({deposits:[deposit],hasMore:false}));
    TestBed.configureTestingModule({imports:[TrustStagedDeposits],providers:[{provide:StudentOperationsService,useValue:{
      stagedTrustDeposits:list,stageTrustDeposit:stage}}]});
    const fixture=TestBed.createComponent(TrustStagedDeposits);
    fixture.componentRef.setInput('connection','trust');
    fixture.detectChanges();
    const button=(label:string)=>Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button'))
      .find(b=>b.textContent?.trim()===label)!;
    expect(list).not.toHaveBeenCalled();
    button('Deposits awaiting an invoice').click();
    fixture.componentInstance.account=deposit.account;
    fixture.detectChanges();
    const preview=fixture.debugElement.query(By.directive(TrustStatementPreview)).componentInstance as TrustStatementPreview;
    preview.useDeposit.emit({...deposit,row:2});
    fixture.detectChanges();
    expect(stage).not.toHaveBeenCalled();
    button('Save deposit without an invoice').click(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('You can retry');
    button('Save deposit without an invoice').click(); fixture.detectChanges();
    expect(stage.calls.count()).toBe(2);
    expect(list.calls.count()).toBe(2);
    expect(fixture.componentInstance.draft).toBeUndefined();
    expect(fixture.nativeElement.textContent).toContain('Deposit saved for invoice review');
  });

  it('keeps open staging and pagination controls within mobile and desktop widths in both themes',()=>{
    TestBed.configureTestingModule({imports:[TrustStagedDeposits],providers:[{provide:StudentOperationsService,useValue:{
      trustSplitLines:()=>of({lines:[{lineId:'id',token:'t',gross:'100.00',available:'90.00',label:'Materials fee'}]}),
      trustInvoiceSuggestions:()=>of({page:1,hasMore:true,invoices:[{id:'inv',invoiceNumber:'INV-1',balance:'100.00',difference:'2642.00',score:2,referenceMatch:true}]}),
      stagedTrustDeposits:()=>of({deposits:[deposit],hasMore:true})}}]});
    const fixture=TestBed.createComponent(TrustStagedDeposits);
    fixture.componentRef.setInput('connection','trust'); fixture.detectChanges();
    fixture.componentInstance.toggle(); fixture.componentInstance.selected=deposit.id; fixture.detectChanges();
    fixture.debugElement.query(By.directive(TrustInvoiceSuggestionPanel)).componentInstance.toggle(); fixture.detectChanges();
    Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button')).find(b=>b.textContent?.includes('Record match decision'))!.click(); fixture.detectChanges();
    Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button')).find(b=>b.textContent?.includes('Add to split'))!.click(); fixture.detectChanges();
    Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button')).find(b=>b.textContent?.includes('Choose invoice line purposes'))!.click(); fixture.detectChanges();
    const frame=document.createElement('iframe');
    document.body.appendChild(frame);
    try {
      const doc=frame.contentDocument!;
      for (const style of document.head.querySelectorAll('style')) doc.head.appendChild(style.cloneNode(true));
      doc.body.appendChild(fixture.nativeElement.cloneNode(true));
      for (const width of [375,1280]) {
        frame.style.width=width+'px';
        for (const dark of [false,true]) {
          doc.documentElement.classList.toggle('dark',dark);
          for (const control of doc.querySelectorAll('button,input[type=search],input[inputmode=decimal]')) {
            const rect=control.getBoundingClientRect();
            expect(rect.width).toBeGreaterThan(0);
            expect(rect.right).toBeLessThanOrEqual(width);
          }
        }
      }
    } finally {frame.remove();}
  });

  it('compares tied suggestions, supports manual search, and opens only the chosen invoice',()=>{
    const suggestion={id:'inv',invoiceNumber:'INV-2',reference:'Different',balance:'2742.00',difference:'0.00',
      peers:2,score:1,contact:'Fixture',numberMatch:false,referenceMatch:false,amountMatch:true};
    const lookup=jasmine.createSpy().and.returnValues(of({page:1,invoices:[suggestion]}),of({page:1,invoices:[]}));
    TestBed.configureTestingModule({imports:[TrustStagedDeposits],providers:[{provide:StudentOperationsService,useValue:{
      stagedTrustDeposits:()=>of({deposits:[deposit],hasMore:false}),trustInvoiceSuggestions:lookup}}]});
    const fixture=TestBed.createComponent(TrustStagedDeposits);
    fixture.componentRef.setInput('connection','trust'); fixture.detectChanges();
    const parent=fixture.componentInstance; const reviewed=jasmine.createSpy(); parent.review.subscribe(reviewed);
    parent.toggle(); parent.selected=deposit.id; fixture.detectChanges();
    expect(lookup).not.toHaveBeenCalled();
    const panel=fixture.debugElement.query(By.directive(TrustInvoiceSuggestionPanel)).componentInstance as TrustInvoiceSuggestionPanel;
    panel.toggle(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('2 invoices have the same matching evidence');
    expect(fixture.nativeElement.textContent).toContain('Bank reference differs');
    expect(reviewed).not.toHaveBeenCalled();
    Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button')).find(b=>b.textContent?.trim()==='Review INV-2')!.click();
    expect(reviewed).toHaveBeenCalledOnceWith({invoice:'inv',deposit});
    panel.search='Sponsor'; panel.find(); fixture.detectChanges();
    expect(lookup.calls.mostRecent().args).toEqual(['trust',deposit.id,'Sponsor',1]);
    expect(fixture.nativeElement.textContent).toContain('No open TRUST invoices match this search.');
  });

  it('retains the draft across searches, checks explicit amounts and clears obsolete results',()=>{
    const a={id:'a',invoiceNumber:'INV-1',balance:'3500.00'}, b={id:'b',invoiceNumber:'INV-2',balance:'10.00'};
    const pending=new Subject<any>();
    const check=jasmine.createSpy().and.returnValues(of({allocations:[{invoiceId:'a',invoiceNumber:'INV-1',
      amount:'3000.00',remainingDue:'500.00'}],allocated:'3000.00',unassigned:'2.00'}),pending);
    const lookup=jasmine.createSpy().and.returnValues(of({invoices:[a]}),of({invoices:[b]}));
    TestBed.configureTestingModule({imports:[TrustInvoiceSuggestionPanel],providers:[{provide:StudentOperationsService,
      useValue:{trustInvoiceSuggestions:lookup,previewTrustSplit:check}}]});
    const fixture=TestBed.createComponent(TrustInvoiceSuggestionPanel);
    fixture.componentRef.setInput('connection','trust'); fixture.componentRef.setInput('deposit',{...deposit,amount:'3002.00'}); fixture.detectChanges();
    const panel=fixture.componentInstance;
    const button=(label:string)=>Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button'))
      .find(b=>b.textContent?.trim()===label)!;
    panel.toggle(); fixture.detectChanges(); button('Add to split').click(); fixture.detectChanges();
    expect(button('Add to split').disabled).toBeTrue();
    panel.search='other'; panel.find(); fixture.detectChanges();
    const input=fixture.nativeElement.querySelector('input[inputmode=decimal]') as HTMLInputElement;
    input.value='3000'; input.dispatchEvent(new Event('input')); fixture.detectChanges();
    button('Check split against imported balances').click(); fixture.detectChanges();
    expect(check).toHaveBeenCalledOnceWith('trust',deposit.id,[{invoiceId:'a',expectedBalance:'3500.00',amount:'3000'}]);
    expect(fixture.nativeElement.textContent).toContain('AUD 500.00 remaining due');
    button('Add to split').click(); fixture.detectChanges();
    expect(panel.preview).toBeUndefined();
    button('Remove INV-2').click(); fixture.detectChanges();
    button('Check split against imported balances').click();
    fixture.componentRef.setInput('connection','other'); fixture.detectChanges();
    expect(pending.observed).toBeFalse();
    expect(panel.split).toEqual([]);
  });

  it('loads line purposes on demand, includes them in the preview, and clears a changed line',()=>{
    const candidate={id:'inv',invoiceNumber:'INV',balance:'125.00'};
    const line={lineId:'line',label:'Materials',gross:'25.00',available:'25.00',token:'old'};
    const lines=jasmine.createSpy().and.returnValues(of({lines:[line]}),of({lines:[{...line,token:'new'}]}));
    const preview=jasmine.createSpy().and.returnValue(of({allocations:[{invoiceId:'inv',amount:'30.00',remainingDue:'95.00',
      lines:[{...line,amount:'20.00'}],purposeUnassigned:'10.00'}],allocated:'30.00',unassigned:'10.00'}));
    TestBed.configureTestingModule({imports:[TrustInvoiceSuggestionPanel],providers:[{provide:StudentOperationsService,
      useValue:{trustSplitLines:lines,trustInvoiceSuggestions:()=>of({invoices:[candidate]}),previewTrustSplit:preview}}]});
    const fixture=TestBed.createComponent(TrustInvoiceSuggestionPanel);
    fixture.componentRef.setInput('connection','trust'); fixture.componentRef.setInput('deposit',deposit); fixture.detectChanges();
    const click=(label:string)=>{Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button'))
      .find(b=>b.textContent?.trim()===label)!.click();fixture.detectChanges();};
    click('Find possible invoices'); click('Add to split'); expect(lines).not.toHaveBeenCalled();
    fixture.componentInstance.split[0].amount='30';
    click('Choose invoice line purposes');
    const field=fixture.nativeElement.querySelector('input[placeholder="Amount for this line"]');
    field.value='20';field.dispatchEvent(new Event('input'));fixture.detectChanges();
    click('Check split against imported balances');
    expect(preview.calls.first().args[2][0].lines).toEqual([{lineId:'line',token:'old',amount:'20'}]);
    expect(fixture.nativeElement.textContent).toContain('AUD 10.00 without a line purpose');
    click('Refresh invoice lines');
    expect(fixture.componentInstance.preview).toBeUndefined();
    expect(fixture.componentInstance.split[0].lines).toEqual([]);
  });

  it('saves a checked split, replays an uncertain save, and releases the persisted revision',()=>{
    const candidate={id:'a',invoiceNumber:'INV-1',balance:'100.00'};
    const plan={allocations:[{invoiceId:'a',invoiceNumber:'INV-1',amount:'75.00',remainingDue:'25.00'}],allocated:'75.00',unassigned:'25.00'};
    const saved={action:'reserve',reason:'Remittance',revision:1,actor:'Manager',recordedAt:'2026-11-28T02:00:00Z',plan};
    const lookup=jasmine.createSpy().and.returnValues(of({invoices:[candidate]}),of({invoices:[candidate],reservation:saved}),of({invoices:[candidate]}));
    const write=jasmine.createSpy().and.returnValues(throwError(()=>({status:503})),of({revision:1}),of({revision:2}));
    TestBed.configureTestingModule({imports:[TrustInvoiceSuggestionPanel],providers:[{provide:StudentOperationsService,
      useValue:{trustInvoiceSuggestions:lookup,previewTrustSplit:()=>of(plan),changeTrustSplit:write}}]});
    const fixture=TestBed.createComponent(TrustInvoiceSuggestionPanel);
    fixture.componentRef.setInput('connection','trust'); fixture.componentRef.setInput('deposit',deposit); fixture.detectChanges();
    const panel=fixture.componentInstance;
    const click=(label:string)=>{Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button'))
      .find(b=>b.textContent?.trim()===label)!.click();fixture.detectChanges();};
    click('Find possible invoices'); click('Add to split'); panel.split[0].amount='75'; click('Check split against imported balances');
    click('Reserve split in Sophia'); expect(write).not.toHaveBeenCalled();
    panel.reservationReason='Remittance'; fixture.detectChanges(); click('Reserve split in Sophia'); click('Reserve split in Sophia');
    expect(write.calls.argsFor(0)).toEqual(write.calls.argsFor(1));
    expect(fixture.nativeElement.textContent).toContain('AUD 75.00 reserved');
    panel.reservationReason='Correction'; fixture.detectChanges(); click('Release split reservation');
    expect(write.calls.mostRecent().args[2]).toEqual(jasmine.objectContaining({action:'release',reason:'Correction',revision:1}));
  });

  it('records an explicit decision and reuses its key after an unconfirmed response',()=>{
    const candidate={id:'inv',invoiceNumber:'INV-1',balance:'100.00',evidenceToken:'a'.repeat(64),score:1,peers:1};
    const lookup=jasmine.createSpy().and.returnValue(of({page:1,revision:4,invoices:[candidate]}));
    const write=jasmine.createSpy().and.returnValues(throwError(()=>({status:503})),of({revision:5}));
    TestBed.configureTestingModule({imports:[TrustInvoiceSuggestionPanel],providers:[{provide:StudentOperationsService,useValue:{
      trustInvoiceSuggestions:lookup,recordTrustInvoiceDecision:write}}]});
    const fixture=TestBed.createComponent(TrustInvoiceSuggestionPanel);
    fixture.componentRef.setInput('deposit',deposit); fixture.componentRef.setInput('connection','trust'); fixture.detectChanges();
    const click=(label:string)=>Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button'))
      .find(b=>b.textContent?.trim()===label)!.click();
    click('Find possible invoices'); fixture.detectChanges();
    click('Record match decision'); fixture.detectChanges();
    click('Dismiss match'); expect(write).not.toHaveBeenCalled();
    fixture.componentInstance.reason='Checked remittance'; fixture.detectChanges();
    click('Dismiss match'); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Retry with the same reason');
    click('Dismiss match'); fixture.detectChanges();
    expect(write.calls.argsFor(0)).toEqual(write.calls.argsFor(1));
    expect(write.calls.first().args[2]).toEqual(jasmine.objectContaining({decision:'dismissed',reason:'Checked remittance',revision:4,evidenceToken:candidate.evidenceToken}));
    expect(fixture.nativeElement.textContent).toContain('Match decision recorded');
  });

  it('opens the saved review history on a verified receipt and retries an older page',()=>{
    const entry={decision:'accepted',reason:'Remittance confirmed',reviewer:'Test manager',reviewedAt:'2026-11-27T02:00:00Z',
      ruleVersion:1,evidence:{invoiceNumber:'INV-2',amountMatch:true,lookup:'manual',balance:'10.00',peers:1,score:1}};
    const history=jasmine.createSpy().and.returnValues(of({entries:[{...entry,revision:2}],next:2}),
      throwError(()=>({status:503})),of({entries:[{...entry,revision:1,reason:'Original reason'}],next:null}));
    const receipt={id:'receipt',reviewedDepositId:deposit.id,amount:'10.00',invoiceDue:'10.00',candidateIds:[]};
    TestBed.configureTestingModule({imports:[TrustReceiptForm],providers:[{provide:StudentOperationsService,useValue:{
      trustReceipts:()=>of([receipt]),trustInvoiceDecisionHistory:history}}]});
    const fixture=TestBed.createComponent(TrustReceiptForm);
    fixture.componentRef.setInput('connection','trust'); fixture.componentRef.setInput('invoice',{xeroInvoiceId:'invoice',status:'PAID',amountDue:0});
    fixture.detectChanges();
    const click=(label:string)=>{Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button')).find(b=>b.textContent?.trim()===label)!.click();fixture.detectChanges();};
    expect(history).not.toHaveBeenCalled();
    click('Match decision history'); click('Older decisions'); click('Retry review history');
    expect(history.calls.mostRecent().args).toEqual(['trust',deposit.id,2]);
    expect(fixture.nativeElement.textContent).toContain('Original reason');
    expect(fixture.nativeElement.textContent).toContain('Remittance confirmed');
  });

  it('fills a receipt from the reviewed deposit only after the manager chooses to use it',()=>{
    const verify=jasmine.createSpy();
    TestBed.configureTestingModule({imports:[TrustReceiptForm],providers:[{provide:StudentOperationsService,useValue:{
      trustReceipts:()=>of([]),verifyTrustReceipt:verify}}]});
    const fixture=TestBed.createComponent(TrustReceiptForm);
    fixture.componentRef.setInput('connection','trust');
    fixture.componentRef.setInput('invoice',{xeroInvoiceId:'invoice',currencyCode:'AUD',amountDue:2741.8,status:'AUTHORISED'});
    fixture.componentRef.setInput('reviewDeposit',deposit); fixture.detectChanges();
    expect(fixture.componentInstance.amount).toBe('');
    Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button')).find(b=>b.textContent?.includes('Use reviewed deposit'))!.click();
    expect(fixture.componentInstance.amount).toBe('2742.00');
    expect(fixture.componentInstance.bankTransactionId).toBe('BANK-1');
    expect(fixture.componentInstance.statementSource).toEqual(deposit.source);
    expect(verify).not.toHaveBeenCalled();
  });

  it('carries a saved row and its source to an invoice and waits for explicit verification',()=>{
    const verify=jasmine.createSpy().and.returnValue(of({id:'verified'}));
    TestBed.configureTestingModule({imports:[TrustReceiptForm],providers:[{provide:StudentOperationsService,useValue:{
      stagedTrustDeposits:()=>of({deposits:[deposit],hasMore:false}),trustReceipts:()=>of([]),verifyTrustReceipt:verify}}]});
    const fixture=TestBed.createComponent(TrustReceiptForm);
    fixture.componentRef.setInput('connection','trust');
    fixture.componentRef.setInput('invoice',{xeroInvoiceId:'invoice',currencyCode:'AUD',amountDue:2741.8,status:'AUTHORISED'});
    fixture.detectChanges();
    const picker=fixture.debugElement.query(By.directive(TrustStagedDeposits)).componentInstance as TrustStagedDeposits;
    picker.toggle(); picker.selected=deposit.id; fixture.detectChanges();
    Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button'))
      .find(b=>b.textContent?.includes('Replace receipt draft'))!.click();
    expect(fixture.componentInstance.account).toBe(deposit.account);
    expect(fixture.componentInstance.statementSource).toEqual(deposit.source);
    expect(verify).not.toHaveBeenCalled();
    fixture.componentInstance.save();
    const body=verify.calls.first().args[2] as FormData;
    expect(body.get('amount')).toBe('2742.00');
    expect(body.get('bankTransactionId')).toBe('BANK-1');
    expect(body.get('statementFileSha256')).toBe(deposit.source.sha256);
  });
});
