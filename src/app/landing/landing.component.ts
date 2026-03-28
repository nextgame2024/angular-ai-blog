import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
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
  submitState: 'idle' | 'sent' = 'idle';
  isMuted = false;
  isPlaying = false;

  @ViewChild('heroVideo', { static: false })
  videoRef?: ElementRef<HTMLVideoElement>;

  contactForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    email: ['', [Validators.required, Validators.email]],
    company: [''],
    message: ['', [Validators.required, Validators.maxLength(1200)]],
  });

  constructor(private fb: FormBuilder) {}

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

  submitContact(): void {
    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      return;
    }

    const { name, email, company, message } = this.contactForm.getRawValue();
    const subject = encodeURIComponent(
      `SophiaAi inquiry from ${name || 'Client'}`,
    );
    const body = encodeURIComponent(
      [
        `Name: ${name}`,
        `Email: ${email}`,
        `Company: ${company || '-'}`,
        '',
        message,
      ].join('\n'),
    );

    window.location.href = `mailto:jlcm66@gmail.com?subject=${subject}&body=${body}`;
    this.submitState = 'sent';
    this.contactForm.reset();
  }
}
