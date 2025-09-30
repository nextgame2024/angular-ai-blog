import { Component, OnDestroy, OnInit } from '@angular/core';
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
import { Observable } from 'rxjs';
import { uploadActions } from './store/upload.actions';
import {
  selectIsUploading,
  selectUploadError,
  selectUploadedUrl,
} from './store/index';

/* PrimeNG */
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { AvatarModule } from 'primeng/avatar';
import { FileUploadModule } from 'primeng/fileupload';

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
  form = this.fb.nonNullable.group({
    image: '',
    username: '',
    bio: '',
    email: '',
    password: '',
  });

  previewUrl: string | null = null;
  selectedFile?: File;
  isUploadingAvatar$!: Observable<boolean>;
  uploadError$!: Observable<string | null>;
  uploadedUrlSub?: Subscription;

  // default avatar preview if image is empty/broken
  defaultAvatar =
    'https://files-nodejs-api.s3.ap-southeast-2.amazonaws.com/public/avatar-user.png';

  currentUser?: CurrentUserInterface;
  data$ = combineLatest({
    isSubmitting: this.store.select(selectIsSubmitting),
    backendErrors: this.store.select(selectValidationErrors),
  });
  currentUserSubscription?: Subscription;

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

    this.uploadedUrlSub = this.store
      .select(selectUploadedUrl)
      .pipe(filter((u): u is string => !!u))
      .subscribe((url) => {
        this.form.patchValue({ image: url });
        this.revokePreview();
      });
  }

  ngOnDestroy(): void {
    this.currentUserSubscription?.unsubscribe();
    this.uploadedUrlSub?.unsubscribe();
    this.revokePreview();
  }

  private revokePreview() {
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = null;
    }
  }

  onFileSelected(ev: any) {
    // PrimeNG gives ev.files; native <input> would be ev.target.files
    const file: File | undefined = ev?.files?.[0];
    if (!file) return;
    this.selectedFile = file;

    // instant local preview
    this.revokePreview();
    this.previewUrl = URL.createObjectURL(file);
  }

  onUpload(ev: any) {
    if (!this.selectedFile) return;
    this.store.dispatch(
      uploadActions.uploadAvatar({ file: this.selectedFile })
    );
  }

  onClearSelection() {
    this.selectedFile = undefined;
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
