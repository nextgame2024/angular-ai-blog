import { TestBed } from '@angular/core/testing';
import { of,Subject,throwError } from 'rxjs';
import { CaseOfferReviewComponent,offerMoneyInput } from './case-offer-review.component';
import { StudentOperationsService } from '../student-operations/student-operations.service';
import { ManagerCollegesService } from '../services/manager.colleges.service';
import type { StudentDocumentAnalysis,StudentOfferExtraction } from '../student-operations/student-operations.types';
const source:StudentOfferExtraction={kind:'letter_of_offer',studentName:'Example Student',collegeName:'Example College',abn:null,cricosProviderCode:'03829G',currency:'AUD',statedTotalMinor:904000,evidence:[{page:2,quote:'Grand total $9040'}],issues:[],
  courses:[{name:'General English',code:'116682E',startsOn:'2027-01-25',endsOn:'2028-03-19',duration:'60 weeks'}],
  fees:[{label:'Tuition and materials',amountMinor:904000,conditional:false,condition:null},{label:'International transfer',amountMinor:2500,conditional:true,condition:'International payments only'}],
  instalments:[{sequence:1,dueTerm:'Immediately',dueOn:null,totalMinor:99500,includedConditionalFeeMinor:2500,components:[{label:'Material',amountMinor:5000},{label:'Tuition',amountMinor:72000}]},{sequence:2,dueTerm:null,dueOn:'2028-01-31',totalMinor:807000,includedConditionalFeeMinor:0,components:[]}]};
const result:StudentDocumentAnalysis={documentId:'doc',jobId:'job',resultId:'result',status:'needs_review',reviewVersion:0,extraction:source,reasons:[],reviewReason:null,decision:null,enabled:true,
  offer:{resolution:'exact',exactCollegeId:'college',candidates:[{collegeId:'college',name:'Example College',abn:null}],colleges:[{collegeId:'college',name:'Example College',abn:null}],currentCollegeId:null,selectedCollegeId:'college',caseRecordVersion:2,offerId:'offer',isCurrent:false,problems:[],totals:{statedTotalMinor:904000,instalmentTotalMinor:906500,includedConditionalFeesMinor:2500,baseInstalmentTotalMinor:904000,unexplainedDifference:false}}};
describe('CaseOfferReviewComponent',()=>{
  let api:any,colleges:any;
  beforeEach(async()=>{
    api={reviewDocumentAnalysis:jasmine.createSpy().and.returnValue(of({saved:true})),documentAnalysis:jasmine.createSpy().and.returnValue(of(result))};
    colleges={createFromOffer:jasmine.createSpy().and.returnValue(of({college:{collegeId:'new-college'}}))};
    await TestBed.configureTestingModule({imports:[CaseOfferReviewComponent],providers:[{provide:StudentOperationsService,useValue:api}]}).overrideComponent(CaseOfferReviewComponent,{set:{providers:[{provide:ManagerCollegesService,useValue:colleges}]}}).compileComponents();
  });
  function setup(input=result){const f=TestBed.createComponent(CaseOfferReviewComponent);f.componentRef.setInput('analysis',structuredClone(input));f.componentRef.setInput('caseId','case');f.componentRef.setInput('documentId','doc');f.detectChanges();return f;}
  it('keeps both totals and conditional fee without an applicability decision',()=>{
    const f=setup(),c=f.componentInstance;expect(c.paymentTotals).toEqual({total:906500,included:2500});expect(c.totalsDiffer).toBeFalse();
    c.form.controls.reason.setValue('Reviewed source');c.save('confirmed');const value=api.reviewDocumentAnalysis.calls.mostRecent().args[2];
    expect(value.expectedCaseVersion).toBe(2);expect(value.collegeId).toBe('college');expect(value.corrections.instalments[0]).toEqual(source.instalments[0]);expect(value.corrections.statedTotalMinor).toBe(904000);expect(value.corrections.fees[1].conditional).toBeTrue();expect(value).not.toEqual(jasmine.objectContaining({feeApplies:jasmine.anything()}));
  });
  it('parses money exactly and rejects fractions of cents, negatives and exponent input',()=>{
    expect(offerMoneyInput('995.00')).toBe(99500);expect(offerMoneyInput('0.29')).toBe(29);for(const value of ['-25','2.555','1e3','NaN',''])expect(offerMoneyInput(value)).toBeNull();
  });
  it('requires note, selected college and acknowledged unexplained totals',()=>{
    const f=setup(),c=f.componentInstance,notice=spyOn(c.problem,'emit');c.save('confirmed');expect(api.reviewDocumentAnalysis).not.toHaveBeenCalled();
    c.form.controls.reason.setValue('Difference reviewed');c.form.controls.total.setValue('9100.00');c.save('confirmed');expect(api.reviewDocumentAnalysis).not.toHaveBeenCalled();expect(notice).toHaveBeenCalledWith(jasmine.stringMatching('acknowledge'));
    c.form.controls.acknowledgeTotals.setValue(true);c.save('confirmed');expect(api.reviewDocumentAnalysis).toHaveBeenCalled();
  });
  it('does not replace the existing case college without explicit confirmation',()=>{
    const f=setup({...result,offer:{...result.offer!,currentCollegeId:'previous'}}),c=f.componentInstance;c.form.controls.reason.setValue('Reviewed');c.save('confirmed');expect(api.reviewDocumentAnalysis).not.toHaveBeenCalled();c.form.controls.replaceCollege.setValue(true);c.save('confirmed');expect(api.reviewDocumentAnalysis).toHaveBeenCalled();
  });
  it('keeps retry identity after an uncertain review and guards duplicate submissions',()=>{
    const f=setup(),c=f.componentInstance;c.form.controls.reason.setValue('Reviewed');api.reviewDocumentAnalysis.and.returnValue(throwError(()=>({status:503})));c.save('confirmed');const key=api.reviewDocumentAnalysis.calls.mostRecent().args[3];const waiting=new Subject<any>();api.reviewDocumentAnalysis.and.returnValue(waiting);c.save('confirmed');c.save('confirmed');expect(api.reviewDocumentAnalysis.calls.count()).toBe(2);expect(api.reviewDocumentAnalysis.calls.mostRecent().args[3]).toBe(key);waiting.next({});expect(c.busy).toBeFalse();
  });
  it('creates a college with current mandatory fields and preserves unsaved offer edits',()=>{
    const f=setup(),c=f.componentInstance;c.form.controls.courses.at(0).controls.name.setValue('Edited English');c.beginCollege();c.collegeForm.controls.college_name.setValue('New College');
    api.documentAnalysis.and.returnValue(of({...result,offer:{...result.offer!,colleges:[...result.offer!.colleges,{collegeId:'new-college',name:'New College',abn:null}]}}));c.createCollege();
    expect(colleges.createFromOffer.calls.mostRecent().args[0]).toEqual({college_name:'New College',owner_name:'',abn:'',notes:''});expect(c.form.controls.collegeId.value).toBe('new-college');expect(c.form.controls.courses.at(0).controls.name.value).toBe('Edited English');expect(c.analysis.offer?.caseRecordVersion).toBe(2);
  });
  it('rejects with a note even when extracted financial fields are incomplete',()=>{
    const f=setup(),c=f.componentInstance;c.form.controls.total.setValue('');c.form.controls.reason.setValue('Wrong offer');c.save('rejected');expect(api.reviewDocumentAnalysis.calls.mostRecent().args[2].corrections).toBeNull();
  });
  for(const width of [390,1440])for(const dark of [false,true])it(`fits offer fields at ${width}px in ${dark?'dark':'light'} mode`,()=>{
    const f=setup();const frame=document.createElement('iframe');frame.style.width=`${width}px`;frame.style.height='900px';document.body.appendChild(frame);
    try{const doc=frame.contentDocument!,win=frame.contentWindow!;document.querySelectorAll('style').forEach(s=>doc.head.appendChild(s.cloneNode(true)));doc.documentElement.classList.toggle('dark',dark);doc.body.style.margin='0';const host=f.nativeElement.cloneNode(true) as HTMLElement;host.style.display='block';host.style.width=`${Math.min(width-32,620)}px`;doc.body.appendChild(host);
      expect(host.scrollWidth).toBeLessThanOrEqual(host.clientWidth+1);for(const b of host.querySelectorAll<HTMLButtonElement>('button'))expect(b.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);expect(win.getComputedStyle(host.querySelector('input')!).backgroundColor).toBe(dark?'rgb(38, 52, 73)':'rgb(255, 255, 255)');
    }finally{frame.remove();f.destroy();}
  });
});
