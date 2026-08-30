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
    clientSecret?: string;
    expiresAt?: string;
  };
  avatar: {
    provider: string;
    sessionToken?: string;
    transportMode?: 'livekit' | 'p2p';
    streamUrl?: string;
    expiresAt?: string;
  };
  tools: SophiaRuntimeToolDefinition[];
}

export interface SophiaRuntimeSessionStatusResponse {
  session: SophiaRuntimeSession;
}

export interface CreateSophiaRuntimeSessionRequest {
  customerId?: string;
  deviceId?: string;
  storeId?: string;
  createdByUserId?: string;
}

export interface ExecuteSophiaRuntimeToolRequest {
  toolName: string;
  input: Record<string, unknown>;
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
