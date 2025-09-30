import { createFeature, createSelector } from '@ngrx/store';
import {
  initialUploadState,
  uploadReducer,
  UploadState,
} from './upload.reducer';

export const uploadFeature = createFeature({
  name: 'avatarUpload',
  reducer: uploadReducer,
});

export const {
  name: uploadFeatureKey,
  reducer: avatarUploadReducer,
  selectAvatarUploadState,
} = uploadFeature;

export const selectIsUploading = createSelector(
  selectAvatarUploadState,
  (s?: UploadState) => (s ?? initialUploadState).isUploading
);
export const selectUploadedUrl = createSelector(
  selectAvatarUploadState,
  (s?: UploadState) => (s ?? initialUploadState).uploadedUrl
);
export const selectUploadError = createSelector(
  selectAvatarUploadState,
  (s?: UploadState) => (s ?? initialUploadState).error
);
