import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { firstValueFrom, Observable, of, throwError } from 'rxjs';
import {
  sophiaAdminGuard,
  sophiaAdminPermissionGuard,
} from './sophia-admin.guard';
import { SophiaAdminService } from './sophia-admin.service';

describe('sophiaAdminGuard', () => {
  async function run(
    context: unknown,
    guard = sophiaAdminGuard,
    data: Record<string, unknown> = {},
  ): Promise<boolean | UrlTree> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SophiaAdminService, useValue: { context: () => context } },
      ],
    });
    const result = TestBed.runInInjectionContext(() => guard(
      { data } as never,
      { url: '/sophia-admin/knowledge' } as never,
    ));
    return typeof result === 'boolean' || result instanceof UrlTree
      ? result
      : firstValueFrom(result as Observable<boolean | UrlTree>);
  }

  afterEach(() => TestBed.resetTestingModule());

  it('allows the shell after the server verifies an Admin principal', async () => {
    await expectAsync(run(of({ principal: { permissions: ['organisation.read'] } }))).toBeResolvedTo(true);
  });

  it('redirects a principal without a route permission to the accessible forbidden state', async () => {
    const result = await run(
      of({ principal: { permissions: ['agents.read'] } }),
      sophiaAdminPermissionGuard,
      { permission: 'knowledge.read' },
    );
    expect(result instanceof UrlTree).toBeTrue();
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toContain('/sophia-admin/forbidden');
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toContain('permission=knowledge.read');
  });

  it('allows a module route when its declared permission is present', async () => {
    await expectAsync(run(
      of({ principal: { permissions: ['knowledge.read'] } }),
      sophiaAdminPermissionGuard,
      { permission: 'knowledge.read' },
    )).toBeResolvedTo(true);
  });

  it('redirects an unverifiable identity to login', async () => {
    const result = await run(throwError(() => new Error('unauthorised')));
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toContain('/login');
  });
});
