import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Store } from '@ngrx/store';
import { authActions } from '../store/actions';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { selectIsSubmitting, selectValidationErrors } from '../store/reducers';
import { CommonModule } from '@angular/common';
import { combineLatest } from 'rxjs';
import { BackendErrorMessages } from '../../shared/components/backendErrorMessages.component';
import { RegisterRequestInterface } from './../types/registerRequest.interface';
import { environment } from 'src/environments/environment';
import { LOGIN_REDIRECT_TARGET_QUERY_PARAM } from '../../shared/services/post-login-redirect.service';

/* PrimeNG */
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';

@Component({
    selector: 'mc-register',
    templateUrl: './register.component.html',
    styleUrls: ['./register.component.css'],
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
        InputGroupModule,
        InputGroupAddonModule,
    ]
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

  constructor(
    private fb: FormBuilder,
    private store: Store,
    private route: ActivatedRoute
  ) {}

  onSubmit() {
    if (this.form.invalid) return;
    const request: RegisterRequestInterface = {
      user: {
        ...this.form.getRawValue(),
        companyId: environment.registerCompanyId,
      },
    };
    const redirectTarget =
      this.route.snapshot.queryParamMap.get(LOGIN_REDIRECT_TARGET_QUERY_PARAM);

    this.store.dispatch(authActions.register({ request, redirectTarget }));
  }
}
