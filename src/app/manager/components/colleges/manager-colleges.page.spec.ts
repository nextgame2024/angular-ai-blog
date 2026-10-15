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
    api.list.and.returnValue(of({ colleges: [], total: 0, page: 1, limit: 20 }));
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
