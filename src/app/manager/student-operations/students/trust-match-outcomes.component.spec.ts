import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { StudentOperationsService } from '../student-operations.service';
import { TrustMatchOutcomesPanel } from './trust-match-outcomes.component';

const report={
  total:5,reviewed:3,counts:{same_invoice:1,different_invoice:1,unreviewed:2,no_acceptance:1},
  medianReviewMinutes:2.5,bands:[{lookup:'manual',score:1,version:1,verified:2,agreed:1}],
  deposits:[{id:'staged',date:'2026-11-13',transactionId:'BANK-1',amount:'2742.00',outcome:'different_invoice',
    acceptedNumber:'INV-10',verifiedNumber:'INV-20'}],filteredTotal:5,page:1,limit:25,
};

describe('TRUST match outcomes',()=>{
  function setup(read:jasmine.Spy) {
    TestBed.configureTestingModule({imports:[TrustMatchOutcomesPanel],providers:[{provide:StudentOperationsService,useValue:{trustMatchOutcomes:read}}]});
    const fixture=TestBed.createComponent(TrustMatchOutcomesPanel);
    fixture.componentRef.setInput('connection','trust');
    fixture.detectChanges();
    return fixture;
  }
  it('compares only accepted and verified deposits, and retains the cohort totals when filtering',()=>{
    const read=jasmine.createSpy().and.returnValue(of(report));
    const fixture=setup(read);
    expect(read).not.toHaveBeenCalled();
    const panel=fixture.componentInstance;
    fixture.nativeElement.querySelector('button').click(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('1 of 2 verified deposits');
    expect(fixture.nativeElement.textContent).toContain('(50%)');
    expect(fixture.nativeElement.textContent).toContain('2.5 minutes');
    expect(fixture.nativeElement.textContent).toContain('INV-20');
    panel.outcome='different_invoice';panel.from='2026-11-01';panel.to='2026-11-27';panel.apply();fixture.detectChanges();
    expect(read.calls.mostRecent().args).toEqual(['trust',{page:1,limit:25,sort:'date',direction:'desc',from:'2026-11-01',to:'2026-11-27',outcome:'different_invoice'}]);
    expect(fixture.nativeElement.textContent).toContain('3 of 5 deposits');
    panel.to='2025-11-27'; panel.apply();fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Choose a deposit date range');
    expect(read.calls.count()).toBe(2);
  });
  it('retries the same query and reports missing observations without a percentage',()=>{
    const read=jasmine.createSpy().and.returnValues(throwError(()=>new Error('offline')),of({...report,total:0,reviewed:0,
      medianReviewMinutes:null,bands:[],counts:{},deposits:[],filteredTotal:0}));
    const fixture=setup(read);fixture.componentInstance.toggle();fixture.detectChanges();
    Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button')).find(b=>b.textContent?.includes('Retry report'))!.click();
    fixture.detectChanges();
    expect(read.calls.argsFor(0)).toEqual(read.calls.argsFor(1));
    expect(fixture.nativeElement.textContent).toContain('No verified deposits with an accepted match to compare');
    expect(fixture.nativeElement.textContent).not.toContain('%');
  });
  it('keeps deposit details visible on mobile and desktop in both themes',()=>{
    const fixture=setup(jasmine.createSpy().and.returnValue(of(report)));
    fixture.componentInstance.toggle();fixture.detectChanges();
    const frame=document.createElement('iframe');document.body.appendChild(frame);
    try {
      const doc=frame.contentDocument!;
      for(const style of document.head.querySelectorAll('style')) doc.head.appendChild(style.cloneNode(true));
      doc.body.appendChild(fixture.nativeElement.cloneNode(true));
      for(const width of [375,1280]) {
        frame.style.width=width+'px';
        for(const dark of [false,true]) {
          doc.documentElement.classList.toggle('dark',dark);
          for(const cell of doc.querySelectorAll('tbody td')) {
            const rect=cell.getBoundingClientRect();
            expect(rect.width).toBeGreaterThan(0);
            expect(rect.right).toBeLessThanOrEqual(width);
          }
        }
      }
    } finally {frame.remove();}
  });
});
