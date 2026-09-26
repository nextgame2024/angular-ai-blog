export * from '../contracts/generated/sophia-runtime-v2.contracts';

export type SophiaAvatarProvider = 'none' | 'simli' | 'liveavatar' | 'tavus';
export type SophiaAvatarMode = 'LITE' | 'FULL';
export type SophiaExperience = 'essential' | 'professional' | 'premium';

export interface SophiaRuntimeToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface SophiaRuntimeSession {
  sessionId: string;
  customerId: string;
  deviceId: string | null;
  storeId: string | null;
  status: 'created' | 'active' | 'closed' | 'failed' | string;
  aiProvider: string;
  avatarProvider: string;
  providerSessionId: string | null;
  avatarSessionId: string | null;
  startedAt: string;
  endedAt: string | null;
}

export interface SophiaRuntimeSessionResponse {
  session: SophiaRuntimeSession;
  ai: {
    provider: string;
    model: string;
    voice?: string;
    outputModality: 'audio' | 'text';
    clientSecret?: string;
    expiresAt?: string;
    transportBootstrap?: Record<string, unknown>;
  };
  avatar: {
    provider: SophiaAvatarProvider;
    sessionToken?: string;
    transportMode?: 'livekit' | 'p2p';
    mode?: SophiaAvatarMode;
    streamUrl?: string;
    expiresAt?: string;
    error?: string;
  };
  tools: SophiaRuntimeToolDefinition[];
  sessionAccessToken: string;
  sessionAccessExpiresAt: string;
}

export interface SophiaRuntimeSessionStatusResponse {
  session: SophiaRuntimeSession;
}

export interface SophiaActionReview {
  reviewId: string;
  commandId: string;
  actionType: string;
  status: 'reviewed' | 'confirmed';
  payload: Record<string, unknown>;
  expiresAt: string;
}

export interface SophiaCurrentActionReviewResponse {
  review: SophiaActionReview | null;
}

export interface CreateSophiaRuntimeSessionRequest {
  experience: 'essential' | 'professional' | 'premium';
  /** @deprecated Server policy ignores browser-selected authority fields. */
  aiProvider?: 'openai-realtime' | 'tavus-full';
  customerId?: string;
  deviceId?: string;
  storeId?: string;
  createdByUserId?: string;
  avatarProvider?: Exclude<SophiaAvatarProvider, 'tavus'>;
  avatarMode?: SophiaAvatarMode;
}

export interface ExecuteSophiaRuntimeToolRequest {
  toolName: string;
  input: Record<string, unknown>;
  providerCallId?: string;
  providerEventId?: string;
  eventSource?: 'browser' | 'provider_sideband';
  correlationId?: string;
}

export interface ExecuteSophiaRuntimeToolResponse {
  toolName: string;
  output: unknown;
}

export interface InventoryToolOutput {
  productId: string;
  colour?: string;
  storeId: string;
  quantityAvailable: number;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
}
