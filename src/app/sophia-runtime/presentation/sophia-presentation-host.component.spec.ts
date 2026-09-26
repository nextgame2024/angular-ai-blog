import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SophiaPresentationMediaPolicy } from './sophia-presentation-media-policy';
import { SophiaPresentationHostComponent } from './sophia-presentation-host.component';
import { SophiaToolPresentationRegistry } from './sophia-tool-presentation.registry';
import { SOPHIA_PRESENTATION_MEDIA_HOSTS } from './sophia-tool-presentation.types';

describe('SophiaPresentationHostComponent', () => {
  let fixture: ComponentFixture<SophiaPresentationHostComponent>;

  beforeEach(async () => {
    const document = signal({
      rendererKey: 'generic-fixture-v1',
      blocks: [{
        type: 'source-list' as const,
        title: '<script>alert(1)</script>',
        items: [{
          id: 'item-1',
          title: '<img src=x onerror=alert(1)>',
          excerpt: 'Structured text only',
        }],
      }],
    });
    await TestBed.configureTestingModule({
      imports: [SophiaPresentationHostComponent],
      providers: [
        SophiaPresentationMediaPolicy,
        { provide: SOPHIA_PRESENTATION_MEDIA_HOSTS, useValue: ['media.example.com'] },
        {
          provide: SophiaToolPresentationRegistry,
          useValue: {
            document,
            handleAction: async () => undefined,
            updateField: () => undefined,
            clear: () => undefined,
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(SophiaPresentationHostComponent);
    fixture.detectChanges();
  });

  it('renders structured strings as text and never as supplied HTML', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('script')).toBeNull();
    expect(element.querySelector('.sources img')).toBeNull();
    expect(element.textContent).toContain('<script>alert(1)</script>');
    expect(element.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('rejects media that a registered renderer did not pass through the host policy', () => {
    const component = fixture.componentInstance;
    expect(component.safeMedia({
      mediaId: 'safe',
      url: 'https://media.example.com/photo.jpg',
      altText: 'Safe photo',
    })?.url).toBe('https://media.example.com/photo.jpg');
    expect(component.safeMedia({
      mediaId: 'unsafe',
      url: 'https://unregistered.example/photo.jpg',
      altText: 'Untrusted photo',
    })).toBeNull();
  });
});
