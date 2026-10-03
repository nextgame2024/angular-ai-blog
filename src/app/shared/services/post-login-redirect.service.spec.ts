import { firstValueFrom } from 'rxjs';
import { PostLoginRedirectService } from './post-login-redirect.service';

describe('PostLoginRedirectService', () => {
  it('redirects an ordinary login home without waiting for access APIs', async () => {
    const navigation = jasmine.createSpyObj('NavigationLinksProjectsService', [
      'listActiveNavigationLinks',
    ]);
    const http = jasmine.createSpyObj('HttpClient', ['get']);
    const service = new PostLoginRedirectService(navigation, http);

    const route = await firstValueFrom(service.resolvePostLoginRoute({
      id: 'user-1',
      email: 'owner@example.com',
      username: 'owner',
      token: 'token',
      bio: null,
      image: null,
      companyId: 'company-1',
    }, null));

    expect(route).toBe('/');
    expect(navigation.listActiveNavigationLinks).not.toHaveBeenCalled();
    expect(http.get).not.toHaveBeenCalled();
  });
});
