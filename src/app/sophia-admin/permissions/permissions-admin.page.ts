import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, switchMap } from 'rxjs';

import { adminErrorMessage, humanizeKey } from '../shared/admin-operation.utils';
import { AdminStatePanelComponent } from '../shared/admin-state-panel.component';
import { SophiaAdminService } from '../sophia-admin.service';
import type { SophiaAdminMember, SophiaAdminPermissionRegistry, SophiaAdminPrincipal } from '../sophia-admin.types';

@Component({
  selector: 'app-permissions-admin-page',
  standalone: true,
  imports: [CommonModule, AdminStatePanelComponent],
  templateUrl: './permissions-admin.page.html',
  styleUrls: ['./permissions-admin.page.css'],
})
export class PermissionsAdminPage implements OnInit {
  private readonly admin = inject(SophiaAdminService);
  private readonly destroyRef = inject(DestroyRef);

  readonly principal = signal<SophiaAdminPrincipal | null>(null);
  readonly registry = signal<SophiaAdminPermissionRegistry | null>(null);
  readonly members = signal<SophiaAdminMember[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly tenantPermissions = computed(() => {
    const registry = this.registry();
    if (!registry) return [];
    const platform = new Set(registry.platformPermissions);
    return registry.permissions.filter((permission) => !platform.has(permission));
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
          registry: this.admin.permissionRegistry(principal.tenantId),
          members: this.admin.listMembers(principal.tenantId),
        });
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: ({ registry, members }) => {
        this.registry.set(registry);
        this.members.set(members.members);
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(adminErrorMessage(error, 'The permission registry could not be loaded.'));
        this.loading.set(false);
      },
    });
  }

  grants(role: string, permission: string): boolean {
    return this.registry()?.roles.find((item) => item.role === role)?.permissions.includes(permission) ?? false;
  }

  isMfa(permission: string): boolean {
    return this.registry()?.mfaRequiredPermissions.includes(permission) ?? false;
  }

  label(value: string): string {
    return humanizeKey(value);
  }
}
