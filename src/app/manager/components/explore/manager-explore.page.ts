import { CommonModule, DOCUMENT } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Store } from '@ngrx/store';

import { environment } from 'src/environments/environment';
import { ManagerExploreActions } from '../../store/explore/manager.actions';
import {
  selectManagerExploreError,
  selectManagerExploreLoading,
  selectManagerExplorePage,
  selectManagerExploreSearchQuery,
  selectManagerExploreTotal,
  selectManagerExploreVideos,
} from '../../store/explore/manager.selectors';
import type { BmExploreVideo } from '../../types/explore.interface';

type ExploreStat = {
  value: string;
  label: string;
};

@Component({
  selector: 'app-manager-explore-page',
  imports: [CommonModule],
  templateUrl: './manager-explore.page.html',
  styleUrls: ['./manager-explore.page.css'],
})
export class ManagerExplorePageComponent {
  private readonly mobileMaxWidth = 680;
  private readonly revealThresholdSeconds = 1;
  private readonly store = inject(Store);
  private readonly document = inject(DOCUMENT);

  private readonly heroVideoRef$$ =
    viewChild<ElementRef<HTMLVideoElement>>('heroVideo');
  private readonly modalVideoRef$$ =
    viewChild<ElementRef<HTMLVideoElement>>('modalVideo');
  private readonly playerSurfaceRef$$ =
    viewChild<ElementRef<HTMLElement>>('playerSurface');
  private readonly infiniteSentinelRef$$ =
    viewChild<ElementRef<HTMLElement>>('infiniteSentinel');
  private headerObserver: ResizeObserver | null = null;

  readonly heroVideoSrc$$ = signal(environment.bannerVideo);
  readonly headerH$$ = signal(0);
  readonly isHeroMuted$$ = signal(false);
  readonly isHeroPlaying$$ = signal(false);
  readonly heroReveal$$ = signal(true);

  readonly heroStats: ExploreStat[] = [
    { value: '12', label: 'guided videos' },
    { value: '4', label: 'training categories' },
    { value: '100%', label: 'effectiveness' },
  ];
  readonly quickFilters = [
    'Clients',
    'Projects',
    'Pricing',
    'Quotes',
    'Invoices',
    'Users',
  ];

  readonly exploreVideos$$ = toSignal(
    this.store.select(selectManagerExploreVideos),
    { initialValue: [] as BmExploreVideo[] },
  );
  readonly loading$$ = toSignal(this.store.select(selectManagerExploreLoading), {
    initialValue: false,
  });
  readonly error$$ = toSignal(this.store.select(selectManagerExploreError), {
    initialValue: null,
  });
  readonly searchQuery$$ = toSignal(
    this.store.select(selectManagerExploreSearchQuery),
    { initialValue: '' },
  );
  readonly page$$ = toSignal(this.store.select(selectManagerExplorePage), {
    initialValue: 1,
  });
  readonly total$$ = toSignal(this.store.select(selectManagerExploreTotal), {
    initialValue: 0,
  });

  readonly selectedVideoId$$ = signal<string | null>(null);
  readonly inlinePlayingVideoId$$ = signal<string | null>(null);
  readonly isLoadingMore$$ = signal(false);
  readonly isPlayerReady$$ = signal(false);
  readonly isPlayerPlaying$$ = signal(false);
  readonly isPlayerMuted$$ = signal(false);
  readonly isPlayerFullscreen$$ = signal(false);
  readonly playerCurrentTimeSeconds$$ = signal(0);
  readonly playerDurationSeconds$$ = signal(0);

  readonly selectedVideo$$ = computed(() => {
    const selectedVideoId = this.selectedVideoId$$();
    if (!selectedVideoId) return null;

    return (
      this.exploreVideos$$().find((video) => video.videoId === selectedVideoId) ??
      null
    );
  });

  readonly canLoadMore$$ = computed(
    () => !this.loading$$() && this.exploreVideos$$().length < this.total$$(),
  );
  readonly showInitialLoader$$ = computed(
    () => this.loading$$() && !this.exploreVideos$$().length,
  );
  readonly showEmptyState$$ = computed(
    () => !this.loading$$() && !this.exploreVideos$$().length,
  );
  readonly loadedCountLabel$$ = computed(() => {
    const loadedCount = this.exploreVideos$$().length;
    const total = this.total$$();
    const query = this.searchQuery$$().trim();

    if (query) {
      return `${loadedCount} of ${total} videos match "${query}"`;
    }

    return `${loadedCount} of ${total} Business Manager videos ready`;
  });
  readonly playerProgressPercent$$ = computed(() => {
    const durationSeconds = this.playerDurationSeconds$$();
    if (!durationSeconds) return 0;

    return Math.min(
      100,
      Math.max(
        0,
        (this.playerCurrentTimeSeconds$$() / durationSeconds) * 100,
      ),
    );
  });
  readonly playerCurrentTimeLabel$$ = computed(() =>
    this.formatVideoTime(this.playerCurrentTimeSeconds$$()),
  );
  readonly playerDurationLabel$$ = computed(() =>
    this.formatVideoTime(this.playerDurationSeconds$$()),
  );

  private readonly initialLoadEffect = effect(() => {
    this.store.dispatch(ManagerExploreActions.loadExploreVideos({ page: 1 }));
  });

  private readonly pageInitEffect = effect((onCleanup) => {
    const view = this.document.defaultView;
    if (!view) return;

    this.updateHeroVideoSource();
    this.measureHeader();
    this.observeHeaderResize();
    this.syncHeroMutedState();

    const onResize = () => {
      this.measureHeader();
      this.updateHeroVideoSource();
    };

    view.addEventListener('resize', onResize, { passive: true });

    onCleanup(() => {
      this.headerObserver?.disconnect();
      this.headerObserver = null;
      view.removeEventListener('resize', onResize);
    });
  });

  private readonly loadingReleaseEffect = effect(() => {
    if (!this.loading$$()) {
      this.isLoadingMore$$.set(false);
    }
  });

  private readonly modalSyncEffect = effect(() => {
    if (!this.selectedVideo$$()) {
      this.resetPlayerState();
      return;
    }

    this.isPlayerReady$$.set(false);
    this.playerCurrentTimeSeconds$$.set(0);
    this.playerDurationSeconds$$.set(0);
    this.isPlayerPlaying$$.set(false);
    this.isPlayerMuted$$.set(false);
  });

  private readonly fullscreenListenerEffect = effect((onCleanup) => {
    const onFullscreenChange = () => {
      this.isPlayerFullscreen$$.set(!!this.document.fullscreenElement);
    };

    this.document.addEventListener('fullscreenchange', onFullscreenChange);

    onCleanup(() => {
      this.document.removeEventListener(
        'fullscreenchange',
        onFullscreenChange,
      );
    });
  });

  private readonly infiniteScrollEffect = effect((onCleanup) => {
    const sentinel = this.infiniteSentinelRef$$()?.nativeElement;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const isVisible = entries.some((entry) => entry.isIntersecting);
        if (!isVisible) return;
        this.loadNextPage();
      },
      {
        threshold: 0.2,
      },
    );

    observer.observe(sentinel);

    onCleanup(() => {
      observer.disconnect();
    });
  });

  onHeroVideoMeta(): void {
    this.syncHeroMutedState();
    this.syncHeroReveal();
  }

  onHeroVideoPlay(): void {
    if (this.hasActiveContentVideo()) {
      this.pauseHeroVideo();
      return;
    }

    this.isHeroPlaying$$.set(true);
    this.syncHeroReveal();
  }

  onHeroVideoPause(): void {
    this.isHeroPlaying$$.set(false);
    this.syncHeroReveal();
  }

  onHeroVideoEnded(): void {
    this.isHeroPlaying$$.set(false);
    this.heroReveal$$.set(true);
  }

  onHeroVideoTimeUpdate(): void {
    this.syncHeroReveal();
  }

  playHeroVideo(): void {
    if (this.hasActiveContentVideo()) return;

    const videoElement = this.heroVideoRef$$()?.nativeElement;
    if (!videoElement) return;

    if (
      Number.isFinite(videoElement.duration)
      && (videoElement.ended || videoElement.currentTime >= videoElement.duration - 0.05)
    ) {
      videoElement.currentTime = 0;
    }

    this.syncHeroMutedState();
    this.syncHeroReveal();
    void videoElement.play().catch(() => undefined);
  }

  pauseHeroVideo(): void {
    this.heroVideoRef$$()?.nativeElement.pause();
  }

  stopHeroVideo(): void {
    const videoElement = this.heroVideoRef$$()?.nativeElement;
    if (!videoElement) return;

    videoElement.pause();
    videoElement.currentTime = 0;
    this.isHeroPlaying$$.set(false);
    this.syncHeroReveal();
  }

  toggleHeroMute(): void {
    const videoElement = this.heroVideoRef$$()?.nativeElement;
    if (!videoElement) return;

    const nextMuted = !this.isHeroMuted$$();
    this.isHeroMuted$$.set(nextMuted);
    videoElement.muted = nextMuted;
  }

  onSearchInput(query: string): void {
    this.store.dispatch(ManagerExploreActions.setExploreSearchQuery({ query }));
    this.store.dispatch(ManagerExploreActions.loadExploreVideos({ page: 1 }));
  }

  clearSearch(): void {
    this.onSearchInput('');
  }

  applyQuickFilter(query: string): void {
    this.onSearchInput(query);
  }

  loadNextPage(): void {
    if (this.loading$$() || this.isLoadingMore$$() || !this.canLoadMore$$()) {
      return;
    }

    this.isLoadingMore$$.set(true);
    this.store.dispatch(
      ManagerExploreActions.loadExploreVideos({ page: this.page$$() + 1 }),
    );
  }

  openVideo(videoId: string): void {
    this.pauseHeroVideo();
    this.selectedVideoId$$.set(videoId);
    this.inlinePlayingVideoId$$.set(null);
    setTimeout(() => {
      const videoElement = this.getModalVideoElement();
      if (!videoElement) return;

      videoElement.controls = true;
      videoElement.muted = false;
      void videoElement.play().catch(() => undefined);
    });
  }

  closeVideo(): void {
    const videoElement = this.getModalVideoElement();
    if (videoElement) {
      videoElement.pause();
      videoElement.currentTime = 0;
    }

    if (this.document.fullscreenElement && this.document.exitFullscreen) {
      void this.document.exitFullscreen();
    }

    this.selectedVideoId$$.set(null);
  }

  startPreview(videoElement: HTMLVideoElement): void {
    if (this.inlinePlayingVideoId$$()) return;
    videoElement.muted = true;
    videoElement.playsInline = true;
    videoElement.loop = true;
    void videoElement.play().catch(() => undefined);
  }

  stopPreview(videoElement: HTMLVideoElement): void {
    if (this.inlinePlayingVideoId$$()) return;
    videoElement.pause();
    videoElement.currentTime = 0;
  }

  playInlineVideo(videoElement: HTMLVideoElement, videoId: string): void {
    this.pauseHeroVideo();
    this.inlinePlayingVideoId$$.set(videoId);
    videoElement.controls = true;
    videoElement.loop = false;
    videoElement.muted = false;
    if (videoElement.ended) {
      videoElement.currentTime = 0;
    }
    void videoElement.play().catch(() => undefined);
  }

  onInlineVideoEnded(videoId: string): void {
    if (this.inlinePlayingVideoId$$() === videoId) {
      this.inlinePlayingVideoId$$.set(null);
    }
  }

  playSelectedVideo(): void {
    const videoElement = this.getModalVideoElement();
    if (!videoElement) return;

    void videoElement.play().catch(() => undefined);
  }

  pauseSelectedVideo(): void {
    this.getModalVideoElement()?.pause();
  }

  stopSelectedVideo(): void {
    const videoElement = this.getModalVideoElement();
    if (!videoElement) return;

    videoElement.pause();
    videoElement.currentTime = 0;
    this.syncPlayerStateFromVideo(videoElement);
  }

  toggleMute(): void {
    const videoElement = this.getModalVideoElement();
    if (!videoElement) return;

    videoElement.muted = !videoElement.muted;
    this.syncPlayerStateFromVideo(videoElement);
  }

  toggleFullscreen(): void {
    const playerSurface = this.playerSurfaceRef$$()?.nativeElement;
    if (!playerSurface) return;

    if (!this.document.fullscreenElement && playerSurface.requestFullscreen) {
      void playerSurface.requestFullscreen();
      return;
    }

    if (this.document.fullscreenElement && this.document.exitFullscreen) {
      void this.document.exitFullscreen();
    }
  }

  seekToProgress(progressValue: string): void {
    const videoElement = this.getModalVideoElement();
    if (!videoElement) return;

    const progress = Number(progressValue);
    if (!Number.isFinite(progress)) return;
    if (!videoElement.duration || !Number.isFinite(videoElement.duration)) {
      return;
    }

    videoElement.currentTime = (progress / 100) * videoElement.duration;
    this.syncPlayerStateFromVideo(videoElement);
  }

  onPlayerMetadataLoaded(): void {
    const videoElement = this.getModalVideoElement();
    if (!videoElement) return;

    this.isPlayerReady$$.set(true);
    this.syncPlayerStateFromVideo(videoElement);
  }

  onPlayerTimeUpdate(): void {
    const videoElement = this.getModalVideoElement();
    if (!videoElement) return;

    this.syncPlayerStateFromVideo(videoElement);
  }

  onPlayerPlay(): void {
    this.isPlayerPlaying$$.set(true);
  }

  onPlayerPause(): void {
    this.isPlayerPlaying$$.set(false);
  }

  onPlayerVolumeChange(): void {
    const videoElement = this.getModalVideoElement();
    if (!videoElement) return;

    this.isPlayerMuted$$.set(videoElement.muted);
  }

  trackByVideo = (_: number, video: BmExploreVideo) => video.videoId;

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.selectedVideo$$()) {
      this.closeVideo();
    }
  }

  private syncHeroMutedState(): void {
    const videoElement = this.heroVideoRef$$()?.nativeElement;
    if (!videoElement) return;

    const isMuted = this.isHeroMuted$$();
    if (videoElement.muted !== isMuted) {
      videoElement.muted = isMuted;
    }
  }

  private syncHeroReveal(): void {
    const videoElement = this.heroVideoRef$$()?.nativeElement;
    if (!this.isMobileViewport()) {
      this.heroReveal$$.set(true);
      return;
    }

    if (
      !videoElement ||
      !Number.isFinite(videoElement.duration) ||
      videoElement.duration <= 0
    ) {
      this.heroReveal$$.set(false);
      return;
    }

    const remaining = videoElement.duration - videoElement.currentTime;
    this.heroReveal$$.set(remaining <= this.revealThresholdSeconds);
  }

  private isMobileViewport(): boolean {
    const view = this.document.defaultView;
    return !!(
      view?.matchMedia(`(max-width: ${this.mobileMaxWidth}px)`).matches ||
      view?.matchMedia('(hover: none) and (pointer: coarse)').matches
    );
  }

  private updateHeroVideoSource(): void {
    const view = this.document.defaultView;
    if (!view) return;

    const isMobile = this.isMobileViewport();
    const nextSrc =
      isMobile && environment.bannerVideoMobile
        ? environment.bannerVideoMobile
        : environment.bannerVideo;

    if (nextSrc === this.heroVideoSrc$$()) return;

    this.heroVideoSrc$$.set(nextSrc);
    this.heroReveal$$.set(!isMobile);
    const videoElement = this.heroVideoRef$$()?.nativeElement;
    if (!videoElement) return;

    const wasPlaying = !videoElement.paused && !videoElement.ended;
    videoElement.pause();
    videoElement.currentTime = 0;
    videoElement.load();

    if (wasPlaying && !this.hasActiveContentVideo()) {
      void videoElement.play().catch(() => undefined);
    }
    this.syncHeroReveal();
  }

  private hasActiveContentVideo(): boolean {
    return !!this.selectedVideoId$$() || !!this.inlinePlayingVideoId$$();
  }

  private measureHeader(): void {
    const headerElements = Array.from(
      this.document.querySelectorAll<HTMLElement>('.p-menubar, header, mc-topbar'),
    );
    if (!headerElements.length) return;

    const nextHeaderHeight = Math.max(
      ...headerElements.map((element) => element.offsetHeight || 0),
    );
    if (nextHeaderHeight > 0) {
      this.headerH$$.set(nextHeaderHeight);
    }
  }

  private observeHeaderResize(): void {
    const headerElement = this.document.querySelector<HTMLElement>(
      '.p-menubar, header, mc-topbar',
    );
    const view = this.document.defaultView;
    if (!headerElement || !view || !('ResizeObserver' in view)) return;

    this.headerObserver?.disconnect();

    const observer = new ResizeObserver(() => {
      this.measureHeader();
    });
    observer.observe(headerElement);
    this.headerObserver = observer;
  }

  private getModalVideoElement(): HTMLVideoElement | null {
    return this.modalVideoRef$$()?.nativeElement ?? null;
  }

  private syncPlayerStateFromVideo(videoElement: HTMLVideoElement): void {
    this.playerCurrentTimeSeconds$$.set(videoElement.currentTime || 0);
    this.playerDurationSeconds$$.set(
      Number.isFinite(videoElement.duration) ? videoElement.duration : 0,
    );
    this.isPlayerPlaying$$.set(!videoElement.paused && !videoElement.ended);
    this.isPlayerMuted$$.set(videoElement.muted);
  }

  private resetPlayerState(): void {
    this.isPlayerReady$$.set(false);
    this.isPlayerPlaying$$.set(false);
    this.isPlayerMuted$$.set(false);
    this.isPlayerFullscreen$$.set(false);
    this.playerCurrentTimeSeconds$$.set(0);
    this.playerDurationSeconds$$.set(0);
  }

  private formatVideoTime(totalSeconds: number): string {
    const safeSeconds =
      Number.isFinite(totalSeconds) && totalSeconds > 0
        ? Math.floor(totalSeconds)
        : 0;
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;

    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
}
