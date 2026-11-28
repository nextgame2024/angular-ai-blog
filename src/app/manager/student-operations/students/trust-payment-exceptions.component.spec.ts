import {TestBed} from '@angular/core/testing';
import {of,Subject,throwError} from 'rxjs';
import {StudentOperationsService} from '../student-operations.service';
import {TrustPaymentExceptions} from './trust-payment-exceptions.component';

describe('Consolidated TRUST payment follow-up',()=>{
  const row={invoice:'invoice',receipt:'receipt',payment:'payment',dispatch:'dispatch',amount:'3000.00',linkedAt:'2026-11-20',
    days:8,reason:'reversed',imported:'reconciled',direct:'unavailable',lastKnown:'deleted',lastKnownAt:'2026-11-22',previousDirectReconciled:true};
  function setup(){
    const list=jasmine.createSpy().and.returnValue(of({count:26,rows:[row]}));
    const claim=jasmine.createSpy().and.returnValue(of({claimId:'claim'}));
    TestBed.configureTestingModule({imports:[TrustPaymentExceptions],providers:[{provide:StudentOperationsService,useValue:{
      trustPaymentExceptions:list,changeTrustReviewClaim:claim}}]});
    const fixture=TestBed.createComponent(TrustPaymentExceptions);
    fixture.componentRef.setInput('connection','trust');fixture.detectChanges();
    const panel=fixture.componentInstance;
    const button=(label:string)=>Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button'))
      .find(b=>b.textContent?.trim()===label)!;
    return {list,claim,fixture,panel,button};
  }
  it('keeps sources distinct and opens the linked invoice without changing the filters',()=>{
    const {list,fixture,panel,button}=setup();expect(list).not.toHaveBeenCalled();
    panel.toggle();panel.q=' bank ';panel.owner='mine';panel.reason='reversed';panel.search();panel.sort();panel.load(2);fixture.detectChanges();
    expect(list.calls.mostRecent().args).toEqual(['trust',{q:'bank',reason:'reversed',owner:'mine',page:2,limit:25,direction:'desc'}]);
    const text=fixture.nativeElement.textContent;
    for(const label of ['Invoice import · Reconciled','Check unavailable','Last available bank result · Payment deleted','None recorded']) expect(text).toContain(label);
    const reviewed=jasmine.createSpy();panel.review.subscribe(reviewed);button('invoice').click();
    expect(reviewed).toHaveBeenCalledOnceWith('invoice');expect(panel.page).toBe(2);
  });
  it('uses the existing claim identity, refreshes stale assignments, and cancels work when switching organisation',()=>{
    const {fixture,panel,button,claim,list}=setup();panel.toggle();fixture.detectChanges();
    claim.and.returnValue(throwError(()=>({status:409})));button('Claim follow-up').click();fixture.detectChanges();
    expect(panel.message).toContain('assignment');expect(list.calls.count()).toBe(2);
    list.and.returnValue(of({count:1,rows:[{...row,mine:true,claimId:'claim'}]}));panel.load(1);fixture.detectChanges();
    const pending=new Subject();claim.and.returnValue(pending);button('Release follow-up').click();
    expect(claim.calls.mostRecent().args).toEqual(['trust','invoice','receipt','payment','claim']);
    fixture.componentRef.setInput('connection','other');fixture.detectChanges();expect(pending.observed).toBeFalse();expect(panel.open).toBeFalse();
  });
  it('fits desktop tables and mobile cards in both themes',()=>{
    const {fixture,panel}=setup();panel.toggle();fixture.detectChanges();
    const frame=document.createElement('iframe');document.body.appendChild(frame);
    try {
      const doc=frame.contentDocument!;for(const style of document.head.querySelectorAll('style'))doc.head.appendChild(style.cloneNode(true));
      doc.body.appendChild(fixture.nativeElement.cloneNode(true));
      for(const width of [375,1280]){
        frame.style.width=width+'px';
        for(const dark of [false,true]){
          doc.documentElement.classList.toggle('dark',dark);
          expect(frame.contentWindow!.getComputedStyle(doc.querySelector('thead')!).display==='none').toBe(width===375);
          for(const item of doc.querySelectorAll('table,button,input')) expect(item.getBoundingClientRect().right).toBeLessThanOrEqual(width);
        }
      }
    } finally { frame.remove(); }
  });
});
