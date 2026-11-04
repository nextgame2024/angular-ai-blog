import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { SophiaAdminService } from '../sophia-admin.service';
import { InstructionsAdminPage } from './instructions-admin.page';

describe('InstructionsAdminPage', () => {
  let fixture: ComponentFixture<InstructionsAdminPage>;
  let admin: jasmine.SpyObj<SophiaAdminService>;

  beforeEach(async () => {
    admin = jasmine.createSpyObj<SophiaAdminService>('SophiaAdminService', [
      'context',
      'listInstructionSets',
      'createInstructionSet',
      'createInstructionRevision',
      'approveInstructionRevision',
    ]);
    admin.context.and.returnValue(of({
      principal: {
        tenantId: 'tenant-1',
        identityUserId: 'editor',
        role: 'configuration_editor',
        permissions: ['instructions.read', 'instructions.edit'],
      },
    }));
    admin.listInstructionSets.and.returnValue(of({
      platformSafetyPolicyVersion: 'sophia-safety-1',
      instructionSets: [{
        instruction_set_id: 'set-1',
        instruction_key: 'neutral-assistant',
        created_at: '2026-01-01T00:00:00Z',
        revisions: [{
          instructionRevisionId: 'revision-1',
          revision: 1,
          status: 'draft',
          content: 'Hello {{customerName}}',
          variableSchema: {
            type: 'object',
            properties: { customerName: { type: 'string' } },
            additionalProperties: false,
          },
          createdByIdentity: 'editor',
          createdAt: '2026-01-01T00:00:00Z',
        }],
      }],
    }));

    await TestBed.configureTestingModule({
      imports: [InstructionsAdminPage],
      providers: [{ provide: SophiaAdminService, useValue: admin }],
    }).compileComponents();
    fixture = TestBed.createComponent(InstructionsAdminPage);
    fixture.detectChanges();
  });

  afterEach(() => {
    document.documentElement.classList.remove('dark');
    window.resizeTo(1280, 900);
  });

  it('separates tenant drafts from immutable platform safety and live releases', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent || '';
    expect(text).toContain('sophia-safety-1');
    expect(text).toContain('Not tenant editable');
    expect(text).toContain('draft');
    expect(text).toContain('Drafts and approvals');
  });

  it('keeps the draft approval action visible with the Business Manager primary-button treatment', () => {
    const button = (fixture.nativeElement as HTMLElement).querySelector('.approval-action') as HTMLButtonElement;
    const styles = getComputedStyle(button);

    expect(button.textContent?.trim()).toBe('Approve immutable revision');
    expect(button.disabled).toBeFalse();
    expect(styles.backgroundColor).toBe('rgb(10, 167, 143)');
    expect(styles.color).toBe('rgb(255, 255, 255)');
    expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
  });

  it('explains that the instruction greeting is optional for channel-managed WhatsApp greetings', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Instruction greeting');
    expect(element.textContent).toContain('keep the customer-facing greeting in Leads & Conversations settings');
  });

  it('keeps the authoring workspace usable at mobile width in dark mode', async () => {
    window.resizeTo(390, 844);
    document.documentElement.classList.add('dark');
    fixture.detectChanges();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const element = fixture.nativeElement as HTMLElement;
    const workspace = element.querySelector('.workspace-grid') as HTMLElement;
    const card = element.querySelector('.revision-section') as HTMLElement;
    const button = element.querySelector('.approval-action') as HTMLButtonElement;
    expect(workspace.getBoundingClientRect().width).toBeLessThanOrEqual(window.innerWidth);
    expect(getComputedStyle(workspace).gridTemplateColumns.split(' ')).toHaveSize(1);
    expect(getComputedStyle(card).backgroundColor).toBe('rgb(24, 36, 56)');
    expect(button.getBoundingClientRect().width).toBeGreaterThan(300);
  });
});
