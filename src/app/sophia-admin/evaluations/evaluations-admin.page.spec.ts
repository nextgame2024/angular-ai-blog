import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { SophiaAdminService } from '../sophia-admin.service';
import { EvaluationsAdminPage } from './evaluations-admin.page';

describe('EvaluationsAdminPage', () => {
  let fixture: ComponentFixture<EvaluationsAdminPage>; let admin: jasmine.SpyObj<SophiaAdminService>;
  beforeEach(async () => {
    admin = jasmine.createSpyObj<SophiaAdminService>('SophiaAdminService', ['context', 'evaluations', 'listAgents']);
    admin.context.and.returnValue(of({ principal: { tenantId: 'tenant-1', identityUserId: 'editor', role: 'configuration_editor', permissions: ['evaluations.read', 'evaluations.edit', 'evaluations.run'] } }));
    admin.listAgents.and.returnValue(of({ agents: [] }));
    admin.evaluations.and.returnValue(of({
      registry: { evaluatorKey: 'deterministic-publication-checks', evaluatorVersion: 1, evidenceMode: 'deterministic', supportedPublicationChecks: ['instruction.approved'], externalEffects: false, meteredSessionCreated: false, liveProviderRuns: { available: false, reason: 'gates unavailable' } },
      datasets: [], requirements: [], runs: [], releases: [],
    }));
    await TestBed.configureTestingModule({ imports: [EvaluationsAdminPage], providers: [{ provide: SophiaAdminService, useValue: admin }] }).compileComponents();
    fixture = TestBed.createComponent(EvaluationsAdminPage); fixture.detectChanges();
  });
  it('labels deterministic evidence and makes live provider evidence unavailable', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('deterministic-publication-checks');
    expect(text).toContain('Live/provider-judged runs are unavailable');
    expect(text).toContain('never labelled live');
  });
});
