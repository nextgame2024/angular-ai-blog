import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { uploadActions } from './upload.actions';
import { AvatarUploadService } from '../services/avatar-upload.service';
import { catchError, map, of, switchMap } from 'rxjs';

@Injectable()
export class UploadEffects {
  private actions$ = inject(Actions);
  private api = inject(AvatarUploadService);

  upload$ = createEffect(() =>
    this.actions$.pipe(
      ofType(uploadActions.uploadAvatar),
      switchMap(({ file }) =>
        this.api.uploadViaPresigned(file).pipe(
          map(({ url }) => uploadActions.uploadAvatarSuccess({ url })),
          catchError((err) =>
            of(
              uploadActions.uploadAvatarFailure({
                error:
                  err?.error?.message ||
                  err?.message ||
                  'Failed to upload avatar',
              })
            )
          )
        )
      )
    )
  );
}
