import {TestBed,ComponentFixture} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {of,Subject,throwError} from 'rxjs';
import {SyncCollegesPageComponent} from './sync-colleges.page';
import {StudentOperationsService} from '../student-operations.service';

describe('Sync colleges page',()=>{
  let fixture:ComponentFixture<SyncCollegesPageComponent>,api:{xeroStatus:jasmine.Spy;xeroCollegeMatches:jasmine.Spy};
  beforeEach(async()=>{api={xeroStatus:jasmine.createSpy().and.returnValue(of({connections:[{connectionId:'trust',status:'active',organisationRole:'trust',tenantName:'Trust'},{connectionId:'pty',status:'active',organisationRole:'operating',tenantName:'PTY'}]})),xeroCollegeMatches:jasmine.createSpy().and.returnValue(of({items:[],total:0,page:1,limit:25,colleges:[]}))};
    await TestBed.configureTestingModule({imports:[SyncCollegesPageComponent],providers:[provideRouter([]),{provide:StudentOperationsService,useValue:api}]}).compileComponents();
    fixture=TestBed.createComponent(SyncCollegesPageComponent);
  });
  it('loads only the configured PTY queue with one local connection lookup',()=>{fixture.detectChanges();fixture.detectChanges();expect(fixture.componentInstance.connection.value).toBe('pty');expect(api.xeroStatus).toHaveBeenCalledTimes(1);expect(api.xeroCollegeMatches).toHaveBeenCalledTimes(1);expect(fixture.nativeElement.textContent).toContain('Sync colleges');});
  it('shows access errors without loading the contact directory',()=>{api.xeroStatus.and.returnValue(throwError(()=>({status:403})));fixture.detectChanges();expect(api.xeroCollegeMatches).not.toHaveBeenCalled();expect(fixture.componentInstance.error).toContain('Chief Executives');});
  it('cancels responses after leaving the page',()=>{const late=new Subject<any>();api.xeroStatus.and.returnValue(late);fixture.detectChanges();fixture.destroy();late.next({connections:[{connectionId:'pty',status:'active',organisationRole:'operating'}]});expect(fixture.componentInstance.connection.value).toBe('');});
});
