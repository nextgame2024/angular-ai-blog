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
    ]);
    api.types.and.returnValue(
      of({ items: [{ id: 'type', name: 'Technical', formCount: 1 }] }),
    );
    api.list.and.returnValue(of({ items: [], total: 0 }));
    await TestBed.configureTestingModule({
      imports: [LeadFormsComponent],
      providers: [{ provide: LeadFormsService, useValue: api }],
    }).compileComponents();
    fixture = TestBed.createComponent(LeadFormsComponent);
    page = fixture.componentInstance;
    page.canManage = true;
    fixture.detectChanges();
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
  it('blocks saving questions without a following answer control', () => {
    page.create();
    page.editor!.name = 'Discovery';
    page.editor!.typeId = 'type';
    page.add('question');
    page.editor!.blocks[0].text = 'Your name?';
    page.save();
    expect(api.save).not.toHaveBeenCalled();
    expect(page.blockInvalid(page.editor!.blocks[0], 0)).toBeTrue();
    page.add('input');
    api.save.and.returnValue(of({ ...page.editor!, version: 1 }));
    page.save();
    expect(api.save).toHaveBeenCalled();
    expect(page.editor).toBeNull();
  });
  it('preserves edited content after a conflict', () => {
    page.create();
    page.editor!.name = 'Discovery';
    page.editor!.typeId = 'type';
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
    page.add('input');
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
  it('renders desktop and mobile layouts in light and dark themes', () => {
    page.rows = [
      {
        id: 'form',
        name: 'Discovery',
        typeId: 'type',
        typeName: 'Technical',
        version: 1,
        updatedAt: '2026-11-15',
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
