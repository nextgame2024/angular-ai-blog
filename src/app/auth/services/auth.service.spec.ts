import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './auth.service';

describe('AuthService MFA', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [AuthService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('uses authenticated current-user endpoints for enrollment and activation', () => {
    service.getMfaStatus().subscribe();
    const status = http.expectOne((request) => request.url.endsWith('/user/mfa'));
    expect(status.request.method).toBe('GET');
    status.flush({ mfa: { enabled: false, status: 'not_enrolled' }, mfaVerifiedAt: null });

    service.enrolTotp('current-password').subscribe();
    const enrol = http.expectOne((request) => request.url.endsWith('/user/mfa/totp/enrol'));
    expect(enrol.request.method).toBe('POST');
    expect(enrol.request.body).toEqual({ password: 'current-password' });
    enrol.flush({ mfa: { status: 'pending', secret: 'SECRET', otpauthUri: 'otpauth://totp/example' } });

    service.activateTotp('123456').subscribe();
    const activate = http.expectOne((request) => request.url.endsWith('/user/mfa/totp/activate'));
    expect(activate.request.body).toEqual({ code: '123456' });
    activate.flush({ mfa: { status: 'active', enabled: true, activatedAt: new Date().toISOString() } });
  });

  it('returns the authoritative replacement identity after step-up', () => {
    let token: string | undefined;
    service.stepUpTotp('654321').subscribe((user) => { token = user.token; });
    const request = http.expectOne((candidate) => candidate.url.endsWith('/user/mfa/totp/step-up'));
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ code: '654321' });
    request.flush({ user: { id: 'user-1', email: 'owner@example.com', username: 'owner',
      token: 'step-up-token', image: null, bio: null, mfaEnabled: true,
      mfaVerifiedAt: '2026-10-04T00:00:00.000Z' } });
    expect(token).toBe('step-up-token');
  });

  it('supports a password challenge followed by MFA sign-in', () => {
    let challenge: string | undefined;
    service.login({ user: { email: 'owner@example.com', password: 'password' } })
      .subscribe((response) => {
        if ('mfaRequired' in response) challenge = response.challengeToken;
      });
    const password = http.expectOne((request) => request.url.endsWith('/users/login'));
    expect(password.request.method).toBe('POST');
    password.flush({ mfaRequired: true, challengeToken: 'challenge-token', expiresInSeconds: 300 });
    expect(challenge).toBe('challenge-token');

    let token: string | undefined;
    service.completeMfaLogin('challenge-token', '123456')
      .subscribe((user) => { token = user.token; });
    const mfa = http.expectOne((request) => request.url.endsWith('/users/login/mfa'));
    expect(mfa.request.body).toEqual({ challengeToken: 'challenge-token', code: '123456' });
    mfa.flush({ user: { id: 'user-1', email: 'owner@example.com', username: 'owner',
      token: 'login-token', mfaEnabled: true, mfaVerifiedAt: '2026-10-04T00:00:00.000Z' } });
    expect(token).toBe('login-token');
  });
});
