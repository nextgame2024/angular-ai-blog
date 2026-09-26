import { inject, Injectable, signal } from '@angular/core';

import type { SophiaSessionToolCall } from '../services/sophia-session.facade';
import {
  SOPHIA_TOOL_PRESENTATION_RENDERERS,
  type SophiaPresentationAction,
  type SophiaPresentationDocument,
  type SophiaToolPresentationRenderer,
} from './sophia-tool-presentation.types';

@Injectable()
export class SophiaToolPresentationRegistry {
  private readonly renderers = inject(SOPHIA_TOOL_PRESENTATION_RENDERERS);
  private active: SophiaToolPresentationRenderer | null = null;

  readonly document = signal<SophiaPresentationDocument | null>(null);

  handleToolOutput(toolName: string, output: unknown): boolean {
    const renderer = this.resolve(toolName);
    if (!renderer) return false;
    this.active = renderer;
    this.document.set(renderer.render(toolName, output));
    return true;
  }

  prepareToolInput(
    sessionId: string,
    toolCall: SophiaSessionToolCall,
  ): Promise<Record<string, unknown>> {
    const renderer = this.resolve(toolCall.name);
    return renderer?.prepareToolInput
      ? renderer.prepareToolInput(sessionId, toolCall.name, toolCall.arguments)
      : Promise.resolve(toolCall.arguments);
  }

  async handleAction(action: SophiaPresentationAction): Promise<void> {
    const next = await this.active?.handleAction?.(action);
    if (next !== undefined) this.document.set(next);
  }

  updateField(key: string, value: string): void {
    const next = this.active?.updateField?.(key, value);
    if (next !== undefined) this.document.set(next);
  }

  async dismiss(): Promise<void> {
    try {
      await this.active?.dismiss?.();
    } finally {
      this.clear();
    }
  }

  clear(): void {
    for (const renderer of this.renderers) renderer.clear();
    this.active = null;
    this.document.set(null);
  }

  private resolve(toolName: string): SophiaToolPresentationRenderer | null {
    const matches = this.renderers.filter((renderer) =>
      renderer.manifest.toolNames.includes(toolName),
    );
    if (matches.length > 1) {
      throw new Error(
        `Expected at most one Sophia UI renderer for ${toolName}; found ${matches.length}.`,
      );
    }
    return matches[0] ?? null;
  }
}
