import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Title } from '@angular/platform-browser';
import { appRoutes } from '../app.routes';

describe('Public legal pages', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter(appRoutes)] }));

  it('opens the policy without authentication and identifies Sydney hosting', async () => {
    const harness = await RouterTestingHarness.create('/privacy-policy');
    const page = harness.routeNativeElement!;
    expect(page.querySelector('h1')?.textContent).toContain('Privacy Policy');
    expect(page.textContent).toContain('AWS Amplify website hosting in Sydney, Australia');
    expect(page.textContent).not.toContain('Virginia');
    expect(page.querySelector('a[href="mailto:hello@sophiaai.com.au"]')).not.toBeNull();
    expect(TestBed.inject(Title).getTitle()).toBe('Privacy policy | Sophia Ai');
  });

  it('opens deletion instructions without authentication', async () => {
    const harness = await RouterTestingHarness.create('/data-deletion');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('Request deletion');
    expect(harness.routeNativeElement?.querySelector('a[href="/privacy-policy"]')).not.toBeNull();
  });

  it('preserves the previously shared .html URLs through public redirects', async () => {
    const harness = await RouterTestingHarness.create();
    for (const slug of ['privacy-policy', 'data-deletion']) {
      await harness.navigateByUrl(`/${slug}.html`);
      expect(TestBed.inject(Router).url).toBe(`/${slug}`);
      expect(harness.routeNativeElement?.querySelector('h1')).not.toBeNull();
    }
  });
});
