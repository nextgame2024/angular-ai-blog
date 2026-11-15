import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { PublicFormPage } from './public-form.page';
import { environment } from 'src/environments/environment';
describe('Published customer form', () => {
  let fixture: ComponentFixture<PublicFormPage>,
    page: PublicFormPage,
    http: HttpTestingController;
  const token = 'tenant.publication';
  const base = environment.apiUrl + '/public/forms/' + token;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PublicFormPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ token })) },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PublicFormPage);
    page = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(base).flush({
      name: 'Discovery',
      businessName: 'Example',
      version: 3,
      blocks: [
        {
          id: 'q',
          kind: 'question',
          text: 'Business type?',
          required: true,
          options: [],
        },
        {
          id: 'a',
          kind: 'list',
          text: '',
          required: false,
          options: ['Education', 'Other'],
        },
      ],
    });
    fixture.detectChanges();
  });
  afterEach(() => http.verify());
  it('rejects visually empty rich-text answers and submits formatted text', () => {
    page.form!.blocks[1].kind = 'richtext';
    fixture.detectChanges();
    page.contact = { name: 'Jane', email: 'jane@example.test', phone: '' };
    page.answers['a'] = '<p>&nbsp;<br></p>';
    page.submit();
    expect(page.invalid.has('a')).toBeTrue();
    http.expectNone(base + '/submissions');
    page.answers['a'] = '<p><strong>My goals</strong></p>';
    page.submit();
    const request = http.expectOne(base + '/submissions');
    expect(request.request.body.answers.a).toContain(
      '<strong>My goals</strong>',
    );
    request.flush({});
  });
  it('requires contact details and question answers before submitting', () => {
    page.submit();
    expect(page.invalid.has('name')).toBeTrue();
    expect(page.invalid.has('email')).toBeTrue();
    expect(page.invalid.has('a')).toBeTrue();
    http.expectNone(base + '/submissions');
  });
  it('submits the published version and answers, preserving the request key on retry', () => {
    page.contact = { name: 'Jane', email: 'jane@example.test', phone: '' };
    page.answers = { a: 'Education' };
    page.submit();
    const first = http.expectOne(base + '/submissions');
    const key = first.request.body.requestKey;
    expect(first.request.body.formVersion).toBe(3);
    expect(first.request.body.answers).toEqual({ a: 'Education' });
    first.flush(
      { error: 'Temporary problem' },
      { status: 503, statusText: 'Unavailable' },
    );
    page.submit();
    const retry = http.expectOne(base + '/submissions');
    expect(retry.request.body.requestKey).toBe(key);
    retry.flush({ receipt: 'receipt', appointment: null });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'Your response has been received.',
    );
  });
  it('shows confirmation with the appointment timezone', () => {
    page.result = {
      appointment: {
        startsAt: '2026-12-01T00:00:00.000Z',
        timezone: 'Australia/Brisbane',
      },
    };
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Australia/Brisbane');
    expect(fixture.nativeElement.querySelector('.submit')).toBeNull();
  });
  it('keeps public content within mobile and desktop widths in both themes', () => {
    const frame = document.createElement('iframe');
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
          expect(doc.documentElement.scrollWidth).toBeLessThanOrEqual(width);
          expect(
            frame.contentWindow!.getComputedStyle(doc.querySelector('.card')!)
              .backgroundColor,
          ).toBe(dark ? 'rgb(24, 36, 56)' : 'rgb(255, 255, 255)');
        }
    } finally {
      frame.remove();
    }
  });
});
