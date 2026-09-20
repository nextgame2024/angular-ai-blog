import {TestBed} from '@angular/core/testing';
import {Subject,of} from 'rxjs';
import {SophiaKioskPageComponent} from './sophia-kiosk.page';
import {SophiaRuntimeConfigService} from '../services/sophia-runtime-config.service';
import {SophiaRuntimeSessionService} from '../services/sophia-runtime-session.service';
import {SophiaRealtimeClientService} from '../services/sophia-realtime-client.service';
import {SophiaAvatarClientService} from '../services/sophia-avatar-client.service';
import {SophiaTavusClientService} from '../services/sophia-tavus-client.service';

describe('Sophia startup',()=>{
 let component:SophiaKioskPageComponent;
 let resolveMic:(stream:MediaStream)=>void;
 let rejectMic:(error:Error)=>void;
 let session:Subject<any>;
 let stopped:jasmine.Spy;
 let stream:MediaStream;
 let runtime:any;
 let voice:any;
 let avatar:any;
 let tavus:any;
 const response={session:{sessionId:'test-session',status:'active',aiProvider:'openai-realtime'},ai:{clientSecret:'test'},avatar:{provider:'none'}};
 beforeEach(()=>{
  stopped=jasmine.createSpy('stop');stream={getTracks:()=>[{stop:stopped}],getAudioTracks:()=>[{stop:stopped}]} as unknown as MediaStream;
  spyOn(navigator.mediaDevices,'getUserMedia').and.returnValue(new Promise((resolve,reject)=>{resolveMic=resolve;rejectMic=reject;}));
  session=new Subject();runtime={createSession:jasmine.createSpy('create').and.returnValue(session),closeSession:jasmine.createSpy('close').and.returnValue(of({}))};
  voice={connect:jasmine.createSpy('connect').and.resolveTo(),disconnect:jasmine.createSpy('disconnect').and.resolveTo(),setMicrophoneSuppressed:()=>{}};
  avatar={connect:jasmine.createSpy('avatar connect').and.resolveTo(),disconnect:async()=>{}};
  tavus={connect:jasmine.createSpy('tavus connect').and.resolveTo(),disconnect:async()=>{}};
  TestBed.configureTestingModule({providers:[
   {provide:SophiaRuntimeConfigService,useValue:{}},{provide:SophiaRuntimeSessionService,useValue:runtime},
   {provide:SophiaRealtimeClientService,useValue:voice},
   {provide:SophiaAvatarClientService,useValue:avatar},
   {provide:SophiaTavusClientService,useValue:tavus},
  ]});
  component=TestBed.runInInjectionContext(()=>new SophiaKioskPageComponent());
 });
 afterEach(()=>component.ngOnDestroy());
 it('requests microphone immediately while runtime creation is pending and reuses its stream',async()=>{
  const starting=component.startSession();
  expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);expect(runtime.createSession).toHaveBeenCalledTimes(1);
  resolveMic(stream);await Promise.resolve();expect(voice.connect).not.toHaveBeenCalled();
  session.next(response);session.complete();await starting;
  expect(voice.connect).toHaveBeenCalledWith(jasmine.objectContaining({microphoneStream:stream}));expect(component.state$$()).toBe('active');
 });
 it('denial fails promptly and closes a session that arrives later',async()=>{
  const starting=component.startSession();rejectMic(new Error('Permission denied'));await starting;
  expect(component.state$$()).toBe('error');expect(voice.connect).not.toHaveBeenCalled();
  session.next(response);session.complete();await Promise.resolve();
  expect(runtime.closeSession).toHaveBeenCalledWith('test-session');
 });
 it('stops microphone permission granted after server failure',async()=>{
  const starting=component.startSession();session.error(new Error('Server unavailable'));await starting;
  resolveMic(stream);await Promise.resolve();expect(stopped).toHaveBeenCalled();expect(voice.connect).not.toHaveBeenCalled();
 });
 it('navigation cancels pending startup and closes a late server session',async()=>{
  const starting=component.startSession();component.ngOnDestroy();resolveMic(stream);session.next(response);session.complete();await starting;
  expect(stopped).toHaveBeenCalled();expect(runtime.closeSession).toHaveBeenCalledWith('test-session');expect(voice.connect).not.toHaveBeenCalled();
 });
 it('releases microphone and server session when voice setup fails',async()=>{
  voice.connect.and.rejectWith(new Error('WebRTC failed'));const starting=component.startSession();resolveMic(stream);session.next(response);session.complete();await starting;
  expect(stopped).toHaveBeenCalled();expect(runtime.closeSession).toHaveBeenCalledWith('test-session');expect(component.session$$()).toBeNull();
 });
 it('passes the early microphone stream to Premium without opening Realtime',async()=>{
  component.experience$$.set('tavus');
  (component as any).avatarVideo={nativeElement:document.createElement('video')};
  (component as any).remoteAudio={nativeElement:document.createElement('audio')};
  const starting=component.startSession();resolveMic(stream);
  session.next({...response,session:{...response.session,aiProvider:'tavus-full'},avatar:{provider:'tavus',streamUrl:'https://tavus.daily.co/demo',sessionToken:'test'}});session.complete();await starting;
  expect(tavus.connect).toHaveBeenCalledWith(jasmine.objectContaining({microphoneStream:stream}));expect(voice.connect).not.toHaveBeenCalled();expect(component.state$$()).toBe('active');
 });
 it('keeps Professional voice and avatar connection parallel after microphone setup',async()=>{
  component.experience$$.set('openai-liveavatar-full');
  (component as any).avatarVideo={nativeElement:document.createElement('video')};
  (component as any).simliAudio={nativeElement:document.createElement('audio')};
  const starting=component.startSession();resolveMic(stream);
  session.next({...response,avatar:{provider:'liveavatar',sessionToken:'test'}});session.complete();await starting;
  expect(voice.connect).toHaveBeenCalledWith(jasmine.objectContaining({microphoneStream:stream}));expect(avatar.connect).toHaveBeenCalled();expect(component.state$$()).toBe('active');
 });
});
