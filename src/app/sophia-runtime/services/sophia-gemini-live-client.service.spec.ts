import { normalizeGeminiLiveEvent } from './sophia-gemini-live-client.service';

describe('SophiaGeminiLiveClientService protocol mapping', () => {
  it('processes every audio part and maps only server-constrained tool aliases', () => {
    const event = normalizeGeminiLiveEvent({
      serverContent: {
        modelTurn: { parts: [
          { inlineData: { mimeType: 'audio/pcm;rate=24000', data: 'AQI=' } },
          { inlineData: { mimeType: 'audio/pcm;rate=24000', data: 'AwQ=' } },
        ] },
        outputTranscription: { text: 'Please review.' }, turnComplete: true,
      },
      toolCall: { functionCalls: [
        { id: 'call-1', name: 'sophia_0_booking_prepare', args: { propertyId: 'property-1' } },
        { id: 'call-2', name: 'unapproved_tool', args: {} },
      ] },
    }, { sophia_0_booking_prepare: 'booking.prepare' });

    expect(event.audio).toEqual(['AQI=', 'AwQ=']);
    expect(event.outputText).toBe('Please review.');
    expect(event.turnComplete).toBeTrue();
    expect(event.toolCalls).toEqual([{ id: 'call-1', providerName: 'sophia_0_booking_prepare',
      name: 'booking.prepare', args: { propertyId: 'property-1' } }]);
  });

  it('normalizes barge-in and tool cancellation without inventing completion', () => {
    const event = normalizeGeminiLiveEvent({
      serverContent: { interrupted: true }, toolCallCancellation: { ids: ['call-1', 2] },
    }, {});
    expect(event).toEqual({ interrupted: true, turnComplete: false, outputText: undefined,
      audio: [], toolCalls: [], cancelledToolCallIds: ['call-1'] });
  });
});
