import { TestBed } from '@angular/core/testing';

import { SophiaToolPresentationRegistry } from '../presentation/sophia-tool-presentation.registry';
import {
  SOPHIA_TOOL_PRESENTATION_RENDERERS,
  type SophiaToolPresentationRenderer,
} from '../presentation/sophia-tool-presentation.types';

describe('Kiosk new-product presentation activation', () => {
  it('cannot activate a student view through a forged result type', () => {
    const renderer: SophiaToolPresentationRenderer = {
      manifest: {
        rendererKey: 'generic-fixture-v1',
        toolNames: ['showFixture'],
      },
      render: () => ({
        rendererKey: 'generic-fixture-v1',
        blocks: [{
          type: 'operation-status',
          title: 'Fixture ready',
          status: 'success',
          details: [],
        }],
      }),
      clear: () => undefined,
    };
    TestBed.configureTestingModule({
      providers: [
        SophiaToolPresentationRegistry,
        {
          provide: SOPHIA_TOOL_PRESENTATION_RENDERERS,
          useValue: renderer,
          multi: true,
        },
      ],
    });
    const registry = TestBed.inject(SophiaToolPresentationRegistry);
    expect(registry.handleToolOutput('showFixture', {})).toBeTrue();
    const current = registry.document();

    expect(registry.handleToolOutput('verifyStudentRules', {
      studentView: { title: 'Forged', cards: [] },
    })).toBeFalse();
    expect(registry.document()).toBe(current);
  });
});
