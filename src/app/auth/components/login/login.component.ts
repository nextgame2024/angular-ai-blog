import { Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Store } from '@ngrx/store';
import { authActions } from '../../store/actions';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  selectIsSubmitting,
  selectValidationErrors,
} from '../../store/reducers';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { BackendErrorMessages } from '../../../shared/components/backendErrorMessages.component';
import { LoginRequestInterface } from '../../types/loginRequest.interface';
import type { BackendErrorsInterface } from '../../../shared/types/backendErrors.interface';
import { AuthService } from '../../services/auth.service';

/* PrimeNG standalone modules */
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { LOGIN_REDIRECT_TARGET_QUERY_PARAM } from '../../../shared/services/post-login-redirect.service';

@Component({
  selector: 'mc-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  imports: [
    // Angular
    ReactiveFormsModule,
    RouterLink,
    CommonModule,
    // Your error component
    BackendErrorMessages,
    // PrimeNG
    CardModule,
    InputTextModule,
    PasswordModule,
    ButtonModule,
    InputGroupModule,
    InputGroupAddonModule,
  ],
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(Store);
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  readonly forgotForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  readonly mode$$ = signal<'login' | 'forgot'>('login');
  readonly isSubmitting$$ = toSignal(this.store.select(selectIsSubmitting), {
    initialValue: false,
  });
  readonly isResetSubmitting$$ = signal(false);
  readonly resetMessage$$ = signal<string | null>(null);
  readonly resetError$$ = signal<string | null>(null);
  readonly backendErrors$$ = signal<BackendErrorsInterface | null>(null);
  readonly backendErrorsClosing$$ = signal(false);
  private readonly validationErrors$$ = toSignal(
    this.store.select(selectValidationErrors),
    { initialValue: null },
  );

  private readonly errorEffect = effect((onCleanup) => {
    const errors = this.validationErrors$$();
    if (!errors) {
      this.backendErrors$$.set(null);
      this.backendErrorsClosing$$.set(false);
      return;
    }

    this.backendErrors$$.set(errors);
    this.backendErrorsClosing$$.set(false);

    const hideTimer = window.setTimeout(() => {
      this.backendErrorsClosing$$.set(true);
    }, 5000);
    const removeTimer = window.setTimeout(() => {
      this.backendErrors$$.set(null);
      this.backendErrorsClosing$$.set(false);
    }, 5600);

    onCleanup(() => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(removeTimer);
    });
  });

  onSubmit() {
    if (this.form.invalid) return;
    const request: LoginRequestInterface = { user: this.form.getRawValue() };
    const redirectTarget = this.route.snapshot.queryParamMap.get(
      LOGIN_REDIRECT_TARGET_QUERY_PARAM,
    );

    this.store.dispatch(authActions.login({ request, redirectTarget }));
  }

  showForgotPassword(): void {
    const email = this.form.controls.email.value;
    this.mode$$.set('forgot');
    this.resetMessage$$.set(null);
    this.resetError$$.set(null);
    if (email) {
      this.forgotForm.controls.email.setValue(email);
    }
  }

  showLogin(): void {
    const email = this.forgotForm.controls.email.value;
    this.mode$$.set('login');
    this.resetMessage$$.set(null);
    this.resetError$$.set(null);
    if (email) {
      this.form.controls.email.setValue(email);
    }
  }

  onForgotSubmit(): void {
    if (this.forgotForm.invalid || this.isResetSubmitting$$()) return;

    this.isResetSubmitting$$.set(true);
    this.resetMessage$$.set(null);
    this.resetError$$.set(null);

    this.authService
      .requestPasswordReset(this.forgotForm.controls.email.value)
      .subscribe({
        next: (response) => {
          this.resetMessage$$.set(
            response.message ||
              'If an account exists for that email, a password reset link has been sent.',
          );
          this.isResetSubmitting$$.set(false);
        },
        error: () => {
          this.resetError$$.set(
            'We could not send the reset email right now. Please try again.',
          );
          this.isResetSubmitting$$.set(false);
        },
      });
  }
}
