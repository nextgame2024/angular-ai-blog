import {TestBed,ComponentFixture} from '@angular/core/testing';
import {of,Subject,throwError} from 'rxjs';
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
  it('offers student linking and keeps unmatched contacts pending',()=>{
    const c=fixture.componentInstance;c.review({...row,name:'C30 Laura Garcia Lopez'});c.kind.setValue('student');
    expect(c.kinds.map(x=>x.value)).toEqual(['college','supplier','student']);
    c.save('student');expect(api.resolveXeroCollege).not.toHaveBeenCalled();
    c.studentOptions=[{value:'student',label:'Laura Garcia Lopez'}];c.student.setValue('student');c.save('student');
    expect(api.resolveXeroCollege).toHaveBeenCalledWith('pty','contact',{classification:'student',collegeId:null,studentUserId:'student',expectedRevision:0});
  });
  it('strips contact prefixes when creating a student and requires email',()=>{
    const c=fixture.componentInstance;c.review({...row,name:'C30 Laura Garcia Lopez',email:''});c.kind.setValue('student');c.startCreate();
    expect(c.creation.controls.name.value).toBe('Laura Garcia Lopez');c.save('student',true);expect(api.resolveXeroCollege).not.toHaveBeenCalled();
    c.creation.controls.email.setValue('laura@example.invalid');c.save('student',true);
    expect(api.resolveXeroCollege.calls.mostRecent().args[2]).toEqual(jasmine.objectContaining({classification:'student',create:jasmine.objectContaining({name:'Laura Garcia Lopez',email:'laura@example.invalid',closed:false})}));
  });
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
    const c=fixture.componentInstance;c.sort();c.pageSize.setValue('50');expect(api.xeroCollegeMatches.calls.mostRecent().args).toEqual(['pty',{page:1,limit:50,q:'',status:'unresolved',direction:'desc',scope:'sales',includeColleges:'false'}]);
  });
  it('defaults to pending active sales and reuses college options across pages',()=>{
    expect(api.xeroCollegeMatches.calls.first().args[1]).toEqual(jasmine.objectContaining({status:'unresolved',scope:'sales',includeColleges:'true'}));
    const c=fixture.componentInstance,options=c.options;api.xeroCollegeMatches.and.returnValue(of({...result,colleges:undefined}));c.load(2);
    expect(c.options).toBe(options);expect(api.xeroCollegeMatches.calls.mostRecent().args[1].includeColleges).toBe('false');
    c.scope.setValue('all');c.status.setValue('all');expect(api.xeroCollegeMatches.calls.mostRecent().args[1]).toEqual(jasmine.objectContaining({scope:'all',status:'all'}));
  });
  it('labels pending sales contacts independently of imported and archived totals',()=>{
    api.xeroCollegeMatches.and.returnValue(of({...result,summary:{importedContacts:1678,activeContacts:1548,archivedContacts:130,pendingSalesContacts:496,salesContacts:569,salesTransactions:7342,linkedTransactions:4951}}));
    fixture.componentInstance.load();fixture.detectChanges();const summary=fixture.nativeElement.querySelector('.summary').textContent;
    expect(summary).toContain('496');expect(summary).toContain('1548');expect(summary).toContain('130');expect(summary).not.toContain('1678');
  });
  it('makes trading names and acronyms searchable while retaining the college identity',()=>{
    api.xeroCollegeMatches.and.returnValue(of({...result,colleges:[{collegeId:'college',name:'Legal Education Holdings Pty Ltd',tradingName:'English Unlimited',acronym:'EU'}]}));
    const c=fixture.componentInstance;c.load();const options=c.options;fixture.detectChanges();fixture.detectChanges();
    expect(c.options).toBe(options);expect(c.options[0]).toEqual({value:'college',label:'Legal Education Holdings Pty Ltd — English Unlimited — EU'});
  });
  it('opens review in a dialog and switches to supplier matching',()=>{
    const c=fixture.componentInstance;c.review(row);fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).not.toBeNull();
    expect(c.kind.value).toBe('college');c.kind.setValue('supplier');fixture.detectChanges();
    const dialog=fixture.nativeElement.querySelector('[role="dialog"]');
    expect(dialog.textContent).toContain('Confirm supplier');expect(dialog.textContent).not.toContain('Other business customer');
    c.supplierOptions=[{value:'supplier',label:'Supplier'}];c.supplier.setValue('supplier');c.save('supplier');
    expect(api.resolveXeroCollege.calls.mostRecent().args[2]).toEqual({classification:'supplier',collegeId:null,supplierId:'supplier',expectedRevision:0});
  });
  it('prefills creation and requires a name, then creates a closed college',()=>{
    const c=fixture.componentInstance;c.review(row);c.startCreate(true);
    expect(c.creation.controls.email.value).toBe(row.email);c.creation.controls.name.setValue('');c.save('college',true);
    expect(api.resolveXeroCollege).not.toHaveBeenCalled();c.creation.controls.name.setValue('New college');c.save('college',true);
    expect(api.resolveXeroCollege.calls.mostRecent().args[2].create).toEqual(jasmine.objectContaining({name:'New college',closed:true}));
  });
  it('keeps the modal and entered details on failure and shows the error inside it',()=>{
    api.resolveXeroCollege.and.returnValue(throwError(()=>({status:500})));
    const c=fixture.componentInstance;c.review(row);c.startCreate();c.save('college',true);fixture.detectChanges();
    expect(c.selected).toBe(row);expect(c.creation.controls.name.value).toBe(row.name);expect(c.creation.enabled).toBeTrue();
    expect(fixture.nativeElement.querySelector('[role="dialog"]').textContent).toContain('Your entries have been kept');
  });
  it('closes with Escape and refreshes the current page after saving',()=>{
    const c=fixture.componentInstance;c.review(row);fixture.detectChanges();
    fixture.nativeElement.querySelector('[role="dialog"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    expect(c.selected).toBeNull();c.data={...result,page:3,total:100};c.review(row);c.save('other');
    expect(api.xeroCollegeMatches.calls.mostRecent().args[1].page).toBe(3);
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
