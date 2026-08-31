import {
  extractAudioDelta,
  extractOutputAudioTranscriptDone,
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
      extractOutputAudioTranscriptDone({
        type: 'response.output_audio_transcript.done',
        transcript: '  Welcome to Sophia.  ',
      }),
    ).toBe('Welcome to Sophia.');
    expect(
      extractOutputAudioTranscriptDone({
        type: 'response.output_audio_transcript.delta',
        delta: 'Welcome',
      }),
    ).toBeNull();
  });
});
