import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { adminErrorMessage } from '../shared/admin-operation.utils';
import { SophiaAdminService } from '../sophia-admin.service';
import type { ConnectorBinding, ConnectorRegistration, SophiaAdminPrincipal } from '../sophia-admin.types';

@Component({
  selector: 'app-connectors-admin-page', standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './connectors-admin.page.html', styleUrls: ['../shared/admin-authoring.css'],
})
export class ConnectorsAdminPage implements OnInit {
  private readonly admin = inject(SophiaAdminService); private readonly destroyRef = inject(DestroyRef);
  readonly principal = signal<SophiaAdminPrincipal | null>(null); readonly registrations = signal<ConnectorRegistration[]>([]);
  readonly bindings = signal<ConnectorBinding[]>([]); readonly loading = signal(true); readonly busy = signal(false);
  readonly error = signal(''); readonly notice = signal(''); readonly connectorKey = new FormControl('', { nonNullable: true });
  readonly requestedScopes = new FormControl<string[]>([], { nonNullable: true });
  selectedRegistration(): ConnectorRegistration | null {
    return this.registrations().find((item) => item.connectorKey === this.connectorKey.value) ?? null;
  }
  alreadyBound(): boolean {
    return this.bindings().some((item) => item.connectorKey === this.connectorKey.value && item.status !== 'revoked');
  }

  ngOnInit(): void {
    this.admin.context().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ principal }) => { this.principal.set(principal); this.refresh(); }, error: (error) => this.fail(error),
    });
    this.connectorKey.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.requestedScopes.setValue([]));
  }
  refresh(): void {
    const tenantId = this.principal()?.tenantId; if (!tenantId) return; this.loading.set(true);
    forkJoin({ registry: this.admin.connectorRegistry(tenantId), bindings: this.admin.connectorBindings(tenantId) })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: ({ registry, bindings }) => {
          this.registrations.set(registry.connectors); this.bindings.set(bindings.bindings);
          if (!this.connectorKey.value && registry.connectors[0]) this.connectorKey.setValue(registry.connectors[0].connectorKey);
          this.loading.set(false); this.busy.set(false);
        }, error: (error) => this.fail(error),
      });
  }
  connect(): void {
    const principal = this.principal(); const registration = this.selectedRegistration();
    if (!principal?.externalCompanyId || !registration || !this.requestedScopes.value.length || this.alreadyBound() || this.busy()) return;
    this.start(); this.admin.connectConnector(principal.tenantId, {
      connectorKey: registration.connectorKey, externalAccountId: principal.externalCompanyId,
      requestedScopes: this.requestedScopes.value,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.notice.set('Tenant connector account verified and bound.'); this.refresh(); }, error: (error) => this.fail(error),
    });
  }
  test(binding: ConnectorBinding): void { this.mutate(this.admin.testConnector(this.tenant(), binding.connectorBindingId), 'Connector health verified.'); }
  reconnect(binding: ConnectorBinding): void { this.mutate(this.admin.reconnectConnector(this.tenant(), binding.connectorBindingId, binding.revision), 'Connector reconnected after tenant and account verification.'); }
  disconnect(binding: ConnectorBinding): void {
    if (!window.confirm('Disconnect this connector for future operations? Unresolved commands will remain in reconciliation.')) return;
    this.mutate(this.admin.disconnectConnector(this.tenant(), binding.connectorBindingId, binding.revision), 'Disconnect request recorded.');
  }
  can(permission: string): boolean { return this.principal()?.permissions.includes(permission) ?? false; }
  registration(key: string): ConnectorRegistration | undefined { return this.registrations().find((item) => item.connectorKey === key); }
  private mutate(request: ReturnType<SophiaAdminService['testConnector']>, notice: string): void {
    if (this.busy()) return; this.start(); request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.notice.set(result.reconciliationRequired
          ? `${notice} ${result.unresolvedCommandCount || 0} command outcomes still require reconciliation.` : notice);
        this.refresh();
      }, error: (error) => this.fail(error),
    });
  }
  private start(): void { this.busy.set(true); this.error.set(''); this.notice.set(''); }
  private fail(error: unknown): void { this.error.set(adminErrorMessage(error, 'Connector request failed.')); this.loading.set(false); this.busy.set(false); }
  private tenant(): string { const value = this.principal()?.tenantId; if (!value) throw new Error('Tenant context unavailable.'); return value; }
}
