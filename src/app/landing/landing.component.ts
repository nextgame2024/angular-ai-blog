import { CommonModule, DOCUMENT } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  Renderer2,
  RendererFactory2,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Store } from '@ngrx/store';
import { finalize } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { environment } from 'src/environments/environment';
import { selectCurrentUser } from '../auth/store/reducers';
import {
  LOGIN_REDIRECT_TARGET_QUERY_PARAM,
  PostLoginRedirectService,
  type LoginRedirectTarget,
} from '../shared/services/post-login-redirect.service';

interface NewsItem {
  videoId: string;
  title: string;
  source: string;
  youtubeUrl: string;
  embedUrl: SafeResourceUrl;
  autoplayEmbedUrl: SafeResourceUrl;
}

@Component({
    selector: 'app-landing',
    imports: [CommonModule, ReactiveFormsModule, RouterLink],
    templateUrl: './landing.component.html',
    styleUrls: ['./landing.component.css']
})
export class LandingComponent implements AfterViewInit {
  private readonly mobileMaxWidth = 680;
  private readonly revealThresholdSeconds = 1;

  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly store = inject(Store);
  private readonly renderer = inject(Renderer2);
  private readonly rendererFactory = inject(RendererFactory2);
  private readonly document = inject(DOCUMENT);
  private readonly postLoginRedirect = inject(PostLoginRedirectService);

  readonly videoSrc$$ = signal(environment.bannerVideo);
  readonly currentUser$$ = toSignal(this.store.select(selectCurrentUser), {
    initialValue: undefined,
  });
  readonly submitState$$ = signal<'idle' | 'sending'>('idle');
  readonly isMuted$$ = signal(false);
  readonly isPlaying$$ = signal(false);
  readonly heroReveal$$ = signal(false);
  readonly headerH$$ = signal(0);
  readonly toast$$ = signal<{ type: 'success' | 'error'; message: string } | null>(
    null
  );
  readonly expandedNews$$ = signal<NewsItem | null>(null);
  readonly playingNewsVideoId$$ = signal<string | null>(null);
  private readonly toastTimer$$ = signal<number | null>(null);
  private readonly headerObserver$$ = signal<ResizeObserver | null>(null);

  readonly videoRef$$ = viewChild<ElementRef<HTMLVideoElement>>('heroVideo');

  readonly newsItems = [
    {
      videoId: 'aNkjgE0SNwI',
      title: 'Stark warning AI could make white collar jobs obsolete',
      source: '9 News Australia',
      youtubeUrl: 'https://www.youtube.com/watch?v=aNkjgE0SNwI',
      embedUrl: this.safeYoutubeEmbed('aNkjgE0SNwI'),
      autoplayEmbedUrl: this.safeYoutubeEmbed('aNkjgE0SNwI', true),
    },
    {
      videoId: 'eXdVDhOGqoE',
      title: "AI won't kill us all, but that doesn't make it trustworthy",
      source: 'TED',
      youtubeUrl: 'https://www.youtube.com/watch?v=eXdVDhOGqoE',
      embedUrl: this.safeYoutubeEmbed('eXdVDhOGqoE'),
      autoplayEmbedUrl: this.safeYoutubeEmbed('eXdVDhOGqoE', true),
    },
    {
      videoId: 'f3c4mQty_so',
      title: 'I Tried the First Humanoid Home Robot. It Got Weird.',
      source: 'Wall Street Journal',
      youtubeUrl: 'https://www.youtube.com/watch?v=f3c4mQty_so',
      embedUrl: this.safeYoutubeEmbed('f3c4mQty_so'),
      autoplayEmbedUrl: this.safeYoutubeEmbed('f3c4mQty_so', true),
    },
    {
      videoId: '3oXphIUOoRQ',
      title: 'SpaceX, OpenAI, Anthropic IPOs could trigger the biggest market crash yet',
      source: 'ABC News',
      youtubeUrl: 'https://www.youtube.com/watch?v=3oXphIUOoRQ',
      embedUrl: this.safeYoutubeEmbed('3oXphIUOoRQ'),
      autoplayEmbedUrl: this.safeYoutubeEmbed('3oXphIUOoRQ', true),
    },
  ];

  readonly agents = [
    {
      name: 'Research Agent',
      icon: '◎',
      copy: 'Find, analyze, and summarize information faster.',
    },
    {
      name: 'Workflow Agent',
      icon: '⌘',
      copy: 'Automate multi-step processes across your tools.',
    },
    {
      name: 'Support Agent',
      icon: '◌',
      copy: 'Deliver 24/7 support with human-like responses.',
    },
    {
      name: 'Content Agent',
      icon: '✦',
      copy: 'Create high-quality content tailored to your brand.',
    },
    {
      name: 'Growth Agent',
      icon: '↗',
      copy: 'Identify opportunities and drive business growth.',
    },
  ];

  readonly avatarStyles = [
    {
      name: 'Professional',
      image: 'assets/avatars/professional.png',
    },
    {
      name: 'Executive',
      image: 'assets/avatars/executive.png',
    },
    {
      name: 'Creative',
      image: 'assets/avatars/creative.png',
    },
    {
      name: 'Techwear',
      image: 'assets/avatars/tech.png',
    },
  ];

  readonly processSteps = [
    {
      title: 'Goal',
      icon: '◎',
      copy: 'Define your objective and desired outcome.',
    },
    {
      title: 'Plan',
      icon: '▣',
      copy: 'We design the right AI strategy and agents.',
    },
    {
      title: 'Tools',
      icon: '⚒',
      copy: 'Integrate tools and connect your data.',
    },
    {
      title: 'Action',
      icon: 'ϟ',
      copy: 'Agents execute and automate the work.',
    },
    {
      title: 'Done',
      icon: '✓',
      copy: 'Deliver results and continuous improvement.',
    },
  ];

  readonly contactForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    email: ['', [Validators.required, Validators.email]],
    company: [''],
    message: ['', [Validators.required, Validators.maxLength(1200)]],
  });

  private readonly initEffect = effect((onCleanup) => {
    this.updateVideoSource();
    this.measureHeader();
    this.observeHeaderResize();
    this.syncVideoMuted();
    const onResize = () => {
      this.measureHeader();
      this.updateVideoSource();
    };
    window.addEventListener('resize', onResize, { passive: true });
    onCleanup(() => {
      const timer = this.toastTimer$$();
      if (timer) window.clearTimeout(timer);
      this.headerObserver$$()?.disconnect();
      window.removeEventListener('resize', onResize);
    });
  });

  private readonly contentVideoPauseEffect = effect(() => {
    if (this.hasActiveContentVideo()) {
      this.pauseVideo();
    }
  });

  ngAfterViewInit(): void {
    this.requestHeroAutoplay();
  }

  onVideoPlay(): void {
    if (this.hasActiveContentVideo()) {
      this.pauseVideo();
      return;
    }

    this.isPlaying$$.set(true);
    this.syncHeroReveal();
  }

  onVideoPause(): void {
    this.isPlaying$$.set(false);
    this.syncHeroReveal();
  }

  onVideoEnded(): void {
    this.isPlaying$$.set(false);
    this.heroReveal$$.set(true);
  }

  onVideoMeta(): void {
    this.syncVideoMuted();
    this.syncHeroReveal();
    this.requestHeroAutoplay();
  }

  onVideoTimeUpdate(): void {
    this.syncHeroReveal();
  }

  playVideo(): void {
    this.clearActiveContentVideoForHero();

    const v = this.videoRef$$()?.nativeElement;
    if (!v) return;
    if (Number.isFinite(v.duration) && (v.ended || v.currentTime >= v.duration - 0.05)) {
      this.renderer.setProperty(v, 'currentTime', 0);
    }
    this.syncVideoMuted();
    this.syncHeroReveal();
    v.play().catch(() => {});
  }

  pauseVideo(): void {
    this.videoRef$$()?.nativeElement.pause();
  }

  stopVideo(): void {
    const v = this.videoRef$$()?.nativeElement;
    if (!v) return;
    v.pause();
    this.renderer.setProperty(v, 'currentTime', 0);
    this.syncHeroReveal();
  }

  toggleMute(): void {
    const v = this.videoRef$$()?.nativeElement;
    if (!v) return;
    const nextMuted = !this.isMuted$$();
    this.isMuted$$.set(nextMuted);
    this.renderer.setProperty(v, 'muted', nextMuted);
  }

  expandNewsVideo(item: NewsItem): void {
    this.pauseVideo();
    this.expandedNews$$.set(item);
  }

  closeNewsVideo(): void {
    this.expandedNews$$.set(null);
  }

  playNewsVideo(item: NewsItem): void {
    this.pauseVideo();
    if (!this.isMobileViewport()) {
      this.playingNewsVideoId$$.set(null);
      this.expandedNews$$.set(item);
      return;
    }

    this.playingNewsVideoId$$.set(item.videoId);
  }

  private safeYoutubeEmbed(videoId: string, autoplay = false): SafeResourceUrl {
    const query = autoplay
      ? 'rel=0&playsinline=1&autoplay=1'
      : 'rel=0&playsinline=1';
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.youtube.com/embed/${videoId}?${query}`
    );
  }

  private syncVideoMuted(): void {
    const v = this.videoRef$$()?.nativeElement;
    if (!v) return;
    const isMuted = this.isMuted$$();
    if (v.muted !== isMuted) {
      this.renderer.setProperty(v, 'muted', isMuted);
    }
  }

  private syncHeroReveal(): void {
    const v = this.videoRef$$()?.nativeElement;
    if (!this.isMobilePortraitViewport()) {
      this.heroReveal$$.set(true);
      return;
    }

    if (!v || !Number.isFinite(v.duration) || v.duration <= 0) {
      this.heroReveal$$.set(false);
      return;
    }
    const remaining = v.duration - v.currentTime;
    this.heroReveal$$.set(remaining <= this.revealThresholdSeconds);
  }

  private updateVideoSource(): void {
    if (this.hasActiveContentVideo()) {
      this.pauseVideo();
      return;
    }

    const isMobileVideo = this.shouldUseMobileVideo();
    const nextSrc =
      isMobileVideo && environment.bannerVideoMobile
        ? environment.bannerVideoMobile
        : environment.bannerVideo;
    if (nextSrc === this.videoSrc$$()) return;
    this.heroReveal$$.set(false);
    this.videoSrc$$.set(nextSrc);
    const v = this.videoRef$$()?.nativeElement;
    if (!v) return;
    v.pause();
    this.renderer.setProperty(v, 'currentTime', 0);
    v.load();
    this.requestHeroAutoplay();
  }

  private requestHeroAutoplay(): void {
    window.setTimeout(() => {
      if (this.hasActiveContentVideo()) return;

      const v = this.videoRef$$()?.nativeElement;
      if (!v) return;

      this.renderer.setProperty(v, 'playsInline', true);
      if (Number.isFinite(v.duration) && (v.ended || v.currentTime >= v.duration - 0.05)) {
        this.renderer.setProperty(v, 'currentTime', 0);
      }

      this.syncVideoMuted();
      this.renderer.setProperty(v, 'volume', 1);
      v.play().catch(() => {});
    }, 0);
  }

  private hasActiveContentVideo(): boolean {
    return !!this.expandedNews$$() || !!this.playingNewsVideoId$$();
  }

  private clearActiveContentVideoForHero(): void {
    this.expandedNews$$.set(null);
    this.playingNewsVideoId$$.set(null);
  }

  private isMobileViewport(): boolean {
    return (
      window.matchMedia(`(max-width: ${this.mobileMaxWidth}px)`).matches ||
      window.matchMedia('(hover: none) and (pointer: coarse)').matches
    );
  }

  private isMobilePortraitViewport(): boolean {
    return (
      window.matchMedia(`(max-width: ${this.mobileMaxWidth}px)`).matches &&
      window.matchMedia('(orientation: portrait)').matches
    );
  }

  private shouldUseMobileVideo(): boolean {
    return window.matchMedia(`(max-width: ${this.mobileMaxWidth}px)`).matches;
  }

  private measureHeader(): void {
    const renderer = this.rendererFactory.createRenderer(null, null);
    const root = renderer.selectRootElement(this.document, true) as Document;
    const menubars = Array.from(
      root.querySelectorAll('.p-menubar, header, mc-topbar'),
    ) as HTMLElement[];
    if (!menubars.length) return;
    const newH = Math.max(
      ...menubars.map((el: HTMLElement) => el.offsetHeight || 0),
    );
    if (newH > 0) this.headerH$$.set(newH);
  }

  private observeHeaderResize(): void {
    const menubar = this.document.querySelector<HTMLElement>(
      '.p-menubar, header, mc-topbar'
    );
    if (!('ResizeObserver' in window) || !menubar) return;
    const observer = new ResizeObserver(() => this.measureHeader());
    observer.observe(menubar);
    this.headerObserver$$.set(observer);
  }

  isInvalid(controlName: 'name' | 'email' | 'message'): boolean {
    const control = this.contactForm.get(controlName);
    return !!(control && control.touched && control.invalid);
  }

  getEmailError(): string | null {
    const control = this.contactForm.get('email');
    if (!control || !control.touched) return null;
    if (control.hasError('required')) return 'Email is required.';
    if (control.hasError('email')) return 'Enter a valid email address.';
    return null;
  }

  async openLoginTarget(target: LoginRedirectTarget): Promise<void> {
    const currentUser = this.currentUser$$();
    const route =
      this.postLoginRedirect.getRequestedTargetRoute(target) || '/manager';

    if (currentUser) {
      await this.router.navigateByUrl(route);
      return;
    }

    await this.router.navigate(['/login'], {
      queryParams: {
        [LOGIN_REDIRECT_TARGET_QUERY_PARAM]: target,
      },
    });
  }

  private showToast(type: 'success' | 'error', message: string): void {
    this.toast$$.set({ type, message });
    const currentTimer = this.toastTimer$$();
    if (currentTimer) window.clearTimeout(currentTimer);
    const timer = window.setTimeout(() => {
      this.toast$$.set(null);
    }, 4000);
    this.toastTimer$$.set(timer);
  }

  submitContact(): void {
    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      return;
    }

    const { name, email, company, message } = this.contactForm.getRawValue();
    this.submitState$$.set('sending');

    this.http
      .post(`${environment.apiUrl}/contact`, {
        name,
        email,
        company,
        message,
      })
      .pipe(finalize(() => this.submitState$$.set('idle')))
      .subscribe({
        next: () => {
          this.showToast('success', "Thanks! We'll reply within 24 hours.");
          this.contactForm.reset({
            name: '',
            email: '',
            company: '',
            message: '',
          });
        },
        error: (err) => {
          const msg =
            err?.error?.error || 'Something went wrong. Please try again.';
          this.showToast('error', msg);
        },
      });
  }
}
