import {
  Component,
  ElementRef,
  Renderer2,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AssetInterface } from 'src/app/shared/types/asset.interface';

@Component({
    selector: 'mc-article-media',
    imports: [CommonModule],
    templateUrl: './articleMedia.component.html'
})
export class ArticleMediaComponent {
  readonly assets$$ = input<AssetInterface[] | null | undefined>([], {
    alias: 'assets',
  });

  readonly videoRef$$ = viewChild<ElementRef<HTMLVideoElement>>('videoEl');

  readonly defaultPoster =
    'https://files-nodejs-api.s3.ap-southeast-2.amazonaws.com/public/avatar-user.png';

  readonly isMuted$$ = signal(false);
  readonly isPlaying$$ = signal(false);

  readonly video$$ = computed(() =>
    (this.assets$$() || []).find((a) => a.type === 'video')
  );
  readonly image$$ = computed(() =>
    (this.assets$$() || []).find((a) => a.type === 'image')
  );
  readonly audio$$ = computed(() =>
    (this.assets$$() || []).find((a) => a.type === 'audio')
  );

  private readonly renderer = inject(Renderer2);

  private readonly observerEffect = effect((onCleanup) => {
    const vid = this.videoRef$$()?.nativeElement;
    if (!vid) return;

    const unlistenPlay = this.renderer.listen(vid, 'play', () =>
      this.isPlaying$$.set(true)
    );
    const unlistenPause = this.renderer.listen(vid, 'pause', () =>
      this.isPlaying$$.set(false)
    );
    const unlistenEnded = this.renderer.listen(vid, 'ended', () =>
      this.isPlaying$$.set(false)
    );

    const io = new IntersectionObserver(
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
    io.observe(vid);

    onCleanup(() => {
      io.disconnect();
      unlistenPlay();
      unlistenPause();
      unlistenEnded();
    });
  });

  private async tryAutoplay(vid: HTMLVideoElement) {
    try {
      this.renderer.setProperty(vid, 'muted', this.isMuted$$());
      await vid.play();
    } catch {
      if (!vid.muted) {
        this.isMuted$$.set(true);
        this.renderer.setProperty(vid, 'muted', true);
        try {
          await vid.play();
        } catch {}
      }
    }
  }

  play(): void {
    this.videoRef$$()?.nativeElement.play().catch(() => {});
  }
  pause(): void {
    this.videoRef$$()?.nativeElement.pause();
  }
  stop(): void {
    const v = this.videoRef$$()?.nativeElement;
    if (!v) return;
    v.pause();
    this.renderer.setProperty(v, 'currentTime', 0);
  }
  toggleMute(): void {
    const v = this.videoRef$$()?.nativeElement;
    if (!v) return;
    const nextMuted = !this.isMuted$$();
    this.isMuted$$.set(nextMuted);
    this.renderer.setProperty(v, 'muted', nextMuted);
  }

  onImageError(evt: Event): void {
    const img = evt.target instanceof HTMLImageElement ? evt.target : null;
    if (img && img.src !== this.defaultPoster) {
      this.renderer.setAttribute(img, 'src', this.defaultPoster);
    }
  }
}
