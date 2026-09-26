import {
  pcmBytesToBinaryString,
  SophiaLiveAvatarClientService,
} from './sophia-liveavatar-client.service';

describe('pcmBytesToBinaryString', () => {
  it('preserves PCM bytes as raw binary string characters', () => {
    const pcm = new Uint8Array([0, 1, 127, 128, 254, 255]);

    const result = pcmBytesToBinaryString(pcm);

    expect(Array.from(result, (character) => character.charCodeAt(0))).toEqual([
      0, 1, 127, 128, 254, 255,
    ]);
  });
});

describe('SophiaLiveAvatarClientService interruption', () => {
  it('drops queued audio and interrupts the active SDK session', () => {
    const client = new SophiaLiveAvatarClientService();
    const session = jasmine.createSpyObj('LiveAvatarSession', ['interrupt']);
    const internals = client as unknown as {
      session: { interrupt(): void };
      audioChunks: Uint8Array[];
      audioByteLength: number;
    };
    internals.session = session;
    internals.audioChunks = [new Uint8Array([1, 2])];
    internals.audioByteLength = 2;

    client.interrupt();

    expect(session.interrupt).toHaveBeenCalled();
    expect(internals.audioChunks).toEqual([]);
    expect(internals.audioByteLength).toBe(0);
  });
});
