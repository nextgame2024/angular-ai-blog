import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, Observable, switchMap } from 'rxjs';

import { adminErrorMessage } from '../shared/admin-operation.utils';
import { AdminStatePanelComponent } from '../shared/admin-state-panel.component';
import { SophiaAdminService } from '../sophia-admin.service';
import type { AgentAuthoringDependencies, AgentDetail, AgentDraftConfiguration, AgentSummary, PublicationCheck, SophiaAdminPrincipal } from '../sophia-admin.types';

@Component({
  selector: 'app-agents-admin-page', standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AdminStatePanelComponent],
  templateUrl: './agents-admin.page.html', styleUrls: ['../shared/admin-authoring.css'],
})
export class AgentsAdminPage implements OnInit {
  private readonly admin = inject(SophiaAdminService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  readonly principal = signal<SophiaAdminPrincipal | null>(null);
  readonly agents = signal<AgentSummary[]>([]);
  readonly dependencies = signal<AgentAuthoringDependencies | null>(null);
  readonly selected = signal<AgentDetail | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly creating = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly checks = signal<PublicationCheck[]>([]);
  readonly preview = signal<{ instruction: { content: string; tone?: string | null; greeting?: string | null }; platformSafetyPolicyVersion: string } | null>(null);
  readonly selectedExperiences = computed(() => {
    const ids = new Set(this.form.controls.experienceProfileVersionIds.value);
    return this.dependencies()?.experienceProfiles.filter((item) => ids.has(item.experienceProfileVersionId)) ?? [];
  });
  readonly agentKey = this.fb.nonNullable.control('', [Validators.required, Validators.pattern(/^[a-z0-9][a-z0-9-]{0,79}$/)]);
  readonly previewVariables = this.fb.nonNullable.control('');
  readonly form = this.fb.nonNullable.group({
    displayName: ['', [Validators.required, Validators.maxLength(120)]],
    defaultLocale: ['en-AU', [Validators.required, Validators.maxLength(160)]],
    allowedLocales: ['en-AU', [Validators.required, Validators.maxLength(500)]],
    instructionRevisionId: ['', Validators.required],
    businessProfileVersionId: ['', Validators.required],
    experienceProfileVersionIds: [[] as string[], Validators.required],
    capabilityBindingIds: [[] as string[]],
    knowledgeRevisionIds: [[] as string[]],
    workflowVersionIds: [[] as string[]],
    escalationPolicyVersionId: [''],
  });

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true); this.error.set('');
    this.admin.context().pipe(switchMap(({ principal }) => {
      this.principal.set(principal);
      return forkJoin({ agents: this.admin.listAgents(principal.tenantId), dependencies: this.admin.agentDependencies(principal.tenantId) });
    }), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ agents, dependencies }) => {
        this.agents.set(agents.agents); this.dependencies.set(dependencies); this.loading.set(false);
        if (!this.selected() && agents.agents[0]) this.select(agents.agents[0].agent_id);
      },
      error: (error) => { this.error.set(adminErrorMessage(error, 'Agent authoring could not be loaded.')); this.loading.set(false); },
    });
  }

  can(permission: string): boolean { return this.principal()?.permissions.includes(permission) ?? false; }

  startNew(): void {
    this.selected.set(null); this.creating.set(true); this.agentKey.reset(''); this.checks.set([]); this.preview.set(null);
    const deps = this.dependencies();
    this.form.reset({
      displayName: '', defaultLocale: 'en-AU', allowedLocales: 'en-AU',
      instructionRevisionId: deps?.instructionRevisions[0]?.instructionRevisionId ?? '',
      businessProfileVersionId: deps?.businessProfiles[0]?.businessProfileVersionId ?? '',
      experienceProfileVersionIds: [], capabilityBindingIds: [], knowledgeRevisionIds: [], workflowVersionIds: [], escalationPolicyVersionId: '',
    });
  }

  select(agentId: string): void {
    const principal = this.principal(); if (!principal) return;
    this.busy.set(true); this.error.set(''); this.creating.set(false); this.checks.set([]); this.preview.set(null);
    this.admin.getAgent(principal.tenantId, agentId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (agent) => { this.selected.set(agent); this.patch(agent.configuration); this.busy.set(false); },
      error: (error) => this.fail(error, 'The agent draft could not be loaded.'),
    });
  }

  save(): void {
    const principal = this.principal(); const selected = this.selected();
    if (!principal || this.form.invalid || !this.can('agents.edit')) { this.form.markAllAsTouched(); return; }
    const configuration = this.configuration(); this.startAction();
    const request: Observable<{ agentId: string }> = this.creating()
      ? this.admin.createAgent(principal.tenantId, this.agentKey.value, configuration)
      : this.admin.updateAgentDraft(principal.tenantId, selected!.agent_id, selected!.draft_revision, configuration);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        const agentId = result.agentId;
        this.notice.set(this.creating() ? 'Agent draft created. No live session was changed.' : 'Agent draft saved. Active sessions and releases were not changed.');
        this.busy.set(false); this.reloadAgents(agentId);
      }, error: (error) => this.fail(error, 'The agent draft could not be saved.'),
    });
  }

  validate(): void {
    const principal = this.principal(); const agent = this.selected(); if (!principal || !agent) return;
    this.startAction(); this.admin.validateAgent(principal.tenantId, agent.agent_id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ checks }) => { this.checks.set(checks); this.busy.set(false); },
      error: (error) => this.fail(error, 'Draft validation failed.'),
    });
  }

  runPreview(): void {
    const principal = this.principal(); const agent = this.selected();
    if (!principal || !agent || !this.can('instructions.test')) return;
    let variables: Record<string, string | number | boolean>;
    try { variables = parseVariables(this.previewVariables.value); } catch (error) { this.error.set((error as Error).message); return; }
    this.startAction(); this.admin.previewAgent(principal.tenantId, agent.agent_id, variables).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => { this.preview.set(result); this.checks.set(result.checks); this.busy.set(false); },
      error: (error) => this.fail(error, 'The deterministic preview could not be composed.'),
    });
  }

  compatibleExperiences() { const id = this.form.controls.businessProfileVersionId.value; return this.dependencies()?.experienceProfiles.filter((item) => item.businessProfileVersionId === id) ?? []; }
  compatibleCapabilities() { const id = this.form.controls.businessProfileVersionId.value; return this.dependencies()?.capabilityBindings.filter((item) => item.businessProfileVersionId === id) ?? []; }
  private configuration(): AgentDraftConfiguration {
    const value = this.form.getRawValue();
    return { displayName: value.displayName.trim(), defaultLocale: value.defaultLocale.trim(), allowedLocales: splitList(value.allowedLocales), instructionRevisionId: value.instructionRevisionId, businessProfileVersionId: value.businessProfileVersionId, experienceProfileVersionIds: value.experienceProfileVersionIds, capabilityBindingIds: value.capabilityBindingIds, knowledgeRevisionIds: value.knowledgeRevisionIds, workflowVersionIds: value.workflowVersionIds, ...(value.escalationPolicyVersionId ? { escalationPolicyVersionId: value.escalationPolicyVersionId } : {}) };
  }
  private patch(value: AgentDraftConfiguration): void { this.form.setValue({ ...value, allowedLocales: value.allowedLocales.join(', '), escalationPolicyVersionId: value.escalationPolicyVersionId ?? '' }); }
  private reloadAgents(selectId?: string): void { const principal = this.principal(); if (!principal) return; this.admin.listAgents(principal.tenantId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ agents }) => { this.agents.set(agents); const id = selectId ?? this.selected()?.agent_id; if (id) this.select(id); }); }
  private startAction(): void { this.busy.set(true); this.error.set(''); this.notice.set(''); }
  private fail(error: unknown, fallback: string): void { this.error.set(adminErrorMessage(error, fallback)); this.busy.set(false); this.loading.set(false); }
}

function splitList(value: string): string[] { return [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))]; }
function parseVariables(value: string): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};
  for (const line of value.split('\n').map((item) => item.trim()).filter(Boolean)) {
    const separator = line.indexOf('='); if (separator < 1) throw new Error('Preview variables use one key=value pair per line.');
    const key = line.slice(0, separator).trim(); const raw = line.slice(separator + 1).trim();
    if (!/^[a-z][a-zA-Z0-9_]{0,63}$/.test(key)) throw new Error(`Invalid preview variable name: ${key}`);
    result[key] = raw === 'true' ? true : raw === 'false' ? false : /^-?\d+(?:\.\d+)?$/.test(raw) ? Number(raw) : raw;
  }
  return result;
}
