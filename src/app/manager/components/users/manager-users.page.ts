import { PageJumpComponent } from '../../../shared/components/page-jump/page-jump.component';
import { ListNavigationStateService } from '../../../shared/services/list-navigation-state.service';
import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, inject } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { Subject, of } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
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
  selectManagerUsersLimit,
  selectManagerUsersViewMode,
  selectManagerEditingUser,
} from '../../store/manager.selectors';

import { TownPlannerV2Service } from '../../../townplanner/services/townplanner_v2.service';
import { TownPlannerV2AddressSuggestion } from '../../../townplanner/store/townplanner_v2.state';
import { AvatarUploadService } from '../../../settings/components/settings/services/avatar-upload.service';
import {
  ManagerSelectComponent,
  type ManagerSelectOption,
} from '../shared/manager-select/manager-select.component';
import { selectCurrentUser } from '../../../auth/store/reducers';
import type { CurrentUserInterface } from '../../../shared/types/currentUser.interface';
import { ManagerCompanyService } from '../../services/manager.company.service';
import { ManagerSitesService } from '../../services/manager.sites.service';
import { NavigationLinksProjectsService } from '../../services/navigation.links.projects.service';

import type { BmUser, BmUserSort, BmUserSortDirection } from '../../services/manager.service';
import { ManagerService } from '../../services/manager.service';
import { StudentOperationsService } from '../../student-operations/student-operations.service';

@Component({
    selector: 'app-manager-users-page',
    imports: [PageJumpComponent, CommonModule, ReactiveFormsModule, RouterModule, ManagerSelectComponent],
    templateUrl: './manager-users.page.html',
    styleUrls: ['./manager-users.page.css']
})
export class ManagerUsersPageComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private readonly navigationState = inject(ListNavigationStateService);
  private readonly superAdminId = 'c2dad143-077c-4082-92f0-47805601db3b';

  loading$ = this.store.select(selectManagerUsersLoading);
  error$ = this.store.select(selectManagerUsersError);
  usersRaw$ = this.store.select(selectManagerUsers);
  total$ = this.store.select(selectManagerUsersTotal);
  viewMode$ = this.store.select(selectManagerUsersViewMode);
  editingUser$ = this.store.select(selectManagerEditingUser);
  page$ = this.store.select(selectManagerUsersPage);

  searchQuery$ = this.store.select(selectManagerUsersSearchQuery);
  searchCtrl: FormControl<string>;
  readonly pageSizeOptions: ManagerSelectOption[] = [
    { value: '25', label: '25 per page' },
    { value: '50', label: '50 per page' },
    { value: '100', label: '100 per page' },
  ];
  pageSizeCtrl = new FormControl('25', { nonNullable: true });
  currentPage = 1;
  pageLimit = 25;
  totalUsers = 0;
  isLoading = false;
  userSort: BmUserSort = 'name';
  userSortDirection: BmUserSortDirection = 'asc';
  private closeAfterSave = false;
  private editingUserId: string | null = null;
  dismissedErrors = new Set<string>();
  isConfirmModalOpen = false;
  confirmModalTitle = '';
  confirmModalMessage = '';
  confirmModalConfirmLabel = 'Continue';
  confirmModalCancelLabel = 'Cancel';
  confirmModalShowCancel = false;
  confirmModalTone: 'info' | 'warning' | 'danger' = 'info';
  private confirmModalConfirmAction: (() => void) | null = null;
  private confirmModalCancelAction: (() => void) | null = null;
  currentUser: CurrentUserInterface | null = null;
  isSuperAdmin = false;
  companyOptions: ManagerSelectOption[] = [];
  siteOptions: ManagerSelectOption[] = [];
  showSiteField = false;
  selectedCompanyWorkspaceProfile = '';
  private companyWorkspaceProfiles = new Map<string, string>();
  roleAdministrationError = '';
  canAdministerStudentOperationsRoles = false;
  roleAuthorityResolved = false;
  private roleAuthorityUserId = '';
  readonly businessPackRoleOptions: ManagerSelectOption[] = [
    { value: '', label: 'No student operations role' },
    { value: 'chief_executive', label: 'Chief Executive' },
    { value: 'operations', label: 'Operations' },
    { value: 'advisor', label: 'Advisor' },
  ];
  private pendingRoleAssignment: { companyId: string; roleKey: string | null } | null = null;
  private readonly studentOperationsPackId = 'student-operations';

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
    { value: 'employee', label: 'Employee' },
    { value: 'supplier', label: 'Supplier' },
    { value: 'client', label: 'Client' },
    { value: 'student', label: 'Student' },
    { value: 'advisor', label: 'Advisor' },
  ];

  defaultAvatar =
    'https://files-nodejs-api.s3.ap-southeast-2.amazonaws.com/public/avatar-user.png';
  previewUrl: string | null = null;
  selectedFile?: File;
  isUploadingAvatar = false;
  uploadError: string | null = null;

  userForm = this.fb.group({
    companyId: [''],
    siteId: [''],
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
    businessPackRole: [''],
    studentId: [''],
    studentNameInXero: [''],
  });

  constructor(
    private store: Store,
    private fb: FormBuilder,
    private townPlanner: TownPlannerV2Service,
    private avatarUpload: AvatarUploadService,
    private companyApi: ManagerCompanyService,
    private managerApi: ManagerService,
    private sitesApi: ManagerSitesService,
    private navigationLinksApi: NavigationLinksProjectsService,
    private actions$: Actions,
    private studentOperationsApi: StudentOperationsService,
    private host: ElementRef<HTMLElement>,
  ) {
    this.searchCtrl = this.fb.control('', { nonNullable: true });

    this.page$.pipe(takeUntil(this.destroy$)).subscribe((page) => {
      this.currentPage = page || 1;
    });
    this.total$.pipe(takeUntil(this.destroy$)).subscribe((total) => {
      this.totalUsers = total || 0;
    });
    this.loading$.pipe(takeUntil(this.destroy$)).subscribe((loading) => {
      this.isLoading = loading;
    });
    this.store.select(selectManagerUsersLimit).pipe(takeUntil(this.destroy$)).subscribe((limit) => {
      this.pageLimit = limit || 25;
      this.pageSizeCtrl.setValue(String(this.pageLimit), { emitEvent: false });
    });

    this.actions$
      .pipe(
        ofType(ManagerActions.saveUserSuccess, ManagerActions.saveUserFailure),
        takeUntil(this.destroy$),
      )
      .subscribe((action) => {
        if (action.type === ManagerActions.saveUserSuccess.type) {
          this.finishRoleAssignment(action.user);
          return;
        }
        this.pendingRoleAssignment = null;
        this.closeAfterSave = false;
      });
  }

  ngOnInit(): void {
    const saved = this.navigationState.read<{ page: number; limit: number; sort: BmUserSort; direction: BmUserSortDirection }>('users');
    if (saved) { this.userSort = saved.sort; this.userSortDirection = saved.direction; }
    let initialSearch = true;
    this.store
      .select(selectCurrentUser)
      .pipe(takeUntil(this.destroy$))
      .subscribe((user) => {
        const wasSuperAdmin = this.isSuperAdmin;
        this.currentUser = user ?? null;
        this.isSuperAdmin = user?.id === this.superAdminId;
        if (!this.isSuperAdmin) {
          this.selectedCompanyWorkspaceProfile = user?.workspaceProfile ?? '';
          this.loadSiteLinkVisibility(user?.companyId ?? '');
        }
        this.syncCompanyControlRules();
        this.resolveRoleAdministrationAuthority(user ?? null);
        if (this.isSuperAdmin && !wasSuperAdmin) {
          this.loadCompaniesForSuperAdmin();
        }
        if (!this.isSuperAdmin && user?.companyId) {
          this.loadSitesForCompany();
        }
      });

    this.searchQuery$.pipe(takeUntil(this.destroy$)).subscribe((query) => {
      if (this.searchCtrl.value !== (query || '')) {
        this.searchCtrl.setValue(query || '', { emitEvent: false });
      }
      this.store.dispatch(ManagerActions.loadUsers({ page: initialSearch ? (saved?.page ?? this.currentPage) : 1, limit: initialSearch ? (saved?.limit ?? this.pageLimit) : this.pageLimit, sort: this.userSort, direction: this.userSortDirection }));
      initialSearch = false;
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
    this.pageSizeCtrl.valueChanges.pipe(distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((value) => this.store.dispatch(ManagerActions.loadUsers({ page: 1, limit: Number(value), sort: this.userSort, direction: this.userSortDirection })));
    this.actions$.pipe(ofType(ManagerActions.saveUserSuccess, ManagerActions.archiveUserSuccess), takeUntil(this.destroy$))
      .subscribe(() => this.store.dispatch(ManagerActions.loadUsers({ page: Math.min(this.currentPage, this.totalPages), sort: this.userSort, direction: this.userSortDirection })));

    this.editingUser$.pipe(takeUntil(this.destroy$)).subscribe((u) => {
      this.editingUserId = u?.id ?? null;
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
        companyId: u.companyId ?? '',
        siteId: u.siteId ?? '',
        type: u.type ?? 'employee',
        status: u.status ?? 'active',
        image: u.image ?? '',
        bio: u.bio ?? '',
        businessPackRole: '',
        studentId: u.studentId ?? '',
        studentNameInXero: u.studentNameInXero ?? '',
      });
      if (this.isSuperAdmin) {
        this.selectedCompanyWorkspaceProfile = u.workspaceProfile
          || this.companyWorkspaceProfiles.get(u.companyId || '')
          || '';
        this.loadSiteLinkVisibility(u.companyId || '');
      }
      if (this.isSuperAdmin) {
        this.loadSitesForCompany(u.companyId ?? undefined);
        this.userForm.controls.siteId.setValue(u.siteId ?? '', {
          emitEvent: false,
        });
      }
      if (this.canAdministerStudentOperationsRoles) this.loadBusinessPackRole(u);

      this.userForm.controls.password.clearValidators();
      this.userForm.controls.password.setValidators([Validators.minLength(8)]);
      this.userForm.controls.password.updateValueAndValidity({
        emitEvent: false,
      });
    });

    this.setupAddressAutocomplete();

    this.userForm.controls.companyId.valueChanges
      .pipe(distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((companyId) => {
        if (!this.isSuperAdmin) return;
        this.userForm.controls.siteId.setValue('', { emitEvent: false });
        this.userForm.controls.businessPackRole.setValue('', { emitEvent: false });
        this.roleAdministrationError = '';
        this.selectedCompanyWorkspaceProfile = this.companyWorkspaceProfiles.get(companyId || '') || '';
        this.loadSiteLinkVisibility(companyId || '');
        this.loadSitesForCompany(companyId || undefined);
      });
  }

  ngOnDestroy(): void {
    this.navigationState.save('users', { page: this.currentPage, limit: this.pageLimit, sort: this.userSort, direction: this.userSortDirection });
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
    this.editingUserId = null;
    this.scrollContentToTop();
    this.resetAvatarState();
    this.roleAdministrationError = '';
    const defaultCompanyId = this.isSuperAdmin
      ? (this.companyOptions[0]?.value ?? '')
      : '';
    this.userForm.reset({
      companyId: defaultCompanyId,
      siteId: '',
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
      businessPackRole: '',
      studentId: '',
      studentNameInXero: '',
    });

    this.userForm.controls.password.clearValidators();
    this.userForm.controls.password.setValidators([
      Validators.required,
      Validators.minLength(8),
    ]);
    this.userForm.controls.password.updateValueAndValidity({
      emitEvent: false,
    });
    this.syncCompanyControlRules();

    this.store.dispatch(ManagerActions.openUserCreate());
  }

  openEdit(u: BmUser): void {
    this.roleAdministrationError = '';
    this.store.dispatch(ManagerActions.openUserEdit({ userId: u.id }));
    this.scrollContentToTop();
  }

  closeForm(): void {
    this.store.dispatch(ManagerActions.closeUserForm());
    this.scrollContentToTop();
  }

  saveUser(): void {
    if (!this.ensureAvatarUploadComplete()) return;

    if (this.userForm.controls.type.value === 'advisor'
      && this.canAdministerStudentOperationsRoles
      && this.editingUserId === this.currentUser?.id) {
      this.roleAdministrationError = 'You cannot change your own Chief Executive role to Advisor.';
      this.closeAfterSave = false;
      return;
    }

    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    const payload: any = this.userForm.getRawValue();
    const selectedRole = String(payload.businessPackRole || '').trim();
    delete payload.businessPackRole;
    delete payload.studentId;

    if (!payload.password) delete payload.password;
    if (!this.showSiteField) delete payload.siteId;
    else if (!payload.siteId) payload.siteId = null;
    if (!this.showStudentNameInXero) delete payload.studentNameInXero;

    if (this.isSuperAdmin) {
      payload.companyId = String(payload.companyId || '').trim();
      if (!payload.companyId) {
        this.userForm.controls.companyId.markAsTouched();
        return;
      }
    } else {
      // Non-super admins are always scoped to their own company by backend.
      delete payload.company_id;
      delete payload.companyId;
    }
    const roleCompanyId = this.isSuperAdmin
      ? String(payload.companyId || '').trim()
      : String(this.currentUser?.companyId || '').trim();
    this.pendingRoleAssignment = payload.type !== 'advisor'
      && this.canAdministerStudentOperationsRoles
      && this.selectedCompanyUsesStudentOperations()
      && roleCompanyId === this.currentUser?.companyId
      ? { companyId: roleCompanyId, roleKey: selectedRole || null }
      : null;

    this.store.dispatch(ManagerActions.saveUser({ payload }));
  }

  saveUserAndClose(): void {
    if (!this.ensureAvatarUploadComplete()) return;

    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }
    this.closeAfterSave = true;
    this.saveUser();
  }

  archiveUser(u: BmUser): void {
    if (this.isArchiveDisabled(u)) return;

    const displayName = u.name || u.username || 'User';
    const hasProcesses = !!u.hasProcesses;
    this.openConfirmModal({
      title: hasProcesses ? 'Archive User?' : 'Delete User?',
      message: hasProcesses
        ? `"${displayName}" user is linked to existing processes, so it cannot be deleted. Would you like to archive it instead?`
        : `Are you sure you want to delete "${displayName}"?`,
      tone: hasProcesses ? 'warning' : 'danger',
      confirmLabel: hasProcesses ? 'Archive' : 'Delete',
      onConfirm: () =>
        this.store.dispatch(ManagerActions.archiveUser({ userId: u.id })),
    });
  }

  isArchiveDisabled(u: BmUser): boolean {
    return (u.status ?? 'active') === 'archived';
  }

  formatUserType(type?: string | null): string {
    const normalized = String(type || '').trim().toLowerCase();
    const match = this.typeOptions.find((option) => option.value === normalized);
    return match?.label || '—';
  }

  get avatarSrc(): string {
    return this.previewUrl || this.userForm.controls.image.value || this.defaultAvatar;
  }

  selectedCompanyUsesStudentOperations(): boolean {
    return this.selectedCompanyWorkspaceProfile === 'student_operations';
  }

  get showStudentOperationsRole(): boolean {
    return this.selectedCompanyUsesStudentOperations()
      && this.userForm.controls.type.value !== 'advisor'
      && this.canAdministerStudentOperationsRoles
      && (!this.isSuperAdmin
        || this.userForm.controls.companyId.value === this.currentUser?.companyId);
  }

  get showStudentNameInXero(): boolean {
    return this.selectedCompanyUsesStudentOperations()
      && this.userForm.controls.type.value === 'student';
  }

  get showStudentId(): boolean {
    return this.userForm.controls.type.value === 'student'
      || !!this.userForm.controls.studentId.value;
  }

  private resolveRoleAdministrationAuthority(user: CurrentUserInterface | null): void {
    const userId = user?.id || '';
    if (this.roleAuthorityUserId === userId && this.roleAuthorityResolved) return;
    this.roleAuthorityUserId = userId;
    this.canAdministerStudentOperationsRoles = false;
    this.roleAuthorityResolved = !userId;
    if (!userId) return;

    this.studentOperationsApi.workspace().pipe(take(1)).subscribe({
      next: (workspace) => {
        if (this.roleAuthorityUserId !== userId) return;
        this.canAdministerStudentOperationsRoles = workspace.role === 'chief_executive';
        this.roleAuthorityResolved = true;
        if (this.canAdministerStudentOperationsRoles) {
          this.editingUser$.pipe(take(1)).subscribe((editing) => {
            if (editing) this.loadBusinessPackRole(editing);
          });
        }
      },
      error: () => {
        if (this.roleAuthorityUserId !== userId) return;
        this.roleAuthorityResolved = true;
      },
    });
  }

  private scrollContentToTop(): void {
    requestAnimationFrame(() => {
      const content = this.host.nativeElement.closest('.content');
      content?.scrollTo({ top: 0, behavior: 'auto' });
    });
  }

  get totalPages(): number { return Math.max(1, Math.ceil(this.totalUsers / this.pageLimit)); }
  get pageStart(): number { return this.totalUsers ? (this.currentPage - 1) * this.pageLimit + 1 : 0; }
  get pageEnd(): number { return Math.min(this.currentPage * this.pageLimit, this.totalUsers); }

  sortUsersBy(sort: BmUserSort): void {
    if (this.isLoading) return;
    this.userSortDirection = this.userSort === sort && this.userSortDirection === 'asc' ? 'desc' : 'asc';
    this.userSort = sort;
    this.store.dispatch(ManagerActions.loadUsers({ page: 1, sort, direction: this.userSortDirection }));
  }

  userSortAria(sort: BmUserSort): 'ascending' | 'descending' | 'none' {
    if (this.userSort !== sort) return 'none';
    return this.userSortDirection === 'asc' ? 'ascending' : 'descending';
  }

  goToPage(page: number): void {
    if (this.isLoading) return;
    const target = Math.max(1, Math.min(page, this.totalPages));
    if (target === this.currentPage) return;
    this.store.dispatch(ManagerActions.loadUsers({ page: target, sort: this.userSort, direction: this.userSortDirection }));
    this.scrollContentToTop();
  }

  private openConfirmModal(options: {
    title: string;
    message: string;
    tone?: 'info' | 'warning' | 'danger';
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel?: () => void;
  }): void {
    this.confirmModalTitle = options.title;
    this.confirmModalMessage = options.message;
    this.confirmModalTone = options.tone ?? 'info';
    this.confirmModalConfirmLabel = options.confirmLabel ?? 'Continue';
    this.confirmModalCancelLabel = options.cancelLabel ?? 'Cancel';
    this.confirmModalShowCancel = true;
    this.confirmModalConfirmAction = options.onConfirm;
    this.confirmModalCancelAction = options.onCancel ?? null;
    this.isConfirmModalOpen = true;
  }

  onConfirmModalConfirm(): void {
    const action = this.confirmModalConfirmAction;
    this.closeConfirmModal();
    action?.();
  }

  onConfirmModalCancel(): void {
    const action = this.confirmModalCancelAction;
    this.closeConfirmModal();
    action?.();
  }

  onConfirmModalBackdrop(): void {
    if (this.confirmModalShowCancel) {
      this.onConfirmModalCancel();
    } else {
      this.onConfirmModalConfirm();
    }
  }

  private closeConfirmModal(): void {
    this.isConfirmModalOpen = false;
    this.confirmModalConfirmAction = null;
    this.confirmModalCancelAction = null;
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
    this.avatarUpload
      .uploadViaPresigned(this.selectedFile)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ url }) => {
          const uploadedUrl = String(url || '').trim();
          if (!uploadedUrl) {
            this.uploadError = 'Image upload completed but no image URL was returned.';
            this.isUploadingAvatar = false;
            return;
          }

          this.userForm.controls.image.setValue(uploadedUrl);
          this.userForm.controls.image.markAsDirty();
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

  private ensureAvatarUploadComplete(): boolean {
    if (this.isUploadingAvatar) {
      this.uploadError = 'Please wait until the image upload finishes before saving.';
      return false;
    }

    if (this.selectedFile) {
      this.uploadError =
        this.uploadError ||
        'Image upload did not finish. Please upload the image again before saving.';
      return false;
    }

    return true;
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

  private syncCompanyControlRules(): void {
    const ctrl = this.userForm.controls.companyId;
    if (this.isSuperAdmin) {
      ctrl.setValidators([Validators.required]);
    } else {
      ctrl.clearValidators();
      ctrl.setValue('', { emitEvent: false });
    }
    ctrl.updateValueAndValidity({ emitEvent: false });
  }

  private loadCompaniesForSuperAdmin(): void {
    this.companyApi
      .listCompanies({ page: 1, limit: 100 })
      .pipe(take(1))
      .subscribe({
        next: ({ items }) => {
          this.companyOptions = (items || []).map((company) => ({
            value: company.companyId,
            label: company.companyName || company.companyId,
          }));
          this.companyWorkspaceProfiles = new Map(
            (items || []).map((company) => [company.companyId, company.workspaceProfile || '']),
          );
          this.selectedCompanyWorkspaceProfile = this.companyWorkspaceProfiles.get(
            this.userForm.controls.companyId.value || '',
          ) || '';
          this.loadSiteLinkVisibility(this.userForm.controls.companyId.value || '');
          if (
            this.isSuperAdmin &&
            !this.userForm.controls.companyId.value &&
            this.companyOptions.length
          ) {
            this.userForm.controls.companyId.setValue(this.companyOptions[0].value);
          }
          if (this.isSuperAdmin) {
            this.loadSitesForCompany(this.userForm.controls.companyId.value || undefined);
          }
          this.editingUser$.pipe(take(1)).subscribe((editing) => {
            if (editing) this.loadBusinessPackRole(editing);
          });
        },
        error: () => {
          this.companyOptions = [];
        },
      });
  }

  private loadSitesForCompany(companyId?: string): void {
    this.sitesApi
      .listSites({
        page: 1,
        limit: 100,
        status: 'active',
        companyId: this.isSuperAdmin ? companyId : undefined,
      })
      .pipe(take(1))
      .subscribe({
        next: ({ items }) => {
          this.siteOptions = (items || []).map((site) => ({
            value: site.siteId,
            label: site.siteName,
          }));
          const currentSiteId = this.userForm.controls.siteId.value;
          if (
            currentSiteId &&
            !this.siteOptions.some((option) => option.value === currentSiteId)
          ) {
            this.userForm.controls.siteId.setValue('', { emitEvent: false });
          }
        },
        error: () => {
          this.siteOptions = [];
          this.userForm.controls.siteId.setValue('', { emitEvent: false });
        },
      });
  }

  private loadSiteLinkVisibility(companyId: string): void {
    this.showSiteField = false;
    if (!companyId) return;
    this.navigationLinksApi.listNavigationLinks({
      page: 1, limit: 100, companyId, navigationType: 'menu', active: true,
    }).pipe(take(1)).subscribe({
      next: ({ items }) => {
        const selectedCompanyId = this.isSuperAdmin
          ? this.userForm.controls.companyId.value
          : this.currentUser?.companyId;
        if (selectedCompanyId !== companyId) return;
        this.showSiteField = items.some((link) =>
          link.companyId === companyId
          && link.navigationLabel.trim().toLowerCase() === 'sites',
        );
      },
      error: () => { this.showSiteField = false; },
    });
  }

  private loadBusinessPackRole(user: BmUser): void {
    const companyId = user.companyId || '';
    if (
      !this.canAdministerStudentOperationsRoles
      || !companyId
      || companyId !== this.currentUser?.companyId
    ) {
      this.userForm.controls.businessPackRole.setValue('', { emitEvent: false });
      return;
    }
    this.managerApi.getBusinessPackAssignment({
      companyId,
      userId: user.id,
      packId: this.studentOperationsPackId,
    }).pipe(take(1)).subscribe({
      next: (assignment) => {
        const role = assignment?.status === 'active' ? assignment.roleKey || '' : '';
        this.userForm.controls.businessPackRole.setValue(role, { emitEvent: false });
      },
      error: () => {
        this.roleAdministrationError = 'The student operations role could not be loaded.';
      },
    });
  }

  private finishRoleAssignment(user: BmUser): void {
    const pending = this.pendingRoleAssignment;
    this.pendingRoleAssignment = null;
    if (!pending) {
      const shouldClose = this.closeAfterSave;
      this.closeAfterSave = false;
      if (shouldClose) this.closeForm();
      return;
    }
    this.managerApi.setBusinessPackAssignment({
      companyId: pending.companyId,
      userId: user.id,
      packId: this.studentOperationsPackId,
      roleKey: pending.roleKey,
    }).pipe(take(1)).subscribe({
      next: () => {
        this.roleAdministrationError = '';
        const shouldClose = this.closeAfterSave;
        this.closeAfterSave = false;
        if (shouldClose) this.closeForm();
      },
      error: (error) => {
        this.closeAfterSave = false;
        this.roleAdministrationError = error?.error?.error
          || error?.message
          || 'The user was saved, but the business-pack role could not be updated.';
      },
    });
  }
}
