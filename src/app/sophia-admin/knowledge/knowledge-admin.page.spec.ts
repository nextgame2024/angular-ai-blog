import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { SophiaAdminService } from '../sophia-admin.service';
import { KnowledgeAdminPage } from './knowledge-admin.page';

describe('KnowledgeAdminPage', () => {
  let fixture: ComponentFixture<KnowledgeAdminPage>;

  beforeEach(async () => {
    const admin = jasmine.createSpyObj<SophiaAdminService>('SophiaAdminService', [
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

  it('keeps file intake fail-closed and never offers retrieval preview for an unpublished revision', () => {
    const element = fixture.nativeElement as HTMLElement; const text = element.textContent || '';
    expect(text).toContain('File ingestion remains locked'); expect(text).toContain('Draft policy');
    expect(text).not.toContain('Test retrieval');
    expect((element.querySelector('input[type="file"]') as HTMLInputElement).disabled).toBeTrue();
  });
});
