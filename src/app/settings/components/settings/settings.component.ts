import {
  Component,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { AuthService, MfaEnrollmentResponse, MfaStatusResponse } from 'src/app/auth/services/auth.service';
import { PersistanceService } from 'src/app/shared/services/persistance.service';

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
  private readonly auth = inject(AuthService);
  private readonly persistence = inject(PersistanceService);
  private mfaLoadedUserId: string | null = null;

  readonly form = this.fb.nonNullable.group({
    image: '',
    username: '',
    bio: '',
    email: '',
    password: '',
  });
  readonly mfaEnrollmentForm = this.fb.nonNullable.group({
    password: ['', [Validators.required]],
  });
  readonly mfaActivationForm = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });
  readonly mfaStepUpForm = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });
  readonly mfaStatus$$ = signal<MfaStatusResponse | null>(null);
  readonly mfaEnrollment$$ = signal<MfaEnrollmentResponse['mfa'] | null>(null);
  readonly mfaBusy$$ = signal(false);
  readonly mfaNotice$$ = signal<string | null>(null);
  readonly mfaError$$ = signal<string | null>(null);

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
  readonly avatarUrl$$ = computed(() => {
    const preview = this.previewUrl$$();
    if (preview) return preview;

    const imageUrl = String(this.imageUrl$$() || '').trim();
    return imageUrl || this.defaultAvatar;
  });

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
    if (this.mfaLoadedUserId !== currentUser.id) {
      this.mfaLoadedUserId = currentUser.id;
      this.loadMfaStatus();
    }
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

  onAvatarError(event: Event): void {
    const image = event.target as HTMLImageElement;
    image.src = this.defaultAvatar;
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

  loadMfaStatus(): void {
    this.mfaBusy$$.set(true); this.mfaError$$.set(null);
    this.auth.getMfaStatus().subscribe({
      next: (status) => { this.mfaStatus$$.set(status); this.mfaBusy$$.set(false); },
      error: (error) => { this.mfaError$$.set(apiError(error)); this.mfaBusy$$.set(false); },
    });
  }

  startMfaEnrollment(): void {
    if (this.mfaEnrollmentForm.invalid) return;
    this.mfaBusy$$.set(true); this.mfaError$$.set(null); this.mfaNotice$$.set(null);
    this.auth.enrolTotp(this.mfaEnrollmentForm.controls.password.value).subscribe({
      next: ({ mfa }) => {
        this.mfaEnrollment$$.set(mfa); this.mfaBusy$$.set(false);
        this.mfaEnrollmentForm.reset();
        this.mfaNotice$$.set('Add the secret to your authenticator, then confirm one code.');
        this.loadMfaStatus();
      },
      error: (error) => { this.mfaError$$.set(apiError(error)); this.mfaBusy$$.set(false); },
    });
  }

  activateMfa(): void {
    if (this.mfaActivationForm.invalid) return;
    this.mfaBusy$$.set(true); this.mfaError$$.set(null); this.mfaNotice$$.set(null);
    this.auth.activateTotp(this.mfaActivationForm.controls.code.value).subscribe({
      next: () => {
        this.mfaActivationForm.reset(); this.mfaEnrollment$$.set(null);
        this.mfaNotice$$.set('Authenticator MFA is active. Verify a fresh code before privileged work.');
        this.loadMfaStatus(); this.store.dispatch(authActions.getCurrentUser());
      },
      error: (error) => { this.mfaError$$.set(apiError(error)); this.mfaBusy$$.set(false); },
    });
  }

  stepUpMfa(): void {
    if (this.mfaStepUpForm.invalid) return;
    this.mfaBusy$$.set(true); this.mfaError$$.set(null); this.mfaNotice$$.set(null);
    this.auth.stepUpTotp(this.mfaStepUpForm.controls.code.value).subscribe({
      next: (currentUser) => {
        this.persistence.set('accessToken', currentUser.token);
        this.persistence.set('token', currentUser.token);
        this.store.dispatch(authActions.getCurrentUserSuccess({ currentUser }));
        this.mfaStepUpForm.reset(); this.mfaBusy$$.set(false);
        this.mfaNotice$$.set('Recent MFA verified. Privileged actions are available for up to 12 hours.');
        this.mfaStatus$$.update((status) => status ? { ...status,
          mfaVerifiedAt: currentUser.mfaVerifiedAt ?? null } : status);
      },
      error: (error) => { this.mfaError$$.set(apiError(error)); this.mfaBusy$$.set(false); },
    });
  }
}

function apiError(error: unknown): string {
  const candidate = error as { error?: { error?: unknown }; message?: unknown };
  return typeof candidate.error?.error === 'string' ? candidate.error.error
    : typeof candidate.message === 'string' ? candidate.message : 'MFA operation failed.';
}
