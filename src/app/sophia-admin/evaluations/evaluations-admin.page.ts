import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, forkJoin } from 'rxjs';
import { adminErrorMessage } from '../shared/admin-operation.utils';
import { SophiaAdminService } from '../sophia-admin.service';
import type { AgentSummary, EvaluationDatasetVersion, EvaluationWorkspace, SophiaAdminPrincipal } from '../sophia-admin.types';

@Component({
  selector: 'app-evaluations-admin-page', standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './evaluations-admin.page.html', styleUrls: ['../shared/admin-authoring.css'],
})
export class EvaluationsAdminPage implements OnInit {
  private readonly admin = inject(SophiaAdminService); private readonly destroyRef = inject(DestroyRef);
  readonly principal = signal<SophiaAdminPrincipal | null>(null); readonly workspace = signal<EvaluationWorkspace | null>(null);
  readonly agents = signal<AgentSummary[]>([]); readonly selectedChecks = signal<string[]>([]);
  readonly loading = signal(true); readonly busy = signal(false); readonly error = signal(''); readonly notice = signal('');
  readonly datasetForm = new FormGroup({
    datasetKey: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^[a-z0-9][a-z0-9.-]*$/)] }),
    displayName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
  readonly versionForm = new FormGroup({ datasetId: new FormControl('', { nonNullable: true, validators: [Validators.required] }) });
  readonly executionForm = new FormGroup({
    agentId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    datasetVersionId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    targetType: new FormControl<'draft' | 'release'>('draft', { nonNullable: true, validators: [Validators.required] }),
    releaseId: new FormControl('', { nonNullable: true }),
  });

  ngOnInit(): void {
    this.admin.context().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ principal }) => { this.principal.set(principal); this.refresh(); }, error: (error) => this.fail(error),
    });
  }
  refresh(): void {
    const tenantId = this.principal()?.tenantId; if (!tenantId) return; this.loading.set(true);
    forkJoin({ workspace: this.admin.evaluations(tenantId), agents: this.admin.listAgents(tenantId) })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: ({ workspace, agents }) => {
          this.workspace.set(workspace); this.agents.set(agents.agents);
          if (!this.selectedChecks().length) this.selectedChecks.set([...workspace.registry.supportedPublicationChecks]);
          if (!this.versionForm.controls.datasetId.value && workspace.datasets[0]) this.versionForm.controls.datasetId.setValue(workspace.datasets[0].evaluation_dataset_id);
          if (!this.executionForm.controls.agentId.value && agents.agents[0]) this.executionForm.controls.agentId.setValue(agents.agents[0].agent_id);
          if (!this.executionForm.controls.datasetVersionId.value && this.approvedVersions()[0]) this.executionForm.controls.datasetVersionId.setValue(this.approvedVersions()[0].evaluationDatasetVersionId);
          this.loading.set(false); this.busy.set(false);
        }, error: (error) => this.fail(error),
      });
  }
  approvedVersions(): Array<EvaluationDatasetVersion & { datasetKey: string }> {
    return (this.workspace()?.datasets ?? []).flatMap((dataset) => dataset.versions
      .filter((version) => version.status === 'approved').map((version) => ({ ...version, datasetKey: dataset.dataset_key })));
  }
  releasesForAgent() {
    return (this.workspace()?.releases ?? []).filter((release) => release.agent_id === this.executionForm.controls.agentId.value);
  }
  toggleCheck(checkId: string, checked: boolean): void {
    this.selectedChecks.update((items) => checked ? [...new Set([...items, checkId])] : items.filter((item) => item !== checkId));
  }
  createDataset(): void {
    if (this.datasetForm.invalid || this.busy()) { this.datasetForm.markAllAsTouched(); return; }
    this.mutate(this.admin.createEvaluationDataset(this.tenant(), {
      datasetKey: this.datasetForm.controls.datasetKey.value.trim(), displayName: this.datasetForm.controls.displayName.value.trim(),
    }), 'Evaluation dataset created. Add a pinned version before it can run.');
  }
  createVersion(): void {
    if (this.versionForm.invalid || !this.selectedChecks().length || this.busy()) return;
    const cases = this.selectedChecks().map((publicationCheckId) => ({
      caseKey: publicationCheckId.replace(/[^a-z0-9.-]/g, '-'), publicationCheckId, expectedStatus: 'passed' as const,
    }));
    this.mutate(this.admin.createEvaluationVersion(this.tenant(), this.versionForm.controls.datasetId.value, cases), 'Pinned deterministic dataset version created.');
  }
  approve(version: EvaluationDatasetVersion): void {
    this.mutate(this.admin.approveEvaluationVersion(this.tenant(), version.evaluationDatasetVersionId), 'Evaluation version approved and made immutable.');
  }
  run(): void {
    const targetType = this.executionForm.controls.targetType.value;
    const releaseId = this.executionForm.controls.releaseId.value;
    if (this.executionForm.invalid || (targetType === 'release' && !releaseId)) return;
    this.mutate(this.admin.runEvaluation(this.tenant(), this.executionForm.controls.agentId.value,
      this.executionForm.controls.datasetVersionId.value,
      targetType === 'draft' ? { type: 'draft' } : { type: 'release', releaseId }),
    'Deterministic regression completed without external effects.');
  }
  requireForPublication(): void {
    if (this.executionForm.invalid) return;
    this.mutate(this.admin.bindEvaluationRequirement(this.tenant(), this.executionForm.controls.agentId.value,
      this.executionForm.controls.datasetVersionId.value, true), 'This exact dataset version is now required for publication.');
  }
  can(permission: string): boolean { return this.principal()?.permissions.includes(permission) ?? false; }
  private mutate(request: Observable<unknown>, notice: string): void {
    if (this.busy()) return; this.busy.set(true); this.error.set(''); this.notice.set('');
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: () => { this.notice.set(notice); this.refresh(); }, error: (error) => this.fail(error) });
  }
  private fail(error: unknown): void { this.error.set(adminErrorMessage(error, 'Evaluation request failed.')); this.loading.set(false); this.busy.set(false); }
  private tenant(): string { const value = this.principal()?.tenantId; if (!value) throw new Error('Tenant context unavailable.'); return value; }
}
