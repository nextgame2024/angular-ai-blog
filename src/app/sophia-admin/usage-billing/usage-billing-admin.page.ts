import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { adminErrorMessage } from '../shared/admin-operation.utils';
import { SophiaAdminService } from '../sophia-admin.service';
import type { CommercialWorkspace, SophiaAdminPrincipal, UsageLimitsWorkspace, UsageWorkspace } from '../sophia-admin.types';

@Component({
  selector: 'app-usage-billing-admin-page', standalone: true, imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './usage-billing-admin.page.html',
  styleUrls: ['../shared/admin-authoring.css', './usage-billing-admin.page.css'],
})
export class UsageBillingAdminPage implements OnInit {
  private readonly admin = inject(SophiaAdminService);
  private readonly destroyRef = inject(DestroyRef);
  readonly principal = signal<SophiaAdminPrincipal | null>(null);
  readonly usage = signal<UsageWorkspace | null>(null);
  readonly commercial = signal<CommercialWorkspace | null>(null);
  readonly limits = signal<UsageLimitsWorkspace | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly form = new FormGroup({
    maxConcurrentSessions: new FormControl('', { nonNullable: true }),
    maxToolCallsPerMinute: new FormControl('', { nonNullable: true }),
    providerCostAlertMicrounits: new FormControl('', { nonNullable: true }),
    providerCostAlertCurrency: new FormControl('', { nonNullable: true }),
  });

  ngOnInit(): void {
    this.admin.context().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ principal }) => { this.principal.set(principal); this.refresh(); },
      error: (error) => this.fail(error),
    });
  }

  refresh(): void {
    const tenantId = this.principal()?.tenantId; if (!tenantId) return;
    this.loading.set(true); this.error.set('');
    forkJoin({
      usage: this.admin.usageWorkspace(tenantId),
      limits: this.admin.usageLimits(tenantId),
      commercial: this.can('billing.read') ? this.admin.commercialWorkspace(tenantId) : of(null),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ usage, limits, commercial }) => {
        this.usage.set(usage); this.limits.set(limits); this.commercial.set(commercial);
        const configured = limits.limits.tenantGuardrails;
        this.form.setValue({
          maxConcurrentSessions: configured?.maxConcurrentSessions?.toString() ?? '',
          maxToolCallsPerMinute: configured?.maxToolCallsPerMinute?.toString() ?? '',
          providerCostAlertMicrounits: configured?.providerCostAlertMicrounits ?? '',
          providerCostAlertCurrency: configured?.providerCostAlertCurrency ?? '',
        });
        this.loading.set(false); this.busy.set(false);
      },
      error: (error) => this.fail(error),
    });
  }

  can(permission: string): boolean { return this.principal()?.permissions.includes(permission) ?? false; }
  recentMfa(): boolean {
    const value = Date.parse(this.principal()?.mfaVerifiedAt ?? '');
    return Number.isFinite(value) && value >= Date.now() - 12 * 60 * 60 * 1000;
  }
  saveLimits(): void {
    const current = this.limits(); if (!current || this.busy() || !this.can('usage.limits.manage') || !this.recentMfa()) return;
    const value = this.form.getRawValue();
    try {
      const threshold = value.providerCostAlertMicrounits.trim(); const currency = value.providerCostAlertCurrency.trim().toUpperCase();
      if ((threshold && !currency) || (!threshold && currency)) throw new Error('Provider-cost alert threshold and currency must be set together.');
      this.busy.set(true); this.error.set(''); this.notice.set('');
      this.admin.updateUsageLimits(this.tenant(), {
        expectedRevision: current.limits.tenantGuardrails?.revision ?? 0,
        maxConcurrentSessions: positiveOrNull(value.maxConcurrentSessions, 'Concurrent sessions'),
        maxToolCallsPerMinute: positiveOrNull(value.maxToolCallsPerMinute, 'Tool calls per minute'),
        providerCostAlert: threshold ? { thresholdMicrounits: positiveIntegerString(threshold, 'Provider-cost threshold'), currency } : null,
      }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (updated) => { this.limits.set(updated); this.notice.set('Usage guardrails updated and audited.'); this.busy.set(false); this.refresh(); },
        error: (error) => this.fail(error),
      });
    } catch (error) { this.fail(error); }
  }
  startCheckout(): void {
    const billing = this.commercial(); const plan = billing?.assignment;
    if (!billing?.providerIntegration.checkout || !plan || !this.allowedBillingAction()) return;
    this.busy.set(true); this.error.set(''); this.notice.set('');
    const active = billing.activeCheckoutIntent;
    const requestId = active?.commercial_plan_version_id === plan.planVersionId ? active.request_id : crypto.randomUUID();
    this.admin.createBillingCheckout(this.tenant(), { requestId, planVersionId: plan.planVersionId })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: ({ url }) => { this.busy.set(false); window.location.assign(url); }, error: (error) => this.fail(error),
      });
  }
  openPortal(): void {
    const billing = this.commercial();
    if (!billing?.providerIntegration.portal || !billing.providerCustomers.length || !this.allowedBillingAction()) return;
    this.busy.set(true); this.error.set(''); this.notice.set('');
    this.admin.createBillingPortal(this.tenant(), { requestId: crypto.randomUUID() })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: ({ url }) => { this.busy.set(false); window.location.assign(url); }, error: (error) => this.fail(error),
      });
  }
  reconcileBilling(): void {
    const billing = this.commercial();
    if (!billing?.providerIntegration.reconciliation || !billing.providerCustomers.length || !this.allowedBillingAction()) return;
    this.busy.set(true); this.error.set(''); this.notice.set('');
    this.admin.reconcileBilling(this.tenant(), { requestId: crypto.randomUUID() })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (result) => { this.notice.set(`Sandbox reconciliation ${result.status}: ${result.subscriptionCount} subscription(s), ${result.invoiceCount} invoice(s). No live entitlement changed.`); this.busy.set(false); this.refresh(); },
        error: (error) => this.fail(error),
      });
  }
  allowedBillingAction(): boolean { return this.can('billing.manage') && this.recentMfa() && !this.busy(); }
  money(minor: string | null | undefined, currency: string | null | undefined): string {
    if (minor == null || !currency) return 'Unavailable';
    const value = Number(minor); if (!Number.isSafeInteger(value)) return `${minor} minor units ${currency}`;
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value / 100);
  }
  private fail(error: unknown): void {
    this.error.set(adminErrorMessage(error, 'Usage and billing request failed.')); this.loading.set(false); this.busy.set(false);
  }
  private tenant(): string { const id = this.principal()?.tenantId; if (!id) throw new Error('Tenant context unavailable.'); return id; }
}

function positiveOrNull(value: string, label: string): number | null {
  const trimmed = value.trim(); if (!trimmed) return null;
  const parsed = Number(trimmed); if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${label} must be a positive integer.`);
  return parsed;
}
function positiveIntegerString(value: string, label: string): string {
  if (!/^[1-9]\d*$/.test(value)) throw new Error(`${label} must be a positive integer in microunits.`); return value;
}
