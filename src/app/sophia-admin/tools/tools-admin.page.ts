import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { adminErrorMessage } from '../shared/admin-operation.utils';
import { SophiaAdminService } from '../sophia-admin.service';
import type {
  BusinessProfileCapabilityVersion, CapabilityAuthoringDependencies, CapabilityBinding,
  ConnectorBinding, SophiaAdminPrincipal, ToolRegistry,
} from '../sophia-admin.types';

@Component({
  selector: 'app-tools-admin-page', standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './tools-admin.page.html', styleUrls: ['../shared/admin-authoring.css'],
})
export class ToolsAdminPage implements OnInit {
  private readonly admin = inject(SophiaAdminService);
  private readonly destroyRef = inject(DestroyRef);
  readonly principal = signal<SophiaAdminPrincipal | null>(null);
  readonly registry = signal<ToolRegistry | null>(null);
  readonly dependencies = signal<CapabilityAuthoringDependencies>({ businessProfileVersions: [], capabilityBindings: [] });
  readonly connectors = signal<ConnectorBinding[]>([]);
  readonly sandbox = signal<{ operationId: string; mode: string; externalEffects: false; policyDecision: string; note: string } | null>(null);
  readonly loading = signal(true); readonly busy = signal(false); readonly error = signal(''); readonly notice = signal('');
  readonly profileVersionId = new FormControl('', { nonNullable: true });
  readonly capabilityKey = new FormControl('', { nonNullable: true });
  readonly connectorBindingId = new FormControl('', { nonNullable: true });
  readonly enabled = new FormControl(true, { nonNullable: true });
  readonly capabilities = computed(() => [...new Set((this.registry()?.packs ?? []).flatMap((pack) => pack.capabilities))].sort());
  selectedProfile(): BusinessProfileCapabilityVersion | null {
    return this.dependencies().businessProfileVersions
      .find((item) => item.businessProfileVersionId === this.profileVersionId.value) ?? null;
  }
  currentBinding(): CapabilityBinding | null {
    return this.dependencies().capabilityBindings.find((binding) =>
      binding.businessProfileVersionId === this.profileVersionId.value && binding.capabilityKey === this.capabilityKey.value) ?? null;
  }
  compatibleConnectors(): ConnectorBinding[] {
    const keys = new Set((this.registry()?.packs ?? [])
      .filter((pack) => pack.capabilities.includes(this.capabilityKey.value)).flatMap((pack) => pack.connectorKeys));
    return this.connectors().filter((binding) => binding.status === 'active' && keys.has(binding.connectorKey));
  }

  ngOnInit(): void {
    this.admin.context().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ principal }) => { this.principal.set(principal); this.refresh(); },
      error: (error) => this.fail(error),
    });
    this.profileVersionId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.syncBinding());
    this.capabilityKey.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.syncBinding());
  }

  refresh(): void {
    const tenantId = this.principal()?.tenantId; if (!tenantId) return;
    this.loading.set(true);
    forkJoin({
      registry: this.admin.toolRegistry(tenantId),
      dependencies: this.admin.capabilityAuthoringDependencies(tenantId),
      connectors: this.admin.connectorBindings(tenantId),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ registry, dependencies, connectors }) => {
        this.registry.set(registry); this.dependencies.set(dependencies); this.connectors.set(connectors.bindings);
        if (!this.profileVersionId.value && dependencies.businessProfileVersions[0]) {
          this.profileVersionId.setValue(dependencies.businessProfileVersions[0].businessProfileVersionId);
        }
        if (!this.capabilityKey.value && this.capabilities()[0]) this.capabilityKey.setValue(this.capabilities()[0]);
        this.syncBinding(); this.loading.set(false); this.busy.set(false);
      },
      error: (error) => this.fail(error),
    });
  }

  runSandbox(operationId: string): void {
    if (!this.can('tools.test') || this.busy()) return;
    this.start();
    this.admin.testToolContract(this.tenant(), operationId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => { this.sandbox.set(result); this.notice.set('Synthetic contract check completed without external effects.'); this.busy.set(false); },
      error: (error) => this.fail(error),
    });
  }

  saveBinding(): void {
    const profile = this.selectedProfile(); const connectorBindingId = this.connectorBindingId.value;
    if (!profile?.editable || !this.capabilityKey.value || !connectorBindingId || !this.can('tools.bind') || this.busy()) return;
    const existing = this.currentBinding(); this.start();
    this.admin.putCapabilityBinding(this.tenant(), profile.businessProfileVersionId, this.capabilityKey.value, {
      connectorBindingId, enabled: this.enabled.value, expectedRevision: existing?.revision ?? null,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.notice.set('Draft capability binding saved. Published profiles were not changed.'); this.refresh(); },
      error: (error) => this.fail(error),
    });
  }

  schema(value: Record<string, unknown>): string { return JSON.stringify(value, null, 2); }
  can(permission: string): boolean { return this.principal()?.permissions.includes(permission) ?? false; }
  trackProfile(_index: number, item: BusinessProfileCapabilityVersion): string { return item.businessProfileVersionId; }
  trackBinding(_index: number, item: CapabilityBinding): string { return item.capabilityBindingId; }

  private syncBinding(): void {
    const binding = this.currentBinding();
    this.connectorBindingId.setValue(binding?.connectorBindingId ?? '', { emitEvent: false });
    this.enabled.setValue(binding?.enabled ?? true, { emitEvent: false });
  }
  private start(): void { this.busy.set(true); this.error.set(''); this.notice.set(''); }
  private fail(error: unknown): void { this.error.set(adminErrorMessage(error, 'Tools request failed.')); this.loading.set(false); this.busy.set(false); }
  private tenant(): string { const value = this.principal()?.tenantId; if (!value) throw new Error('Tenant context unavailable.'); return value; }
}
