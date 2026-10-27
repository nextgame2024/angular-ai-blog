import Daily, { type DailyCall } from '@daily-co/daily-js';
import { SophiaTavusClientService } from './sophia-tavus-client.service';

describe('SophiaTavusClientService', () => {
  it('explicitly publishes and verifies the local microphone before connecting', async () => {
    const track = { enabled: true, readyState: 'live' } as MediaStreamTrack;
    const call = jasmine.createSpyObj<DailyCall>('DailyCall', [
      'on', 'join', 'setLocalAudio', 'participants', 'localAudio',
      'isDestroyed', 'meetingState', 'leave', 'destroy',
    ]);
    call.on.and.returnValue(call);
    call.join.and.resolveTo({} as never);
    call.setLocalAudio.and.returnValue(call);
    call.localAudio.and.returnValue(true);
    call.participants.and.returnValue({
      local: {
        local: true,
        tracks: {
          audio: { state: 'sendable', subscribed: true, track },
        },
      },
    } as never);
    call.isDestroyed.and.returnValue(false);
    call.meetingState.and.returnValue('joined-meeting');
    call.leave.and.resolveTo();
    call.destroy.and.resolveTo();
    const createCallObject = spyOn(Daily, 'createCallObject').and.returnValue(call);

    const client = new SophiaTavusClientService();
    await client.connect({
      conversationId: 'conversation-1',
      conversationUrl: 'https://tavus.daily.co/conversation-1',
      meetingToken: 'meeting-token',
      videoElement: document.createElement('video'),
      audioElement: document.createElement('audio'),
      onStatus: () => undefined,
      onEvent: () => undefined,
      onToolCall: async () => ({}),
    });

    expect(createCallObject).toHaveBeenCalledWith(jasmine.objectContaining({
      audioSource: true,
      startAudioOff: false,
    }));
    expect(call.setLocalAudio).toHaveBeenCalledOnceWith(true);
    await client.disconnect();
  });

  it('sends the documented conversation interrupt for the active session', () => {
    const client = new SophiaTavusClientService();
    const call = jasmine.createSpyObj('DailyCall', ['sendAppMessage']);
    const internals = client as unknown as {
      call: { sendAppMessage(message: unknown, recipient: string): void };
      conversationId: string;
    };
    internals.call = call;
    internals.conversationId = 'conversation-1';

    client.interrupt();

    expect(call.sendAppMessage).toHaveBeenCalledOnceWith(
      {
        message_type: 'conversation',
        event_type: 'conversation.interrupt',
        conversation_id: 'conversation-1',
      },
      '*',
    );
  });

  it('sends typed user input through the Tavus respond interaction', () => {
    const client = new SophiaTavusClientService();
    const call = jasmine.createSpyObj('DailyCall', ['sendAppMessage']);
    const internals = client as unknown as {
      call: { sendAppMessage(message: unknown, recipient: string): void };
      conversationId: string;
    };
    internals.call = call;
    internals.conversationId = 'conversation-1';

    client.respond('Show me homes in Brisbane');

    expect(call.sendAppMessage).toHaveBeenCalledOnceWith(
      {
        message_type: 'conversation',
        event_type: 'conversation.respond',
        conversation_id: 'conversation-1',
        properties: { text: 'Show me homes in Brisbane' },
      },
      '*',
    );
  });
});
