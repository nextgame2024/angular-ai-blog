import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { SophiaAdminService } from '../sophia-admin.service';
import type { AgentAuthoringDependencies, AgentDetail } from '../sophia-admin.types';
import { AgentsAdminPage } from './agents-admin.page';

const configuration = {
  displayName: 'Property concierge', defaultLocale: 'en-AU', allowedLocales: ['en-AU'],
  instructionRevisionId: 'instruction-1', businessProfileVersionId: 'business-property',
  experienceProfileVersionIds: ['experience-property'], capabilityBindingIds: [],
  knowledgeRevisionIds: [], workflowVersionIds: [],
};
const agent: AgentDetail = {
  agent_id: 'agent-1', agent_key: 'property-concierge', status: 'draft', active_release_id: null,
  draft_revision: 2, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-02T00:00:00Z',
  updated_by_identity: 'editor', configuration,
};
const dependencies: AgentAuthoringDependencies = {
  businessProfiles: [
    { businessProfileVersionId: 'business-neutral', profileKey: 'neutral', displayName: 'Neutral service', version: 1 },
    { businessProfileVersionId: 'business-property', profileKey: 'property', displayName: 'Property advisory', version: 2, packRegistrationKey: 'optional-pack' },
  ],
  experienceProfiles: [{
    experienceProfileVersionId: 'experience-property', experienceKey: 'voice', displayName: 'Property voice',
    businessProfileVersionId: 'business-property', version: 3, pipelineMode: 'native-realtime',
    providers: [{
      providerId: 'registered-realtime', adapterKey: 'registered-v1', capabilities: ['reasoning', 'speech-output'],
      supportedModes: ['native-realtime'], supportedInputModalities: ['audio'], supportedOutputModalities: ['audio'],
      languages: ['en-AU'], interruptionCapabilities: ['provider-cancel'], transports: ['webrtc'],
      limitations: { reasoningIsReplaceable: false, maxSessionDuration: 900, toolCatalogUpdateSupport: 'none', concurrencyLimits: null, healthFailClosed: true },
    }],
  }],
  instructionRevisions: [{ instructionRevisionId: 'instruction-1', instructionKey: 'assistant', revision: 1, status: 'approved', createdByIdentity: 'editor' }],
  capabilityBindings: [],
  knowledgeRevisions: Array.from({ length: 9 }, (_, index) => ({
    knowledgeRevisionId: `knowledge-${index + 1}`,
    sourceKey: `source-${index + 1}`,
    title: `Knowledge source ${index + 1}`,
    revision: 1,
  })),
  workflowVersions: [], escalationPolicyVersions: [], restrictedSections: [],
};

describe('AgentsAdminPage', () => {
  let fixture: ComponentFixture<AgentsAdminPage>;
  let admin: jasmine.SpyObj<SophiaAdminService>;
  beforeEach(async () => {
    admin = jasmine.createSpyObj<SophiaAdminService>('SophiaAdminService', [
      'context','listAgents','agentDependencies','getAgent','createAgent','updateAgentDraft','validateAgent','previewAgent',
    ]);
    admin.context.and.returnValue(of({ principal: { tenantId: 'tenant-1', identityUserId: 'editor', role: 'configuration_editor', permissions: ['agents.read','agents.edit','instructions.test'] } }));
    admin.listAgents.and.returnValue(of({ agents: [agent] })); admin.agentDependencies.and.returnValue(of(dependencies)); admin.getAgent.and.returnValue(of(agent));
    await TestBed.configureTestingModule({ imports: [AgentsAdminPage], providers: [{ provide: SophiaAdminService, useValue: admin }] }).compileComponents();
    fixture=TestBed.createComponent(AgentsAdminPage); fixture.detectChanges();
  });
  afterEach(() => {
    document.documentElement.classList.remove('dark');
    window.resizeTo(1280, 900);
  });
  it('uses the same generic selectors for neutral and optional-pack profiles and exposes safe provider limits', () => {
    fixture.detectChanges(); const text=(fixture.nativeElement as HTMLElement).textContent||'';
    expect(fixture.componentInstance.businessProfileOptions().map((option) => option.label)).toEqual([
      'Neutral service · v1', 'Property advisory · v2',
    ]);
    expect(text).toContain('Property advisory');
    expect(text).toContain('reasoning, speech-output'); expect(text).toContain('Reasoning replaceable: no');
    expect(text).not.toContain('env://'); expect(text).not.toContain('api key');
  });
  it('runs only the deterministic preview endpoint', () => {
    admin.previewAgent.and.returnValue(of({ mode:'deterministic-composition-only',externalEffects:false,meteredSessionCreated:false,draftRevision:2,platformSafetyPolicyVersion:'sophia-safety-1',instruction:{content:'Hello Taylor'},checks:[] }));
    fixture.componentInstance.previewVariables.setValue('customerName=Taylor'); fixture.componentInstance.runPreview();
    expect(admin.previewAgent).toHaveBeenCalledWith('tenant-1','agent-1',{customerName:'Taylor'});
    expect(fixture.componentInstance.preview()?.instruction.content).toBe('Hello Taylor');
  });
  it('uses shared manager selects and an actionable empty experience state', () => {
    fixture.componentInstance.startNew();
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('app-manager-select').length).toBe(3);
    expect(element.textContent).toContain('No published experiences are available');
    expect(element.textContent).toContain('must be provisioned and published');
  });
  it('selects and clears every published knowledge source without native multi-select controls', () => {
    fixture.componentInstance.startNew();
    fixture.componentInstance.selectAllKnowledge();
    fixture.detectChanges();
    expect(fixture.componentInstance.form.controls.knowledgeRevisionIds.value).toHaveSize(9);
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('select[multiple]').length).toBe(0);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('9 selected');
    fixture.componentInstance.clearSelection('knowledgeRevisionIds');
    expect(fixture.componentInstance.form.controls.knowledgeRevisionIds.value).toEqual([]);
  });
  it('keeps resource selection single-column and readable in dark mode at a narrow viewport', async () => {
    window.resizeTo(390, 844);
    document.documentElement.classList.add('dark');
    fixture.detectChanges();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const element = fixture.nativeElement as HTMLElement;
    const workspace = element.querySelector('.workspace-grid') as HTMLElement;
    const resource = element.querySelector('.resource-group') as HTMLElement;
    expect(workspace.getBoundingClientRect().width).toBeLessThanOrEqual(window.innerWidth);
    expect(getComputedStyle(workspace).gridTemplateColumns.split(' ')).toHaveSize(1);
    expect(getComputedStyle(resource).backgroundColor).toBe('rgb(28, 42, 64)');
  });
});
