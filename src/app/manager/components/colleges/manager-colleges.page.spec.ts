import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { BmCollege, ManagerCollegesService } from '../../services/manager.colleges.service';
import { ManagerCollegesPageComponent } from './manager-colleges.page';

describe('ManagerCollegesPageComponent', () => {
  let api: jasmine.SpyObj<ManagerCollegesService>;
  const college: BmCollege = {
    collegeId: 'college-1', collegeName: 'ATI', ownerName: null, abn: null,
    address: '1 Main Street', city: 'Brisbane', category: 'English language',
    email: 'info@ati.edu.au', cel: null, tel: null, notes: null, status: 'active',
  };

  beforeEach(async () => {
    api = jasmine.createSpyObj<ManagerCollegesService>('ManagerCollegesService',
      ['list', 'create', 'update', 'contacts', 'sites', 'createSite', 'get']);
    api.list.and.returnValue(of({ colleges: [], total: 0, page: 1, limit: 25 }));
    api.create.and.returnValue(of({ college }));
    api.get.and.returnValue(of({ college }));
    api.contacts.and.returnValue(of({ contacts: [] }));
    api.sites.and.returnValue(of({ sites: [] }));
    api.createSite.and.returnValue(of({ site: {
      siteId: 'site-1', collegeId: 'college-1', city: 'Sydney', category: 'University',
      address: '2 Main Street', email: null, phone: null, mobile: null, isPrimary: true,
    } }));
    await TestBed.configureTestingModule({
      imports: [ManagerCollegesPageComponent],
      providers: [provideRouter([]), { provide: ManagerCollegesService, useValue: api }],
    }).compileComponents();
  });

  it('starts with an empty college list and keeps contacts unavailable until saved', () => {
    const fixture = TestBed.createComponent(ManagerCollegesPageComponent);
    fixture.detectChanges();
    const empty = fixture.nativeElement.querySelector('[data-testid="colleges-empty"]') as HTMLElement;
    expect(empty.classList.contains('list-empty')).toBeTrue();
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
    expect(element.querySelector('.users-pagination')?.textContent).toContain('Page 2 of 3');
    fixture.componentInstance.pageSizeCtrl.setValue('50');
    fixture.detectChanges();
    expect(api.list).toHaveBeenCalledWith('', 1, 50, 'name', 'desc');
    expect(element.querySelector('.users-pagination')?.textContent).toContain('Page 1 of 2');
  });

  it('sorts and paginates the complete Contacts and Sites tab data', () => {
    api.contacts.and.returnValue(of({ contacts: [
      { contactId: '2', collegeId: 'college-1', name: 'Zoe', roleTitle: null, email: null, cel: null, tel: null },
      { contactId: '1', collegeId: 'college-1', name: 'Ana', roleTitle: null, email: null, cel: null, tel: null },
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
});
