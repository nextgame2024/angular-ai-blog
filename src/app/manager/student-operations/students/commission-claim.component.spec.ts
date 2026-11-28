import {TestBed} from '@angular/core/testing';
import {of,throwError} from 'rxjs';
import {CommissionClaimComponent} from './commission-claim.component';
import {StudentOperationsService} from '../student-operations.service';

describe('Commission claim review',()=>{
  function setup(){
    const data={token:'calculation',history:[],candidates:[],canCreate:true,totals:{allocations:[],cash:0,offset:0,disputed:0,outstanding:3300,sources:[]}};
    const api={commissionClaim:jasmine.createSpy().and.returnValue(of(data)),commissionCommand:jasmine.createSpy().and.returnValue(throwError(()=>({})))};
    TestBed.configureTestingModule({imports:[CommissionClaimComponent],providers:[{provide:StudentOperationsService,useValue:api}]});
    const f=TestBed.createComponent(CommissionClaimComponent);f.componentRef.setInput('caseId','case');f.componentRef.setInput('obligation','obligation');f.detectChanges();
    return {f,p:f.componentInstance,api};
  }
  it('loads on demand and retries the same eligibility decision with the same request ID',()=>{
    const {p,api}=setup();expect(api.commissionClaim).not.toHaveBeenCalled();p.toggle();
    p.policy='College terms';p.earnedOn='2026-01-01';p.decision='eligible';
    p.save({invalid:false} as never,'review');p.save({invalid:false} as never,'review');
    expect(api.commissionCommand.calls.argsFor(0)).toEqual(api.commissionCommand.calls.argsFor(1));
    expect(api.commissionCommand.calls.first().args[3]).toEqual(jasmine.objectContaining({decision:'eligible',token:'calculation',revision:0}));
  });
  it('keeps an unverified historical match visible and suppresses a duplicate draft',()=>{
    const {f,p,api}=setup();
    api.commissionClaim.and.returnValue(of({history:[],canCreate:true,candidates:[{id:'historic',verified:false}],
      totals:{allocations:[],sources:[],outstanding:3300,cash:0,offset:0,disputed:0}}));
    p.toggle();f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Link the matching historical PTY invoice');
    expect(f.nativeElement.textContent).not.toContain('Create PTY draft');
  });
  it('requires explicit approval to submit a PTY draft and blocks read-only commands',()=>{
    const {p,api}=setup();p.toggle();p.save({invalid:false} as never,'create');expect(api.commissionCommand).not.toHaveBeenCalled();
    p.confirmCreate=true;p.readonly=true;p.save({invalid:false} as never,'create');expect(api.commissionCommand).not.toHaveBeenCalled();
    p.readonly=false;p.save({invalid:false} as never,'create');expect(api.commissionCommand.calls.first().args[2]).toBe('invoice');
  });
});
