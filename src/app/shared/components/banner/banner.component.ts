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

  isMuted = false; // default unmuted
  isPlaying = false;
  private hasAutoPlayedOnce = false;
  private io?: IntersectionObserver;

  // toggle if you want re-play on visibility
  private autoResumeOnVisible = true;

  ngAfterViewInit(): void {
    const vid = this.videoRef?.nativeElement;
    if (!vid) return;

    // keep UI state synced
    vid.addEventListener('play', () => (this.isPlaying = true));
    vid.addEventListener('pause', () => (this.isPlaying = false));
    vid.addEventListener('ended', () => (this.isPlaying = false));

    // Autoplay/resume when ≥60% visible; pause when not visible enough
    this.io = new IntersectionObserver(
      async ([entry]) => {
        if (!entry) return;
        const visibleEnough =
          entry.isIntersecting && entry.intersectionRatio >= 0.6;

        if (visibleEnough) {
          if (vid.ended) {
            if (this.autoResumeOnVisible) {
              try {
                vid.currentTime = 0;
                await vid.play();
                this.hasAutoPlayedOnce = true;
              } catch {}
            }
            this.hasAutoPlayedOnce = true;
            return;
          }

          // First-time visible: try a single autoplay (unmuted)
          if (!this.hasAutoPlayedOnce) {
            await this.tryAutoplayOnce(vid);
          }
          // Subsequent times: resume if paused
          else if (this.autoResumeOnVisible && vid.paused) {
            try {
              await vid.play(); // may be blocked; safe to ignore
            } catch {}
          }
        } else {
          // Off-screen: pause (don’t reset time)
          if (!vid.paused) vid.pause();
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
      await vid.play();
      this.hasAutoPlayedOnce = true;
    } catch {
      this.hasAutoPlayedOnce = true;
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
