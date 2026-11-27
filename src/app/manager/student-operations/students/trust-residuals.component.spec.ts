import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { StudentOperationsService } from '../student-operations.service';
import { TrustResidualsPanel } from './trust-residuals.component';

describe('Student residual review',()=>{
  const row={id:'deposit',reservation:1,revision:0,bankId:'BANK-1',date:'2026-11-20',days:8,amount:'2.00',
    studentId:null,student:null,reference:null};
  const detail={reservation:1,revision:0,amount:'2.00',history:[],choices:[{id:'student',name:'Example',reference:'S42'}]};
  function setup() {
    const list=jasmine.createSpy().and.returnValue(of({count:1,total:'2.00',rows:[row]}));
    const review=jasmine.createSpy().and.returnValue(of(detail));
    const write=jasmine.createSpy().and.returnValues(throwError(()=>({status:503})),of({revision:1}));
    TestBed.configureTestingModule({imports:[TrustResidualsPanel],providers:[{provide:StudentOperationsService,
      useValue:{trustResiduals:list,trustResidual:review,reviewTrustResidual:write}}]});
    const fixture=TestBed.createComponent(TrustResidualsPanel);
    fixture.componentRef.setInput('connection','trust');fixture.detectChanges();
    const click=(label:string)=>{
      Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button')).find(b=>b.textContent?.trim()===label)!.click();
      fixture.detectChanges();
    };
    return {fixture,panel:fixture.componentInstance,list,review,write,click};
  }
  it('loads on demand and requires explicit attribution and reason with a stable key on retry',()=>{
    const {fixture,panel,list,review,write,click}=setup();
    expect(list).not.toHaveBeenCalled();
    click('Student residuals');expect(review).not.toHaveBeenCalled();
    click('Review residual');expect(panel.student).toBe('');
    click('Save attribution');expect(write).not.toHaveBeenCalled();
    panel.student='student';panel.reason='Reviewed remittance';fixture.detectChanges();
    click('Save attribution');click('Save attribution');
    expect(write.calls.argsFor(0)).toEqual(write.calls.argsFor(1));
    expect(write.calls.first().args[2]).toEqual(jasmine.objectContaining({studentId:'student',revision:0,reservation:1}));
    expect(list).toHaveBeenCalledTimes(2);
    expect(panel.detail).toBeUndefined();
    expect(fixture.nativeElement.textContent).toContain('Residual attribution recorded.');
  });
  it('sends filters and sorting to the server and discards a stale review',()=>{
    const {fixture,panel,list,review,write,click}=setup();
    click('Student residuals');panel.query=' S42 ';panel.status='assigned';click('Search and refresh');
    panel.filterStudent({...row,studentId:'student',student:'Example',reference:'S42'});
    expect(list.calls.mostRecent().args[1].studentId).toBe('student');
    panel.studentFilter=undefined;panel.query=' S42 ';panel.status='assigned';panel.search();
    panel.order('amount');expect(list.calls.mostRecent().args[1]).toEqual(jasmine.objectContaining({q:'S42',status:'assigned',sort:'amount'}));
    review.and.returnValue(of({...detail,choices:[],history:[{studentId:'old',student:'Original',reason:'Evidence',revision:1}]}));
    panel.review(row);fixture.detectChanges();
    expect(panel.students.some(s=>s.label.includes('link requires review'))).toBeTrue();
    panel.student='';panel.reason='Different payer';write.and.returnValue(throwError(()=>({status:409})));
    panel.save();expect(panel.detail).toBeUndefined();expect(panel.message).toContain('Reopen');
    fixture.componentRef.setInput('connection','another');fixture.detectChanges();
    expect(panel.open).toBeFalse();expect(panel.query).toBe('');
  });
  it('keeps residual review controls visible on mobile and desktop in both themes',()=>{
    const {fixture,click}=setup();click('Student residuals');click('Review residual');
    const frame=document.createElement('iframe');document.body.appendChild(frame);
    try {
      const doc=frame.contentDocument!;
      for (const style of document.head.querySelectorAll('style')) doc.head.appendChild(style.cloneNode(true));
      doc.body.appendChild(fixture.nativeElement.cloneNode(true));
      for (const width of [375,1280]) {
        frame.style.width=width+'px';
        for (const dark of [false,true]) {
          doc.documentElement.classList.toggle('dark',dark);
          for (const el of doc.querySelectorAll('table,textarea,input[type=search]')) {
            expect(el.getBoundingClientRect().right).toBeLessThanOrEqual(width);
          }
        }
      }
    } finally {frame.remove();}
  });
});
