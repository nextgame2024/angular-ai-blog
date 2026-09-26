import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, forkJoin } from 'rxjs';
import { adminErrorMessage } from '../shared/admin-operation.utils';
import { SophiaAdminService } from '../sophia-admin.service';
import type { SophiaAdminPrincipal, WorkflowDefinition, WorkflowRun, WorkflowTemplate, WorkflowVersion } from '../sophia-admin.types';

@Component({
  selector: 'app-workflows-admin-page', standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './workflows-admin.page.html', styleUrls: ['../shared/admin-authoring.css'],
})
export class WorkflowsAdminPage implements OnInit {
  private readonly admin = inject(SophiaAdminService); private readonly destroyRef = inject(DestroyRef);
  readonly principal = signal<SophiaAdminPrincipal | null>(null); readonly templates = signal<WorkflowTemplate[]>([]);
  readonly workflows = signal<WorkflowDefinition[]>([]); readonly runs = signal<WorkflowRun[]>([]);
  readonly statuses = signal<Record<string, Record<string, unknown>>>({});
  readonly loading = signal(true); readonly busy = signal(false); readonly error = signal(''); readonly notice = signal('');
  readonly createForm = new FormGroup({
    workflowKey: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^[a-z][a-z0-9.-]{1,159}$/)] }),
    templateKey: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  ngOnInit(): void {
    this.admin.context().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ principal }) => { this.principal.set(principal); this.refresh(); }, error: (error) => this.fail(error),
    });
  }
  refresh(): void {
    const tenantId = this.principal()?.tenantId; if (!tenantId) return; this.loading.set(true);
    forkJoin({ templates: this.admin.workflowTemplates(tenantId), workflows: this.admin.workflows(tenantId), runs: this.admin.workflowRuns(tenantId) })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: ({ templates, workflows, runs }) => {
          this.templates.set(templates.templates); this.workflows.set(workflows.workflows); this.runs.set(runs.runs);
          if (!this.createForm.controls.templateKey.value && templates.templates[0]) {
            this.createForm.controls.templateKey.setValue(templates.templates[0].templateKey);
          }
          this.loading.set(false); this.busy.set(false);
        }, error: (error) => this.fail(error),
      });
  }
  selectedTemplate(): WorkflowTemplate | null {
    return this.templates().find((item) => item.templateKey === this.createForm.controls.templateKey.value) ?? null;
  }
  templateFor(key: string): WorkflowTemplate | undefined { return this.templates().find((item) => item.templateKey === key); }
  fixedConfiguration(template: WorkflowTemplate | undefined): Record<string, unknown> | null {
    const schema = template?.configurationSchema;
    if (!schema || schema['type'] !== 'object' || schema['additionalProperties'] !== false) return null;
    const properties = schema['properties'];
    if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return null;
    const configuration: Record<string, unknown> = {};
    for (const [key, definition] of Object.entries(properties as Record<string, unknown>)) {
      if (!definition || typeof definition !== 'object' || Array.isArray(definition) || !Object.hasOwn(definition, 'const')) return null;
      configuration[key] = (definition as Record<string, unknown>)['const'];
    }
    const required = schema['required'];
    if (!Array.isArray(required) || required.some((key) => typeof key !== 'string' || !(key in configuration))) return null;
    return configuration;
  }
  create(): void {
    const template = this.selectedTemplate(); const configuration = this.fixedConfiguration(template ?? undefined);
    if (this.createForm.invalid || !template || !configuration || this.busy()) { this.createForm.markAllAsTouched(); return; }
    this.mutate(this.admin.createWorkflow(this.tenant(), {
      workflowKey: this.createForm.controls.workflowKey.value.trim(), templateKey: template.templateKey, configuration,
    }), 'Workflow draft created from the compiled template.');
  }
  createVersion(workflow: WorkflowDefinition): void {
    const configuration = this.fixedConfiguration(this.templateFor(workflow.template_key)); if (!configuration) return;
    this.mutate(this.admin.createWorkflowVersion(this.tenant(), workflow.workflow_definition_id, configuration), 'New immutable workflow draft version created.');
  }
  publish(version: WorkflowVersion): void {
    this.mutate(this.admin.publishWorkflowVersion(this.tenant(), version.workflowVersionId), 'Workflow version published for future agent releases.');
  }
  refreshStatus(run: WorkflowRun): void {
    if (this.busy()) return; this.start();
    this.admin.workflowStatus(this.tenant(), run.workflowRunId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.statuses.update((current) => ({ ...current, [run.workflowRunId]: result.authoritativeStatus }));
        this.notice.set('Authoritative owner status refreshed.'); this.busy.set(false); this.refresh();
      }, error: (error) => this.fail(error),
    });
  }
  retry(run: WorkflowRun): void {
    if (this.templateFor(run.templateKey)?.retry.support !== 'owner-idempotent' || !window.confirm('Request one owner-idempotent retry?')) return;
    this.mutate(this.admin.retryWorkflow(this.tenant(), run.workflowRunId, actionId('workflow-retry')), 'Owner retry command recorded.');
  }
  json(value: unknown): string { return JSON.stringify(value, null, 2); }
  can(permission: string): boolean { return this.principal()?.permissions.includes(permission) ?? false; }
  private mutate(request: Observable<unknown>, notice: string): void {
    if (this.busy()) return; this.start(); request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.notice.set(notice); this.refresh(); }, error: (error) => this.fail(error),
    });
  }
  private start(): void { this.busy.set(true); this.error.set(''); this.notice.set(''); }
  private fail(error: unknown): void { this.error.set(adminErrorMessage(error, 'Workflow request failed.')); this.loading.set(false); this.busy.set(false); }
  private tenant(): string { const value = this.principal()?.tenantId; if (!value) throw new Error('Tenant context unavailable.'); return value; }
}
function actionId(prefix: string): string { return `${prefix}-${typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Date.now()}`; }
