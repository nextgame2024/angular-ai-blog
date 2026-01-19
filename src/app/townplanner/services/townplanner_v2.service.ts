import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import {
  TownPlannerV2AddressSuggestion,
  TownPlannerV2PlanningPayload,
} from '../store/townplanner_v2.state';
import { environment } from 'src/environments/environment';

export interface PlaceDetailsResponse {
  formattedAddress: string | null;
  lat: number | null;
  lng: number | null;

  // Option A: enriched place-details (optional)
  planning?: TownPlannerV2PlanningPayload | null;
}

@Injectable({ providedIn: 'root' })
export class TownPlannerV2Service {
  private readonly apiBase = environment.apiUrl.replace(/\/$/, '');
  private readonly tpV2Base = `${this.apiBase}/townplanner/v2`;

  constructor(private http: HttpClient) {}

  suggestAddresses(
    input: string,
    sessionToken?: string | null
  ): Observable<TownPlannerV2AddressSuggestion[]> {
    let params = new HttpParams().set('input', input);
    if (sessionToken) params = params.set('sessionToken', sessionToken);

    return this.http
      .get<{ suggestions: TownPlannerV2AddressSuggestion[] }>(
        `${this.tpV2Base}/suggest`,
        { params }
      )
      .pipe(map((r) => r.suggestions || []));
  }

  getPlaceDetails(
    placeId: string,
    sessionToken?: string | null
  ): Observable<PlaceDetailsResponse> {
    let params = new HttpParams().set('placeId', placeId);
    if (sessionToken) params = params.set('sessionToken', sessionToken);

    return this.http.get<PlaceDetailsResponse>(
      `${this.tpV2Base}/place-details`,
      { params }
    );
  }
}
