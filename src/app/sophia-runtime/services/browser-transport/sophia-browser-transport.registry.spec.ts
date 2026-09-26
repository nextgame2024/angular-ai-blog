import { TestBed } from '@angular/core/testing';

import type { SophiaRuntimeSessionResponse } from '../../types/sophia-runtime.types';
import {
  resolveLegacyTransportAdapterKey,
  SophiaBrowserTransportRegistry,
} from './sophia-browser-transport.registry';
import {
  SOPHIA_BROWSER_TRANSPORT_ADAPTERS,
  type SophiaBrowserTransportAdapter,
} from './sophia-browser-transport.types';

describe('SophiaBrowserTransportRegistry', () => {
  it('resolves bounded v1 responses to stable browser adapter keys', () => {
    expect(resolveLegacyTransportAdapterKey(response())).toBe(
      'native-realtime-browser-v1',
    );
    expect(
      resolveLegacyTransportAdapterKey(
        response({ aiProvider: 'tavus-full', avatarProvider: 'tavus' }),
      ),
    ).toBe('daily-conversation-browser-v1');
    expect(
      resolveLegacyTransportAdapterKey(
        response({ aiProvider: 'gemini-live', avatarProvider: 'none' }),
      ),
    ).toBe('gemini-live-browser-v1');
  });

  it('fails closed when a registered adapter cannot open and cleans it up', async () => {
    const adapter = jasmine.createSpyObj<SophiaBrowserTransportAdapter>(
      'adapter',
      ['connect', 'interrupt', 'promptAssistant', 'submitUserText', 'disconnect'],
      {
        manifest: {
          adapterKey: 'native-realtime-browser-v1',
          protocols: [],
          mediaModes: [],
          toolDeliveryModes: [],
        },
      },
    );
    adapter.connect.and.rejectWith(new Error('startup failed'));
    adapter.disconnect.and.resolveTo();
    TestBed.configureTestingModule({
      providers: [
        SophiaBrowserTransportRegistry,
        {
          provide: SOPHIA_BROWSER_TRANSPORT_ADAPTERS,
          useValue: adapter,
          multi: true,
        },
      ],
    });
    const registry = TestBed.inject(SophiaBrowserTransportRegistry);

    await expectAsync(
      registry.connect({
        response: response(),
        media: media(),
        audioBridge: 'webrtc-track',
        callbacks: callbacks(),
      }),
    ).toBeRejectedWithError('startup failed');
    expect(adapter.disconnect).toHaveBeenCalled();
    expect(registry.activeAdapterKey()).toBeNull();
  });

  it('rejects duplicate manifest registrations', async () => {
    const adapters = [adapter(), adapter()];
    TestBed.configureTestingModule({
      providers: [
        SophiaBrowserTransportRegistry,
        ...adapters.map((value) => ({
          provide: SOPHIA_BROWSER_TRANSPORT_ADAPTERS,
          useValue: value,
          multi: true,
        })),
      ],
    });
    const registry = TestBed.inject(SophiaBrowserTransportRegistry);
    await expectAsync(
      registry.connect({
        response: response(),
        media: media(),
        audioBridge: 'webrtc-track',
        callbacks: callbacks(),
      }),
    ).toBeRejectedWithError(/found 2/);
  });
});

function adapter(): SophiaBrowserTransportAdapter {
  return {
    manifest: {
      adapterKey: 'native-realtime-browser-v1',
      protocols: [],
      mediaModes: [],
      toolDeliveryModes: [],
    },
    connect: async () => undefined,
    interrupt: () => undefined,
    promptAssistant: () => undefined,
    submitUserText: () => undefined,
    disconnect: async () => undefined,
  };
}

function response(
  override: { aiProvider?: string; avatarProvider?: 'none' | 'tavus' } = {},
): SophiaRuntimeSessionResponse {
  return {
    session: {
      sessionId: 'session-1',
      customerId: 'customer-1',
      deviceId: null,
      storeId: null,
      status: 'active',
      aiProvider: override.aiProvider || 'openai-realtime',
      avatarProvider: override.avatarProvider || 'none',
      providerSessionId: null,
      avatarSessionId: null,
      startedAt: new Date(0).toISOString(),
      endedAt: null,
    },
    ai: {
      provider: override.aiProvider || 'openai-realtime',
      model: 'test',
      outputModality: 'audio',
      clientSecret: 'ephemeral-secret',
    },
    avatar: { provider: override.avatarProvider || 'none' },
    tools: [],
    sessionAccessToken: 'session-access-token',
    sessionAccessExpiresAt: new Date(60_000).toISOString(),
  };
}

function media() {
  return {
    remoteAudio: document.createElement('audio'),
    avatarVideo: document.createElement('video'),
    avatarAudio: document.createElement('audio'),
  };
}

function callbacks() {
  return {
    onVoiceStatus: () => undefined,
    onPresentationStatus: () => undefined,
    onPresentationUnavailable: () => undefined,
    onEvent: () => undefined,
    onUserActivity: () => undefined,
    onAssistantSpeechStarted: () => undefined,
    onAssistantSpeechStopped: () => undefined,
    onAssistantTurnCompleted: () => undefined,
    onToolCall: async () => undefined,
  };
}
