import type {
  SophiaAudibleOutput,
  SophiaBrowserMediaElements,
} from './sophia-browser-transport.types';

export class SophiaMediaOwner {
  private owner: SophiaAudibleOutput = 'none';

  constructor(private readonly media: SophiaBrowserMediaElements) {
    this.select('none');
  }

  select(owner: SophiaAudibleOutput): void {
    this.owner = owner;
    this.media.remoteAudio.muted = owner !== 'remote-audio';
    this.media.avatarAudio.muted = owner !== 'avatar-audio';
    this.media.avatarVideo.muted = owner !== 'avatar-video';
  }

  current(): SophiaAudibleOutput {
    return this.owner;
  }

  clear(): void {
    this.select('none');
    clearMedia(this.media.remoteAudio);
    clearMedia(this.media.avatarAudio);
    clearMedia(this.media.avatarVideo);
  }
}

function clearMedia(element: HTMLMediaElement): void {
  element.pause();
  element.srcObject = null;
}
