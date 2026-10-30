import { TestBed,fakeAsync,tick } from '@angular/core/testing';
import { of,Subject,throwError } from 'rxjs';
import { CaseChecklistComponent } from './case-checklist.component';
import { StudentOperationsService } from '../student-operations/student-operations.service';

describe('CaseChecklistComponent',()=>{
  const items=[['signed_engagement_letter','Signed engagement letter'],['invoice_loo_consistency','Invoice/LoO consistency'],['document_completeness','Document completeness'],['pending_track_status','Pending Track status']]
    .map(([key,label])=>({key,label,completed:false,recordVersion:0,updatedBy:null,updatedAt:null}));
  let api:any;
  beforeEach(async()=>{
    api={caseChecklist:jasmine.createSpy().and.returnValue(of({status:'pre_sale',items})),caseChecklistProgress:jasmine.createSpy(),updateCaseChecklist:jasmine.createSpy()};
    await TestBed.configureTestingModule({imports:[CaseChecklistComponent],providers:[{provide:StudentOperationsService,useValue:api}]}).compileComponents();
  });
  function setup(id='case-1',status='pre_sale',manage=true){
    const f=TestBed.createComponent(CaseChecklistComponent);f.componentRef.setInput('caseId',id);f.componentRef.setInput('status',status);f.componentRef.setInput('canManage',manage);f.detectChanges();return f;
  }
  it('shows the four unchecked draft items without fetching or saving before the case exists',()=>{
    const f=setup('');expect(f.nativeElement.textContent).toContain('Save the case');
    const inputs=[...f.nativeElement.querySelectorAll('input')] as HTMLInputElement[];
    expect(inputs.length).toBe(4);expect(inputs.every(i=>i.disabled&&!i.checked)).toBeTrue();expect(api.caseChecklist).not.toHaveBeenCalled();
    expect(f.componentInstance.items.map(i=>i.key)).toEqual(['signed_engagement_letter','document_completeness','invoice_loo_consistency','pending_track_status']);
  });
  it('keeps document checks visible but read-only on hold',()=>{
    const f=setup('case-1','on_hold');expect(api.caseChecklist).toHaveBeenCalledOnceWith('case-1');expect(f.nativeElement.querySelectorAll('input').length).toBe(4);expect([...f.nativeElement.querySelectorAll('input')].every((i:any)=>i.disabled)).toBeTrue();
  });
  it('loads saved state only for Pre-sale cases and makes advisor controls read-only',()=>{
    const f=setup('case-1','in_progress');expect(api.caseChecklist).not.toHaveBeenCalled();expect(f.nativeElement.querySelector('input')).toBeNull();
    f.componentRef.setInput('status','pre_sale');f.componentRef.setInput('canManage',false);f.detectChanges();
    expect(api.caseChecklist).toHaveBeenCalledOnceWith('case-1');expect([...f.nativeElement.querySelectorAll('input')].every((i:any)=>i.disabled)).toBeTrue();
  });
  it('saves immediately, prevents duplicate ticks and emits an activity refresh after confirmed success',()=>{
    const f=setup(),pending=new Subject<any>();api.updateCaseChecklist.and.returnValue(pending);
    const changed=spyOn(f.componentInstance.changed,'emit');const input=f.nativeElement.querySelector('input') as HTMLInputElement;
    input.click();f.detectChanges();expect(input.checked).toBeFalse();expect(input.disabled).toBeTrue();
    expect(api.updateCaseChecklist).toHaveBeenCalledOnceWith('case-1',{itemKey:items[0].key,completed:true,recordVersion:0},jasmine.any(String));
    input.click();expect(api.updateCaseChecklist).toHaveBeenCalledTimes(1);
    pending.next({status:'pre_sale',items:items.map(i=>({...i,completed:true,recordVersion:1}))});f.detectChanges();
    expect(input.checked).toBeTrue();expect(changed).toHaveBeenCalledTimes(1);expect(f.componentInstance.message).toBe('Checklist complete.');
  });
  it('retains confirmed state and the same retry key for an uncertain save',()=>{
    const f=setup();api.updateCaseChecklist.and.returnValue(throwError(()=>({status:0})));
    const input=f.nativeElement.querySelector('input') as HTMLInputElement;input.click();f.detectChanges();const key=api.updateCaseChecklist.calls.mostRecent().args[2];
    expect(input.checked).toBeFalse();expect(f.componentInstance.message).toContain('Retry the same checkbox');
    input.click();expect(api.updateCaseChecklist.calls.mostRecent().args[2]).toBe(key);
  });
  it('requires reload after a conflict and does not replace state after navigating to another case',()=>{
    const f=setup();api.updateCaseChecklist.and.returnValue(throwError(()=>({status:409})));
    (f.nativeElement.querySelector('input') as HTMLInputElement).click();f.detectChanges();
    expect(f.nativeElement.querySelector('.retry')).not.toBeNull();expect(f.nativeElement.querySelector('input').disabled).toBeTrue();
    const pending=new Subject<any>();api.caseChecklist.and.returnValue(pending);f.componentInstance.load();
    f.componentRef.setInput('caseId','');f.detectChanges();pending.next({items:items.map(i=>({...i,completed:true}))});
    expect(f.componentInstance.complete).toBe(0);expect(f.componentInstance.loading).toBeFalse();
  });
  it('shows a timed error toast and retry when loading fails',()=>{
    api.caseChecklist.and.returnValue(throwError(()=>new Error('private details')));const f=setup();
    expect(f.componentInstance.message).not.toContain('private');expect(f.nativeElement.querySelector('app-manager-toast')).not.toBeNull();
    api.caseChecklist.and.returnValue(of({items,status:'pre_sale'}));(f.nativeElement.querySelector('.retry') as HTMLButtonElement).click();f.detectChanges();expect(f.nativeElement.querySelectorAll('input').length).toBe(4);
  });
  it('shows evidence-controlled items as read-only and refreshes them after document changes',()=>{
    api.caseChecklist.and.returnValue(of({status:'pre_sale',items:items.map((i,n)=>({...i,automatic:n===0||n===2,hint:'Updated from document checks.'}))}));
    const f=setup(),inputs=[...f.nativeElement.querySelectorAll('input')] as HTMLInputElement[];
    expect(inputs[0].disabled).toBeTrue();expect(inputs[2].disabled).toBeTrue();expect(inputs[1].disabled).toBeFalse();
    inputs[0].click();expect(api.updateCaseChecklist).not.toHaveBeenCalled();
    expect(f.nativeElement.textContent).toContain('Updated from document checks.');
    api.caseChecklist.and.returnValue(of({status:'pre_sale',items:items.map(i=>({...i,completed:true}))}));
    f.componentRef.setInput('refreshToken',1);f.detectChanges();expect(f.componentInstance.complete).toBe(4);expect(api.caseChecklist).toHaveBeenCalledTimes(2);
  });
  it('shows green completion and warning icons next to the checkbox, without warning on missing files',()=>{
    api.caseChecklist.and.returnValue(of({status:'pre_sale',items:items.map((i,n)=>({...i,completed:n===0,validationState:n===0?'passed':n===2?'needs_review':'missing'}))}));
    const f=setup(),rows=f.nativeElement.querySelectorAll('.checklist-item');
    expect(rows[0].querySelector('.checklist-controls [aria-label="Validation complete"]')).not.toBeNull();
    expect(rows[2].querySelector('.checklist-controls [aria-label="Pending review"]')).not.toBeNull();
    expect(rows[1].querySelector('.validation-icon')).toBeNull();
  });
  it('shows an explicit invoice waiting state instead of pretending validation is running',()=>{
    api.caseChecklist.and.returnValue(of({status:'pre_sale',items:items.map((i,n)=>({...i,automatic:true,validationState:n===1||n===3?'pending':'passed',hint:n===1||n===3?'Waiting for all reviewed invoices to be created.':'Confirmed.'}))}));
    const f=setup();expect(f.nativeElement.textContent).not.toContain('Checking');expect(f.nativeElement.textContent).toContain('Waiting for all reviewed invoices');
    expect(f.nativeElement.querySelectorAll('.validation-pending').length).toBe(2);
    expect([...f.nativeElement.querySelectorAll('input')].every((input:any)=>input.disabled)).toBeTrue();
  });
  it('does not poll financial checks over time; changes trigger a single refresh',fakeAsync(()=>{
    const f=setup();tick(60*60*1000);expect(api.caseChecklist).toHaveBeenCalledTimes(1);
    f.componentRef.setInput('refreshToken',1);f.detectChanges();expect(api.caseChecklist).toHaveBeenCalledTimes(2);
    tick(60*60*1000);expect(api.caseChecklist).toHaveBeenCalledTimes(2);f.destroy();
  }));
  it('observes only saved background status, refreshes completion once and then stops',fakeAsync(()=>{
    spyOnProperty(document,'hidden','get').and.returnValue(false);
    api.caseChecklist.and.returnValue(of({status:'pre_sale',items,progress:{revision:'pending',backgroundPending:true}}));
    api.caseChecklistProgress.and.returnValue(of({revision:'finished',backgroundPending:false}));
    const f=setup(),updated=spyOn(f.componentInstance.workflowUpdated,'emit');
    api.caseChecklist.and.returnValue(of({status:'pre_sale',items:items.map(i=>({...i,completed:true})),progress:{revision:'finished',backgroundPending:false}}));
    tick(5000);f.detectChanges();expect(f.componentInstance.complete).toBe(4);expect(updated).toHaveBeenCalledTimes(1);
    expect(api.caseChecklistProgress).toHaveBeenCalledOnceWith('case-1');expect(api.caseChecklist).toHaveBeenCalledTimes(2);
    tick(60*60*1000);expect(api.caseChecklistProgress).toHaveBeenCalledTimes(1);expect(api.caseChecklist).toHaveBeenCalledTimes(2);f.destroy();
  }));
  it('bounds status observation and exposes a manual refresh instead of polling indefinitely',fakeAsync(()=>{
    spyOnProperty(document,'hidden','get').and.returnValue(false);
    api.caseChecklist.and.returnValue(of({status:'pre_sale',items,progress:{revision:'pending',backgroundPending:true}}));
    api.caseChecklistProgress.and.returnValue(of({revision:'pending',backgroundPending:true}));
    const f=setup();tick(5*60*1000);f.detectChanges();expect(api.caseChecklistProgress).toHaveBeenCalledTimes(60);
    expect(api.caseChecklist).toHaveBeenCalledTimes(1);expect(f.nativeElement.textContent).toContain('Refresh status');
    tick(60*60*1000);expect(api.caseChecklistProgress).toHaveBeenCalledTimes(60);f.destroy();
  }));
  it('pauses hidden pages, cancels stale responses on navigation and stops after destruction',fakeAsync(()=>{
    const hidden=spyOnProperty(document,'hidden','get').and.returnValue(true),response=new Subject<any>();
    api.caseChecklist.and.returnValue(of({status:'pre_sale',items,progress:{revision:'pending',backgroundPending:true}}));
    api.caseChecklistProgress.and.returnValue(response);const f=setup(),updated=spyOn(f.componentInstance.workflowUpdated,'emit');
    tick(10000);expect(api.caseChecklistProgress).not.toHaveBeenCalled();hidden.and.returnValue(false);f.componentInstance.visibilityChanged();tick(5000);
    expect(api.caseChecklistProgress).toHaveBeenCalledTimes(1);f.componentRef.setInput('caseId','');f.detectChanges();response.next({revision:'finished',backgroundPending:false});
    expect(updated).not.toHaveBeenCalled();expect(f.componentInstance.complete).toBe(0);f.destroy();tick(60*60*1000);expect(api.caseChecklistProgress).toHaveBeenCalledTimes(1);
  }));
  it('stops on a status error without exposing details or blocking confirmed checklist rows',fakeAsync(()=>{
    spyOnProperty(document,'hidden','get').and.returnValue(false);
    api.caseChecklist.and.returnValue(of({status:'pre_sale',items,progress:{revision:'pending',backgroundPending:true}}));
    api.caseChecklistProgress.and.returnValue(throwError(()=>new Error('private SQL detail')));const f=setup();tick(5000);f.detectChanges();
    expect(f.componentInstance.failed).toBeFalse();expect(f.componentInstance.message).not.toContain('private');expect(f.nativeElement.textContent).toContain('Refresh status');
    tick(60000);expect(api.caseChecklistProgress).toHaveBeenCalledTimes(1);f.destroy();
  }));
  for(const width of [390,1440])for(const dark of [false,true])it(`fits accessible checklist controls at ${width}px, ${dark?'dark':'light'}`,()=>{
    const f=setup(),frame=document.createElement('iframe');frame.style.width=`${width}px`;document.body.appendChild(frame);
    try{
      const doc=frame.contentDocument!,win=frame.contentWindow!;document.querySelectorAll('style').forEach(s=>doc.head.appendChild(s.cloneNode(true)));doc.documentElement.classList.toggle('dark',dark);
      const host=f.nativeElement.cloneNode(true) as HTMLElement;doc.body.appendChild(host);
      expect(host.scrollWidth).toBeLessThanOrEqual(host.clientWidth+1);
      for(const label of host.querySelectorAll('label')){expect(label.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);expect(label.querySelector('input[type="checkbox"]')).not.toBeNull();}
      expect(win.getComputedStyle(host.querySelector('.checklist-item')!).color).toBe(dark?'rgb(193, 208, 230)':'rgb(66, 86, 117)');
    }finally{frame.remove();f.destroy();}
  });
});
