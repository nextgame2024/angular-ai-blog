import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { combineLatest, Observable, Subject, of } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  map,
  startWith,
  switchMap,
  take,
  takeUntil,
} from 'rxjs/operators';

import { ManagerActions } from '../../store/manager.actions';
import {
  selectManagerUsersSearchQuery,
  selectManagerUsers,
  selectManagerUsersError,
  selectManagerUsersLoading,
  selectManagerUsersTotal,
  selectManagerUsersPage,
  selectManagerUsersViewMode,
  selectManagerEditingUser,
} from '../../store/manager.selectors';

import { TownPlannerV2Service } from '../../../townplanner/services/townplanner_v2.service';
import { TownPlannerV2AddressSuggestion } from '../../../townplanner/store/townplanner_v2.state';
import { AvatarUploadService } from '../../../settings/components/settings/services/avatar-upload.service';
import { ManagerSelectComponent } from '../shared/manager-select/manager-select.component';

import type { BmUser } from '../../services/manager.service';

@Component({
  selector: 'app-manager-users-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, ManagerSelectComponent],
  templateUrl: './manager-users.page.html',
  styleUrls: ['./manager-users.page.css'],
})
export class ManagerUsersPageComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  loading$ = this.store.select(selectManagerUsersLoading);
  error$ = this.store.select(selectManagerUsersError);
  usersRaw$ = this.store.select(selectManagerUsers);
  total$ = this.store.select(selectManagerUsersTotal);
  viewMode$ = this.store.select(selectManagerUsersViewMode);
  editingUser$ = this.store.select(selectManagerEditingUser);
  page$ = this.store.select(selectManagerUsersPage);

  searchQuery$ = this.store.select(selectManagerUsersSearchQuery);
  searchCtrl: FormControl<string>;
  filteredUsers$!: Observable<BmUser[]>;
  canLoadMore$!: Observable<boolean>;

  private infiniteObserver?: IntersectionObserver;
  private isLoadingMore = false;
  private currentPage = 1;
  private canLoadMore = false;
  private isLoading = false;
  private closeAfterSave = false;
  dismissedErrors = new Set<string>();

  @ViewChild('usersList') usersListRef?: ElementRef<HTMLElement>;
  @ViewChild('infiniteSentinel') infiniteSentinelRef?: ElementRef<HTMLElement>;

  addressSuggestions: TownPlannerV2AddressSuggestion[] = [];
  showAddressSuggestions = false;
  addressActiveIndex = -1;
  private addressSessionToken: string | null = null;
  private addressHasFocus = false;

  statusOptions = [
    { value: 'active', label: 'active' },
    { value: 'archived', label: 'archived' },
  ];

  typeOptions = [
    { value: 'employee', label: 'employee' },
    { value: 'supplier', label: 'supplier' },
    { value: 'client', label: 'client' },
  ];

  defaultAvatar =
    'https://files-nodejs-api.s3.ap-southeast-2.amazonaws.com/public/avatar-user.png';
  previewUrl: string | null = null;
  selectedFile?: File;
  isUploadingAvatar = false;
  uploadError: string | null = null;

  userForm = this.fb.group({
    username: ['', [Validators.required, Validators.maxLength(80)]],
    email: [
      '',
      [Validators.required, Validators.email, Validators.maxLength(160)],
    ],
    password: [''], // create required, edit optional
    name: ['', [Validators.required, Validators.maxLength(140)]],
    address: [''],
    cel: [''],
    tel: [''],
    type: ['employee', [Validators.required]],
    status: ['active', [Validators.required]],
    image: [''],
    bio: [''],
  });

  constructor(
    private store: Store,
    private fb: FormBuilder,
    private townPlanner: TownPlannerV2Service,
    private avatarUpload: AvatarUploadService,
    private actions$: Actions,
  ) {
    this.searchCtrl = this.fb.control('', { nonNullable: true });

    this.filteredUsers$ = combineLatest([
      this.usersRaw$,
      this.searchCtrl.valueChanges.pipe(startWith('')),
    ]).pipe(
      map(([users, query]) => {
        const q = (query || '').trim().toLowerCase();
        if (!q) return users;
        return users.filter((u) => {
          return (
            u.username?.toLowerCase().includes(q) ||
            u.name?.toLowerCase().includes(q) ||
            u.email?.toLowerCase().includes(q) ||
            u.type?.toLowerCase().includes(q) ||
            u.status?.toLowerCase().includes(q)
          );
        });
      }),
    );

    this.canLoadMore$ = combineLatest([
      this.total$,
      this.usersRaw$,
      this.loading$,
    ]).pipe(
      map(([total, users, loading]) => !loading && users.length < total),
    );
    this.page$.pipe(takeUntil(this.destroy$)).subscribe((page) => {
      this.currentPage = page || 1;
    });
    this.canLoadMore$.pipe(takeUntil(this.destroy$)).subscribe((canLoad) => {
      this.canLoadMore = canLoad;
    });
    this.loading$.pipe(takeUntil(this.destroy$)).subscribe((loading) => {
      this.isLoading = loading;
      if (!loading) this.isLoadingMore = false;
    });

    this.actions$
      .pipe(
        ofType(ManagerActions.saveUserSuccess, ManagerActions.saveUserFailure),
        takeUntil(this.destroy$),
      )
      .subscribe((action) => {
        if (!this.closeAfterSave) return;
        this.closeAfterSave = false;
        if (action.type === ManagerActions.saveUserSuccess.type) {
          this.closeForm();
        }
      });
  }

  ngOnInit(): void {
    this.store.dispatch(ManagerActions.loadUsers({ page: 1 }));

    this.searchQuery$.pipe(takeUntil(this.destroy$)).subscribe((query) => {
      if (this.searchCtrl.value !== (query || '')) {
        this.searchCtrl.setValue(query || '', { emitEvent: false });
      }
      this.store.dispatch(ManagerActions.loadUsers({ page: 1 }));
    });

    this.searchCtrl.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        takeUntil(this.destroy$),
      )
      .subscribe((query) =>
        this.store.dispatch(
          ManagerActions.setUsersSearchQuery({ query: query || '' }),
        ),
      );

    this.viewMode$
      .pipe(takeUntil(this.destroy$))
      .subscribe((mode) => {
        if (mode !== 'list') return;
        setTimeout(() => this.setupInfiniteScroll(), 0);
      });

    this.editingUser$.pipe(takeUntil(this.destroy$)).subscribe((u) => {
      if (!u) return;

      this.resetAvatarState();
      this.userForm.patchValue({
        username: u.username ?? '',
        email: u.email ?? '',
        password: '',
        name: u.name ?? '',
        address: u.address ?? '',
        cel: u.cel ?? '',
        tel: u.tel ?? '',
        type: u.type ?? 'employee',
        status: u.status ?? 'active',
        image: u.image ?? '',
        bio: u.bio ?? '',
      });

      this.userForm.controls.password.clearValidators();
      this.userForm.controls.password.setValidators([Validators.minLength(8)]);
      this.userForm.controls.password.updateValueAndValidity({
        emitEvent: false,
      });
    });

    this.setupAddressAutocomplete();
  }

  ngOnDestroy(): void {
    this.infiniteObserver?.disconnect();
    this.destroy$.next();
    this.destroy$.complete();
    this.revokePreview();
  }

  dismissError(message: string): void {
    if (message) this.dismissedErrors.add(message);
  }

  isErrorDismissed(message: string | null | undefined): boolean {
    return message ? this.dismissedErrors.has(message) : false;
  }

  trackByUser = (_: number, u: BmUser) => u.id;

  openCreate(): void {
    this.resetAvatarState();
    this.userForm.reset({
      username: '',
      email: '',
      password: '',
      name: '',
      address: '',
      cel: '',
      tel: '',
      type: 'employee',
      status: 'active',
      image: '',
      bio: '',
    });

    this.userForm.controls.password.clearValidators();
    this.userForm.controls.password.setValidators([
      Validators.required,
      Validators.minLength(8),
    ]);
    this.userForm.controls.password.updateValueAndValidity({
      emitEvent: false,
    });

    this.store.dispatch(ManagerActions.openUserCreate());
  }

  openEdit(u: BmUser): void {
    this.store.dispatch(ManagerActions.openUserEdit({ userId: u.id }));
  }

  closeForm(): void {
    this.store.dispatch(ManagerActions.closeUserForm());
  }

  saveUser(): void {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    const payload: any = this.userForm.getRawValue();

    if (!payload.password) delete payload.password;

    // Never send company_id from UI
    delete payload.company_id;
    delete payload.companyId;

    this.store.dispatch(ManagerActions.saveUser({ payload }));
  }

  saveUserAndClose(): void {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }
    this.closeAfterSave = true;
    this.saveUser();
  }

  archiveUser(u: BmUser): void {
    const ok = window.confirm(
      `Archive user "${u.username}"?\n\nThis is a soft-delete (status = archived).`,
    );
    if (!ok) return;

    this.store.dispatch(ManagerActions.archiveUser({ userId: u.id }));
  }

  get avatarSrc(): string {
    return this.previewUrl || this.userForm.controls.image.value || this.defaultAvatar;
  }

  private setupInfiniteScroll(): void {
    const sentinel = this.infiniteSentinelRef?.nativeElement;
    const list = this.usersListRef?.nativeElement;
    if (!sentinel || !list) return;

    this.infiniteObserver?.disconnect();

    const scrollRoot = list.closest('.content') as HTMLElement | null;

    this.infiniteObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        this.tryLoadMore();
      },
      {
        root: scrollRoot,
        rootMargin: '200px 0px',
        threshold: 0.1,
      },
    );

    this.infiniteObserver.observe(sentinel);
  }

  private tryLoadMore(): void {
    if (!this.canLoadMore || this.isLoading || this.isLoadingMore) return;
    this.isLoadingMore = true;
    this.store.dispatch(ManagerActions.loadUsers({ page: this.currentPage + 1 }));
  }

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) return;

    if (file.size > 5_000_000) {
      this.uploadError = 'Image is too large. Max size is 5 MB.';
      input.value = '';
      return;
    }

    this.selectedFile = file;
    this.revokePreview();
    this.previewUrl = URL.createObjectURL(file);
    this.uploadError = null;

    this.uploadAvatar();
  }

  uploadAvatar(): void {
    if (!this.selectedFile || this.isUploadingAvatar) return;
    this.isUploadingAvatar = true;
    this.avatarUpload.uploadViaPresigned(this.selectedFile).subscribe({
      next: ({ url }) => {
        this.userForm.controls.image.setValue(url);
        this.revokePreview();
        this.selectedFile = undefined;
        this.isUploadingAvatar = false;
      },
      error: (err) => {
        this.isUploadingAvatar = false;
        const raw =
          err?.error?.error ||
          err?.error ||
          err?.message ||
          'Failed to upload image';
        this.uploadError =
          typeof raw === 'string' && raw.includes('EntityTooLarge')
            ? 'Image is too large. Max size is 5 MB.'
            : raw;
      },
    });
  }

  private revokePreview(): void {
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = null;
    }
  }

  private resetAvatarState(): void {
    this.revokePreview();
    this.selectedFile = undefined;
    this.uploadError = null;
    this.isUploadingAvatar = false;
  }

  onAddressFocus(): void {
    this.addressHasFocus = true;
    const current = (this.userForm.controls.address.value || '').trim();
    if (current.length >= 3 && this.addressSuggestions.length) {
      this.showAddressSuggestions = true;
    }
  }

  onAddressBlur(): void {
    this.addressHasFocus = false;
    window.setTimeout(() => {
      this.showAddressSuggestions = false;
      this.addressActiveIndex = -1;
    }, 120);
  }

  onAddressKeydown(event: KeyboardEvent): void {
    if (!this.addressSuggestions.length) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.addressActiveIndex = Math.min(
        this.addressActiveIndex + 1,
        this.addressSuggestions.length - 1,
      );
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.addressActiveIndex = Math.max(this.addressActiveIndex - 1, 0);
    } else if (event.key === 'Enter') {
      if (this.addressActiveIndex >= 0) {
        event.preventDefault();
        this.onAddressSelect(this.addressSuggestions[this.addressActiveIndex]);
      }
    } else if (event.key === 'Escape') {
      this.showAddressSuggestions = false;
      this.addressActiveIndex = -1;
    }
  }

  onAddressSelect(suggestion: TownPlannerV2AddressSuggestion): void {
    this.userForm.controls.address.setValue(suggestion.description, {
      emitEvent: false,
    });
    this.addressSuggestions = [];
    this.showAddressSuggestions = false;
    this.addressActiveIndex = -1;

    const token = this.addressSessionToken;
    this.addressSessionToken = null;

    this.townPlanner
      .getPlaceDetails(suggestion.placeId, token)
      .pipe(take(1))
      .subscribe((details) => {
        const next =
          details?.formattedAddress || suggestion.description || '';
        if (next) {
          this.userForm.controls.address.setValue(next, { emitEvent: false });
        }
      });
  }

  private setupAddressAutocomplete(): void {
    this.userForm.controls.address.valueChanges
      .pipe(
        debounceTime(200),
        distinctUntilChanged(),
        switchMap((query) => {
          const q = (query || '').toString().trim();
          if (!this.addressHasFocus) {
            this.addressSuggestions = [];
            this.showAddressSuggestions = false;
            this.addressActiveIndex = -1;
            return of([]);
          }
          if (q.length < 3) {
            this.addressSuggestions = [];
            this.showAddressSuggestions = false;
            this.addressActiveIndex = -1;
            return of([]);
          }

          if (!this.addressSessionToken) {
            this.addressSessionToken = this.createSessionToken();
          }

          return this.townPlanner.suggestAddresses(q, this.addressSessionToken);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe((sugs) => {
        this.addressSuggestions = sugs || [];
        const shouldShow =
          this.addressHasFocus && this.addressSuggestions.length > 0;
        this.showAddressSuggestions = shouldShow;
        this.addressActiveIndex = shouldShow ? 0 : -1;
      });
  }

  private createSessionToken(): string {
    const cryptoObj = globalThis.crypto as Crypto | undefined;
    if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
    return Math.random().toString(36).slice(2);
  }
}
