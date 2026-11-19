import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { Actions } from '@ngrx/effects';
import { of, Subject } from 'rxjs';
import { ManagerSchedulePageComponent } from './manager-schedule.page';
import { LeadSchedulingService, LeadAppointment } from './leads/lead-scheduling.service';
import { LeadWorkspaceService } from '../../leads/lead-workspace.service';
import { ManagerProjectsService } from '../../services/manager.projects.service';
import { initialManagerScheduleState } from '../../store/schedule/manager.state';

describe('Unified scheduling calendar', () => {
  const appointment: LeadAppointment = {id:'a',leadId:'l',leadName:'Calendar contact',leadEmail:'contact@example.test',advisorId:'advisor',startsAt:'2026-11-20T01:00:00Z',endsAt:'2026-11-20T01:30:00Z',timezone:'Australia/Brisbane',description:'Discovery call',status:'confirmed',version:1,calendarRevision:1,assessment:{score:80,priority:'high',summary:[{label:'Business need',quote:'Missed enquiries'}]}};
  let api: jasmine.SpyObj<LeadSchedulingService>;
  beforeEach(async () => {
    api=jasmine.createSpyObj('appointments',['calendarRange','context','list','slots']);
    api.calendarRange.and.returnValue(of([appointment]));
    api.context.and.returnValue(of({actorId:'advisor',canManage:true,advisors:[{id:'advisor',name:'Advisor'}],timezone:'Australia/Brisbane'}));
    api.slots.and.returnValue(of({calendarRevision:1,timezone:'Australia/Brisbane',advisorTimezone:'Australia/Brisbane',slots:[]}));
    await TestBed.configureTestingModule({imports:[ManagerSchedulePageComponent],providers:[
      provideRouter([]),provideMockStore({initialState:{managerSchedule:{...initialManagerScheduleState,schedules:[{scheduleId:'p',scheduledItemId:'p',scheduledItemType:'project',scheduledItemLabel:'Existing project',date:'2026-11-20',startTime:'09:00',endTime:'10:00',description:'Project work'}]}}}),
      {provide:Actions,useValue:new Actions(new Subject())},
      {provide:LeadSchedulingService,useValue:api},
      {provide:LeadWorkspaceService,useValue:{list:()=>of({items:[],total:0,page:1,limit:25})}},
      {provide:ManagerProjectsService,useValue:{}}
    ]}).compileComponents();
  });
  it('combines both sources and opens contact details instead of the project editor',()=>{
    const fixture=TestBed.createComponent(ManagerSchedulePageComponent), page=fixture.componentInstance;
    page.viewDate$$.set(new Date(2026,10,1)); fixture.detectChanges();
    expect(page.filteredSchedules$$().length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('Calendar contact');
    expect(fixture.nativeElement.textContent).toContain('Existing project');
    expect(fixture.nativeElement.textContent).not.toContain('Lead appointments');
    expect(api.list).not.toHaveBeenCalled();
    const dispatch=spyOn(TestBed.inject(MockStore),'dispatch');
    page.openEdit(page.appointments$$()[0]); fixture.detectChanges();
    expect(dispatch).not.toHaveBeenCalled();
    const description=fixture.nativeElement.querySelector('.appointment-description').value;
    expect(description).toContain('contact@example.test');
    expect(description).toContain('80/100');
    expect(description).toContain('Missed enquiries');
    fixture.destroy();
  });
  it('switches to an appointment without requiring a project and retains the chosen date',()=>{
    const fixture=TestBed.createComponent(ManagerSchedulePageComponent),page=fixture.componentInstance;
    fixture.detectChanges();
    page.scheduleForm.controls.date.setValue('2026-11-23');
    page.chooseAppointment(); fixture.detectChanges();
    expect(page.appointmentEditor?.booking.controls.date.value).toBe('2026-11-23');
    expect(fixture.nativeElement.textContent).toContain('New contact');
    expect(page.scheduleForm.controls.scheduled_item_id.valid).toBeFalse();
    fixture.destroy();
  });
});
