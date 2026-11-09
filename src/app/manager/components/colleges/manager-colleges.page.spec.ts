import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { BmCollege, ManagerCollegesService } from '../../services/manager.colleges.service';
import { ManagerCollegesPageComponent } from './manager-colleges.page';
import { TownPlannerV2Service } from '../../../townplanner/services/townplanner_v2.service';

describe('ManagerCollegesPageComponent', () => {
  let api: jasmine.SpyObj<ManagerCollegesService>;
  const college: BmCollege = {
    collegeId: 'college-1', collegeName: 'ATI', ownerName: null, abn: null,
    address: '1 Main Street', city: 'Brisbane', category: 'English language',
    email: 'info@ati.edu.au', cel: null, tel: null, notes: null, status: 'active',
  };

  beforeEach(async () => {
    api = jasmine.createSpyObj<ManagerCollegesService>('ManagerCollegesService',
      ['list', 'create', 'update', 'contacts', 'sites', 'courses', 'createSite', 'get']);
    api.list.and.returnValue(of({ colleges: [], total: 0, page: 1, limit: 25 }));
    api.create.and.returnValue(of({ college }));
    api.get.and.returnValue(of({ college }));
    api.contacts.and.returnValue(of({ contacts: [] }));
    api.sites.and.returnValue(of({ sites: [] }));
    api.courses.and.returnValue(of({ courses: [], total: 0, page: 1, limit: 25 }));
    api.createSite.and.returnValue(of({ site: {
      siteId: 'site-1', collegeId: 'college-1', city: 'Sydney', category: 'University',
      address: '2 Main Street', email: null, phone: null, mobile: null, isPrimary: true,
    } }));
    await TestBed.configureTestingModule({
      imports: [ManagerCollegesPageComponent],
      providers: [provideRouter([]), { provide: ManagerCollegesService, useValue: api }, { provide: TownPlannerV2Service, useValue: { suggestAddresses: () => of([]), getPlaceDetails: () => of(null) } }],
    }).compileComponents();
  });

  it('starts with an empty college list and keeps contacts unavailable until saved', () => {
    const fixture = TestBed.createComponent(ManagerCollegesPageComponent);
    fixture.detectChanges();
    const empty = fixture.nativeElement.querySelector('[data-testid="colleges-empty"]') as HTMLElement;
    expect(empty.tagName).toBe('APP-MANAGER-EMPTY-STATE');
    expect(empty.querySelector('strong')?.textContent).toBe('No colleges found');
    expect(empty.querySelector('span')?.textContent).toBe('No records match the current filters.');
    expect(getComputedStyle(empty).display).toBe('grid');
    expect(getComputedStyle(empty).textAlign).toBe('center');
    expect(fixture.nativeElement.querySelector('.search-icon svg circle')).not.toBeNull();
    fixture.componentInstance.create();
    fixture.detectChanges();
    const contactsTab = fixture.nativeElement.querySelectorAll('.form-tabs button')[1] as HTMLButtonElement;
    expect(contactsTab.disabled).toBeTrue();
    expect(contactsTab.classList.contains('disabled')).toBeTrue();
    expect(getComputedStyle(contactsTab).opacity).toBe('0.5');
    expect((fixture.nativeElement.querySelectorAll('.form-tabs button')[2] as HTMLButtonElement).disabled).toBeTrue();
    const dismiss = fixture.nativeElement.querySelector('.warning-dismiss') as HTMLButtonElement;
    expect(dismiss).not.toBeNull();
    dismiss.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.warning-banner')).toBeNull();
  });

  it('creates a college and then enables the Contacts tab', () => {
    const fixture = TestBed.createComponent(ManagerCollegesPageComponent);
    fixture.detectChanges();
    fixture.componentInstance.create();
    fixture.componentInstance.collegeForm.patchValue({ college_name: 'ATI' });
    fixture.componentInstance.save();
    fixture.detectChanges();
    expect(api.create).toHaveBeenCalled();
    const contactsTab = fixture.nativeElement.querySelectorAll('.form-tabs button')[1] as HTMLButtonElement;
    expect(contactsTab.disabled).toBeFalse();
    expect(contactsTab.classList.contains('disabled')).toBeFalse();
    expect(getComputedStyle(contactsTab).opacity).toBe('1');
    fixture.componentInstance.showContacts();
    expect(api.contacts).toHaveBeenCalledWith('college-1');
    fixture.componentInstance.showSites();
    expect(api.sites).toHaveBeenCalledWith('college-1');
  });
  it('shows trading name and acronym in the table and cards and searches/sorts via the API',fakeAsync(()=>{
    api.list.and.returnValue(of({colleges:[{...college,tradingName:'Australian Training Institute',acronym:'ATI'}],total:1,page:1,limit:25}));
    const fixture=TestBed.createComponent(ManagerCollegesPageComponent);fixture.detectChanges();
    const el:HTMLElement=fixture.nativeElement;
    expect(el.querySelector('.trading-name')?.textContent).toContain('Australian Training Institute');
    expect(el.querySelector('.cards')?.textContent).toContain('Acronym: ATI');
    const tradingSort=[...el.querySelectorAll<HTMLButtonElement>('.sort-button')].find(b=>b.textContent?.includes('Trading name'))!;
    tradingSort.click();fixture.detectChanges();expect(api.list).toHaveBeenCalledWith('',1,25,'tradingName','asc');
    fixture.componentInstance.search.setValue('ATI');tick(301);expect(api.list).toHaveBeenCalledWith('ATI',1,25,'tradingName','asc');
    fixture.destroy();
  }));

  it('loads the acronym and keeps commissions disabled until the college is saved',()=>{
    const fixture=TestBed.createComponent(ManagerCollegesPageComponent);fixture.detectChanges();fixture.componentInstance.create();fixture.detectChanges();
    const tab=[...fixture.nativeElement.querySelectorAll('.form-tabs button')].find((button:any)=>button.textContent.includes('Commissions')) as HTMLButtonElement;
    expect(tab.disabled).toBeTrue();fixture.componentInstance.edit({...college,acronym:'ATI'});fixture.detectChanges();
    expect(tab.disabled).toBeFalse();expect(fixture.componentInstance.collegeForm.controls.acronym.value).toBe('ATI');
  });

  for(const width of [390,1440]) for(const dark of [false,true]) {
    it(`keeps the college identity columns and empty state within ${width}px in ${dark?'dark':'light'} mode`,()=>{
      api.list.and.returnValue(of({colleges:[{...college,tradingName:'Australian College of Agriculture & Horticulture; Australian College of Agriculture & Horticulture',acronym:'ACAH'}],total:1,page:1,limit:25}));
      const fixture=TestBed.createComponent(ManagerCollegesPageComponent);fixture.detectChanges();
      const frame=document.createElement('iframe');frame.style.width=`${width}px`;frame.style.height='900px';document.body.appendChild(frame);
      try {
        const doc=frame.contentDocument!,win=frame.contentWindow!;doc.documentElement.classList.toggle('dark',dark);
        doc.body.style.cssText='margin:0;padding:.75rem;box-sizing:border-box';
        document.querySelectorAll('style').forEach(style=>doc.head.appendChild(style.cloneNode(true)));
        doc.body.appendChild(fixture.nativeElement.cloneNode(true));
        expect(doc.documentElement.scrollWidth).toBeLessThanOrEqual(width+1);
        expect(win.getComputedStyle(doc.querySelector('.table-wrap')!).display).toBe(width<900?'none':'block');
        api.list.and.returnValue(of({colleges:[],total:0,page:1,limit:25}));fixture.componentInstance.load();fixture.detectChanges();
        // Angular injects the empty component's styles when it is first instantiated.
        doc.head.replaceChildren();document.querySelectorAll('style').forEach(style=>doc.head.appendChild(style.cloneNode(true)));
        doc.body.replaceChildren(fixture.nativeElement.cloneNode(true));
        const empty=doc.querySelector('app-manager-empty-state')!;expect(win.getComputedStyle(empty).minHeight).toBe('385px');
        expect(win.getComputedStyle(empty).display).toBe('grid');expect(win.getComputedStyle(empty).textAlign).toBe('center');
        expect(doc.documentElement.scrollWidth).toBeLessThanOrEqual(width+1);
      } finally {frame.remove();fixture.destroy();}
    });
  }

  it('uses Users-style table controls with server paging and sorting', () => {
    api.list.and.callFake((_q, page) => of({ colleges: [college], total: 51, page: page || 1, limit: 25 }));
    const fixture = TestBed.createComponent(ManagerCollegesPageComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('table.user-table th[aria-sort="ascending"]')?.textContent).toContain('Name');
    expect(element.querySelector('table.user-table .badge')?.textContent).toContain('active');
    expect(element.querySelector('table.user-table .row-actions .btn-icon svg')).not.toBeNull();
    expect(element.querySelector('.users-pagination')?.textContent).toContain('Showing 1–25 of 51');
    (element.querySelector('button.sort-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(api.list).toHaveBeenCalledWith('', 1, 25, 'name', 'desc');
    expect(element.querySelector('table.user-table th[aria-sort="descending"]')?.textContent).toContain('Name');
    (element.querySelector('[aria-label="Next page"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(api.list).toHaveBeenCalledWith('', 2, 25, 'name', 'desc');
    expect((element.querySelector('app-page-jump input') as HTMLInputElement).value).toBe('2');
    expect(element.querySelector('app-page-jump')?.textContent).toContain('of 3');
    fixture.componentInstance.pageSizeCtrl.setValue('50');
    fixture.detectChanges();
    expect(api.list).toHaveBeenCalledWith('', 1, 50, 'name', 'desc');
    expect((element.querySelector('app-page-jump input') as HTMLInputElement).value).toBe('1');
    expect(element.querySelector('app-page-jump')?.textContent).toContain('of 2');
    fixture.componentInstance.goToPage(2);
    fixture.destroy();
    api.list.calls.reset();
    const returned = TestBed.createComponent(ManagerCollegesPageComponent);
    returned.detectChanges();
    expect(api.list).toHaveBeenCalledOnceWith('', 2, 50, 'name', 'desc');
  });

  it('sorts and paginates the complete Contacts and Sites tab data', () => {
    api.contacts.and.returnValue(of({ contacts: [
      { contactId: '2', collegeId: 'college-1', name: 'Zoe', roleTitle: null, email: null, cel: null, tel: null,
        fax: null, source: 'manual', contactType: null, sourceUrl: null, sourceCheckedAt: null, sourceActive: true },
      { contactId: '1', collegeId: 'college-1', name: 'Ana', roleTitle: null, email: null, cel: null, tel: null,
        fax: null, source: 'manual', contactType: null, sourceUrl: null, sourceCheckedAt: null, sourceActive: true },
    ] }));
    api.sites.and.returnValue(of({ sites: [
      { siteId: '2', collegeId: 'college-1', city: 'Sydney', category: null, address: null, email: null, phone: null, mobile: null, isPrimary: false },
      { siteId: '1', collegeId: 'college-1', city: 'Melbourne', category: null, address: null, email: null, phone: null, mobile: null, isPrimary: true },
    ] }));
    const fixture = TestBed.createComponent(ManagerCollegesPageComponent);
    fixture.detectChanges();
    fixture.componentInstance.edit(college);
    fixture.componentInstance.showContacts();
    fixture.detectChanges();
    expect(fixture.componentInstance.displayedContacts.map((contact) => contact.name)).toEqual(['Ana', 'Zoe']);
    fixture.componentInstance.sortContactsBy('name');
    fixture.detectChanges();
    expect(fixture.componentInstance.displayedContacts.map((contact) => contact.name)).toEqual(['Zoe', 'Ana']);
    expect((fixture.nativeElement as HTMLElement).querySelector('table.user-table th[aria-sort="descending"]')?.textContent).toContain('Name');
    fixture.componentInstance.showSites();
    fixture.detectChanges();
    expect(fixture.componentInstance.displayedSites.map((site) => site.city)).toEqual(['Melbourne', 'Sydney']);
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('table.user-table th .sort-button').length).toBe(7);
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('table.user-table .badge').length).toBe(2);
    expect((fixture.nativeElement as HTMLElement).querySelector('[aria-label="Sites pagination"]')).not.toBeNull();
  });

  it('shows the primary site in Details without including it in a college update', () => {
    const fixture = TestBed.createComponent(ManagerCollegesPageComponent);
    fixture.detectChanges();
    fixture.componentInstance.edit(college);
    fixture.detectChanges();
    const readonly = [...fixture.nativeElement.querySelectorAll('.college-form-card input[readonly]')] as HTMLInputElement[];
    expect(readonly.map((input) => input.value)).toContain('Brisbane');
    expect(readonly.map((input) => input.value)).toContain('English language');
    expect(readonly.every((input) => input.readOnly)).toBeTrue();
    expect(fixture.componentInstance.collegeForm.getRawValue()).not.toEqual(jasmine.objectContaining({ city: 'Brisbane' }));
  });

  it('creates a first site as primary and sends site details separately', () => {
    const fixture = TestBed.createComponent(ManagerCollegesPageComponent);
    fixture.detectChanges();
    fixture.componentInstance.edit(college);
    fixture.componentInstance.showSites();
    fixture.componentInstance.addSite();
    expect(fixture.componentInstance.siteForm.value.is_primary).toBe('yes');
    fixture.componentInstance.siteForm.patchValue({ city: 'Sydney', category: 'University', address: '2 Main Street' });
    fixture.componentInstance.saveSite();
    expect(api.createSite).toHaveBeenCalledWith('college-1', jasmine.objectContaining({
      city: 'Sydney', category: 'University', address: '2 Main Street', is_primary: true,
    }));
    expect(api.get).toHaveBeenCalledWith('college-1');
  });

  it('loads and server-paginates the CRICOS Courses tab', () => {
    api.courses.and.returnValue(of({ courses: [{
      courseId: 'course-1', collegeId: 'college-1', cricosCourseCode: '112441K', courseName: 'Certificate III',
      vetNationalCode: 'CHC30121', dualQualification: false, field1Broad: 'Education', field1Narrow: null,
      field1Detailed: null, field2Broad: null, field2Narrow: null, field2Detailed: null, courseLevel: 'Certificate III',
      foundationStudies: false, workComponent: true, workComponentHoursWeek: 20, workComponentWeeks: 12,
      workComponentTotalHours: 240, courseLanguage: 'English', durationWeeks: 78, tuitionFeeCents: 1200000,
      nonTuitionFeeCents: 55000, estimatedTotalCostCents: 1255000, expired: false, locationCount: 2,
      locations: ['Kent Street', 'Seven Hills'],
    }], total: 51, page: 1, limit: 25 }));
    const fixture = TestBed.createComponent(ManagerCollegesPageComponent);
    fixture.detectChanges();
    fixture.componentInstance.edit({ ...college, cricosProviderCode: '04100H' });
    fixture.componentInstance.showCourses();
    fixture.detectChanges();
    expect(api.courses).toHaveBeenCalledWith('college-1', '', 'active', 1, 25, 'name', 'asc');
    expect((fixture.nativeElement as HTMLElement).querySelector('table[aria-label="CRICOS courses"]')?.textContent).toContain('112441K');
    expect((fixture.nativeElement as HTMLElement).querySelector('[aria-label="Courses pagination"]')?.textContent).toContain('Showing 1–25 of 51');
    fixture.componentInstance.sortCoursesBy('code');
    expect(api.courses).toHaveBeenCalledWith('college-1', '', 'active', 1, 25, 'code', 'asc');
  });
});
