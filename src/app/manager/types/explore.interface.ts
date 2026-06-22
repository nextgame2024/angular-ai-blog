export type ExploreVideoCategory =
  | 'Setup'
  | 'Operations'
  | 'Catalog'
  | 'Finance';

export type ExploreVideoLevel =
  | 'Getting started'
  | 'Core workflow'
  | 'Advanced';

export interface BmExploreVideo {
  videoId: string;
  title: string;
  description: string;
  module: string;
  category: ExploreVideoCategory;
  level: ExploreVideoLevel;
  keywords: string[];
  durationLabel: string;
  videoUrl: string;
  posterUrl: string;
  accentGradient: string;
}

export interface ExploreVideosResult {
  items: BmExploreVideo[];
  page: number;
  limit: number;
  total: number;
}
