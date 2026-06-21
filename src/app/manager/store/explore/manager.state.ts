import type { BmExploreVideo } from '../../types/explore.interface';

export interface ManagerExploreState {
  exploreSearchQuery: string;
  exploreVideos: BmExploreVideo[];
  exploreLoading: boolean;
  exploreError: string | null;
  explorePage: number;
  exploreLimit: number;
  exploreTotal: number;
}

export const initialManagerExploreState: ManagerExploreState = {
  exploreSearchQuery: '',
  exploreVideos: [],
  exploreLoading: false,
  exploreError: null,
  explorePage: 1,
  exploreLimit: 8,
  exploreTotal: 0,
};
