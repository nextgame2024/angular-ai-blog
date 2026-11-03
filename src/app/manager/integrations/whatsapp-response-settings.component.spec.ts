import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { WhatsAppResponseSettingsComponent } from './whatsapp-response-settings.component';
import { WhatsAppConnectionService } from './whatsapp-connection.service';
describe('Approved agent response binding', () => {
  it('loads lazily, reuses published releases and saves optimistic mode changes', async () => {
    const api = jasmine.createSpyObj('WhatsAppConnectionService', [
      'responses',
      'bindResponse',
    ]);
    api.responses.and.returnValue(
      of({
        releases: [{ id: 'r', label: 'Assistant', version: 2 }],
        bindings: [
          { profileId: 'pilot', releaseId: 'r', mode: 'review', revision: 3 },
        ],
      }),
    );
    api.bindResponse.and.returnValue(of({ revision: 4 }));
    await TestBed.configureTestingModule({
      imports: [WhatsAppResponseSettingsComponent],
      providers: [{ provide: WhatsAppConnectionService, useValue: api }],
    }).compileComponents();
    const fixture = TestBed.createComponent(WhatsAppResponseSettingsComponent);
    fixture.componentRef.setInput('profileId', 'pilot');
    fixture.detectChanges();
    expect(api.responses).not.toHaveBeenCalled();
    const page = fixture.componentInstance;
    page.open();
    fixture.detectChanges();
    expect(page.options[0].label).toContain('Version 2');
    page.mode = 'automatic';
    page.save();
    expect(api.bindResponse).toHaveBeenCalledWith('pilot', 'r', 'automatic', 3);
    expect(page.revision).toBe(4);
    api.bindResponse.and.returnValue(
      throwError(() => ({ error: { error: 'Refresh first' } })),
    );
    page.save();
    expect(page.message).toBe('Refresh first');
    expect(page.releaseId).toBe('r');
    fixture.destroy();
  });
});
