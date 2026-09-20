import { pcmBytesToBinaryString, SophiaLiveAvatarClientService } from './sophia-liveavatar-client.service';

describe('pcmBytesToBinaryString', () => {
  it('preserves PCM bytes as raw binary string characters', () => {
    const pcm = new Uint8Array([0, 1, 127, 128, 254, 255]);
    const result = pcmBytesToBinaryString(pcm);
    expect(Array.from(result, (character) => character.charCodeAt(0))).toEqual([
      0, 1, 127, 128, 254, 255,
    ]);
  });
});

describe('Sophia Professional interruption', () => {
  it('interrupts the HeyGen session and discards queued audio', () => {
    const service = new SophiaLiveAvatarClientService();
    const interrupt = jasmine.createSpy('interrupt');
    (service as any).session = { interrupt };
    (service as any).audioChunks = [new Uint8Array([1, 2])];
    (service as any).audioByteLength = 2;
    service.interrupt();
    expect(interrupt).toHaveBeenCalledTimes(1);
    expect((service as any).audioChunks).toEqual([]);
    expect((service as any).audioByteLength).toBe(0);
  });
});
