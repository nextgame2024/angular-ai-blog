import { createReducer, on } from '@ngrx/store';
import { uploadActions } from './upload.actions';

export interface UploadState {
  isUploading: boolean;
  uploadedUrl: string | null;
  error: string | null;
}

export const initialUploadState: UploadState = {
  isUploading: false,
  uploadedUrl: null,
  error: null,
};

export const uploadReducer = createReducer(
  initialUploadState,
  on(uploadActions.uploadAvatar, (s) => ({
    ...s,
    isUploading: true,
    error: null,
    uploadedUrl: null,
  })),
  on(uploadActions.uploadAvatarSuccess, (s, { url }) => ({
    ...s,
    isUploading: false,
    uploadedUrl: url,
  })),
  on(uploadActions.uploadAvatarFailure, (s, { error }) => ({
    ...s,
    isUploading: false,
    error,
  })),
  on(uploadActions.resetUploadState, () => initialUploadState)
);
