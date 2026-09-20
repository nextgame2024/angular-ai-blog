import {SophiaTavusClientService} from './sophia-tavus-client.service';
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
});
