import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Store } from '@ngrx/store';
import { combineLatest, Observable, Subject } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  map,
  startWith,
  takeUntil,
} from 'rxjs/operators';

import { ManagerActions } from '../../store/manager.actions';
import {
  selectManagerSearchQuery,
  selectManagerUsers,
  selectManagerUsersError,
  selectManagerUsersLoading,
  selectManagerUsersTotal,
  selectManagerUsersViewMode,
  selectManagerEditingUser,
} from '../../store/manager.selectors';

import type { BmUser } from '../../services/manager.service';

@Component({
  selector: 'app-manager-users-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
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

  searchQuery$ = this.store.select(selectManagerSearchQuery);
  searchCtrl: FormControl<string>;
  filteredUsers$!: Observable<BmUser[]>;

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
          ManagerActions.setSearchQuery({ query: query || '' }),
        ),
      );

    this.editingUser$.pipe(takeUntil(this.destroy$)).subscribe((u) => {
      if (!u) return;

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
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  trackByUser = (_: number, u: BmUser) => u.id;

  openCreate(): void {
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

  archiveUser(u: BmUser): void {
    const ok = window.confirm(
      `Archive user "${u.username}"?\n\nThis is a soft-delete (status = archived).`,
    );
    if (!ok) return;

    this.store.dispatch(ManagerActions.archiveUser({ userId: u.id }));
  }
}
