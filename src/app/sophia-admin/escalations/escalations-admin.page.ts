import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, forkJoin } from 'rxjs';
import { adminErrorMessage } from '../shared/admin-operation.utils';
import { SophiaAdminService } from '../sophia-admin.service';
import type { EscalationCase, EscalationChannel, EscalationDestination, EscalationPolicy, EscalationPolicyConfiguration, SophiaAdminPrincipal } from '../sophia-admin.types';

@Component({
  selector: 'app-escalations-admin-page', standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './escalations-admin.page.html', styleUrls: ['../shared/admin-authoring.css'],
})
export class EscalationsAdminPage implements OnInit {
  private readonly admin = inject(SophiaAdminService); private readonly destroyRef = inject(DestroyRef);
  readonly principal = signal<SophiaAdminPrincipal | null>(null); readonly channels = signal<EscalationChannel[]>([]);
  readonly destinations = signal<EscalationDestination[]>([]);
  readonly policies = signal<EscalationPolicy[]>([]); readonly cases = signal<EscalationCase[]>([]); readonly selectedCase = signal<EscalationCase | null>(null);
  readonly loading = signal(true); readonly busy = signal(false); readonly error = signal(''); readonly notice = signal('');
  readonly destinationForm = new FormGroup({
    destinationKey: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^[a-z][a-z0-9.-]{1,159}$/)] }),
    displayName: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(160)] }),
    channel: new FormControl<EscalationChannel['channel']>('operations_inbox', { nonNullable: true, validators: [Validators.required] }),
  });
  readonly policyForm = new FormGroup({
    policyKey: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^[a-z][a-z0-9.-]{1,159}$/)] }),
    defaultDestinationId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
  readonly resolutionForm = new FormGroup({
    resolutionCode: new FormControl('handled', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^[a-z][a-z0-9.-]{1,159}$/)] }),
    resolutionNote: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(2000)] }),
  });

  ngOnInit(): void {
    this.admin.context().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ principal }) => { this.principal.set(principal); this.refresh(); }, error: (error) => this.fail(error),
    });
  }
  refresh(): void {
    const tenantId = this.principal()?.tenantId; if (!tenantId) return; this.loading.set(true);
    forkJoin({ channels: this.admin.escalationChannels(tenantId), destinations: this.admin.escalationDestinations(tenantId),
      policies: this.admin.escalationPolicies(tenantId), cases: this.admin.escalationCases(tenantId) })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: ({ channels, destinations, policies, cases }) => {
          this.channels.set(channels.channels); this.destinations.set(destinations.destinations);
          this.policies.set(policies.policies); this.cases.set(cases.cases);
          const supported = channels.channels.find((channel) => channel.availability === 'supported');
          if (supported) this.destinationForm.controls.channel.setValue(supported.channel);
          if (!this.policyForm.controls.defaultDestinationId.value) {
            const destination = destinations.destinations.find((item) => item.availability === 'supported' && item.status === 'active');
            if (destination) this.policyForm.controls.defaultDestinationId.setValue(destination.escalationDestinationId);
          }
          this.loading.set(false); this.busy.set(false);
        }, error: (error) => this.fail(error),
      });
  }
  supportedChannels(): EscalationChannel[] { return this.channels().filter((channel) => channel.availability === 'supported'); }
  activeDestinations() { return this.destinations().filter((item) => item.availability === 'supported' && item.status === 'active'); }
  createDestination(): void {
    if (this.destinationForm.invalid || this.busy()) { this.destinationForm.markAllAsTouched(); return; }
    this.mutate(this.admin.createEscalationDestination(this.tenant(), this.destinationForm.getRawValue()), 'Supported destination created.');
  }
  configuration(): EscalationPolicyConfiguration | null {
    const defaultDestinationId = this.policyForm.controls.defaultDestinationId.value;
    return defaultDestinationId ? { defaultDestinationId, rules: [], contextFields: ['reason', 'summary'] } : null;
  }
  createPolicy(): void {
    const configuration = this.configuration(); if (this.policyForm.invalid || !configuration || this.busy()) return;
    this.mutate(this.admin.createEscalationPolicy(this.tenant(), this.policyForm.controls.policyKey.value.trim(), configuration), 'Escalation policy draft created.');
  }
  createPolicyVersion(policy: EscalationPolicy): void {
    const configuration = this.configuration(); if (!configuration) return;
    this.mutate(this.admin.createEscalationPolicyVersion(this.tenant(), policy.escalation_policy_id, configuration), 'New policy draft version created.');
  }
  publish(versionId: string): void { this.mutate(this.admin.publishEscalationPolicy(this.tenant(), versionId), 'Escalation policy published.'); }
  selectCase(item: EscalationCase): void {
    this.start(); this.admin.escalationCase(this.tenant(), item.escalationCaseId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (detail) => { this.selectedCase.set(detail); this.busy.set(false); }, error: (error) => this.fail(error),
    });
  }
  assignToMe(item: EscalationCase): void {
    const identity = this.principal()?.identityUserId; if (!identity || !['open', 'assigned'].includes(item.status)) return;
    this.caseMutation(this.admin.assignEscalationCase(this.tenant(), item.escalationCaseId, identity, item.revision), 'Case assigned.');
  }
  startCase(item: EscalationCase): void {
    if (!['open', 'assigned'].includes(item.status)) return;
    this.caseMutation(this.admin.startEscalationCase(this.tenant(), item.escalationCaseId, item.revision), 'Case moved to in progress.');
  }
  resolve(item: EscalationCase): void {
    if (this.resolutionForm.invalid || item.status === 'resolved') { this.resolutionForm.markAllAsTouched(); return; }
    const value = this.resolutionForm.getRawValue();
    this.caseMutation(this.admin.resolveEscalationCase(this.tenant(), item.escalationCaseId, item.revision,
      value.resolutionCode.trim(), value.resolutionNote.trim()), 'Case resolved. Delivery and transfer evidence remain unchanged.');
  }
  can(permission: string): boolean { return this.principal()?.permissions.includes(permission) ?? false; }
  json(value: unknown): string { return JSON.stringify(value, null, 2); }
  private caseMutation(request: Observable<EscalationCase>, notice: string): void { this.mutate(request, notice, true); }
  private mutate(request: Observable<unknown>, notice: string, clearSelection = false): void {
    if (this.busy()) return; this.start(); request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { if (clearSelection) this.selectedCase.set(null); this.notice.set(notice); this.refresh(); }, error: (error) => this.fail(error),
    });
  }
  private start(): void { this.busy.set(true); this.error.set(''); this.notice.set(''); }
  private fail(error: unknown): void { this.error.set(adminErrorMessage(error, 'Escalation request failed.')); this.loading.set(false); this.busy.set(false); }
  private tenant(): string { const value = this.principal()?.tenantId; if (!value) throw new Error('Tenant context unavailable.'); return value; }
}
