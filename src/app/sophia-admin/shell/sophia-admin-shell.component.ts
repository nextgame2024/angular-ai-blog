import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Store } from '@ngrx/store';
import { switchMap } from 'rxjs';

import { authActions } from '../../auth/store/actions';
import { AdminStatePanelComponent } from '../shared/admin-state-panel.component';
import { SOPHIA_ADMIN_MODULES } from '../sophia-admin.modules';
import { SophiaAdminService } from '../sophia-admin.service';
import type {
  SophiaAdminOrganisation,
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

  readonly modules = SOPHIA_ADMIN_MODULES;
  readonly principal = signal<SophiaAdminPrincipal | null>(null);
  readonly organisation = signal<SophiaAdminOrganisation | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly displayName = computed(
    () => this.organisation()?.metadata?.branding?.displayName
      || this.organisation()?.name
      || 'Sophia Admin',
  );

  ngOnInit(): void {
    this.admin.context().pipe(
      switchMap(({ principal }) => {
        this.principal.set(principal);
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
