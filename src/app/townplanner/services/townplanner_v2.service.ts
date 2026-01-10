import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TownPlannerV2Result } from '../store/townplanner_v2.state';

@Injectable({ providedIn: 'root' })
export class TownPlannerV2Service {
  // Prefer environment.apiUrl if you have it; keeping simple here.
  private readonly baseUrl = '/api/townplanner/v2';

  constructor(private http: HttpClient) {}

  lookupProperty(address: string): Observable<TownPlannerV2Result> {
    const params = new HttpParams().set('address', address);
    return this.http.get<TownPlannerV2Result>(`${this.baseUrl}/property`, {
      params,
    });
  }
}
