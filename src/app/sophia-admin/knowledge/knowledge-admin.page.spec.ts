import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { SophiaAdminService } from '../sophia-admin.service';
import { KnowledgeAdminPage } from './knowledge-admin.page';

describe('KnowledgeAdminPage', () => {
  let fixture: ComponentFixture<KnowledgeAdminPage>;
  let admin: jasmine.SpyObj<SophiaAdminService>;

  beforeEach(async () => {
    admin = jasmine.createSpyObj<SophiaAdminService>('SophiaAdminService', [
      'context', 'listSources', 'listBindings', 'fileReadiness', 'listFileIntakes',
    ]);
    admin.context.and.returnValue(of({ principal: { tenantId: 'tenant-1', identityUserId: 'user-1', role: 'configuration_editor', permissions: ['knowledge.read', 'knowledge.ingest'] } }));
    admin.listSources.and.returnValue(of({ sources: [{ knowledge_source_id: 'source-1', source_key: 'draft-policy', title: 'Draft policy', source_type: 'managed_text', status: 'active', created_at: '2026-09-25T00:00:00Z', revisions: [{ knowledgeRevisionId: 'revision-1', revision: 1, status: 'draft', ingestionStatus: 'ready', createdAt: '2026-09-25T00:00:00Z' }] }] }));
    admin.listBindings.and.returnValue(of({ bindings: [] }));
    admin.fileReadiness.and.returnValue(of({ enabled: false, acceptedMediaTypes: ['text/plain'], maxUploadBytes: 1048576, parserIsolation: 'worker_thread', storage: { ready: false, reason: 'private storage unavailable' }, scanner: { ready: false, reason: 'scanner unavailable' } }));
    admin.listFileIntakes.and.returnValue(of({ intakes: [] }));
    await TestBed.configureTestingModule({ imports: [KnowledgeAdminPage], providers: [{ provide: SophiaAdminService, useValue: admin }] }).compileComponents();
    fixture = TestBed.createComponent(KnowledgeAdminPage); fixture.detectChanges();
  });

  afterEach(() => {
    document.documentElement.classList.remove('dark');
    window.resizeTo(1280, 900);
  });

  it('keeps file intake fail-closed and never offers retrieval preview for an unpublished revision', () => {
    const element = fixture.nativeElement as HTMLElement; const text = element.textContent || '';
    expect(text).toContain('File ingestion remains locked'); expect(text).toContain('Draft policy');
    expect(text).not.toContain('Test retrieval');
    expect((element.querySelector('input[type="file"]') as HTMLInputElement).disabled).toBeTrue();
  });

  it('uses the shared manager publication control and shows an actionable unavailable state', () => {
    const element = fixture.nativeElement as HTMLElement;
    const select = element.querySelector('app-manager-select[formcontrolname="capabilityBindingId"]');
    expect(select).not.toBeNull();
    expect(select?.querySelector('button')?.disabled).toBeTrue();
    expect(element.textContent).toContain('Knowledge publishing is not configured');
    expect(element.textContent).toContain('enabled Managed Knowledge capability');
  });

  it('uses the shared manager loader while tenant knowledge is loading', () => {
    fixture.componentInstance.loading.set(true);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('app-manager-list-loader')).not.toBeNull();
  });

  it('selects the provisioned managed knowledge binding and reports it ready', () => {
    admin.listBindings.and.returnValue(of({ bindings: [{
      capability_binding_id: 'binding-1',
      connector_key: 'sophia-managed-knowledge',
      business_profile_version_id: 'profile-version-1',
      business_profile_version: 1,
      profile_key: 'sophia-ai-managed-knowledge',
      display_name: 'Sophia AI managed knowledge',
    }] }));

    fixture.componentInstance.refresh();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const trigger = element.querySelector('app-manager-select[formcontrolname="capabilityBindingId"] button') as HTMLButtonElement;
    expect(trigger.disabled).toBeFalse();
    expect(trigger.textContent).toContain('Sophia AI managed knowledge');
    expect(fixture.componentInstance.publishForm.controls.capabilityBindingId.value).toBe('binding-1');
    expect(element.textContent).toContain('Managed Knowledge is ready');
  });

  it('keeps the publication grant usable at mobile width in dark mode', async () => {
    window.resizeTo(390, 844);
    document.documentElement.classList.add('dark');
    fixture.detectChanges();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const element = fixture.nativeElement as HTMLElement;
    const panel = element.querySelector('.publication-panel') as HTMLElement;
    const heading = panel.querySelector('.section-heading') as HTMLElement;
    expect(panel.getBoundingClientRect().width).toBeLessThanOrEqual(window.innerWidth);
    expect(getComputedStyle(heading).flexDirection).toBe('column');
    expect(getComputedStyle(panel).backgroundColor).toBe('rgb(24, 36, 56)');
  });
});
