import {TestBed} from '@angular/core/testing';
import {of,throwError} from 'rxjs';
import {CollegeSettlementsComponent} from './college-settlements.component';
import {StudentOperationsService} from '../student-operations.service';
describe('Case college settlements',()=>{
  const row={id:'obligation',college:'College',gross:'100',balance:'100',direct:'10',trustDue:'25',fundingRisk:true,method:'gross'};
  function setup(){
    const api={collegeObligations:jasmine.createSpy().and.returnValue(of({row,total:1,offers:[],documents:[],colleges:[{value:'c',label:'College'}],schedules:[]})),
      collegeHistory:jasmine.createSpy().and.returnValue(of({rows:[{id:'p',kind:'direct_proof',reference:'Receipt 1',amount:'50',remaining:'25'}],more:false})),
      recordCollegeSettlement:jasmine.createSpy().and.returnValues(throwError(()=>({})),of({id:'saved'}))};
    TestBed.configureTestingModule({imports:[CollegeSettlementsComponent],providers:[{provide:StudentOperationsService,useValue:api}]});
    const f=TestBed.createComponent(CollegeSettlementsComponent);f.componentRef.setInput('caseId','case');f.detectChanges();
    return {f,p:f.componentInstance,api};
  }
  it('opens on demand and keeps a confirmation tied to the proof across a retry',()=>{
    const {f,p,api}=setup();expect(api.collegeObligations).not.toHaveBeenCalled();
    p.toggle();f.detectChanges();expect(f.nativeElement.textContent).toContain('Accountant review');
    p.startEvent(p.events[0]);Object.assign(p.entry,{date:'2026-01-01',reference:'college-1',evidence:'College acknowledgement'});
    p.save({invalid:false} as never);p.save({invalid:false} as never);
    expect(api.recordCollegeSettlement.calls.argsFor(0)).toEqual(api.recordCollegeSettlement.calls.argsFor(1));
    expect(api.recordCollegeSettlement.calls.first().args[2]).toEqual(jasmine.objectContaining({proof:'p',kind:'direct_confirmation',amount:'25'}));
  });
  it('keeps the obligation form within the viewport on mobile and desktop in both themes',()=>{
    const {f,p}=setup();p.toggle();p.startTerms();f.detectChanges();
    const frame=document.createElement('iframe');document.body.appendChild(frame);
    try{const doc=frame.contentDocument!;
      for(const style of document.head.querySelectorAll('style'))doc.head.appendChild(style.cloneNode(true));
      doc.body.appendChild(f.nativeElement.cloneNode(true));
      for(const width of [375,1280]){frame.style.width=width+'px';for(const dark of [false,true]){
        doc.documentElement.classList.toggle('dark',dark);
        for(const el of doc.querySelectorAll('button,input,textarea'))expect(el.getBoundingClientRect().right).toBeLessThanOrEqual(width);
      }}
    }finally{frame.remove();}
  });
});
