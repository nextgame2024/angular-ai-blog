import {TestBed} from '@angular/core/testing';
import {Subject,of} from 'rxjs';
import {SophiaKioskPageComponent} from './sophia-kiosk.page';
import {SophiaRuntimeConfigService} from '../services/sophia-runtime-config.service';
import {SophiaRuntimeSessionService} from '../services/sophia-runtime-session.service';
import {SophiaRealtimeClientService} from '../services/sophia-realtime-client.service';
import {SophiaAvatarClientService} from '../services/sophia-avatar-client.service';
import {SophiaTavusClientService} from '../services/sophia-tavus-client.service';

describe('Kiosk student/property separation',()=>{
  let component:SophiaKioskPageComponent;
  const executeTool=jasmine.createSpy('executeTool');
  beforeEach(()=>{
    executeTool.calls.reset();
    TestBed.configureTestingModule({providers:[
      {provide:SophiaRuntimeConfigService,useValue:{}},
      {provide:SophiaRuntimeSessionService,useValue:{executeTool}},
      ...[SophiaRealtimeClientService,SophiaAvatarClientService,SophiaTavusClientService].map(provide=>({provide,useValue:{}})),
    ]});
    component=TestBed.runInInjectionContext(()=>new SophiaKioskPageComponent());
  });
  it('clears inspection review when showing student guidance and closes student guidance for property results',()=>{
    component.bookingReview$$.set({mode:'new',customerName:'Example',customerEmail:'example@example.com',propertyAddress:'Example',startsAtLabel:'Example time'});
    (component as any).handleToolOutput('verifyStudentRules',{studentView:{title:'Student',cards:[]}});
    expect(component.bookingReview$$()).toBeNull();
    expect(component.studentView$$()?.title).toBe('Student');
    (component as any).handleToolOutput('searchProperties',{properties:[]});
    expect(component.studentView$$()).toBeNull();
  });
  it('ignores a late property response after switching to student guidance',async()=>{
    const property=new Subject<any>();const student=new Subject<any>();
    executeTool.and.returnValues(property,student);
    const p=(component as any).executeRealtimeTool('session',{name:'searchProperties',arguments:{}});
    const s=(component as any).executeRealtimeTool('session',{name:'verifyStudentRules',arguments:{topic:'work'}});
    student.next({output:{studentView:{title:'Student evidence',cards:[]}}});student.complete();await s;
    property.next({output:{properties:[]}});property.complete();await p;
    expect(component.studentView$$()?.title).toBe('Student evidence');
  });

  const review={mode:'new' as const,slotId:'30000000-0000-4000-8000-000000000001',startsAt:'2026-10-01T00:00:00Z',confirmedStartsAt:'2026-10-01T00:00:00Z',startsAtLabel:'1 Oct, 10 am',adviserName:'Demo adviser',serviceName:'Student enquiry',meetingDetails:'No real meeting',timeZone:'Australia/Brisbane',isDemo:true,customerName:'Test Customer',customerEmail:'test@example.com',includeSummary:false,enquirySummary:'Private',sourceLinks:[]};
  it('requires a new confirmation turn and sends on-screen email edits without an unconsented summary',async()=>{
    component.consultationView$$.set({review});
    const prepare=(input:any)=>(component as any).prepareConfirmedConsultationInput('session','bookStudentConsultation',input);
    const input={...review,confirmed:true};
    await expectAsync(prepare(input)).toBeRejectedWithError(/Wait for/);
    component.updateConsultationField({field:'customerEmail',value:'corrected@example.com'});
    (component as any).onUserActivity();
    await expectAsync(prepare(input)).toBeRejectedWithError(/Wait for/);
    (component as any).onAssistantSpeechStopped();
    (component as any).onUserActivity();executeTool.and.returnValue(of({output:{consultationReview:review}}));
    const result=await prepare(input);expect(result.customerEmail).toBe('corrected@example.com');expect(result.enquirySummary).toBe('');
    expect(result.sourceLinks).toEqual([]);expect(result.confirmed).toBeTrue();
  });
  it('requires another review for changed consent and rejects a different slot',async()=>{
    component.consultationView$$.set({review});(component as any).onAssistantSpeechStopped();(component as any).onUserActivity();
    const prepare=(input:any)=>(component as any).prepareConfirmedConsultationInput('session','bookStudentConsultation',input);
    await expectAsync(prepare({...review,slotId:'different',confirmed:true})).toBeRejectedWithError(/newly selected/);
    await expectAsync(prepare({...review,includeSummary:true,confirmed:true})).toBeRejectedWithError(/corrected details/);
    expect(executeTool).not.toHaveBeenCalled();
  });
  it('clears consultation reviews when returning to properties',()=>{
    component.consultationView$$.set({review});
    (component as any).handleToolOutput('searchProperties',{properties:[]});
    expect(component.consultationView$$()).toBeNull();
  });
});
