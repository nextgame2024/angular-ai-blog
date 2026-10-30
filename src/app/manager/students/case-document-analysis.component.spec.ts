import { TestBed } from '@angular/core/testing';
import { of,Subject,throwError } from 'rxjs';
import { CaseDocumentAnalysisComponent } from './case-document-analysis.component';
import { StudentOperationsService } from '../student-operations/student-operations.service';
import { provideHttpClient } from '@angular/common/http';
import { By } from '@angular/platform-browser';
import { CaseOfferReviewComponent } from './case-offer-review.component';
const result={documentId:'doc',jobId:'job',resultId:'result',status:'needs_review',reviewVersion:0,
  extraction:{kind:'passport' as const,studentName:'Example Student',evidence:[{page:1,quote:'Expiry date: 06 August 2035'}],issues:[],expiresOn:'2035-08-06',mrzExpiryMatches:true},
  reasons:['student_identity_needs_review'],reviewReason:null,decision:null,enabled:true};
describe('CaseDocumentAnalysisComponent',()=>{
  let api:any;
  beforeEach(async()=>{
    api={documentAnalysis:jasmine.createSpy().and.returnValue(of(result)),reviewDocumentAnalysis:jasmine.createSpy().and.returnValue(of({saved:true})),retryDocumentAnalysis:jasmine.createSpy().and.returnValue(of({queued:true})),startDocumentAnalysis:jasmine.createSpy().and.returnValue(of({queued:true}))};
    await TestBed.configureTestingModule({imports:[CaseDocumentAnalysisComponent],providers:[provideHttpClient(),{provide:StudentOperationsService,useValue:api}]}).compileComponents();
  });
  function setup(){const f=TestBed.createComponent(CaseDocumentAnalysisComponent);f.componentRef.setInput('caseId','case');f.componentRef.setInput('documentId','doc');f.componentRef.setInput('status','needs_review');f.componentRef.setInput('canManage',true);f.detectChanges();return f;}
  it('shows state without fetching private extraction until opened',()=>{
    const f=setup();expect(api.documentAnalysis).not.toHaveBeenCalled();expect(f.nativeElement.textContent).toContain('Pending review');
    f.componentInstance.open();f.detectChanges();expect(api.documentAnalysis).toHaveBeenCalledOnceWith('case','doc');expect(f.componentInstance.modal.nativeElement.open).toBeTrue();
    expect(f.nativeElement.textContent).toContain('Expiry date: 06 August 2035');
  });
  it('advisors see status without the review action',()=>{
    const f=setup();f.componentRef.setInput('canManage',false);f.detectChanges();f.componentInstance.open();
    expect(f.nativeElement.querySelector('.check-button')).toBeNull();expect(api.documentAnalysis).not.toHaveBeenCalled();
  });
  it('keeps automatically passed documents available for manager review',()=>{
    const f=setup();f.componentRef.setInput('status','passed');f.detectChanges();
    const button=f.nativeElement.querySelector('.check-button') as HTMLButtonElement;expect(button.textContent?.trim()).toBe('Passed');button.click();expect(api.documentAnalysis).toHaveBeenCalledOnceWith('case','doc');
  });
  it('keeps historical evidence readable but cannot confirm a superseded upload',()=>{
    api.documentAnalysis.and.returnValue(of({...result,currentForType:false}));const f=setup(),c=f.componentInstance;c.open();f.detectChanges();
    c.form.controls.reason.setValue('Reviewed old file');c.save('confirmed');expect(api.reviewDocumentAnalysis).not.toHaveBeenCalled();
    expect(f.nativeElement.textContent).toContain('Review the latest upload');expect(f.nativeElement.querySelector('button[type="submit"]').disabled).toBeTrue();
  });
  it('allows an empty note, sends corrected fields and version, and reuses the key on uncertain failure',()=>{
    const f=setup(),c=f.componentInstance;c.open();c.form.controls.expiresOn.setValue('2036-08-06');
    api.reviewDocumentAnalysis.and.returnValue(throwError(()=>({status:503})));c.save('confirmed');const first=api.reviewDocumentAnalysis.calls.mostRecent().args;
    expect(first[2]).toEqual(jasmine.objectContaining({expectedReviewVersion:0,resultId:'result',decision:'confirmed',reason:null,corrections:jasmine.objectContaining({expiresOn:'2036-08-06',mrzExpiryMatches:null})}));
    api.reviewDocumentAnalysis.and.returnValue(of({}));c.save('confirmed');expect(api.reviewDocumentAnalysis.calls.mostRecent().args[3]).toBe(first[3]);expect(c.modal.nativeElement.open).toBeFalse();
  });
  it('guards close and duplicate save while busy and cancels late reads on scope changes',()=>{
    const f=setup(),c=f.componentInstance,waiting=new Subject<any>();api.documentAnalysis.and.returnValue(waiting);c.open();
    f.componentRef.setInput('documentId','other');f.detectChanges();waiting.next(result);expect(c.data).toBeNull();
    api.documentAnalysis.and.returnValue(of(result));c.open();c.form.controls.reason.setValue('Checked');
    const save=new Subject<any>();api.reviewDocumentAnalysis.and.returnValue(save);c.save('confirmed');c.save('confirmed');c.close();expect(c.modal.nativeElement.open).toBeTrue();expect(api.reviewDocumentAnalysis).toHaveBeenCalledTimes(1);
    save.next({});expect(c.modal.nativeElement.open).toBeFalse();
  });
  it('requires explicit expiry verification when readings conflict',()=>{
    api.documentAnalysis.and.returnValue(of({...result,extraction:{...result.extraction,mrzExpiryMatches:false}}));const f=setup(),c=f.componentInstance;c.open();c.form.controls.reason.setValue('Original checked');c.save('confirmed');expect(api.reviewDocumentAnalysis).not.toHaveBeenCalled();
    c.form.controls.expiryVerified.setValue(true);c.save('confirmed');expect(api.reviewDocumentAnalysis.calls.mostRecent().args[2].corrections.mrzExpiryMatches).toBeNull();
  });
  it('retries saved files without invoking upload and emits a refresh',()=>{
    api.documentAnalysis.and.returnValue(of({...result,status:'check_failed',extraction:null,resultId:null}));const f=setup(),c=f.componentInstance;const changed=spyOn(c.changed,'emit');c.open();c.retry();expect(api.retryDocumentAnalysis).toHaveBeenCalledWith('case','doc','job',jasmine.any(String));expect(changed).toHaveBeenCalled();
  });
  it('starts an eligible saved file without reuploading it',()=>{
    api.documentAnalysis.and.returnValue(of({...result,status:'not_checked',extraction:null,resultId:null,jobId:null,canStart:true}));const f=setup(),c=f.componentInstance;c.open();f.detectChanges();expect(f.nativeElement.textContent).toContain('Check saved document');c.start();expect(api.startDocumentAnalysis).toHaveBeenCalledWith('case','doc',jasmine.any(String));
  });
  it('shows reload guidance on conflict and accessible error feedback',()=>{
    const f=setup(),c=f.componentInstance;c.open();c.form.controls.reason.setValue('Original checked');api.reviewDocumentAnalysis.and.returnValue(throwError(()=>({status:409})));c.save('rejected');f.detectChanges();expect(c.message).toContain('Reload');expect(f.nativeElement.querySelector('dialog app-manager-toast')).not.toBeNull();
  });
  for(const width of [390,1440])for(const dark of [false,true])it(`fits at ${width}px with touch targets in ${dark?'dark':'light'} mode`,()=>{
    const f=setup();f.componentInstance.open();f.detectChanges();
    const frame=document.createElement('iframe');frame.style.width=`${width}px`;frame.style.height='900px';document.body.appendChild(frame);
    try{
      const doc=frame.contentDocument!,win=frame.contentWindow!;document.querySelectorAll('style').forEach(style=>doc.head.appendChild(style.cloneNode(true)));doc.documentElement.classList.toggle('dark',dark);doc.body.style.margin='0';
      const host=f.nativeElement.cloneNode(true) as HTMLElement;doc.body.appendChild(host);const modal=host.querySelector('dialog')!;modal.removeAttribute('open');modal.showModal();
      expect(modal.scrollWidth).toBeLessThanOrEqual(modal.clientWidth+1);expect(modal.getBoundingClientRect().right).toBeLessThanOrEqual(width);
      for(const button of Array.from(modal.querySelectorAll('button')))expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
      expect(win.getComputedStyle(modal).backgroundColor).toBe(dark?'rgb(30, 41, 59)':'rgb(255, 255, 255)');
    }finally{frame.remove();f.destroy();}
  });
  for(const width of [390,1440])for(const dark of [false,true])it(`keeps the wide offer modal actions visible at ${width}px in ${dark?'dark':'light'} mode`,()=>{
    api.documentAnalysis.and.returnValue(of({...result,extraction:{kind:'letter_of_offer',studentName:'Example Student',collegeName:'Example College',abn:null,cricosProviderCode:null,currency:'AUD',statedTotalMinor:120000,
      courses:[{name:'English',code:null,startsOn:null,endsOn:null,duration:'12 weeks'}],fees:[{label:'Tuition',amountMinor:120000,conditional:false,condition:null}],
      instalments:Array.from({length:12},(_,i)=>({sequence:i+1,dueTerm:'Monthly',dueOn:null,totalMinor:10000,includedConditionalFeeMinor:0,components:[]})),evidence:[{page:1,quote:'Synthetic evidence'}],issues:[]}}));
    const f=setup();f.componentInstance.open();f.detectChanges();const offer=f.debugElement.query(By.directive(CaseOfferReviewComponent)).componentInstance as CaseOfferReviewComponent;
    const frame=document.createElement('iframe');frame.style.width=`${width}px`;frame.style.height='900px';document.body.appendChild(frame);
    try{
      const doc=frame.contentDocument!;document.querySelectorAll('style').forEach(style=>doc.head.appendChild(style.cloneNode(true)));doc.documentElement.classList.toggle('dark',dark);doc.body.style.margin='0';
      for(const tab of offer.tabs){offer.selectTab(tab.key);f.detectChanges();const host=f.nativeElement.cloneNode(true) as HTMLElement;doc.body.appendChild(host);const modal=host.querySelector('dialog')!;modal.removeAttribute('open');modal.showModal();
        expect(modal.scrollWidth).toBeLessThanOrEqual(modal.clientWidth+1);expect(modal.getBoundingClientRect().height).toBeLessThanOrEqual(830);if(width===1440)expect(modal.getBoundingClientRect().width).toBeGreaterThan(1000);
        const scroll=modal.querySelector('.offer-scroll')!;scroll.scrollTop=scroll.scrollHeight;
        const footer=modal.querySelector('.offer-footer')!;expect(footer.getBoundingClientRect().bottom).toBeLessThanOrEqual(modal.getBoundingClientRect().bottom);expect(footer.getBoundingClientRect().top).toBeGreaterThan(modal.getBoundingClientRect().top);
        expect(footer.querySelectorAll('button').length).toBe(2);for(const button of footer.querySelectorAll('button'))expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);modal.close();host.remove();
      }
    }finally{frame.remove();f.destroy();}
  });
});
