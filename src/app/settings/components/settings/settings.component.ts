import {
  Component,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { selectCurrentUser } from 'src/app/auth/store/reducers';
import { CurrentUserInterface } from 'src/app/shared/types/currentUser.interface';
import { selectIsSubmitting, selectValidationErrors } from './store/reducers';
import { CommonModule } from '@angular/common';
import { BackendErrorMessages } from 'src/app/shared/components/backendErrorMessages.component';
import { CurrentUserRequestInterface } from 'src/app/shared/types/currentUserRequest.interface';
import { authActions } from 'src/app/auth/store/actions';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';

/* PrimeNG */
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { TextareaModule } from 'primeng/textarea';
import { ButtonModule } from 'primeng/button';
import { AvatarModule } from 'primeng/avatar';
import { FileUpload, FileUploadModule } from 'primeng/fileupload';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';

/* NgRx (avatar upload) */
import { uploadActions } from './store/upload.actions';
import {
  selectIsUploading,
  selectUploadedUrl,
} from './store';

type FileUploadSelectEvent = {
  files?: File[];
};

type FileUploadHandlerEvent = {
  files?: File[];
};

@Component({
    selector: 'mc-settings',
    templateUrl: './settings.component.html',
    styleUrls: ['./settings.component.css'],
    imports: [
        CommonModule,
        ReactiveFormsModule,
        BackendErrorMessages,
        // PrimeNG
        CardModule,
        InputTextModule,
        PasswordModule,
        TextareaModule,
        ButtonModule,
        AvatarModule,
        FileUploadModule,
        InputGroupModule,
        InputGroupAddonModule,
    ]
})
export class SettingsComponent {
  readonly uploaderRef$$ = viewChild<FileUpload>('uploader');

  private readonly fb = inject(FormBuilder);
  private readonly store = inject(Store);

  readonly form = this.fb.nonNullable.group({
    image: '',
    username: '',
    bio: '',
    email: '',
    password: '',
  });

  // bigger default preview if image is empty/broken
  readonly defaultAvatar =
    'https://files-nodejs-api.s3.ap-southeast-2.amazonaws.com/public/avatar-user.png';

  readonly currentUser$$ = toSignal<CurrentUserInterface | null>(
    this.store.select(selectCurrentUser).pipe(map((user) => user ?? null)),
    { initialValue: null }
  );
  readonly isSubmitting$$ = toSignal(this.store.select(selectIsSubmitting), {
    initialValue: false,
  });
  readonly backendErrors$$ = toSignal(this.store.select(selectValidationErrors), {
    initialValue: null,
  });

  // avatar upload state
  readonly isUploadingAvatar$$ = toSignal(this.store.select(selectIsUploading), {
    initialValue: false,
  });
  private readonly uploadedUrl$$ = toSignal(
    this.store.select(selectUploadedUrl),
    { initialValue: null }
  );

  // local preview (Object URL)
  readonly previewUrl$$ = signal<string | null>(null);
  readonly selectedFile$$ = signal<File | null>(null);
  private readonly imageControl = this.form.controls.image;
  readonly imageUrl$$ = toSignal(this.imageControl.valueChanges, {
    initialValue: this.imageControl.value,
  });
  readonly avatarUrl$$ = computed(
    () => this.previewUrl$$() ?? this.imageUrl$$() ?? this.defaultAvatar
  );

  private readonly initFormEffect = effect(() => {
    const currentUser = this.currentUser$$();
    if (!currentUser) return;
    this.form.patchValue({
      image: currentUser.image ?? '',
      username: currentUser.username,
      bio: currentUser.bio ?? '',
      email: currentUser.email,
      password: '',
    });
  });

  private readonly uploadedUrlEffect = effect(() => {
    const url = this.uploadedUrl$$();
    if (!url) return;
    this.form.patchValue({ image: url });
    this.previewUrl$$.set(null);
    this.selectedFile$$.set(null);
    this.uploaderRef$$()?.clear();
  });

  private readonly previewCleanupEffect = effect((onCleanup) => {
    const preview = this.previewUrl$$();
    if (!preview) return;
    onCleanup(() => URL.revokeObjectURL(preview));
  });

  logout(): void {
    this.store.dispatch(authActions.logout());
  }

  // ===== Avatar upload handlers =====

  onFileSelected(ev: FileUploadSelectEvent): void {
    const file = ev.files?.[0];
    if (!file) return;
    this.selectedFile$$.set(file);

    // instant local preview
    this.previewUrl$$.set(URL.createObjectURL(file));

    // since [auto]="true", PrimeNG will immediately trigger uploadHandler → onUpload()
    // nothing else to do here
  }

  onUpload(_: FileUploadHandlerEvent): void {
    const file = this.selectedFile$$();
    if (!file) return;
    this.store.dispatch(
      uploadActions.uploadAvatar({ file })
    );
  }

  // ===== Submit settings =====

  submit(): void {
    const currentUser = this.currentUser$$();
    if (!currentUser) throw new Error('Current user is not set');
    const currentUserRequest: CurrentUserRequestInterface = {
      user: {
        ...currentUser,
        ...this.form.getRawValue(),
      },
    };
    this.store.dispatch(authActions.updateCurrentUser({ currentUserRequest }));
  }
}
