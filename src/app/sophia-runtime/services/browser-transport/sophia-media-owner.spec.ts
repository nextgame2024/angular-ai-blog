import { SophiaMediaOwner } from './sophia-media-owner';

describe('SophiaMediaOwner', () => {
  it('allows exactly one audible output at a time', () => {
    const remoteAudio = document.createElement('audio');
    const avatarAudio = document.createElement('audio');
    const avatarVideo = document.createElement('video');
    const owner = new SophiaMediaOwner({
      remoteAudio,
      avatarAudio,
      avatarVideo,
    });

    owner.select('remote-audio');
    expect([remoteAudio.muted, avatarAudio.muted, avatarVideo.muted]).toEqual([
      false,
      true,
      true,
    ]);

    owner.select('avatar-video');
    expect([remoteAudio.muted, avatarAudio.muted, avatarVideo.muted]).toEqual([
      true,
      true,
      false,
    ]);
  });

  it('mutes and detaches every media element during cleanup', () => {
    const media = {
      remoteAudio: document.createElement('audio'),
      avatarAudio: document.createElement('audio'),
      avatarVideo: document.createElement('video'),
    };
    const owner = new SophiaMediaOwner(media);
    owner.select('avatar-audio');
    owner.clear();

    expect(owner.current()).toBe('none');
    expect(media.remoteAudio.muted).toBeTrue();
    expect(media.avatarAudio.muted).toBeTrue();
    expect(media.avatarVideo.muted).toBeTrue();
    expect(media.remoteAudio.srcObject).toBeNull();
    expect(media.avatarAudio.srcObject).toBeNull();
    expect(media.avatarVideo.srcObject).toBeNull();
  });
});
