import { SophiaTavusClientService } from './sophia-tavus-client.service';

describe('SophiaTavusClientService interruption', () => {
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
});
