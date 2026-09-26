import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, switchMap } from 'rxjs';

import { adminErrorMessage, hasRecentMfa, humanizeKey } from '../shared/admin-operation.utils';
import { AdminStatePanelComponent } from '../shared/admin-state-panel.component';
import { SophiaAdminService } from '../sophia-admin.service';
import type {
  SophiaAdminInvitation,
  SophiaAdminInvitationReceipt,
  SophiaAdminMember,
  SophiaAdminPermissionRegistry,
  SophiaAdminPrincipal,
  SophiaAdminRole,
} from '../sophia-admin.types';

@Component({
  selector: 'app-users-admin-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AdminStatePanelComponent],
  templateUrl: './users-admin.page.html',
  styleUrls: ['./users-admin.page.css'],
})
export class UsersAdminPage implements OnInit {
  private readonly admin = inject(SophiaAdminService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);

  readonly principal = signal<SophiaAdminPrincipal | null>(null);
  readonly members = signal<SophiaAdminMember[]>([]);
  readonly invitations = signal<SophiaAdminInvitation[]>([]);
  readonly registry = signal<SophiaAdminPermissionRegistry | null>(null);
  readonly loading = signal(true);
  readonly savingId = signal('');
  readonly error = signal('');
  readonly notice = signal('');
  readonly receipt = signal<SophiaAdminInvitationReceipt | null>(null);
  readonly roles = computed(() => this.registry()?.roles ?? []);
  readonly inviteForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(320)]],
    role: ['configuration_editor' as SophiaAdminRole, Validators.required],
    expiresInHours: [48, [Validators.required, Validators.min(1), Validators.max(168)]],
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.admin.context().pipe(
      switchMap(({ principal }) => {
        this.principal.set(principal);
        return forkJoin({
          members: this.admin.listMembers(principal.tenantId),
          invitations: this.admin.listInvitations(principal.tenantId),
          registry: this.admin.permissionRegistry(principal.tenantId),
        });
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: ({ members, invitations, registry }) => {
        this.members.set(members.members);
        this.invitations.set(invitations.invitations);
        this.registry.set(registry);
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(adminErrorMessage(error, 'Membership administration could not be loaded.'));
        this.loading.set(false);
      },
    });
  }

  can(permission: string): boolean {
    return this.principal()?.permissions.includes(permission) ?? false;
  }

  get privilegedReady(): boolean {
    return hasRecentMfa(this.principal()?.mfaVerifiedAt);
  }

  get canMutateMemberships(): boolean {
    return this.can('users.manage') && this.can('users.roles.assign') && this.privilegedReady;
  }

  issueInvitation(): void {
    const principal = this.principal();
    if (!principal || this.inviteForm.invalid || !this.can('users.invite') || !this.can('users.roles.assign') || !this.privilegedReady) {
      this.inviteForm.markAllAsTouched();
      return;
    }
    this.savingId.set('invitation:new');
    this.error.set('');
    this.receipt.set(null);
    const value = this.inviteForm.getRawValue();
    this.admin.issueInvitation(principal.tenantId, {
      email: value.email.trim().toLowerCase(), role: value.role, expiresInHours: Number(value.expiresInHours),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (receipt) => {
        this.receipt.set(receipt);
        this.notice.set('Dry-run invitation created and audited. Copy the token now; it is not available from the invitation list.');
        this.inviteForm.reset({ email: '', role: 'configuration_editor', expiresInHours: 48 });
        this.savingId.set('');
        this.reloadLists();
      },
      error: (error) => this.operationFailed(error, 'The invitation could not be created.'),
    });
  }

  updateRole(member: SophiaAdminMember, role: string): void {
    if (!this.canMutateMemberships || this.isSelf(member) || !this.isRole(role) || role === member.role_key) return;
    this.updateMember(member, { role }, `Role changed to ${this.label(role)}.`);
  }

  updateStatus(member: SophiaAdminMember, status: string): void {
    if (!this.canMutateMemberships || this.isSelf(member) || !['active', 'suspended', 'revoked'].includes(status) || status === member.status) return;
    this.updateMember(member, { status: status as SophiaAdminMember['status'] }, `Membership status changed to ${status}.`);
  }

  revoke(invitation: SophiaAdminInvitation): void {
    const principal = this.principal();
    if (!principal || invitation.status !== 'pending' || !this.can('users.invite')) return;
    this.savingId.set(invitation.invitation_id);
    this.error.set('');
    this.admin.revokeInvitation(principal.tenantId, invitation.invitation_id, invitation.revision)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.notice.set('Invitation revoked and recorded in the Admin audit trail.');
          this.savingId.set('');
          this.reloadLists();
        },
        error: (error) => this.operationFailed(error, 'The invitation could not be revoked.'),
      });
  }

  isSelf(member: SophiaAdminMember): boolean {
    return member.membership_id === this.principal()?.membershipId;
  }

  label(value: string): string {
    return humanizeKey(value);
  }

  trackPermission(_index: number, permission: string): string {
    return permission;
  }

  private updateMember(
    member: SophiaAdminMember,
    change: { role?: SophiaAdminRole; status?: SophiaAdminMember['status'] },
    notice: string,
  ): void {
    const principal = this.principal()!;
    this.savingId.set(member.membership_id);
    this.error.set('');
    this.admin.updateMember(principal.tenantId, member.membership_id, {
      expectedRevision: member.authorization_revision, ...change,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.notice.set(`${notice} The change was recorded in the Admin audit trail.`);
        this.savingId.set('');
        this.reloadLists();
      },
      error: (error) => {
        this.operationFailed(error, 'The membership could not be updated.');
        this.reloadLists();
      },
    });
  }

  private reloadLists(): void {
    const principal = this.principal();
    if (!principal) return;
    forkJoin({
      members: this.admin.listMembers(principal.tenantId),
      invitations: this.admin.listInvitations(principal.tenantId),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ members, invitations }) => {
        this.members.set(members.members);
        this.invitations.set(invitations.invitations);
      },
      error: (error) => this.error.set(adminErrorMessage(error, 'The updated lists could not be reloaded.')),
    });
  }

  private operationFailed(error: unknown, fallback: string): void {
    this.error.set(adminErrorMessage(error, fallback));
    this.savingId.set('');
  }

  private isRole(value: string): value is SophiaAdminRole {
    return this.roles().some((item) => item.role === value);
  }
}
