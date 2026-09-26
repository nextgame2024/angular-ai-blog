import { inject, Injectable } from '@angular/core';

import type { SophiaRuntimeSessionResponse } from '../../types/sophia-runtime.types';
import type { SophiaAvatarAudioBridge } from '../sophia-runtime-config.service';
import {
  SOPHIA_BROWSER_TRANSPORT_ADAPTERS,
  SOPHIA_PRESENTATION_ADAPTERS,
  type SophiaBrowserMediaElements,
  type SophiaBrowserTransportAdapter,
  type SophiaBrowserTransportCallbacks,
  type SophiaPresentationAdapter,
} from './sophia-browser-transport.types';

@Injectable()
export class SophiaPresentationAdapterRegistry {
  private readonly adapters = inject(SOPHIA_PRESENTATION_ADAPTERS);

  resolve(response: SophiaRuntimeSessionResponse): SophiaPresentationAdapter {
    const adapterKey = resolveLegacyPresentationAdapterKey(
      response.avatar.provider,
    );
    return resolveExactlyOne(this.adapters, adapterKey, 'presentation');
  }
}

@Injectable()
export class SophiaBrowserTransportRegistry {
  private readonly adapters = inject(SOPHIA_BROWSER_TRANSPORT_ADAPTERS);
  private active: SophiaBrowserTransportAdapter | null = null;

  async connect(input: {
    response: SophiaRuntimeSessionResponse;
    media: SophiaBrowserMediaElements;
    audioBridge: SophiaAvatarAudioBridge;
    callbacks: SophiaBrowserTransportCallbacks;
  }): Promise<void> {
    await this.disconnect();
    const adapterKey = resolveLegacyTransportAdapterKey(input.response);
    const adapter = resolveExactlyOne(this.adapters, adapterKey, 'transport');
    this.active = adapter;
    try {
      await adapter.connect(input);
    } catch (error) {
      await adapter.disconnect().catch(() => undefined);
      if (this.active === adapter) this.active = null;
      throw error;
    }
  }

  interrupt(): void {
    this.active?.interrupt();
  }

  promptAssistant(text: string): void {
    this.active?.promptAssistant(text);
  }

  submitUserText(text: string): void {
    if (!this.active) throw new Error('Sophia text input is unavailable.');
    this.active.submitUserText(text);
  }

  async disconnect(): Promise<void> {
    const active = this.active;
    this.active = null;
    if (active) await active.disconnect();
  }

  activeAdapterKey(): string | null {
    return this.active?.manifest.adapterKey ?? null;
  }
}

export function resolveLegacyTransportAdapterKey(
  response: SophiaRuntimeSessionResponse,
): string {
  if (
    response.ai.provider === 'tavus-full' &&
    response.avatar.provider === 'tavus'
  ) {
    return 'daily-conversation-browser-v1';
  }
  if (
    response.ai.provider === 'openai-realtime' &&
    response.avatar.provider !== 'tavus'
  ) {
    return 'native-realtime-browser-v1';
  }
  if (response.ai.provider === 'gemini-live' && response.avatar.provider === 'none') {
    return 'gemini-live-browser-v1';
  }
  throw new Error('The runtime returned an unsupported browser transport plan.');
}

function resolveLegacyPresentationAdapterKey(provider: string): string {
  switch (provider) {
    case 'none':
      return 'static-presentation-v1';
    case 'simli':
      return 'simli-presentation-v1';
    case 'liveavatar':
      return 'live-avatar-presentation-v1';
    default:
      throw new Error(
        'The runtime returned an unsupported presentation transport plan.',
      );
  }
}

function resolveExactlyOne<T extends { manifest: { adapterKey: string } }>(
  adapters: readonly T[],
  adapterKey: string,
  kind: string,
): T {
  const matches = adapters.filter(
    (adapter) => adapter.manifest.adapterKey === adapterKey,
  );
  if (matches.length !== 1) {
    throw new Error(
      `Expected one registered Sophia ${kind} adapter for ${adapterKey}; found ${matches.length}.`,
    );
  }
  return matches[0];
}
