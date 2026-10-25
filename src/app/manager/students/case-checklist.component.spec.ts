import { TestBed } from '@angular/core/testing';
import { of,Subject,throwError } from 'rxjs';
import { CaseChecklistComponent } from './case-checklist.component';
import { StudentOperationsService } from '../student-operations/student-operations.service';

describe('CaseChecklistComponent',()=>{
  const items=[['signed_engagement_letter','Signed engagement letter'],['invoice_loo_consistency','Invoice/LoO consistency'],['document_completeness','Document completeness'],['pending_track_status','Pending Track status']]
    .map(([key,label])=>({key,label,completed:false,recordVersion:0,updatedBy:null,updatedAt:null}));
  let api:any;
  beforeEach(async()=>{
    api={caseChecklist:jasmine.createSpy().and.returnValue(of({status:'pre_sale',items})),updateCaseChecklist:jasmine.createSpy()};
    await TestBed.configureTestingModule({imports:[CaseChecklistComponent],providers:[{provide:StudentOperationsService,useValue:api}]}).compileComponents();
  });
  function setup(id='case-1',status='pre_sale',manage=true){
    const f=TestBed.createComponent(CaseChecklistComponent);f.componentRef.setInput('caseId',id);f.componentRef.setInput('status',status);f.componentRef.setInput('canManage',manage);f.detectChanges();return f;
  }
  it('shows the four unchecked draft items without fetching or saving before the case exists',()=>{
    const f=setup('');expect(f.nativeElement.textContent).toContain('Save the case');
    const inputs=[...f.nativeElement.querySelectorAll('input')] as HTMLInputElement[];
    expect(inputs.length).toBe(4);expect(inputs.every(i=>i.disabled&&!i.checked)).toBeTrue();expect(api.caseChecklist).not.toHaveBeenCalled();
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
