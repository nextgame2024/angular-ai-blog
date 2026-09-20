import {compactTavusToolOutput,SophiaTavusClientService} from './sophia-tavus-client.service';
describe('Premium event delivery',()=>{
 function setup(){const service=new SophiaTavusClientService() as any;const send=jasmine.createSpy('send');service.call={sendAppMessage:send};service.conversationId='current';return {service,send};}
 const message={event_type:'conversation.tool_call',conversation_id:'current',properties:{tool_call_id:'call',name:'lookup',arguments:{}}};
 it('executes a replayed tool call once and returns one result',async()=>{
  const {service,send}=setup();service.onToolCall=jasmine.createSpy('tool').and.resolveTo({ok:true});
  await Promise.all([service.handleAppMessage(message),service.handleAppMessage(JSON.stringify(message))]);
  expect(service.onToolCall).toHaveBeenCalledTimes(1);expect(send).toHaveBeenCalledTimes(1);
 });
 it('does not deliver a late result into a different conversation',async()=>{
  const {service,send}=setup();let finish!:(v:unknown)=>void;
  service.onToolCall=()=>new Promise(resolve=>{finish=resolve;});
  const pending=service.handleAppMessage(message);service.conversationId='next';finish({ok:true});await pending;expect(send).not.toHaveBeenCalled();
 });
 it('ignores stale conversation speech events and distinguishes listening from waiting',async()=>{
  const {service}=setup();service.onUserUtterance=jasmine.createSpy('listening');service.onUserSpeechStopped=jasmine.createSpy('waiting');
  await service.handleAppMessage({event_type:'user.started_speaking',conversation_id:'old'});expect(service.onUserUtterance).not.toHaveBeenCalled();
  await service.handleAppMessage({event_type:'user.started_speaking',conversation_id:'current'});expect(service.onUserUtterance).toHaveBeenCalledTimes(1);
  await service.handleAppMessage({event_type:'conversation.utterance',conversation_id:'current',properties:{role:'user'}});expect(service.onUserSpeechStopped).toHaveBeenCalledTimes(1);
 });
 it('keeps an oversized student panel result below the Tavus app-message limit',()=>{
  const output={status:'reviewed',answer:'A'.repeat(2500),studentView:{cards:Array.from({length:12},()=>({summary:'B'.repeat(900)}))}};
  const compact=compactTavusToolOutput('showStudentVisaDemoGuidance',output) as any;
  const envelope={message_type:'conversation',event_type:'conversation.tool_result',conversation_id:'current',properties:{tool_call_id:'call',output:compact,status:'success'}};
  expect(new TextEncoder().encode(JSON.stringify(envelope)).length).toBeLessThan(4096);
  expect(compact.answer).toBeTruthy();
  expect(compact.studentView).toBeUndefined();
 });
 it('keeps exact fields for the first four consultation slots when compacting',()=>{
  const slots=Array.from({length:12},(_,index)=>({slotId:`slot-${index}`,startsAt:`2026-09-2${index}T10:00:00+10:00`,startsAtLabel:`Time ${index}`,serviceName:'Student consultation',adviserName:'Demo adviser',isDemo:true,unused:'X'.repeat(1000)}));
  const compact=compactTavusToolOutput('getStudentConsultationSlots',{consultationSlots:slots}) as any;
  expect(compact.consultationSlots.length).toBe(4);
  expect(compact.consultationSlots[0]).toEqual(jasmine.objectContaining({slotId:'slot-0',startsAtLabel:'Time 0',isDemo:true}));
  expect(JSON.stringify(compact)).not.toContain('unused');
 });
});
