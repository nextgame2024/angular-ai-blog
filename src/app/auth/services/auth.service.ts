import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RegisterRequestInterface } from '../types/registerRequest.interface';
import { map, Observable } from 'rxjs';
import { CurrentUserInterface } from '../../shared/types/currentUser.interface';
import { AuthResponseInterface } from '../types/authResponse.interface';
import { environment } from 'src/environments/environment.development';
import { LoginRequestInterface } from '../types/loginRequest.interface';
import { CurrentUserRequestInterface } from 'src/app/shared/types/currentUserRequest.interface';

export interface PasswordResetMessageResponse {
  message: string;
}

export interface MfaStatusResponse {
  mfa: {
    enabled: boolean;
    status: 'not_enrolled' | 'pending' | 'active';
    activatedAt?: string | null;
    lockedUntil?: string | null;
  };
  mfaVerifiedAt: string | null;
}

export interface MfaEnrollmentResponse {
  mfa: { status: 'pending'; secret: string; otpauthUri: string };
}

export interface MfaLoginChallengeResponse {
  mfaRequired: true;
  challengeToken: string;
  expiresInSeconds: number;
}

export type LoginResponse = AuthResponseInterface | MfaLoginChallengeResponse;

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  constructor(private http: HttpClient) {}

  getUser(response: AuthResponseInterface): CurrentUserInterface {
    return response.user;
  }

  getCurrentUser(): Observable<CurrentUserInterface> {
    const url = environment.apiUrl + '/user';
    return this.http.get<AuthResponseInterface>(url).pipe(map(this.getUser));
  }

  register(data: RegisterRequestInterface): Observable<CurrentUserInterface> {
    const url = environment.apiUrl + '/users';
    return this.http
      .post<AuthResponseInterface>(url, data)
      .pipe(map(this.getUser));
  }

  login(data: LoginRequestInterface): Observable<LoginResponse> {
    const url = environment.apiUrl + '/users/login';
    return this.http.post<LoginResponse>(url, data);
  }

  completeMfaLogin(challengeToken: string, code: string): Observable<CurrentUserInterface> {
    const url = environment.apiUrl + '/users/login/mfa';
    return this.http.post<AuthResponseInterface>(url, { challengeToken, code })
      .pipe(map(this.getUser));
  }

  requestPasswordReset(
    email: string,
  ): Observable<PasswordResetMessageResponse> {
    const url = environment.apiUrl + '/users/password/forgot';
    return this.http.post<PasswordResetMessageResponse>(url, { email });
  }

  resetPassword(
    token: string,
    password: string,
  ): Observable<PasswordResetMessageResponse> {
    const url = environment.apiUrl + '/users/password/reset';
    return this.http.post<PasswordResetMessageResponse>(url, {
      token,
      password,
    });
  }

  updateCurrentUser(
    currentUserRequest: CurrentUserRequestInterface,
  ): Observable<CurrentUserInterface> {
    const url = environment.apiUrl + '/user';
    return this.http
      .put<AuthResponseInterface>(url, currentUserRequest)
      .pipe(map(this.getUser));
  }

  getMfaStatus(): Observable<MfaStatusResponse> {
    return this.http.get<MfaStatusResponse>(environment.apiUrl + '/user/mfa');
  }

  enrolTotp(password: string): Observable<MfaEnrollmentResponse> {
    return this.http.post<MfaEnrollmentResponse>(environment.apiUrl + '/user/mfa/totp/enrol', { password });
  }

  activateTotp(code: string): Observable<{ mfa: { status: 'active'; enabled: true; activatedAt: string } }> {
    return this.http.post<{ mfa: { status: 'active'; enabled: true; activatedAt: string } }>(
      environment.apiUrl + '/user/mfa/totp/activate', { code });
  }

  disableTotp(password: string, code: string): Observable<{ sessionsRevoked: true }> {
    return this.http.post<{ sessionsRevoked: true }>(
      environment.apiUrl + '/user/mfa/totp/disable', { password, code });
  }

  stepUpTotp(code: string): Observable<CurrentUserInterface> {
    return this.http.post<AuthResponseInterface>(environment.apiUrl + '/user/mfa/totp/step-up', { code })
      .pipe(map(this.getUser));
  }
}
