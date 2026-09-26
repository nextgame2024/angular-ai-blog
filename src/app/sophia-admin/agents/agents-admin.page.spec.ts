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
  capabilityBindings: [], knowledgeRevisions: [], workflowVersions: [], escalationPolicyVersions: [], restrictedSections: [],
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
  it('uses the same generic selectors for neutral and optional-pack profiles and exposes safe provider limits', () => {
    fixture.detectChanges(); const text=(fixture.nativeElement as HTMLElement).textContent||'';
    expect(text).toContain('Neutral service'); expect(text).toContain('Property advisory');
    expect(text).toContain('reasoning, speech-output'); expect(text).toContain('Reasoning replaceable: no');
    expect(text).not.toContain('env://'); expect(text).not.toContain('api key');
  });
  it('runs only the deterministic preview endpoint', () => {
    admin.previewAgent.and.returnValue(of({ mode:'deterministic-composition-only',externalEffects:false,meteredSessionCreated:false,draftRevision:2,platformSafetyPolicyVersion:'sophia-safety-1',instruction:{content:'Hello Taylor'},checks:[] }));
    fixture.componentInstance.previewVariables.setValue('customerName=Taylor'); fixture.componentInstance.runPreview();
    expect(admin.previewAgent).toHaveBeenCalledWith('tenant-1','agent-1',{customerName:'Taylor'});
    expect(fixture.componentInstance.preview()?.instruction.content).toBe('Hello Taylor');
  });
});
