import { TestBed } from '@angular/core/testing';

import type { SophiaRuntimeSessionResponse } from '../../types/sophia-runtime.types';
import {
  SophiaRealtimeClientService,
  type SophiaRealtimeConnectRequest,
} from '../sophia-realtime-client.service';
import {
  SophiaGeminiLiveClientService,
  type SophiaGeminiLiveConnectRequest,
} from '../sophia-gemini-live-client.service';
import { SophiaPresentationAdapterRegistry } from './sophia-browser-transport.registry';
import type {
  SophiaBrowserTransportCallbacks,
  SophiaPresentationAdapter,
} from './sophia-browser-transport.types';
import {
  SophiaGeminiLiveBrowserAdapter,
  SophiaNativeRealtimeBrowserAdapter,
} from './sophia-session-transport.adapters';

describe('SophiaNativeRealtimeBrowserAdapter', () => {
  let adapter: SophiaNativeRealtimeBrowserAdapter;
  let realtime: jasmine.SpyObj<SophiaRealtimeClientService>;
  let presentation: jasmine.SpyObj<SophiaPresentationAdapter>;
  let realtimeRequest: SophiaRealtimeConnectRequest;

  beforeEach(() => {
    realtime = jasmine.createSpyObj<SophiaRealtimeClientService>(
      'SophiaRealtimeClientService',
      [
        'connect',
        'interrupt',
        'promptAssistant',
        'submitUserText',
        'disconnect',
        'setMicrophoneSuppressed',
      ],
    );
    presentation = jasmine.createSpyObj<SophiaPresentationAdapter>(
      'SophiaPresentationAdapter',
      [
        'connect',
        'attachRemoteStream',
        'appendAudio',
        'completeAudio',
        'speakText',
        'interrupt',
        'disconnect',
      ],
      {
        manifest: {
          adapterKey: 'live-avatar-presentation-v1',
          audibleOutput: () => 'avatar-video',
        },
      },
    );
    realtime.connect.and.callFake(async (request) => {
      realtimeRequest = request;
      request.onStatus('Realtime connected');
    });
    realtime.disconnect.and.resolveTo();
    presentation.connect.and.callFake(async (request) => {
      request.onStatus('Avatar connected', true);
    });
    presentation.disconnect.and.resolveTo();

    TestBed.configureTestingModule({
      providers: [
        SophiaNativeRealtimeBrowserAdapter,
        { provide: SophiaRealtimeClientService, useValue: realtime },
        {
          provide: SophiaPresentationAdapterRegistry,
          useValue: { resolve: () => presentation },
        },
      ],
    });
    adapter = TestBed.inject(SophiaNativeRealtimeBrowserAdapter);
  });

  it('routes one audible output and deduplicates repeated provider tool events', async () => {
    const executeTool = jasmine
      .createSpy('executeTool')
      .and.resolveTo({ ok: true });
    const media = {
      remoteAudio: document.createElement('audio'),
      avatarAudio: document.createElement('audio'),
      avatarVideo: document.createElement('video'),
    };
    await adapter.connect({
      response: response(),
      media,
      audioBridge: 'webrtc-track',
      callbacks: callbacks(executeTool),
    });

    expect(media.remoteAudio.muted).toBeTrue();
    expect(media.avatarAudio.muted).toBeTrue();
    expect(media.avatarVideo.muted).toBeFalse();

    const call = { callId: 'call-1', name: 'safeRead', arguments: {} };
    const [first, duplicate] = await Promise.all([
      realtimeRequest.onToolCall(call),
      realtimeRequest.onToolCall(call),
    ]);
    expect(first).toEqual({ ok: true });
    expect(duplicate).toEqual({ ok: true });
    expect(executeTool).toHaveBeenCalledTimes(1);
  });

  it('interrupts both generation and queued presentation output, then cleans up', async () => {
    const media = {
      remoteAudio: document.createElement('audio'),
      avatarAudio: document.createElement('audio'),
      avatarVideo: document.createElement('video'),
    };
    await adapter.connect({
      response: response(),
      media,
      audioBridge: 'webrtc-track',
      callbacks: callbacks(),
    });

    adapter.interrupt();
    expect(realtime.interrupt).toHaveBeenCalled();
    expect(presentation.interrupt).toHaveBeenCalled();

    await adapter.disconnect();
    expect(realtime.disconnect).toHaveBeenCalled();
    expect(presentation.disconnect).toHaveBeenCalled();
    expect(media.remoteAudio.muted).toBeTrue();
    expect(media.avatarAudio.muted).toBeTrue();
    expect(media.avatarVideo.muted).toBeTrue();
  });
});

function response(): SophiaRuntimeSessionResponse {
  return {
    session: {
      sessionId: 'session-1',
      customerId: 'customer-1',
      deviceId: null,
      storeId: null,
      status: 'active',
      aiProvider: 'openai-realtime',
      avatarProvider: 'liveavatar',
      providerSessionId: 'provider-session-1',
      avatarSessionId: 'avatar-session-1',
      startedAt: new Date(0).toISOString(),
      endedAt: null,
    },
    ai: {
      provider: 'openai-realtime',
      model: 'test',
      outputModality: 'text',
      clientSecret: 'ephemeral-client-secret',
    },
    avatar: {
      provider: 'liveavatar',
      sessionToken: 'ephemeral-avatar-token',
      mode: 'FULL',
    },
    tools: [],
    sessionAccessToken: 'session-access-token',
    sessionAccessExpiresAt: new Date(60_000).toISOString(),
  };
}

function callbacks(
  onToolCall: SophiaBrowserTransportCallbacks['onToolCall'] = async () => ({}),
): SophiaBrowserTransportCallbacks {
  return {
    onVoiceStatus: () => undefined,
    onPresentationStatus: () => undefined,
    onPresentationUnavailable: () => undefined,
    onEvent: () => undefined,
    onUserActivity: () => undefined,
    onAssistantSpeechStarted: () => undefined,
    onAssistantSpeechStopped: () => undefined,
    onAssistantTurnCompleted: () => undefined,
    onToolCall,
  };
}

describe('SophiaGeminiLiveBrowserAdapter', () => {
  it('selects one Web Audio owner and deduplicates secured tool callbacks', async () => {
    let liveRequest!: SophiaGeminiLiveConnectRequest;
    const live = jasmine.createSpyObj<SophiaGeminiLiveClientService>(
      'SophiaGeminiLiveClientService',
      ['connect', 'interrupt', 'promptAssistant', 'submitUserText', 'disconnect'],
    );
    live.connect.and.callFake(async (request) => {
      liveRequest = request;
      request.onStatus('Gemini Live connected');
    });
    live.disconnect.and.resolveTo();
    TestBed.configureTestingModule({
      providers: [
        SophiaGeminiLiveBrowserAdapter,
        { provide: SophiaGeminiLiveClientService, useValue: live },
      ],
    });
    const adapter = TestBed.inject(SophiaGeminiLiveBrowserAdapter);
    const executeTool = jasmine.createSpy('executeTool').and.resolveTo({ ok: true });
    const media = {
      remoteAudio: document.createElement('audio'),
      avatarAudio: document.createElement('audio'),
      avatarVideo: document.createElement('video'),
    };
    const geminiResponse = response();
    geminiResponse.session.aiProvider = 'gemini-live';
    geminiResponse.session.avatarProvider = 'none';
    geminiResponse.ai = {
      provider: 'gemini-live', model: 'gemini-3.8-live', outputModality: 'audio',
      clientSecret: 'ephemeral', transportBootstrap: { protocol: 'gemini-live-websocket' },
    };
    geminiResponse.avatar = { provider: 'none' };

    await adapter.connect({
      response: geminiResponse, media, audioBridge: 'webrtc-track', callbacks: callbacks(executeTool),
    });
    expect(media.remoteAudio.muted).toBeTrue();
    expect(media.avatarAudio.muted).toBeTrue();
    expect(media.avatarVideo.muted).toBeTrue();
    const call = { callId: 'call-1', name: 'catalog.search', arguments: {} };
    const [first, duplicate] = await Promise.all([
      liveRequest.onToolCall(call), liveRequest.onToolCall(call),
    ]);
    expect(first).toEqual({ ok: true });
    expect(duplicate).toEqual({ ok: true });
    expect(executeTool).toHaveBeenCalledTimes(1);
    adapter.interrupt();
    expect(live.interrupt).toHaveBeenCalled();
    await adapter.disconnect();
    expect(live.disconnect).toHaveBeenCalled();
  });
});
