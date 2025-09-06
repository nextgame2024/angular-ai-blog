export type AssetType = 'image' | 'audio' | 'video';

export interface AssetInterface {
  id: number | string;
  type: AssetType;
  url: string;
  mimeType?: string | null;
  durationSec?: number | null;
  width?: number | null;
  height?: number | null;
  metadata?: any;
  createdAt?: string | null;
}
