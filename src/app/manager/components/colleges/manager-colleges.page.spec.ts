import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ManagerCollegesService } from '../../services/manager.colleges.service';
import { ManagerCollegesPageComponent } from './manager-colleges.page';

describe('ManagerCollegesPageComponent', () => {
  let api: jasmine.SpyObj<ManagerCollegesService>;

  beforeEach(async () => {
    api = jasmine.createSpyObj<ManagerCollegesService>('ManagerCollegesService', ['list', 'create', 'update', 'contacts']);
    api.list.and.returnValue(of({ colleges: [], total: 0, page: 1, limit: 20 }));
    api.create.and.returnValue(of({ college: {
      collegeId: 'college-1', collegeName: 'ATI', ownerName: null, abn: null,
      address: null, email: null, cel: null, tel: null, notes: null, status: 'active',
    } }));
    api.contacts.and.returnValue(of({ contacts: [] }));
    await TestBed.configureTestingModule({
      imports: [ManagerCollegesPageComponent],
      providers: [provideRouter([]), { provide: ManagerCollegesService, useValue: api }],
    }).compileComponents();
  });

  it('starts with an empty college list and keeps contacts unavailable until saved', () => {
    const fixture = TestBed.createComponent(ManagerCollegesPageComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No colleges found');
    fixture.componentInstance.create();
    fixture.detectChanges();
    const contactsTab = fixture.nativeElement.querySelectorAll('.form-tabs button')[1] as HTMLButtonElement;
    expect(contactsTab.disabled).toBeTrue();
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
    fixture.componentInstance.showContacts();
    expect(api.contacts).toHaveBeenCalledWith('college-1');
  });
});
