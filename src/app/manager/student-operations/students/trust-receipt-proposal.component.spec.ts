import { TestBed } from '@angular/core/testing';
import { of,throwError } from 'rxjs';
import { StudentOperationsService } from '../student-operations.service';
import { TrustReceiptProposalPanel } from './trust-receipt-proposal.component';

describe('Verified TRUST receipt proposals',()=>{
  const snapshot={invoiceNumber:'INV-1',contactName:'Student',amount:'3000.00',due:'3500.00',account:'TRUST',bankId:'BANK-1'};
  const initial={state:'new',token:'one',revision:0,snapshot,history:[],blocked:null};
  const event={action:'prepare',snapshot,token:'one',reason:'Checked'};
  const prepared={...initial,state:'prepared',revision:1,history:[event]};
  function setup() {
    const read=jasmine.createSpy().and.returnValues(of(initial),of(prepared),of({...prepared,state:'approved'}));
    const write=jasmine.createSpy().and.returnValues(throwError(()=>({status:503})),of({revision:1}),of({revision:2}));
    const enqueue=jasmine.createSpy().and.returnValues(throwError(()=>({status:503})),of({id:'payment-key'}));
    const cancel=jasmine.createSpy().and.returnValue(of({id:'payment-key'}));
    TestBed.configureTestingModule({imports:[TrustReceiptProposalPanel],providers:[{provide:StudentOperationsService,
      useValue:{enqueueTrustPayment:enqueue,cancelTrustDispatch:cancel,trustReceiptProposal:read,changeTrustProposal:write}}]});
    const fixture=TestBed.createComponent(TrustReceiptProposalPanel);
    fixture.componentRef.setInput('connection','trust');fixture.componentRef.setInput('invoice','inv');fixture.componentRef.setInput('receipt',{id:'receipt'});
    fixture.detectChanges();
    const click=(label:string)=>{Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button'))
      .find(b=>b.textContent?.trim()===label)!.click();fixture.detectChanges();};
    return {read,write,enqueue,cancel,fixture,click,panel:fixture.componentInstance};
  }
  it('requires an explicit review, replays an uncertain save and binds approval to the reviewed revision',()=>{
    const {read,write,fixture,click,panel}=setup();
    expect(read).not.toHaveBeenCalled();click('Payment proposal');click('Prepare payment proposal');
    expect(write).not.toHaveBeenCalled();
    panel.reason='Checked deposit';fixture.detectChanges();click('Prepare payment proposal');click('Prepare payment proposal');
    expect(write.calls.argsFor(0)).toEqual(write.calls.argsFor(1));
    expect(panel.reason).toBe('');
    panel.reason='Approved details';fixture.detectChanges();click('Approve proposal in Sophia');
    expect(write.calls.mostRecent().args[3]).toEqual(jasmine.objectContaining({revision:1,action:'approve',token:'one'}));
    expect(fixture.nativeElement.textContent).toContain('Approved in Sophia');
  });
  it('queues once on retry and cancels by durable dispatch ID',()=>{
    const {read,enqueue,cancel,fixture,click,panel}=setup();
    const approved={...prepared,state:'approved',releaseCheck:null,revision:2};
    read.and.returnValues(of(approved),of({...approved,dispatch:{id:'payment-key',revision:2,actor:'Other',reason:'Release'}}),
      of({...approved,dispatch:{id:'payment-key',revision:2,cancelledAt:'2026-11-28T00:00:00Z'}}));
    click('Payment proposal');click('Queue payment locally');expect(enqueue).not.toHaveBeenCalled();
    panel.reason='Release';fixture.detectChanges();click('Queue payment locally');click('Queue payment locally');
    expect(enqueue.calls.argsFor(0)).toEqual(enqueue.calls.argsFor(1));expect(panel.canQueue).toBeFalse();
    panel.reason='Correction';fixture.detectChanges();click('Cancel queued payment');
    expect(cancel.calls.first().args[3]).toEqual({dispatchId:'payment-key',reason:'Correction'});expect(panel.canQueue).toBeFalse();
  });

  it('keeps review controls visible on narrow and desktop screens in both themes',()=>{
    const {fixture,click}=setup();click('Payment proposal');
    const frame=document.createElement('iframe');document.body.appendChild(frame);
    try {
      const doc=frame.contentDocument!;
      for (const style of document.head.querySelectorAll('style')) doc.head.appendChild(style.cloneNode(true));
      doc.body.appendChild(fixture.nativeElement.cloneNode(true));
      for (const width of [375,1280]) {
        frame.style.width=width+'px';
        for (const dark of [false,true]) {
          doc.documentElement.classList.toggle('dark',dark);
          for (const control of doc.querySelectorAll('button,textarea')) {
            const rect=control.getBoundingClientRect();expect(rect.width).toBeGreaterThan(0);expect(rect.right).toBeLessThanOrEqual(width);
          }
        }
      }
    } finally {frame.remove();}
  });

  it('withdraws a stale snapshot using its original token and refreshes after concurrent changes',()=>{
    const {read,write,fixture,click,panel}=setup();
    read.and.returnValue(of({...prepared,state:'stale',token:'changed',blocked:'Review imported payment'}));
    write.and.returnValue(throwError(()=>({status:409})));click('Payment proposal');
    expect(panel.canPrepare || panel.canApprove).toBeFalse();
    panel.reason='Payment exists';fixture.detectChanges();click('Withdraw proposal');
    expect(write.calls.first().args[3].token).toBe('one');
    expect(fixture.nativeElement.textContent).toContain('proposal changed');
    fixture.componentRef.setInput('receipt',{id:'different'});fixture.detectChanges();expect(panel.open).toBeFalse();
  });
});
