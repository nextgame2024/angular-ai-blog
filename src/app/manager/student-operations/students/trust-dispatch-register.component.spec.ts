import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { StudentOperationsService } from '../student-operations.service';
import { TrustDispatchRegister } from './trust-dispatch-register.component';

describe('TRUST payment dispatch register',()=>{
  function setup() {
    const read=jasmine.createSpy().and.returnValue(of({count:30,rows:[{id:'key',invoice:'inv',invoiceNumber:'INV-1',bankId:'B1',
      queuedAt:'2026-11-28T01:00:00Z',amount:'3000.00',status:'recorded',workerCheck:{status:'matched',attempt:2,at:'2026-11-28T01:00:00Z'},reviewer:'Reviewer'}]}));
    TestBed.configureTestingModule({imports:[TrustDispatchRegister],providers:[{provide:StudentOperationsService,useValue:{trustDispatches:read}}]});
    const fixture=TestBed.createComponent(TrustDispatchRegister);fixture.componentRef.setInput('connection','trust');fixture.detectChanges();
    return {fixture,read,panel:fixture.componentInstance};
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
  it('fits the queue on mobile and desktop in both themes',()=>{
    const {fixture,panel}=setup();panel.toggle();fixture.detectChanges();
    const frame=document.createElement('iframe');document.body.appendChild(frame);
    try {
      const doc=frame.contentDocument!;
      for (const style of document.head.querySelectorAll('style')) doc.head.appendChild(style.cloneNode(true));
      doc.body.appendChild(fixture.nativeElement.cloneNode(true));
      for (const width of [375,1280]) {
        frame.style.width=width+'px';
        for (const dark of [false,true]) {
          doc.documentElement.classList.toggle('dark',dark);
          for (const control of doc.querySelectorAll('table,input[type=search]')) expect(control.getBoundingClientRect().right).toBeLessThanOrEqual(width);
        }
      }
    } finally {frame.remove();}
  });
});
