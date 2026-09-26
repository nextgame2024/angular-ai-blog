import { TestBed } from '@angular/core/testing';
import { SophiaPresentationMediaPolicy } from './sophia-presentation-media-policy';
import { SOPHIA_PRESENTATION_MEDIA_HOSTS } from './sophia-tool-presentation.types';

describe('SophiaPresentationMediaPolicy', () => {
  it('allows only HTTPS media from an exact registered hostname', () => {
    TestBed.configureTestingModule({
      providers: [
        SophiaPresentationMediaPolicy,
        { provide: SOPHIA_PRESENTATION_MEDIA_HOSTS, useValue: ['media.example.com'] },
      ],
    });
    const policy = TestBed.inject(SophiaPresentationMediaPolicy);
    expect(policy.allow('https://media.example.com/image.jpg')).toBe(
      'https://media.example.com/image.jpg',
    );
    expect(policy.allow('javascript:alert(1)')).toBeNull();
    expect(policy.allow('http://media.example.com/image.jpg')).toBeNull();
    expect(policy.allow('https://media.example.com.evil.test/image.jpg')).toBeNull();
    expect(policy.allow('https://user:secret@media.example.com/image.jpg')).toBeNull();
  });
});
