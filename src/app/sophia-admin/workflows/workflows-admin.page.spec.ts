import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { SophiaAdminService } from '../sophia-admin.service';
import { WorkflowsAdminPage } from './workflows-admin.page';

describe('WorkflowsAdminPage', () => {
  let fixture: ComponentFixture<WorkflowsAdminPage>;
  let component: WorkflowsAdminPage;
  let admin: jasmine.SpyObj<SophiaAdminService>;
  const template = { templateKey: 'compiled.follow-up', version: '1.0.0', displayName: 'Follow-up',
    description: 'Owner-managed follow-up.', ownerKey: 'business-owner', connectorKey: 'approved-connector',
    configurationSchema: { type: 'object', additionalProperties: false, required: ['mode'], properties: { mode: { const: 'owner-managed' } } },
    requiredAuthorization: ['explicit-user-review'], statusOperationId: 'workflow.status', retry: { support: 'unsupported' as const } };

  beforeEach(async () => {
    admin = jasmine.createSpyObj<SophiaAdminService>('SophiaAdminService', [
      'context', 'workflowTemplates', 'workflows', 'workflowRuns', 'createWorkflow',
      'createWorkflowVersion', 'publishWorkflowVersion', 'workflowStatus', 'retryWorkflow',
    ]);
    admin.context.and.returnValue(of({ principal: { tenantId: 'tenant-1', identityUserId: 'user-1', role: 'configuration_editor', permissions: ['workflows.read', 'workflows.configure', 'workflows.publish', 'workflows.retry'] } }));
    admin.workflowTemplates.and.returnValue(of({ templates: [template] }));
    admin.workflows.and.returnValue(of({ workflows: [{ workflow_definition_id: 'definition-1', workflow_key: 'follow-up', template_key: template.templateKey, created_at: '2026-09-25T00:00:00Z', versions: [{ workflowVersionId: 'version-1', version: 1, status: 'draft', templateVersion: '1.0.0', configuration: { mode: 'owner-managed' }, requiredAuthorization: ['explicit-user-review'] }] }] }));
    admin.workflowRuns.and.returnValue(of({ runs: [{ workflowRunId: 'run-1', workflowVersionId: 'version-0', capabilityBindingId: 'binding-1', ownerKey: 'business-owner', externalRunRef: 'opaque-run', status: 'outcome_unknown', templateKey: template.templateKey, connectorKey: 'approved-connector' }] }));
    admin.createWorkflow.and.returnValue(of({})); admin.createWorkflowVersion.and.returnValue(of({}));
    admin.publishWorkflowVersion.and.returnValue(of({})); admin.retryWorkflow.and.returnValue(of({}));
    admin.workflowStatus.and.returnValue(of({ workflowRunId: 'run-1', workflowVersionId: 'version-0', capabilityBindingId: 'binding-1', ownerKey: 'business-owner', externalRunRef: 'opaque-run', status: 'outcome_unknown', templateKey: template.templateKey, connectorKey: 'approved-connector', authoritativeStatus: { status: 'outcome_unknown', retryable: false } }));
    await TestBed.configureTestingModule({ imports: [WorkflowsAdminPage], providers: [{ provide: SophiaAdminService, useValue: admin }] }).compileComponents();
    fixture = TestBed.createComponent(WorkflowsAdminPage); component = fixture.componentInstance; fixture.detectChanges();
  });

  it('derives fixed configuration from the compiled schema and never exposes arbitrary JSON editing', () => {
    expect(component.fixedConfiguration(template)).toEqual({ mode: 'owner-managed' });
    const element = fixture.nativeElement as HTMLElement; expect(element.textContent).toContain('owner-managed');
    expect(element.querySelector('textarea')).toBeNull();
  });

  it('shows authoritative aggregate status without fake steps or unsupported retry controls', () => {
    const element = fixture.nativeElement as HTMLElement; const text = element.textContent || '';
    expect(text).toContain('not durable step records'); expect(text).toContain('Manual retry unavailable');
    expect(text).not.toContain('Request idempotent retry');
    component.refreshStatus(component.runs()[0]); fixture.detectChanges();
    expect(admin.workflowStatus).toHaveBeenCalledWith('tenant-1', 'run-1');
    expect(fixture.nativeElement.textContent).toContain('outcome_unknown');
  });
});
