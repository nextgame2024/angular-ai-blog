import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { SophiaAdminService } from '../sophia-admin.service';
import type { AgentSummary } from '../sophia-admin.types';
import { AgentVersionsAdminPage } from './agent-versions-admin.page';

describe('AgentVersionsAdminPage', () => {
  let fixture:ComponentFixture<AgentVersionsAdminPage>;let admin:jasmine.SpyObj<SophiaAdminService>;
  const agent:AgentSummary={agent_id:'agent-1',agent_key:'neutral-agent',status:'draft',draft_revision:3,created_at:'2026-01-01T00:00:00Z',updated_at:'2026-01-01T00:00:00Z'};
  beforeEach(async()=>{admin=jasmine.createSpyObj<SophiaAdminService>('SophiaAdminService',['context','listAgents','agentReleases','agentDiff','validateAgent','publishAgent','rollbackAgent','revokeAgentRelease']);admin.context.and.returnValue(of({principal:{tenantId:'tenant-1',identityUserId:'publisher',role:'release_publisher',permissions:['agents.read','agents.publish','agent_versions.read','agent_versions.publish','agent_versions.rollback']}}));admin.listAgents.and.returnValue(of({agents:[agent]}));admin.agentReleases.and.returnValue(of({agentId:'agent-1',releases:[]}));admin.agentDiff.and.returnValue(of({agentId:'agent-1',draftRevision:3,changes:[]}));admin.validateAgent.and.returnValue(of({revision:3,checks:[{checkId:'instruction.approved',status:'failed',message:'Missing approved instruction.'}]}));await TestBed.configureTestingModule({imports:[AgentVersionsAdminPage],providers:[{provide:SophiaAdminService,useValue:admin}]}).compileComponents();fixture=TestBed.createComponent(AgentVersionsAdminPage);fixture.detectChanges();});
  it('blocks publication when server readiness checks fail and states that drafts are not live',()=>{fixture.detectChanges();expect(fixture.componentInstance.publishable()).toBeFalse();const element=fixture.nativeElement as HTMLElement;expect(element.textContent).toContain('Missing approved instruction.');expect(element.textContent).toContain('Draft changes cannot affect live sessions');expect((element.querySelector('.primary') as HTMLButtonElement).disabled).toBeTrue();});
});
