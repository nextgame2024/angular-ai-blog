import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AssetInterface } from 'src/app/shared/types/asset.interface';

@Component({
  selector: 'mc-article-media',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './articleMedia.component.html',
})
export class ArticleMediaComponent implements AfterViewInit, OnDestroy {
  @Input() assets: AssetInterface[] | null | undefined = [];

  @ViewChild('videoEl', { static: false })
  videoRef?: ElementRef<HTMLVideoElement>;

  readonly defaultPoster =
    'https://files-nodejs-api.s3.ap-southeast-2.amazonaws.com/public/avatar-user.png';

  isMuted = false;
  isPlaying = false;
  private io?: IntersectionObserver;

  get video(): AssetInterface | undefined {
    return (this.assets || []).find((a) => a.type === 'video');
  }
  get image(): AssetInterface | undefined {
    return (this.assets || []).find((a) => a.type === 'image');
  }
  get audio(): AssetInterface | undefined {
    return (this.assets || []).find((a) => a.type === 'audio');
  }

  ngAfterViewInit(): void {
    const vid = this.videoRef?.nativeElement;
    if (!vid) return;

    vid.addEventListener('play', () => (this.isPlaying = true));
    vid.addEventListener('pause', () => (this.isPlaying = false));
    vid.addEventListener('ended', () => (this.isPlaying = false));

    this.io = new IntersectionObserver(
      async ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
          await this.tryAutoplay(vid);
        } else {
          vid.pause();
        }
      },
      { threshold: [0, 0.6, 1] }
    );
    this.io.observe(vid);
  }

  ngOnDestroy(): void {
    this.io?.disconnect();
  }

  private async tryAutoplay(vid: HTMLVideoElement) {
    try {
      vid.muted = this.isMuted;
      await vid.play();
    } catch {
      if (!vid.muted) {
        this.isMuted = true;
        vid.muted = true;
        try {
          await vid.play();
        } catch {}
      }
    }
  }

  play(): void {
    this.videoRef?.nativeElement.play().catch(() => {});
  }
  pause(): void {
    this.videoRef?.nativeElement.pause();
  }
  stop(): void {
    const v = this.videoRef?.nativeElement;
    if (!v) return;
    v.pause();
    v.currentTime = 0;
  }
  toggleMute(): void {
    const v = this.videoRef?.nativeElement;
    if (!v) return;
    this.isMuted = !this.isMuted;
    v.muted = this.isMuted;
  }

  onImageError(evt: Event): void {
    const img = evt.target as HTMLImageElement | null;
    if (img && img.src !== this.defaultPoster) {
      img.src = this.defaultPoster;
    }
  }
}
