import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Store } from '@ngrx/store';
import { authActions } from '../../store/actions';
import { RouterLink } from '@angular/router';
import {
  selectIsSubmitting,
  selectValidationErrors,
} from '../../store/reducers';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { Subscription } from 'rxjs';
import { BackendErrorMessages } from '../../../shared/components/backendErrorMessages.component';
import { LoginRequestInterface } from '../../types/loginRequest.interface';
import type { BackendErrorsInterface } from '../../../shared/types/backendErrors.interface';

/* PrimeNG standalone modules */
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'mc-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  standalone: true,
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
  ],
})
export class LoginComponent implements OnInit, OnDestroy {
  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  isSubmitting$ = this.store.select(selectIsSubmitting);
  backendErrors: BackendErrorsInterface | null = null;
  backendErrorsClosing = false;
  private errorSub?: Subscription;
  private errorHideTimer?: number;
  private errorRemoveTimer?: number;

  constructor(
    private fb: FormBuilder,
    private store: Store,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.errorSub = this.store.select(selectValidationErrors).subscribe((errors) => {
      this.backendErrors = errors || null;
      this.backendErrorsClosing = false;
      if (!errors) return;
      if (this.errorHideTimer) window.clearTimeout(this.errorHideTimer);
      if (this.errorRemoveTimer) window.clearTimeout(this.errorRemoveTimer);
      this.errorHideTimer = window.setTimeout(() => {
        this.backendErrorsClosing = true;
      }, 5000);
      this.errorRemoveTimer = window.setTimeout(() => {
        this.backendErrors = null;
        this.backendErrorsClosing = false;
      }, 5600);
    });
  }

  ngOnDestroy(): void {
    this.errorSub?.unsubscribe();
    if (this.errorHideTimer) window.clearTimeout(this.errorHideTimer);
    if (this.errorRemoveTimer) window.clearTimeout(this.errorRemoveTimer);
  }

  onSubmit() {
    if (this.form.invalid) return;
    const request: LoginRequestInterface = { user: this.form.getRawValue() };
    this.store.dispatch(authActions.login({ request }));
  }
}
