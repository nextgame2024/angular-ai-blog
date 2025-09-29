import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  NgZone,
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
  logo = environment.apiUrl;

  @ViewChild('heroVideo', { static: false })
  videoRef?: ElementRef<HTMLVideoElement>;

  // Mobile aspect box
  aspectRatio = '3 / 2';
  ptPercent = 66.6667;
  supportsAspectRatio = false;
  isDesktop = false;

  // Header height (px)
  headerH = 64;

  isMuted = false;
  isPlaying = false;
  private hasAutoPlayedOnce = false;
  private io?: IntersectionObserver;
  private ro?: ResizeObserver;
  private mql?: MediaQueryList;

  private autoResumeOnVisible = true;

  constructor(private zone: NgZone) {}

  ngAfterViewInit(): void {
    try {
      // @ts-ignore
      this.supportsAspectRatio = !!(window as any).CSS?.supports?.(
        'aspect-ratio',
        '1 / 1'
      );
    } catch {
      this.supportsAspectRatio = false;
    }

    // Desktop breakpoint watcher (matches Tailwind md = 768px)
    this.mql = window.matchMedia('(min-width: 768px)');
    const updateDesktop = () =>
      this.zone.run(() => (this.isDesktop = this.mql!.matches));
    updateDesktop();
    this.mql.addEventListener
      ? this.mql.addEventListener('change', updateDesktop)
      : this.mql.addListener(updateDesktop);

    this.measureHeader();
    this.observeHeaderResize();
    this.observeWindowResize();

    const vid = this.videoRef?.nativeElement;
    if (!vid) return;

    vid.addEventListener('play', () => (this.isPlaying = true));
    vid.addEventListener('pause', () => (this.isPlaying = false));
    vid.addEventListener('ended', () => (this.isPlaying = false));

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
          if (!this.hasAutoPlayedOnce) {
            await this.tryAutoplayOnce(vid);
          } else if (this.autoResumeOnVisible && vid.paused) {
            try {
              await vid.play();
            } catch {}
          }
        } else {
          if (!vid.paused) vid.pause();
        }
      },
      { threshold: [0, 0.6, 1] }
    );

    this.io.observe(vid);
  }

  ngOnDestroy(): void {
    this.io?.disconnect();
    this.ro?.disconnect();
    window.removeEventListener('resize', this._onWinResize);
    if (this.mql) {
      this.mql.removeEventListener
        ? this.mql.removeEventListener('change', () => {})
        : this.mql.removeListener(() => {});
    }
  }

  onLogoError(ev: Event) {
    const img = ev.target as HTMLImageElement;
    img.src = 'assets/sophiaAi-logo.svg';
  }

  onMetaLoaded(): void {
    const vid = this.videoRef?.nativeElement;
    if (!vid || !vid.videoWidth || !vid.videoHeight) return;
    this.aspectRatio = `${vid.videoWidth} / ${vid.videoHeight}`;
    this.ptPercent = (vid.videoHeight / vid.videoWidth) * 100;
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
    this.videoRef?.nativeElement.play().catch(() => {});
  }
  pauseVideo(): void {
    this.videoRef?.nativeElement.pause();
  }
  stopVideo(): void {
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

  private measureHeader(): void {
    const menubars = Array.from(
      document.querySelectorAll<HTMLElement>('.p-menubar, header, mc-topbar')
    );
    if (menubars.length) {
      const newH = Math.max(...menubars.map((el) => el.offsetHeight || 0));
      if (newH > 0 && newH !== this.headerH) this.headerH = newH;
    }
  }
  private observeHeaderResize(): void {
    const menubar = document.querySelector<HTMLElement>(
      '.p-menubar, header, mc-topbar'
    );
    if (!('ResizeObserver' in window) || !menubar) return;
    this.ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = Math.round((entry.target as HTMLElement).offsetHeight);
        if (h > 0 && h !== this.headerH)
          this.zone.run(() => (this.headerH = h));
      }
    });
    this.ro.observe(menubar);
  }
  private _onWinResize = () => this.measureHeader();
  private observeWindowResize(): void {
    window.addEventListener('resize', this._onWinResize, { passive: true });
  }
}
