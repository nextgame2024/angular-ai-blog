import {
  extractAudioDelta,
  extractAssistantTextDone,
  isAudioDoneEvent,
} from './sophia-realtime-client.service';

describe('Sophia Realtime audio events', () => {
  it('decodes only model audio deltas', () => {
    const audio = extractAudioDelta({
      type: 'response.output_audio.delta',
      delta: 'AAECAw==',
    });

    expect(Array.from(audio || [])).toEqual([0, 1, 2, 3]);
    expect(
      extractAudioDelta({
        type: 'response.output_audio_transcript.delta',
        delta: 'Hello',
      }),
    ).toBeNull();
  });

  it('does not flush audio for transcript completion', () => {
    expect(isAudioDoneEvent({ type: 'response.output_audio.done' })).toBeTrue();
    expect(
      isAudioDoneEvent({ type: 'response.output_audio_transcript.done' }),
    ).toBeFalse();
  });

  it('returns only a completed output audio transcript', () => {
    expect(
      extractAssistantTextDone({
        type: 'response.output_audio_transcript.done',
        transcript: '  Welcome to Sophia.  ',
      }),
    ).toBe('Welcome to Sophia.');
    expect(
      extractAssistantTextDone({
        type: 'response.output_audio_transcript.delta',
        delta: 'Welcome',
      }),
    ).toBeNull();
  });

  it('returns completed text-only model output', () => {
    expect(
      extractAssistantTextDone({
        type: 'response.output_text.done',
        text: '  Text for HeyGen FULL. ',
      }),
    ).toBe('Text for HeyGen FULL.');
  });
});

import {SophiaRealtimeClientService} from './sophia-realtime-client.service';
describe('Realtime interruptions',()=>{
 it('keeps the microphone enabled during output and reports user interruption',async()=>{
  const service=new SophiaRealtimeClientService() as any;
  const track={enabled:true};service.localStream={getAudioTracks:()=>[track]};
  const interrupted=jasmine.createSpy('interrupt');
  const request={onEvent:()=>{},onOutputAudioStarted:()=>{},onUserSpeechStarted:interrupted};
  await service.handleServerEvent(JSON.stringify({type:'output_audio_buffer.started'}),request);
  expect(track.enabled).toBeTrue();
  await service.handleServerEvent(JSON.stringify({type:'input_audio_buffer.speech_started'}),request);
  expect(track.enabled).toBeTrue();expect(interrupted).toHaveBeenCalledTimes(1);
 });
 it('does not resume an old tool answer after the user asks another question',async()=>{
  const service=new SophiaRealtimeClientService() as any;const sent:any[]=[];
  service.dataChannel={readyState:'open',send:(message:string)=>sent.push(JSON.parse(message))};
  let finish!:(value:unknown)=>void;
  const request={onEvent:()=>{},onToolCall:()=>new Promise(resolve=>{finish=resolve;})};
  const pending=service.handleServerEvent(JSON.stringify({type:'response.function_call_arguments.done',call_id:'call',name:'lookup',arguments:'{}'}),request);
  await service.handleServerEvent(JSON.stringify({type:'input_audio_buffer.speech_started'}),request);
  finish({result:'old answer'});await pending;
  expect(sent.some(e=>e.type==='conversation.item.create')).toBeTrue();
  expect(sent.some(e=>e.type==='response.create')).toBeFalse();
 });
 it('does not send interrupted text to HeyGen for playback',async()=>{
  const service=new SophiaRealtimeClientService() as any;const speak=jasmine.createSpy('speak');
  const request={onEvent:()=>{},onAssistantTextDone:speak};
  for(const event of [{type:'response.created',response:{id:'old'}},{type:'input_audio_buffer.speech_started'},{type:'response.output_text.done',response_id:'old',text:'Old answer'}])await service.handleServerEvent(JSON.stringify(event),request);
  expect(speak).not.toHaveBeenCalled();
 });
});
