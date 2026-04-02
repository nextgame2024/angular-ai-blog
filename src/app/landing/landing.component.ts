import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild } from '@angular/core';
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
export class LandingComponent {
  introVideo = environment.introVideo;
  submitState: 'idle' | 'sending' = 'idle';
  isMuted = false;
  isPlaying = false;
  toast: { type: 'success' | 'error'; message: string } | null = null;
  private toastTimer?: number;

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

  onVideoPlay(): void {
    this.isPlaying = true;
  }

  onVideoPause(): void {
    this.isPlaying = false;
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
            err?.error?.error ||
            'Something went wrong. Please try again.';
          this.showToast('error', msg);
        },
      });
  }
}
