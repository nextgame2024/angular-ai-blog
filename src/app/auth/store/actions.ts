import { CurrentUserRequestInterface } from './../../shared/types/currentUserRequest.interface';
import { CurrentUserInterface } from '../../shared/types/currentUser.interface';
import {
  createAction,
  createActionGroup,
  emptyProps,
  props,
} from '@ngrx/store';
import { RegisterRequestInterface } from '../types/registerRequest.interface';
import { BackendErrorsInterface } from '../../shared/types/backendErrors.interface';
import { LoginRequestInterface } from '../types/loginRequest.interface';

export const authActions = createActionGroup({
  source: 'auth',
  events: {
    Register: props<{ request: RegisterRequestInterface }>(),
    'Register success': props<{ currentUser: CurrentUserInterface }>(),
    'Register failure': props<{ errors: BackendErrorsInterface }>(),

    Login: props<{ request: LoginRequestInterface }>(),
    'Login success': props<{ currentUser: CurrentUserInterface }>(),
    'Login failure': props<{ errors: BackendErrorsInterface }>(),

    'Get current user': emptyProps(),
    'Get current user success': props<{ currentUser: CurrentUserInterface }>(),
    'Get current user failure': emptyProps(),

    'Update current user': props<{
      currentUserRequest: CurrentUserRequestInterface;
    }>(),
    'Update current user success': props<{
      currentUser: CurrentUserInterface;
    }>(),
    'Update current user failure': props<{ errors: BackendErrorsInterface }>(),

    Logout: emptyProps(),
  },
});
