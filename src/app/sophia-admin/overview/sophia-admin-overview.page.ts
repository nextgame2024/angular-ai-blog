import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { AdminPaginationComponent } from '../shared/admin-pagination.component';
import { AdminStatePanelComponent } from '../shared/admin-state-panel.component';
import { AdminTableComponent } from '../shared/admin-table.component';
import { SOPHIA_ADMIN_MODULES } from '../sophia-admin.modules';
import { SophiaAdminService } from '../sophia-admin.service';
import type { AdminOnboardingReadiness, SophiaAdminPrincipal } from '../sophia-admin.types';

@Component({
  selector: 'app-sophia-admin-overview',
  standalone: true,
  imports: [RouterLink, AdminPaginationComponent, AdminStatePanelComponent, AdminTableComponent],
  templateUrl: './sophia-admin-overview.page.html',
  styleUrls: ['./sophia-admin-overview.page.css'],
})
export class SophiaAdminOverviewPage implements OnInit {
  private readonly admin = inject(SophiaAdminService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly pageSize = 8;
  readonly modules = SOPHIA_ADMIN_MODULES;
  readonly principal = signal<SophiaAdminPrincipal | null>(null);
  readonly readiness = signal<AdminOnboardingReadiness | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly readinessError = signal('');
  readonly page = signal(1);
  readonly availableCount = computed(
    () => this.modules.filter((item) => item.available && this.hasPermission(item.permission)).length,
  );
  readonly visibleModules = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.modules.slice(start, start + this.pageSize);
  });
  readonly tableRows = computed(() => this.visibleModules().map((item) => ({
    id: item.id,
    module: `${item.id} · ${item.label}`,
    access: this.hasPermission(item.permission) ? 'Granted' : 'Not granted',
    status: item.available ? 'Available' : 'Not yet available',
    delivery: item.deliveryTask,
  })));
  readonly tableColumns = [
    { key: 'module', label: 'Module' },
    { key: 'access', label: 'Your access' },
    { key: 'status', label: 'UI status' },
    { key: 'delivery', label: 'Delivery task' },
  ] as const;
  readonly readinessRows = computed(() => (this.readiness()?.steps ?? []).map((step) => ({
    id: step.key,
    step: step.label,
    modules: step.moduleIds.join(', '),
    status: this.readinessStatus(step.status),
    detail: step.detail,
  })));
  readonly readinessColumns = [
    { key: 'step', label: 'Readiness step' },
    { key: 'modules', label: 'Modules' },
    { key: 'status', label: 'Status' },
    { key: 'detail', label: 'Persisted evidence' },
  ] as const;

  ngOnInit(): void {
    this.admin.context().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ principal }) => {
        this.principal.set(principal);
        this.loadReadiness(principal.tenantId);
      },
      error: () => {
        this.error.set('Your current Sophia Admin permissions could not be loaded.');
        this.loading.set(false);
      },
    });
  }

  private loadReadiness(tenantId: string): void {
    this.admin.onboardingReadiness(tenantId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (readiness) => {
        this.readiness.set(readiness);
        this.loading.set(false);
      },
      error: () => {
        this.readinessError.set('Persisted onboarding readiness could not be loaded. Module access remains available below.');
        this.loading.set(false);
      },
    });
  }

  readinessStatus(status: AdminOnboardingReadiness['steps'][number]['status']): string {
    switch (status) {
      case 'ready': return 'Ready';
      case 'not_configured': return 'Not configured';
      case 'restricted': return 'Restricted';
      case 'awaiting_runtime_evidence': return 'Awaiting runtime evidence';
    }
  }

  hasPermission(permission: string): boolean {
    return this.principal()?.permissions.includes(permission) ?? false;
  }

  setPage(page: number): void {
    this.page.set(page);
  }
}
