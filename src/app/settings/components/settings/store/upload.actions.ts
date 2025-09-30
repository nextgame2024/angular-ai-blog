import { createActionGroup, emptyProps, props } from '@ngrx/store';

export const uploadActions = createActionGroup({
  source: 'Avatar Upload',
  events: {
    'Upload Avatar': props<{ file: File }>(),
    'Upload Avatar Success': props<{ url: string; key?: string }>(),
    'Upload Avatar Failure': props<{ error: string }>(),
    'Reset Upload State': emptyProps(),
  },
});
