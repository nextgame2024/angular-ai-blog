import { Route } from '@angular/router';
import { RegisterComponent } from './components/register.component';
import { LoginComponent } from './components/login/login.component';
import { ResetPasswordComponent } from './components/reset-password/reset-password.component';

export const registerRoutes: Route[] = [
  {
    path: '',
    component: RegisterComponent,
  },
];

export const loginRoutes: Route[] = [
  {
    path: 'reset-password',
    component: ResetPasswordComponent,
  },
  {
    path: '',
    component: LoginComponent,
  },
];
