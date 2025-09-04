import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Store } from '@ngrx/store';
import { authActions } from '../store/actions';
import { RouterLink } from '@angular/router';
import { selectIsSubmitting, selectValidationErrors } from '../store/reducers';
import { CommonModule } from '@angular/common';
import { combineLatest } from 'rxjs';
import { BackendErrorMessages } from '../../shared/components/backendErrorMessages.component';
import { RegisterRequestInterface } from './../types/registerRequest.interface';

/* PrimeNG */
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'mc-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css'],
  standalone: true,
  imports: [
    // Angular
    ReactiveFormsModule,
    RouterLink,
    CommonModule,

    // Your shared component
    BackendErrorMessages,

    // PrimeNG
    CardModule,
    InputTextModule,
    PasswordModule,
    ButtonModule,
  ],
})
export class RegisterComponent {
  form = this.fb.nonNullable.group({
    username: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  isSubmitting$ = this.store.select(selectIsSubmitting);
  data$ = combineLatest({
    isSubmitting$: this.store.select(selectIsSubmitting),
    backendErrors: this.store.select(selectValidationErrors),
  });

  constructor(private fb: FormBuilder, private store: Store) {}

  onSubmit() {
    if (this.form.invalid) return;
    const request: RegisterRequestInterface = { user: this.form.getRawValue() };
    this.store.dispatch(authActions.register({ request }));
  }
}
