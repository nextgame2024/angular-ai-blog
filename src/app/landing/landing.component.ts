import { CommonModule, DOCUMENT } from '@angular/common';
import {
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
import { Router } from '@angular/router';
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

@Component({
    selector: 'app-landing',
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './landing.component.html',
    styleUrls: ['./landing.component.css']
})
export class LandingComponent {
  private readonly mobileMaxWidth = 680;
  private readonly revealThresholdSeconds = 2;

  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
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
  private readonly toastTimer$$ = signal<number | null>(null);
  private readonly headerObserver$$ = signal<ResizeObserver | null>(null);

  readonly videoRef$$ = viewChild<ElementRef<HTMLVideoElement>>('heroVideo');

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

  onVideoPlay(): void {
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
  }

  onVideoTimeUpdate(): void {
    this.syncHeroReveal();
  }

  playVideo(): void {
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
    if (!v || !Number.isFinite(v.duration) || v.duration <= 0) {
      this.heroReveal$$.set(false);
      return;
    }
    const remaining = v.duration - v.currentTime;
    this.heroReveal$$.set(remaining <= this.revealThresholdSeconds);
  }

  private updateVideoSource(): void {
    const isMobile = window.matchMedia(
      `(max-width: ${this.mobileMaxWidth}px)`
    ).matches;
    const nextSrc =
      isMobile && environment.bannerVideoMobile
        ? environment.bannerVideoMobile
        : environment.bannerVideo;
    if (nextSrc === this.videoSrc$$()) return;
    this.heroReveal$$.set(false);
    this.videoSrc$$.set(nextSrc);
    const v = this.videoRef$$()?.nativeElement;
    if (!v) return;
    const wasPlaying = !v.paused && !v.ended;
    v.pause();
    this.renderer.setProperty(v, 'currentTime', 0);
    v.load();
    if (wasPlaying) {
      v.play().catch(() => {});
    }
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
