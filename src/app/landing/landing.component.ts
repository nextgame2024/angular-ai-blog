import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.css'],
})
export class LandingComponent implements AfterViewInit, OnInit, OnDestroy {
  private readonly mobileMaxWidth = 680;
  videoSrc = environment.bannerVideo;
  submitState: 'idle' | 'sending' = 'idle';
  isMuted = false;
  isPlaying = false;
  heroReveal = false;
  headerH = 0;
  toast: { type: 'success' | 'error'; message: string } | null = null;
  private toastTimer?: number;
  private headerObserver?: ResizeObserver;
  private readonly revealThresholdSeconds = 2;

  @ViewChild('heroVideo', { static: false })
  videoRef?: ElementRef<HTMLVideoElement>;

  contactForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    email: ['', [Validators.required, Validators.email]],
    company: [''],
    message: ['', [Validators.required, Validators.maxLength(1200)]],
  });

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
  ) {}

  ngOnInit(): void {
    this.updateVideoSource();
  }

  ngAfterViewInit(): void {
    this.measureHeader();
    this.observeHeaderResize();
    window.addEventListener('resize', this.onWindowResize, { passive: true });
  }

  ngOnDestroy(): void {
    if (this.toastTimer) window.clearTimeout(this.toastTimer);
    this.headerObserver?.disconnect();
    window.removeEventListener('resize', this.onWindowResize);
  }

  onVideoPlay(): void {
    this.isPlaying = true;
    this.syncHeroReveal();
  }

  onVideoPause(): void {
    this.isPlaying = false;
    this.syncHeroReveal();
  }

  onVideoEnded(): void {
    this.isPlaying = false;
    this.heroReveal = true;
  }

  onVideoMeta(): void {
    this.syncHeroReveal();
  }

  onVideoTimeUpdate(): void {
    this.syncHeroReveal();
  }

  playVideo(): void {
    const v = this.videoRef?.nativeElement;
    if (!v) return;
    if (Number.isFinite(v.duration) && (v.ended || v.currentTime >= v.duration - 0.05)) {
      v.currentTime = 0;
    }
    this.syncHeroReveal();
    v.play().catch(() => {});
  }

  pauseVideo(): void {
    this.videoRef?.nativeElement.pause();
  }

  stopVideo(): void {
    const v = this.videoRef?.nativeElement;
    if (!v) return;
    v.pause();
    v.currentTime = 0;
    this.syncHeroReveal();
  }

  toggleMute(): void {
    const v = this.videoRef?.nativeElement;
    if (!v) return;
    this.isMuted = !this.isMuted;
    v.muted = this.isMuted;
  }

  private syncHeroReveal(): void {
    const v = this.videoRef?.nativeElement;
    if (!v || !Number.isFinite(v.duration) || v.duration <= 0) {
      this.heroReveal = false;
      return;
    }
    const remaining = v.duration - v.currentTime;
    this.heroReveal = remaining <= this.revealThresholdSeconds;
  }

  private updateVideoSource(): void {
    const isMobile = window.matchMedia(
      `(max-width: ${this.mobileMaxWidth}px)`
    ).matches;
    const nextSrc =
      isMobile && environment.bannerVideoMobile
        ? environment.bannerVideoMobile
        : environment.bannerVideo;
    if (nextSrc === this.videoSrc) return;
    this.heroReveal = false;
    this.videoSrc = nextSrc;
    const v = this.videoRef?.nativeElement;
    if (!v) return;
    const wasPlaying = !v.paused && !v.ended;
    v.pause();
    v.currentTime = 0;
    v.load();
    if (wasPlaying) {
      v.play().catch(() => {});
    }
  }

  private measureHeader(): void {
    const menubars = Array.from(
      document.querySelectorAll<HTMLElement>('.p-menubar, header, mc-topbar')
    );
    if (!menubars.length) return;
    const newH = Math.max(...menubars.map((el) => el.offsetHeight || 0));
    if (newH > 0) this.headerH = newH;
  }

  private observeHeaderResize(): void {
    const menubar = document.querySelector<HTMLElement>(
      '.p-menubar, header, mc-topbar'
    );
    if (!('ResizeObserver' in window) || !menubar) return;
    this.headerObserver = new ResizeObserver(() => this.measureHeader());
    this.headerObserver.observe(menubar);
  }

  private onWindowResize = (): void => {
    this.measureHeader();
    this.updateVideoSource();
  };

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

  private showToast(type: 'success' | 'error', message: string): void {
    this.toast = { type, message };
    if (this.toastTimer) window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toast = null;
    }, 4000);
  }

  submitContact(): void {
    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      return;
    }

    const { name, email, company, message } = this.contactForm.getRawValue();
    this.submitState = 'sending';

    this.http
      .post(`${environment.apiUrl}/contact`, {
        name,
        email,
        company,
        message,
      })
      .pipe(finalize(() => (this.submitState = 'idle')))
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
