import { InjectionToken } from '@angular/core';

export interface SophiaPresentationAction {
  actionId: string;
  label: string;
  payload?: Record<string, unknown>;
}

export interface SophiaPresentationMedia {
  mediaId: string;
  url: string;
  altText: string;
}

export interface SophiaItemListBlock {
  type: 'item-list';
  eyebrow?: string;
  title: string;
  items: Array<{
    id: string;
    title: string;
    subtitle?: string;
    summary?: string;
    badge?: string;
    media?: SophiaPresentationMedia;
    action?: SophiaPresentationAction;
  }>;
}

export interface SophiaDetailBlock {
  type: 'detail-card';
  eyebrow?: string;
  title: string;
  subtitle?: string;
  primaryText?: string;
  summary?: string;
  fields: Array<{ label: string; value: string }>;
}

export interface SophiaMediaGalleryBlock {
  type: 'media-gallery';
  title: string;
  media: SophiaPresentationMedia[];
}

export interface SophiaAvailabilityBlock {
  type: 'availability-list';
  title: string;
  rows: Array<{
    id: string;
    primary: string;
    secondary: string;
    status?: string;
  }>;
}

export interface SophiaReviewBlock {
  type: 'review-card';
  eyebrow?: string;
  title: string;
  prompt: string;
  fields: Array<{
    key: string;
    label: string;
    value: string;
    inputType: 'text' | 'email';
    autocomplete?: string;
  }>;
  facts: Array<{ label: string; value: string }>;
  action: SophiaPresentationAction;
  secondaryAction?: SophiaPresentationAction;
}

export interface SophiaStatusBlock {
  type: 'operation-status';
  eyebrow?: string;
  title: string;
  status: 'success' | 'processing' | 'warning' | 'failed' | 'unknown';
  summary?: string;
  details: Array<{ label: string; value: string }>;
}

export interface SophiaSourceListBlock {
  type: 'source-list';
  title: string;
  items: Array<{
    id: string;
    title: string;
    excerpt: string;
    sourceRef?: string;
  }>;
}

export type SophiaPresentationBlock =
  | SophiaItemListBlock
  | SophiaDetailBlock
  | SophiaMediaGalleryBlock
  | SophiaAvailabilityBlock
  | SophiaReviewBlock
  | SophiaStatusBlock
  | SophiaSourceListBlock;

export interface SophiaPresentationDocument {
  rendererKey: string;
  blocks: SophiaPresentationBlock[];
}

export interface SophiaToolPresentationRendererManifest {
  rendererKey: string;
  toolNames: readonly string[];
}

export interface SophiaToolPresentationRenderer {
  readonly manifest: SophiaToolPresentationRendererManifest;
  render(toolName: string, output: unknown): SophiaPresentationDocument | null;
  prepareToolInput?(
    sessionId: string,
    toolName: string,
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  handleAction?(
    action: SophiaPresentationAction,
  ): Promise<SophiaPresentationDocument | null | void>;
  updateField?(
    key: string,
    value: string,
  ): SophiaPresentationDocument | null | void;
  dismiss?(): Promise<void>;
  clear(): void;
}

export const SOPHIA_TOOL_PRESENTATION_RENDERERS = new InjectionToken<
  readonly SophiaToolPresentationRenderer[]
>('SOPHIA_TOOL_PRESENTATION_RENDERERS');

export const SOPHIA_PRESENTATION_MEDIA_HOSTS = new InjectionToken<
  readonly string[]
>('SOPHIA_PRESENTATION_MEDIA_HOSTS');

export interface SophiaToolActivityLabels {
  rendererKey: string;
  labels: Readonly<Record<string, string>>;
}

export const SOPHIA_TOOL_ACTIVITY_LABELS = new InjectionToken<
  readonly SophiaToolActivityLabels[]
>('SOPHIA_TOOL_ACTIVITY_LABELS');

export const SOPHIA_CORE_TOOL_ACTIVITY_LABELS: SophiaToolActivityLabels = {
  rendererKey: 'core-presentation-v1',
  labels: { researchBusiness: 'Researching official sources' },
};
