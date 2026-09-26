import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, switchMap } from 'rxjs';

import { adminErrorMessage, hasRecentMfa } from '../shared/admin-operation.utils';
import { AdminStatePanelComponent } from '../shared/admin-state-panel.component';
import { SophiaAdminService } from '../sophia-admin.service';
import type { AgentDraftDiff, AgentRelease, AgentSummary, PublicationCheck, SophiaAdminPrincipal } from '../sophia-admin.types';

@Component({ selector: 'app-agent-versions-admin-page', standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AdminStatePanelComponent],
  templateUrl: './agent-versions-admin.page.html', styleUrls: ['../shared/admin-authoring.css'],
})
export class AgentVersionsAdminPage implements OnInit {
  private readonly admin = inject(SophiaAdminService); private readonly destroyRef = inject(DestroyRef);
  readonly principal = signal<SophiaAdminPrincipal | null>(null); readonly agents = signal<AgentSummary[]>([]);
  readonly selected = signal<AgentSummary | null>(null); readonly releases = signal<AgentRelease[]>([]);
  readonly diff = signal<AgentDraftDiff | null>(null); readonly checks = signal<PublicationCheck[]>([]);
  readonly publishable = computed(() => this.checks().length > 0 && this.checks().every((check) => check.status === 'passed'));
  readonly loading = signal(true); readonly busy = signal(false); readonly error = signal(''); readonly notice = signal('');
  readonly releaseNotes = new FormControl('', { nonNullable: true, validators: Validators.maxLength(2000) });
  readonly revokeReason = new FormControl('', { nonNullable: true, validators: [Validators.minLength(1), Validators.maxLength(2000)] });
  ngOnInit(): void { this.load(); }
  load(): void { this.loading.set(true); this.admin.context().pipe(switchMap(({ principal }) => { this.principal.set(principal); return this.admin.listAgents(principal.tenantId); }), takeUntilDestroyed(this.destroyRef)).subscribe({ next: ({ agents }) => { this.agents.set(agents); this.loading.set(false); if (agents[0]) this.select(agents[0]); }, error: (e) => this.fail(e, 'Agent versions could not be loaded.') }); }
  can(permission: string): boolean { return this.principal()?.permissions.includes(permission) ?? false; }
  get privilegedReady(): boolean { return hasRecentMfa(this.principal()?.mfaVerifiedAt); }
  select(agent: AgentSummary): void { const principal = this.principal(); if (!principal) return; this.selected.set(agent); this.busy.set(true); this.error.set(''); forkJoin({ releases: this.admin.agentReleases(principal.tenantId, agent.agent_id), diff: this.admin.agentDiff(principal.tenantId, agent.agent_id), validation: this.admin.validateAgent(principal.tenantId, agent.agent_id) }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (result) => { this.releases.set(result.releases.releases); this.diff.set(result.diff); this.checks.set(result.validation.checks); this.busy.set(false); }, error: (e) => this.fail(e, 'Release history could not be loaded.') }); }
  publish(): void { const p=this.principal(), a=this.selected(); if(!p||!a||!this.can('agents.publish')||!this.can('agent_versions.publish')||this.releaseNotes.invalid)return; this.start(); this.admin.publishAgent(p.tenantId,a.agent_id,a.draft_revision,this.releaseNotes.value).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({next:()=>{this.notice.set('Immutable release published for future sessions. Existing sessions were not changed.');this.releaseNotes.reset('');this.refreshSelected();},error:e=>this.fail(e,'The draft could not be published.')}); }
  rollback(release: AgentRelease): void { const p=this.principal(),a=this.selected(); if(!p||!a||!this.can('agent_versions.rollback')||release.revoked_at)return; this.start(); this.admin.rollbackAgent(p.tenantId,a.agent_id,release.agent_release_id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({next:()=>{this.notice.set(`Release ${release.release_number} is active for future sessions. History was not rewritten.`);this.refreshSelected();},error:e=>this.fail(e,'The release could not be activated.')}); }
  revoke(release: AgentRelease): void { const p=this.principal(),a=this.selected(); if(!p||!a||!this.can('agents.disable')||!this.privilegedReady||this.revokeReason.invalid)return; this.start(); this.admin.revokeAgentRelease(p.tenantId,a.agent_id,release.agent_release_id,this.revokeReason.value).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({next:()=>{this.notice.set('Release emergency revocation recorded.');this.revokeReason.reset('');this.refreshSelected();},error:e=>this.fail(e,'The release could not be revoked.')}); }
  value(value: unknown): string { return JSON.stringify(value); }
  private refreshSelected(): void { const p=this.principal(),a=this.selected(); if(!p||!a)return; this.admin.listAgents(p.tenantId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({agents})=>{this.agents.set(agents);const current=agents.find(x=>x.agent_id===a.agent_id);if(current)this.select(current);}); }
  private start():void{this.busy.set(true);this.error.set('');this.notice.set('');}
  private fail(e:unknown,f:string):void{this.error.set(adminErrorMessage(e,f));this.busy.set(false);this.loading.set(false);}
}
