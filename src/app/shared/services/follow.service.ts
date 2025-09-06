import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { Profile } from 'src/app/follow/store/actions';
import { environment } from 'src/environments/environment.development';

@Injectable({ providedIn: 'root' })
export class FollowService {
  constructor(private http: HttpClient) {}

  suggestions(limit = 6): Observable<Profile[]> {
    return this.http
      .get<{ profiles: Profile[] }>(`${environment.apiUrl}/users/suggestions`, {
        params: { limit } as any,
      })
      .pipe(map((r) => r.profiles || []));
  }

  follow(username: string): Observable<Profile> {
    return this.http
      .post<{ profile: Profile }>(
        `${environment.apiUrl}/profiles/${encodeURIComponent(username)}/follow`,
        {}
      )
      .pipe(map((r) => r.profile));
  }

  unfollow(username: string): Observable<Profile> {
    return this.http
      .delete<{ profile: Profile }>(
        `${environment.apiUrl}/profiles/${encodeURIComponent(username)}/follow`
      )
      .pipe(map((r) => r.profile));
  }
}
