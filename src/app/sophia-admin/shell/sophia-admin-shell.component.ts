import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Store } from '@ngrx/store';
import { switchMap } from 'rxjs';

import { authActions } from '../../auth/store/actions';
import { AdminStatePanelComponent } from '../shared/admin-state-panel.component';
import { SOPHIA_ADMIN_MODULES } from '../sophia-admin.modules';
import { SophiaAdminService } from '../sophia-admin.service';
import type {
  SophiaAdminOrganisation,
  SophiaAdminOrganisationContext,
  SophiaAdminPrincipal,
} from '../sophia-admin.types';

@Component({
  selector: 'app-sophia-admin-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    AdminStatePanelComponent,
  ],
  templateUrl: './sophia-admin-shell.component.html',
  styleUrls: ['./sophia-admin-shell.component.css'],
})
export class SophiaAdminShellComponent implements OnInit {
  private readonly admin = inject(SophiaAdminService);
  private readonly store = inject(Store);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  readonly modules = SOPHIA_ADMIN_MODULES;
  readonly principal = signal<SophiaAdminPrincipal | null>(null);
  readonly organisation = signal<SophiaAdminOrganisation | null>(null);
  readonly organisations = signal<SophiaAdminOrganisationContext[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly displayName = computed(
    () => this.organisation()?.metadata?.branding?.displayName
      || this.organisation()?.name
      || 'Sophia Admin',
  );

  ngOnInit(): void {
    this.admin.context().pipe(
      switchMap(({ principal, organisations }) => {
        this.principal.set(principal);
        this.organisations.set(organisations ?? []);
        return this.admin.getOrganisation(principal.tenantId);
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (organisation) => {
        this.organisation.set(organisation);
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(adminErrorMessage(error));
        this.loading.set(false);
      },
    });
  }

  hasPermission(permission: string): boolean {
    return this.principal()?.permissions.includes(permission) ?? false;
  }

  canSwitchOrganisation(): boolean {
    return this.principal()?.authorityType === 'platform' && this.organisations().length > 1;
  }

  selectOrganisation(tenantId: string): void {
    if (!tenantId || tenantId === this.principal()?.tenantId) return;
    this.loading.set(true);
    this.error.set('');
    this.principal.set(null);
    this.organisation.set(null);
    this.admin.selectOrganisation(tenantId).pipe(
      switchMap(({ principal, organisations }) => {
        this.principal.set(principal);
        this.organisations.set(organisations ?? []);
        return this.admin.getOrganisation(principal.tenantId);
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (organisation) => {
        this.organisation.set(organisation);
        void this.router.navigate(['/sophia-admin/overview']).finally(() => this.loading.set(false));
      },
      error: (error) => {
        this.error.set(adminErrorMessage(error));
        this.loading.set(false);
      },
    });
  }

  signOut(): void {
    this.admin.clearContext();
    this.principal.set(null);
    this.organisation.set(null);
    this.store.dispatch(authActions.logout());
  }
}

function adminErrorMessage(error: unknown): string {
  const candidate = error as { error?: { message?: string | string[] }; message?: string };
  const message = candidate.error?.message;
  return Array.isArray(message)
    ? message.join(' ')
    : message || candidate.message || 'The Sophia Admin context could not be loaded.';
}
