import { TestBed } from '@angular/core/testing';
import { of,throwError } from 'rxjs';
import {TrustSubmissionReview} from './trust-submission-review.component';
import {By} from '@angular/platform-browser';
import { StudentOperationsService } from '../student-operations.service';
import { TrustDispatchRegister } from './trust-dispatch-register.component';

describe('TRUST payment dispatch register',()=>{
  function setup() {
    const read=jasmine.createSpy().and.returnValue(of({count:30,rows:[{id:'key',invoice:'inv',invoiceNumber:'INV-1',bankId:'B1',
      queuedAt:'2026-11-28T01:00:00Z',amount:'3000.00',status:'recorded',workerCheck:{status:'matched',attempt:2,at:'2026-11-28T01:00:00Z'},reviewer:'Reviewer'}]}));
    const history=jasmine.createSpy().and.returnValue(of({entries:[],next:null}));
    const save=jasmine.createSpy().and.returnValue(of({revision:1}));
    const recover=jasmine.createSpy().and.returnValue(of({status:'awaiting_verification'}));
    TestBed.configureTestingModule({imports:[TrustDispatchRegister],providers:[{provide:StudentOperationsService,useValue:{trustDispatches:read,submissionReviews:history,recordSubmissionReview:save,recoverTrustSubmission:recover}}]});
    const fixture=TestBed.createComponent(TrustDispatchRegister);fixture.componentRef.setInput('connection','trust');fixture.detectChanges();
    return {fixture,read,history,save,recover,panel:fixture.componentInstance};
  }
  it('loads on demand and preserves scoped search, ordering and pagination',()=>{
    const {read,fixture,panel}=setup();expect(read).not.toHaveBeenCalled();
    panel.toggle();fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Invoice check 2 · Matched at check time');
    const review=jasmine.createSpy();panel.review.subscribe(review);fixture.nativeElement.querySelector('.invoice-link').click();
    expect(review).toHaveBeenCalledWith('inv');
    panel.query=' B1 ';panel.status='cancelled';panel.search();panel.sortDate();panel.load(2);
    expect(read.calls.mostRecent().args).toEqual(['trust',{q:'B1',status:'cancelled',page:2,limit:25,direction:'asc'}]);
    fixture.componentRef.setInput('connection','other');fixture.detectChanges();expect(panel.open).toBeFalse();expect(panel.data).toBeUndefined();
  });
  it('shows the direct Xero check and staff report independently and links to the correct organisation',()=>{
    const {fixture,panel,read}=setup(),payment='12345678-1234-4234-8234-123456789abc';
    read.and.returnValue(of({count:1,rows:[{id:'dispatch',status:'confirmed',paymentId:payment,bankOutcome:'pending',
      bankCheckedAt:'2026-11-28T01:00:00Z',staffCheckedAt:'2026-11-27T01:00:00Z'}]}));
    fixture.componentRef.setInput('shortCode','!fixture');panel.toggle();fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Awaiting bank reconciliation');
    expect(fixture.nativeElement.textContent).toContain('Staff reported reconciliation');
    expect(fixture.nativeElement.textContent).toContain('Find & Match');
    expect(new URL(fixture.nativeElement.querySelector('a.invoice-link').href).searchParams.get('shortcode')).toBe('!fixture');
  });
  it('checks only on request, preserves evidence on a lost response and refreshes after a recorded review',()=>{
    const {fixture,panel,read,history,save,recover}=setup();
    read.and.returnValue(of({count:1,rows:[{id:'dispatch',invoice:'inv',receipt:'receipt',submittedAt:'2026-11-28',status:'submitted',reviewRevision:0}]}));
    panel.toggle();fixture.detectChanges();
    const child=fixture.debugElement.query(By.directive(TrustSubmissionReview)).componentInstance as TrustSubmissionReview;
    expect(recover).not.toHaveBeenCalled();expect(history).not.toHaveBeenCalled();
    child.toggle();child.check();expect(recover).toHaveBeenCalledOnceWith('trust','inv','receipt','dispatch');
    expect(child.message).toContain('could not be verified');
    child.save('close');expect(save).not.toHaveBeenCalled();
    save.and.returnValues(throwError(()=>({status:503})),of({revision:1}));
    child.evidence='Reviewed bank and Xero';child.save('close');child.save('close');
    expect(save.calls.argsFor(0)).toEqual(save.calls.argsFor(1));
    expect(save.calls.argsFor(1)[2]).toEqual({requestId:jasmine.any(String),revision:0,evidence:'Reviewed bank and Xero',action:'close'});
    expect(read.calls.count()).toBe(2);
  });
  it('keeps closed reviews available for rechecking and shows the audit trail after confirmation',()=>{
    const {fixture,panel,read,history,save}=setup();
    history.and.returnValue(of({entries:[{revision:1,action:'close',actor:'Reviewer',evidence:'Bank records checked'}],next:null}));
    const row={id:'dispatch',invoice:'inv',receipt:'receipt',submittedAt:'2026-11-28',reviewRevision:1,status:'review_closed'};
    read.and.returnValue(of({count:1,rows:[row]}));panel.toggle();fixture.detectChanges();
    const child=fixture.debugElement.query(By.directive(TrustSubmissionReview)).componentInstance as TrustSubmissionReview;
    child.toggle();fixture.detectChanges();expect(fixture.nativeElement.textContent).toContain('Reopen investigation');
    save.and.returnValue(throwError(()=>({status:409})));child.evidence='New evidence';child.save('investigate');child.save('investigate');
    expect(save).toHaveBeenCalledTimes(1);expect(child.stale).toBeTrue();
    read.and.returnValue(of({count:1,rows:[{...row,status:'confirmed'}]}));panel.load(1);fixture.detectChanges();
    fixture.debugElement.query(By.directive(TrustSubmissionReview)).componentInstance.toggle();fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Bank records checked');
    expect(fixture.nativeElement.querySelector('textarea')).toBeNull();
  });
  it('fits the queue on mobile and desktop in both themes',()=>{
    const {fixture,panel,read}=setup();
    read.and.returnValue(of({count:1,rows:[{id:'dispatch',invoice:'inv',receipt:'receipt',submittedAt:'2026-11-28',status:'submitted'}]}));
    panel.toggle();fixture.detectChanges();
    fixture.debugElement.query(By.directive(TrustSubmissionReview)).componentInstance.toggle();fixture.detectChanges();
    const frame=document.createElement('iframe');document.body.appendChild(frame);
    try {
      const doc=frame.contentDocument!;
      for (const style of document.head.querySelectorAll('style')) doc.head.appendChild(style.cloneNode(true));
      doc.body.appendChild(fixture.nativeElement.cloneNode(true));
      for (const width of [375,1280]) {
        frame.style.width=width+'px';
        for (const dark of [false,true]) {
          doc.documentElement.classList.toggle('dark',dark);
          for (const control of doc.querySelectorAll('table,input[type=search],textarea,button')) expect(control.getBoundingClientRect().right).toBeLessThanOrEqual(width);
        }
      }
    } finally {frame.remove();}
  });
});
