import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'mc-reset-password',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    CardModule,
    InputGroupModule,
    InputGroupAddonModule,
    PasswordModule,
    ButtonModule,
  ],
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.css'],
})
export class ResetPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  readonly token = this.route.snapshot.queryParamMap.get('token') || '';
  readonly isSubmitting$$ = signal(false);
  readonly successMessage$$ = signal<string | null>(null);
  readonly errorMessage$$ = signal<string | null>(
    this.token ? null : 'This password reset link is missing a token.',
  );

  readonly form = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]],
  });

  readonly passwordsDoNotMatch$$ = computed(() => {
    const { password, confirmPassword } = this.form.getRawValue();
    return !!password && !!confirmPassword && password !== confirmPassword;
  });

  onSubmit(): void {
    if (
      this.form.invalid ||
      this.passwordsDoNotMatch$$() ||
      !this.token ||
      this.isSubmitting$$()
    ) {
      return;
    }

    this.isSubmitting$$.set(true);
    this.errorMessage$$.set(null);
    this.successMessage$$.set(null);

    this.authService
      .resetPassword(this.token, this.form.controls.password.value)
      .subscribe({
        next: (response) => {
          this.successMessage$$.set(
            response.message ||
              'Password updated successfully. Redirecting to sign in...',
          );
          this.isSubmitting$$.set(false);
          window.setTimeout(() => {
            void this.router.navigateByUrl('/login');
          }, 1400);
        },
        error: (error) => {
          this.errorMessage$$.set(
            error?.error?.error ||
              'This reset link is invalid or expired. Please request a new link.',
          );
          this.isSubmitting$$.set(false);
        },
      });
  }
}
