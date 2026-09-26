import { fakeAsync, flushMicrotasks, TestBed, tick } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { SophiaBrowserTransportRegistry } from './browser-transport/sophia-browser-transport.registry';
import { SophiaRuntimeConfigService } from './sophia-runtime-config.service';
import { SophiaRuntimeSessionService } from './sophia-runtime-session.service';
import { SophiaSessionFacade } from './sophia-session.facade';

describe('SophiaSessionFacade', () => {
  let facade: SophiaSessionFacade;
  let transports: jasmine.SpyObj<SophiaBrowserTransportRegistry>;
  let runtime: jasmine.SpyObj<SophiaRuntimeSessionService>;

  beforeEach(() => {
    transports = jasmine.createSpyObj<SophiaBrowserTransportRegistry>(
      'SophiaBrowserTransportRegistry',
      ['connect', 'interrupt', 'promptAssistant', 'submitUserText', 'disconnect'],
    );
    transports.disconnect.and.resolveTo();
    runtime = jasmine.createSpyObj<SophiaRuntimeSessionService>(
      'SophiaRuntimeSessionService',
      [
        'warmUp',
        'createSession',
        'closeSession',
        'heartbeatSession',
        'markDisconnected',
        'forgetSession',
        'executeTool',
        'confirmActionReview',
        'cancelActionReview',
      ],
    );
    runtime.warmUp.and.returnValue(of({ ok: true }));

    TestBed.configureTestingModule({
      providers: [
        SophiaSessionFacade,
        {
          provide: SophiaRuntimeConfigService,
          useValue: {
            resolveAvatarAudioBridge: () => Promise.resolve('webrtc-track'),
          },
        },
        {
          provide: SophiaRuntimeSessionService,
          useValue: runtime,
        },
        {
          provide: SophiaBrowserTransportRegistry,
          useValue: transports,
        },
      ],
    });
    facade = TestBed.inject(SophiaSessionFacade);
  });

  it('accepts only stable public experience IDs', () => {
    expect(facade.experience()).toBe('essential');
    expect(facade.selectExperience('professional')).toBeTrue();
    expect(facade.experience()).toBe('professional');
    expect(facade.selectExperience('openai-liveavatar-full')).toBeFalse();
    expect(facade.experience()).toBe('professional');
  });

  it('normalizes interruption behind the transport registry', () => {
    facade.interrupt();
    expect(transports.interrupt).toHaveBeenCalled();
  });

  it('disconnects adapters and forgets local credentials when the session expires', fakeAsync(() => {
    runtime.createSession.and.returnValue(
      of({
        session: {
          sessionId: 'session-1',
          customerId: 'customer-1',
          deviceId: null,
          storeId: null,
          status: 'active',
          aiProvider: 'openai-realtime',
          avatarProvider: 'none',
          providerSessionId: null,
          avatarSessionId: null,
          startedAt: new Date().toISOString(),
          endedAt: null,
        },
        ai: {
          provider: 'openai-realtime',
          model: 'test',
          outputModality: 'audio',
          clientSecret: 'ephemeral-secret',
        },
        avatar: { provider: 'none' },
        tools: [],
        sessionAccessToken: 'session-token',
        sessionAccessExpiresAt: new Date(Date.now() + 100).toISOString(),
      }),
    );
    transports.connect.and.resolveTo();
    const onClosed = jasmine.createSpy('onClosed');

    void facade.connect({
      remoteAudio: document.createElement('audio'),
      avatarVideo: document.createElement('video'),
      avatarAudio: document.createElement('audio'),
      onClosed,
    });
    flushMicrotasks();
    tick(101);
    flushMicrotasks();

    expect(transports.disconnect).toHaveBeenCalled();
    expect(runtime.forgetSession).toHaveBeenCalledOnceWith('session-1');
    expect(facade.session()).toBeNull();
    expect(facade.state()).toBe('error');
    expect(onClosed).toHaveBeenCalled();
    facade.destroy();
    flushMicrotasks();
  }));

  it('clears local session data even when the remote close fails', fakeAsync(() => {
    runtime.createSession.and.returnValue(of(sessionResponse()));
    runtime.closeSession.and.returnValue(throwError(() => new Error('close failed')));
    transports.connect.and.resolveTo();
    const onClosed = jasmine.createSpy('onClosed');

    void facade.connect({
      remoteAudio: document.createElement('audio'),
      avatarVideo: document.createElement('video'),
      avatarAudio: document.createElement('audio'),
      onClosed,
    });
    flushMicrotasks();
    void facade.close();
    flushMicrotasks();

    expect(runtime.forgetSession).toHaveBeenCalledOnceWith('session-1');
    expect(facade.session()).toBeNull();
    expect(onClosed).toHaveBeenCalled();
    expect(facade.state()).toBe('error');
    facade.destroy();
  }));
});

function sessionResponse() {
  return {
    session: {
      sessionId: 'session-1', customerId: 'customer-1', deviceId: null, storeId: null,
      status: 'active', aiProvider: 'openai-realtime', avatarProvider: 'none',
      providerSessionId: null, avatarSessionId: null,
      startedAt: new Date().toISOString(), endedAt: null,
    },
    ai: { provider: 'openai-realtime', model: 'test', outputModality: 'audio' as const, clientSecret: 'secret' },
    avatar: { provider: 'none' as const },
    tools: [], sessionAccessToken: 'session-token',
    sessionAccessExpiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
}
