import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { select, Store } from '@ngrx/store';
import { combineLatest, filter, Subscription } from 'rxjs';
import { selectCurrentUser } from 'src/app/auth/store/reducers';
import { CurrentUserInterface } from 'src/app/shared/types/currentUser.interface';
import { selectIsSubmitting, selectValidationErrors } from './store/reducers';
import { CommonModule } from '@angular/common';
import { BackendErrorMessages } from 'src/app/shared/components/backendErrorMessages.component';
import { CurrentUserRequestInterface } from 'src/app/shared/types/currentUserRequest.interface';
import { authActions } from 'src/app/auth/store/actions';

/* PrimeNG */
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { AvatarModule } from 'primeng/avatar';
import { FileUpload, FileUploadModule } from 'primeng/fileupload';

/* NgRx (avatar upload) */
import { Observable } from 'rxjs';
import { uploadActions } from './store/upload.actions';
import {
  selectIsUploading,
  selectUploadError,
  selectUploadedUrl,
} from './store';

@Component({
  selector: 'mc-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    BackendErrorMessages,
    // PrimeNG
    CardModule,
    InputTextModule,
    InputTextareaModule,
    PasswordModule,
    ButtonModule,
    AvatarModule,
    FileUploadModule,
  ],
})
export class SettingsComponent implements OnInit, OnDestroy {
  @ViewChild('uploader') uploader?: FileUpload;

  form = this.fb.nonNullable.group({
    image: '',
    username: '',
    bio: '',
    email: '',
    password: '',
  });

  // bigger default preview if image is empty/broken
  defaultAvatar =
    'https://files-nodejs-api.s3.ap-southeast-2.amazonaws.com/public/avatar-user.png';

  currentUser?: CurrentUserInterface;

  data$ = combineLatest({
    isSubmitting: this.store.select(selectIsSubmitting),
    backendErrors: this.store.select(selectValidationErrors),
  });

  currentUserSubscription?: Subscription;

  // avatar upload state
  isUploadingAvatar$!: Observable<boolean>;
  uploadError$!: Observable<string | null>;
  uploadedUrlSub?: Subscription;

  // local preview (Object URL)
  previewUrl: string | null = null;
  selectedFile?: File;

  constructor(private fb: FormBuilder, private store: Store) {}

  ngOnInit(): void {
    this.currentUserSubscription = this.store
      .pipe(select(selectCurrentUser), filter(Boolean))
      .subscribe((currentUser) => {
        this.currentUser = currentUser;
        this.initializeForm();
      });

    this.isUploadingAvatar$ = this.store.select(selectIsUploading);
    this.uploadError$ = this.store.select(selectUploadError);

    // when effect emits S3 URL → set form.image, clear preview and reset uploader so user can upload again
    this.uploadedUrlSub = this.store
      .select(selectUploadedUrl)
      .pipe(filter((u): u is string => !!u))
      .subscribe((url) => {
        this.form.patchValue({ image: url });
        this.revokePreview();
        // allow immediate re-upload
        this.uploader?.clear();
        this.selectedFile = undefined;
      });
  }

  ngOnDestroy(): void {
    this.currentUserSubscription?.unsubscribe();
    this.uploadedUrlSub?.unsubscribe();
    this.revokePreview();
  }

  initializeForm(): void {
    if (!this.currentUser) throw new Error('Current user is not set');
    this.form.patchValue({
      image: this.currentUser.image ?? '',
      username: this.currentUser.username,
      bio: this.currentUser.bio ?? '',
      email: this.currentUser.email,
      password: '',
    });
  }

  logout(): void {
    this.store.dispatch(authActions.logout());
  }

  // ===== Avatar upload handlers =====

  private revokePreview() {
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = null;
    }
  }

  onFileSelected(ev: any) {
    const file: File | undefined = ev?.files?.[0];
    if (!file) return;
    this.selectedFile = file;

    // instant local preview
    this.revokePreview();
    this.previewUrl = URL.createObjectURL(file);

    // since [auto]="true", PrimeNG will immediately trigger uploadHandler → onUpload()
    // nothing else to do here
  }

  onUpload(_: any) {
    if (!this.selectedFile) return;
    this.store.dispatch(
      uploadActions.uploadAvatar({ file: this.selectedFile })
    );
  }

  // ===== Submit settings =====

  submit(): void {
    if (!this.currentUser) throw new Error('Current user is not set');
    const currentUserRequest: CurrentUserRequestInterface = {
      user: {
        ...this.currentUser,
        ...this.form.getRawValue(),
      },
    };
    this.store.dispatch(authActions.updateCurrentUser({ currentUserRequest }));
  }
}
