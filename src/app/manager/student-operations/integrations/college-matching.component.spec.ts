import {TestBed,ComponentFixture} from '@angular/core/testing';
import {of,Subject} from 'rxjs';
import {CollegeMatchingComponent} from './college-matching.component';
import {StudentOperationsService} from '../student-operations.service';

describe('PTY college matching',()=>{
  let fixture:ComponentFixture<CollegeMatchingComponent>;
  const row={contactId:'contact',name:'Australian College of Commerce & Information Technology Pty Ltd',email:'college@example.invalid',contactStatus:'ACTIVE',collegeId:null,collegeName:null,classification:'unresolved' as const,revision:0,invoiceCount:8};
  const result={items:[row],total:1,page:1,limit:25,colleges:[{collegeId:'college',name:row.name}]};
  let api:{xeroCollegeMatches:jasmine.Spy;resolveXeroCollege:jasmine.Spy};
  beforeEach(async()=>{api={xeroCollegeMatches:jasmine.createSpy().and.returnValue(of(result)),resolveXeroCollege:jasmine.createSpy().and.returnValue(of({}))};
    await TestBed.configureTestingModule({imports:[CollegeMatchingComponent],providers:[{provide:StudentOperationsService,useValue:api}]}).compileComponents();
    fixture=TestBed.createComponent(CollegeMatchingComponent);fixture.componentRef.setInput('connectionId','pty');fixture.detectChanges();});
  it('requires an explicit college and retains the provider contact identity when saving',()=>{
    const c=fixture.componentInstance;c.review(row);c.save('college');expect(api.resolveXeroCollege).not.toHaveBeenCalled();
    c.college.setValue('college');c.save('college');expect(api.resolveXeroCollege).toHaveBeenCalledOnceWith('pty','contact',{classification:'college',collegeId:'college',expectedRevision:0});
  });
  it('classifies other business income without creating a college or student',()=>{
    const c=fixture.componentInstance;c.review(row);c.save('other');expect(api.resolveXeroCollege).toHaveBeenCalledOnceWith('pty','contact',{classification:'other',collegeId:null,expectedRevision:0});
  });
  it('ignores late responses after changing organisation',()=>{
    const late=new Subject<typeof result>();api.xeroCollegeMatches.and.returnValue(late);fixture.componentInstance.load();
    api.xeroCollegeMatches.and.returnValue(of({...result,items:[]}));fixture.componentRef.setInput('connectionId','another-pty');fixture.detectChanges();late.next(result);
    expect(fixture.componentInstance.data?.items).toEqual([]);
  });
  it('sorts and paginates on the server',()=>{
    const c=fixture.componentInstance;c.sort();c.pageSize.setValue('50');expect(api.xeroCollegeMatches.calls.mostRecent().args).toEqual(['pty',{page:1,limit:50,q:'',status:'all',direction:'desc'}]);
  });
  it('makes trading names and acronyms searchable while retaining the college identity',()=>{
    api.xeroCollegeMatches.and.returnValue(of({...result,colleges:[{collegeId:'college',name:'Legal Education Holdings Pty Ltd',tradingName:'English Unlimited',acronym:'EU'}]}));
    const c=fixture.componentInstance;c.load();const options=c.options;fixture.detectChanges();fixture.detectChanges();
    expect(c.options).toBe(options);expect(c.options[0]).toEqual({value:'college',label:'Legal Education Holdings Pty Ltd — English Unlimited — EU'});
  });
  for(const width of [390,1440])for(const dark of [false,true])it(`keeps contact review usable at ${width}px in ${dark?'dark':'light'} mode`,()=>{
    fixture.componentInstance.review(row);fixture.detectChanges();const frame=document.createElement('iframe');frame.style.width=`${width}px`;frame.style.height='1000px';document.body.appendChild(frame);
    try{const doc=frame.contentDocument!,win=frame.contentWindow!;document.querySelectorAll('style').forEach(s=>doc.head.appendChild(s.cloneNode(true)));doc.documentElement.classList.toggle('dark',dark);doc.body.style.margin='0';
      const host=fixture.nativeElement.cloneNode(true) as HTMLElement;doc.body.appendChild(host);const section=doc.querySelector('section') as HTMLElement;
      expect(section.scrollWidth).toBeLessThanOrEqual(section.clientWidth+1);expect(win.getComputedStyle(section).backgroundColor).toBe(dark?'rgb(17, 24, 39)':'rgb(255, 255, 255)');
      const button=doc.querySelector('.primary') as HTMLElement;expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
      expect(win.getComputedStyle(doc.querySelector('thead')!).display).toBe(width===390?'none':'table-header-group');
    }finally{frame.remove();}
  });
});
