import { LeadSchedulingService } from '../components/schedule/leads/lead-scheduling.service';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { LeadFormsComponent } from './lead-forms.component';
import { LeadFormsService } from './lead-forms.service';
describe('Lead form builder', () => {
  let page: LeadFormsComponent,
    fixture: ComponentFixture<LeadFormsComponent>,
    api: jasmine.SpyObj<LeadFormsService>;
  beforeEach(async () => {
    api = jasmine.createSpyObj('LeadFormsService', [
      'types',
      'list',
      'save',
      'detail',
      'createType',
      'deleteType',
      'delete',
      'publication',
      'publish',
      'unpublish',
    ]);
    api.publication.and.returnValue(of({ token: null, version: null }));
    api.types.and.returnValue(
      of({ items: [{ id: 'type', name: 'Technical', formCount: 1 }] }),
    );
    api.list.and.returnValue(of({ items: [], total: 0 }));
    await TestBed.configureTestingModule({
      imports: [LeadFormsComponent],
      providers: [
        { provide: LeadFormsService, useValue: api },
        {
          provide: LeadSchedulingService,
          useValue: {
            context: () =>
              of({
                advisors: [{ id: 'advisor', name: 'Advisor' }],
                timezone: 'Australia/Brisbane',
              }),
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(LeadFormsComponent);
    page = fixture.componentInstance;
    page.canManage = true;
    fixture.detectChanges();
  });
  it('shows and copies the published friendly link in both layouts', async () => {
    const row = { id: 'form', name: 'Discovery', typeId: 'type', typeName: 'Marketing',
      version: 1, updatedAt: '', publicationToken: 'tenant.publication',
      friendlyUrl: 'https://example.test/forms/discovery' };
    page.rows = [row];
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.friendly-link a').length).toBe(2);
    expect(page.publicationUrl(row)).toBe(row.friendlyUrl);
    const copy = spyOn(navigator.clipboard, 'writeText').and.resolveTo();
    await page.copyFriendlyUrl(row);
    expect(copy).toHaveBeenCalledWith(row.friendlyUrl);
    expect(page.toast).toBe('Friendly URL copied.');
    copy.and.rejectWith(new Error('denied'));
    await page.copyFriendlyUrl(row);
    expect(page.tone).toBe('error');
    row.publicationToken = '';
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.friendly-link')).toBeNull();
  });
  it('requires valid comma-separated notification emails', () => {
    page.create();
    expect(page.validEmails()).toBeFalse();
    page.editor!.emails = 'jose@example.test, carolina@example.test';
    expect(page.validEmails()).toBeTrue();
    page.editor!.emails = 'jose@example.test, bad';
    expect(page.validEmails()).toBeFalse();
  });
  it('loads the list and preserves server paging and sorting', () => {
    api.list.and.returnValue(of({ items: [], total: 80 }));
    page.total = 80;
    page.goPage(2);
    expect(api.list.calls.mostRecent().args[0].page).toBe(2);
    page.sortBy('name');
    expect(api.list.calls.mostRecent().args[0]).toEqual(
      jasmine.objectContaining({ page: 1, sort: 'name', direction: 'asc' }),
    );
  });
  it('creates one question card containing its answer type and required controls', () => {
    page.create();
    page.add('question');
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('.block').length).toBe(1);
    expect(root.querySelector('.block-header strong')?.textContent).toContain(
      '1. Question',
    );
    expect(root.querySelectorAll('.required-options input').length).toBe(2);
    expect(
      root.querySelector('.question-answer app-manager-select'),
    ).toBeTruthy();
    expect(page.blockGroups[0].answer?.kind).toBe('input');
    expect(page.blockButtons.map((b) => b.kind)).toEqual([
      'title',
      'subtitle',
      'question',
      'description',
      'list',
      'input',
      'checkboxes',
      'calendar',
    ]);
  });
  it('validates options inside the question and saves the compatible answer relationship', () => {
    page.create();
    page.editor!.name = 'Discovery';
    page.editor!.typeId = 'type';
    page.editor!.emails = 'owner@example.test';
    page.add('question');
    page.editor!.blocks[0].text = 'Business type?';
    page.editor!.blocks[0].required = true;
    page.changeAnswer(0, 'list');
    page.save();
    expect(api.save).not.toHaveBeenCalled();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.block.invalid')).toBeTruthy();
    page.editor!.blocks[1].options = ['Education', 'Education'];
    page.save();
    expect(api.save).not.toHaveBeenCalled();
    page.editor!.blocks[1].options = ['Education', 'Other'];
    page.changeAnswer(0, 'checkboxes');
    expect(page.editor!.blocks[1].options).toEqual(['Education', 'Other']);
    const expected = structuredClone(page.editor!);
    api.save.and.returnValue(of({ ...expected, version: 1 }));
    page.save();
    expect(api.save).toHaveBeenCalledWith(expected);
    expect(page.editor).toBeNull();
  });
  it('loads existing separate question and answer records as one card without changing their IDs', () => {
    const question = {
      id: 'q',
      kind: 'question' as const,
      text: 'Your name?',
      required: true,
      options: [],
    };
    const answer = {
      id: 'a',
      kind: 'input' as const,
      text: 'Full name',
      required: false,
      options: [],
    };
    api.detail.and.returnValue(
      of({
        id: 'form',
        name: 'Discovery',
        typeId: 'type',
        blocks: [question, answer],
        version: 1,
      }),
    );
    page.open({
      id: 'form',
      name: 'Discovery',
      typeId: 'type',
      typeName: 'Technical',
      version: 1,
      updatedAt: '',
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.block').length).toBe(1);
    expect(page.blockGroups[0].answer?.id).toBe('a');
    expect(page.dirty).toBeFalse();
  });
  it('moves and removes questions with their answers and keeps card numbering consecutive', () => {
    page.create();
    page.add('title');
    page.add('question');
    page.add('question');
    page.add('description');
    const first = page.editor!.blocks[1].id,
      answer = page.editor!.blocks[2].id;
    page.move(1, 1);
    expect(page.editor!.blocks[3].id).toBe(first);
    expect(page.editor!.blocks[4].id).toBe(answer);
    page.move(3, -1);
    expect(page.editor!.blocks[1].id).toBe(first);
    fixture.detectChanges();
    expect(
      Array.from(
        fixture.nativeElement.querySelectorAll('.block-header strong'),
        (el: any) => el.textContent.trim(),
      ),
    ).toEqual(['1. Title', '2. Question', '3. Question', '4. Description']);
    page.remove(1);
    expect(
      page.editor!.blocks.some((b) => b.id === first || b.id === answer),
    ).toBeFalse();
    expect(page.blockGroups.length).toBe(3);
  });
  it('reserves space for both parts of a question at the storage limit', () => {
    page.create();
    for (let i = 0; i < 99; i++) page.add('title');
    expect(page.canAdd('question')).toBeFalse();
    page.add('question');
    expect(page.editor!.blocks.length).toBe(99);
  });
  it('keeps standalone controls separate and configures one calendar per form', () => {
    page.create();
    page.add('question');
    page.add('list');
    page.add('input');
    page.add('calendar');
    expect(page.blockGroups.map((g) => g.block.kind)).toEqual([
      'question',
      'list',
      'input',
      'calendar',
    ]);
    expect(page.canAdd('calendar')).toBeFalse();
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('app-lead-form-calendar-editor'),
    ).toBeTruthy();
    page.attempted = true;
    const calendar = page.editor!.blocks[4];
    expect(page.blockInvalid(calendar, 4)).toBeTrue();
    calendar.calendar!.advisorId = 'advisor';
    expect(page.blockInvalid(calendar, 4)).toBeFalse();
  });
  it('shows one public-link globe and a visibility-off unpublish action even after saved edits', () => {
    page.rows = [
      {
        id: 'form',
        name: 'Published',
        typeId: 'type',
        typeName: 'Technical',
        version: 2,
        updatedAt: '2026-11-16',
        publicationToken: 'tenant.publication',
        publishedVersion: 1,
      },
    ];
    fixture.detectChanges();
    const actions = fixture.nativeElement.querySelector(
      '.desktop-table .actions',
    );
    expect(
      actions.querySelectorAll('a[title="Open public form in a new tab"]')
        .length,
    ).toBe(1);
    expect(
      actions.querySelector('[title="Publish latest changes"]'),
    ).toBeNull();
    expect(
      actions.querySelector('[title="Unpublish"] path').getAttribute('d'),
    ).toContain('m3 3 18 18');
  });
  it('publishes and unpublishes directly from a form row', () => {
    const row: any = { id: 'form', name: 'Discovery', version: 2 };
    api.publish.and.returnValue(of({ token: 'tenant.publication' }));
    page.publishRow(row);
    expect(api.publish).toHaveBeenCalledWith(row);
    expect(row.publishedVersion).toBe(2);
    expect(page.publicationUrl(row)).toBe(
      window.location.origin + '/forms/tenant.publication',
    );
    api.unpublish.and.returnValue(of({}));
    page.unpublishRow(row);
    page.confirmation!.action();
    expect(row.publicationToken).toBeNull();
  });
  it('publishes only saved forms and shows the campaign URL', () => {
    page.create();
    page.editor!.version = 1;
    page.dirty = true;
    page.publish();
    expect(api.publish).not.toHaveBeenCalled();
    page.dirty = false;
    api.publish.and.returnValue(of({ token: 'tenant.publication' }));
    page.publish();
    expect(page.publicUrl).toBe(
      window.location.origin + '/forms/tenant.publication',
    );
    api.unpublish.and.returnValue(of({}));
    page.unpublish();
    expect(page.publicUrl).toBe('');
  });
  it('uses the stored friendly URL when publishing or reopening a form', () => {
    const friendlyUrl='https://sophiaai.com.au/forms/business-discovery';
    page.create();page.editor!.version=1;page.dirty=false;
    api.publish.and.returnValue(of({token:'tenant.publication',friendlyUrl}));
    page.publish();expect(page.publicUrl).toBe(friendlyUrl);
    api.detail.and.returnValue(of(page.editor!));
    api.publication.and.returnValue(of({token:'tenant.publication',version:1,friendlyUrl}));
    page.open({id:'form',name:'Business Discovery',version:1,typeId:'type',typeName:'Marketing',updatedAt:''});
    expect(page.publicUrl).toBe(friendlyUrl);
  });
  it('preserves edited content after a conflict', () => {
    page.create();
    page.editor!.name = 'Discovery';
    page.editor!.typeId = 'type';
    page.editor!.emails = 'owner@example.test';
    page.add('title');
    page.editor!.blocks[0].text = 'Hello';
    api.save.and.returnValue(
      throwError(() => ({ error: { error: 'Reload before saving.' } })),
    );
    page.save();
    expect(page.editor!.blocks[0].text).toBe('Hello');
    expect(page.dirty).toBeTrue();
    expect(page.busy).toBeFalse();
  });
  it('reorders blocks and confirms discarding changes', () => {
    page.create();
    page.add('title');
    page.add('subtitle');
    page.move(1, -1);
    expect(page.editor!.blocks[0].kind).toBe('subtitle');
    page.closeEditor();
    expect(page.editor).not.toBeNull();
    expect(page.confirmation).not.toBeNull();
    page.confirm();
    expect(page.editor).toBeNull();
  });
  it('renders rich text safely and required questions in preview', () => {
    page.create();
    page.add('description');
    page.editor!.blocks[0].text =
      '<b>Welcome</b><img onerror="alert(1)"><script>alert(2)</script>';
    page.add('question');
    page.editor!.blocks[1].text = 'Your name?';
    page.editor!.blocks[1].required = true;
    page.preview = true;
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.rich-description b')?.textContent).toBe(
      'Welcome',
    );
    expect(root.querySelector('script')).toBeNull();
    expect(root.querySelector('[onerror]')).toBeNull();
    expect(
      root.querySelector('.form-preview input')?.hasAttribute('required'),
    ).toBeTrue();
  });
  it('keeps the block toolbar sticky beside questions and adapts to narrow screens', () => {
    page.create();
    for (let i = 0; i < 8; i++) page.add('question');
    page.changeAnswer(0, 'richtext');
    fixture.detectChanges();
    const frame = document.createElement('iframe');
    frame.style.height = '600px';
    document.body.appendChild(frame);
    try {
      const doc = frame.contentDocument!;
      for (const style of Array.from(document.querySelectorAll('style')))
        doc.head.appendChild(style.cloneNode(true));
      doc.body.style.margin = '0';
      doc.body.appendChild(fixture.nativeElement.cloneNode(true));
      for (const width of [390, 1280])
        for (const dark of [false, true]) {
          frame.style.width = width + 'px';
          doc.documentElement.classList.toggle('dark', dark);
          const toolbar = doc.querySelector('.block-toolbar') as HTMLElement;
          const content = doc.querySelector('.builder-content') as HTMLElement;
          expect(frame.contentWindow!.getComputedStyle(toolbar).position).toBe(
            'sticky',
          );
          if (width === 1280) {
            expect(toolbar.getBoundingClientRect().left).toBeGreaterThan(
              content.getBoundingClientRect().left,
            );
            expect(content.offsetWidth / toolbar.offsetWidth).toBeCloseTo(4, 0);
          }
          expect(doc.documentElement.scrollWidth).toBeLessThanOrEqual(width);
          frame.contentWindow!.scrollTo(0, 800);
          expect(toolbar.getBoundingClientRect().top).toBeGreaterThanOrEqual(0);
          frame.contentWindow!.scrollTo(0, 0);
        }
    } finally {
      frame.remove();
    }
  });
  it('renders desktop and mobile layouts in light and dark themes', () => {
    page.rows = [
      {
        id: 'form',
        name: 'Discovery',
        typeId: 'type',
        typeName: 'Technical',
        version: 1,
        updatedAt: '2026-11-15',
        publicationToken: 'tenant.publication',
        friendlyUrl: 'https://sophiaai.com.au/forms/prepare-for-your-meeting',
      },
    ];
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('table')).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('.mobile-cards .lead-card'),
    ).toBeTruthy();
    const frame = document.createElement('iframe');
    frame.style.height = '900px';
    document.body.appendChild(frame);
    try {
      const doc = frame.contentDocument!;
      for (const style of Array.from(document.querySelectorAll('style')))
        doc.head.appendChild(style.cloneNode(true));
      doc.body.style.margin = '0';
      doc.body.appendChild(fixture.nativeElement.cloneNode(true));
      for (const width of [390, 1280])
        for (const dark of [false, true]) {
          frame.style.width = width + 'px';
          doc.documentElement.classList.toggle('dark', dark);
          const style = (selector: string) =>
            frame.contentWindow!.getComputedStyle(doc.querySelector(selector)!);
          expect(style('.desktop-table').display).toBe(
            width < 860 ? 'none' : 'block',
          );
          expect(style('.mobile-cards').display).toBe(
            width < 860 ? 'block' : 'none',
          );
          expect(style('.card').backgroundColor).toBe(
            dark ? 'rgb(24, 36, 56)' : 'rgb(255, 255, 255)',
          );
          expect(doc.documentElement.scrollWidth).toBeLessThanOrEqual(width);
        }
    } finally {
      frame.remove();
    }
  });
});
