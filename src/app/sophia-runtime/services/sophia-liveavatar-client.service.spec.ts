import { pcmBytesToBinaryString } from './sophia-liveavatar-client.service';

describe('pcmBytesToBinaryString', () => {
  it('preserves PCM bytes as raw binary string characters', () => {
    const pcm = new Uint8Array([0, 1, 127, 128, 254, 255]);

    const result = pcmBytesToBinaryString(pcm);

    expect(Array.from(result, (character) => character.charCodeAt(0))).toEqual([
      0, 1, 127, 128, 254, 255,
    ]);
  });
});
