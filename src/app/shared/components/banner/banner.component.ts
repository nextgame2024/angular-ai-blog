import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { environment } from 'src/environments/environment.development';

@Component({
  selector: 'mc-banner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './banner.component.html',
})
export class BannerComponent implements AfterViewInit, OnDestroy {
  readonly videoSrc = environment.introVideo;

  @ViewChild('heroVideo', { static: false })
  videoRef?: ElementRef<HTMLVideoElement>;

  isMuted = false;
  isPlaying = false;
  private hasAutoPlayedOnce = false;
  private io?: IntersectionObserver;

  ngAfterViewInit(): void {
    const vid = this.videoRef?.nativeElement;
    if (!vid) return;

    // keep UI state synced
    vid.addEventListener('play', () => (this.isPlaying = true));
    vid.addEventListener('pause', () => (this.isPlaying = false));
    vid.addEventListener('ended', () => (this.isPlaying = false));

    // try autoplay once when ≥60% visible
    this.io = new IntersectionObserver(
      async ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
          if (!this.hasAutoPlayedOnce) {
            await this.tryAutoplayOnce(vid);
          }
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

  private async tryAutoplayOnce(vid: HTMLVideoElement) {
    try {
      // first try with current (unmuted) state
      await vid.play();
      this.hasAutoPlayedOnce = true;
    } catch {
      // if blocked by the browser, fall back to muted autoplay
      this.hasAutoPlayedOnce = true;
      // if (!vid.muted) {
      //   this.isMuted = true;
      //   vid.muted = true;
      //   try {
      //     await vid.play();
      //     this.hasAutoPlayedOnce = true;
      //   } catch {
      //     // still blocked – give up silently; user can press Play
      //   }
      // }
    }
  }

  playVideo(): void {
    const vid = this.videoRef?.nativeElement;
    vid?.play().catch(() => {});
  }

  pauseVideo(): void {
    const vid = this.videoRef?.nativeElement;
    vid?.pause();
  }

  stopVideo(): void {
    const vid = this.videoRef?.nativeElement;
    if (!vid) return;
    vid.pause();
    vid.currentTime = 0;
  }

  toggleMute(): void {
    const vid = this.videoRef?.nativeElement;
    if (!vid) return;
    this.isMuted = !this.isMuted;
    vid.muted = this.isMuted;
  }
}
