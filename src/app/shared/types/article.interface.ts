import { PopularTagType } from './popularTag.type';
import { ProfileInterface } from '../components/types/profile.interface';
import { AssetInterface } from './asset.interface';

export interface ArticleInterface {
  body: string;
  createdAt: string;
  description: string;
  favorited: boolean;
  favoritesCount: number;
  slug: string;
  tagList: PopularTagType[];
  title: string;
  updatedAt: string;
  author: ProfileInterface;
  assets?: AssetInterface[];
}
