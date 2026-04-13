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
    ]
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(Store);
  private readonly route = inject(ActivatedRoute);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  readonly isSubmitting$$ = toSignal(this.store.select(selectIsSubmitting), {
    initialValue: false,
  });
  readonly backendErrors$$ = signal<BackendErrorsInterface | null>(null);
  readonly backendErrorsClosing$$ = signal(false);
  private readonly validationErrors$$ = toSignal(
    this.store.select(selectValidationErrors),
    { initialValue: null }
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
    const redirectTarget =
      this.route.snapshot.queryParamMap.get(LOGIN_REDIRECT_TARGET_QUERY_PARAM);

    this.store.dispatch(authActions.login({ request, redirectTarget }));
  }
}
