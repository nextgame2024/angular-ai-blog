import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  of,
  switchMap,
} from 'rxjs';
import { TownPlannerV2Actions } from './townplanner_v2.actions';
import { TownPlannerV2Service } from '../services/townplanner_v2.service';

@Injectable()
export class TownPlannerV2Effects {
  // When query changes, fetch suggestions (debounced + cancel in-flight)
  suggest$ = createEffect(() =>
    this.actions$.pipe(
      ofType(TownPlannerV2Actions.setAddressQuery),
      map(({ query, sessionToken }) => ({
        q: (query || '').trim(),
        sessionToken: sessionToken ?? null,
      })),
      debounceTime(250),
      distinctUntilChanged((a, b) => a.q === b.q),
      switchMap(({ q, sessionToken }) => {
        if (q.length < 3) return of(TownPlannerV2Actions.clearSuggestions());

        return this.api.suggestAddresses(q, sessionToken).pipe(
          map((suggestions) =>
            TownPlannerV2Actions.suggestAddressesSuccess({ suggestions })
          ),
          catchError((err) =>
            of(
              TownPlannerV2Actions.suggestAddressesFailure({
                error:
                  err?.error?.error ||
                  err?.message ||
                  'Failed to load address suggestions',
              })
            )
          )
        );
      })
    )
  );

  // Selecting a suggestion triggers place details lookup
  selectSuggestion$ = createEffect(() =>
    this.actions$.pipe(
      ofType(TownPlannerV2Actions.selectSuggestion),
      switchMap(({ suggestion, sessionToken }) =>
        of(
          TownPlannerV2Actions.setAddressQuery({
            query: suggestion.description,
            sessionToken: sessionToken ?? null,
          }),
          TownPlannerV2Actions.loadPlaceDetails({
            placeId: suggestion.placeId,
            addressLabel: suggestion.description,
            sessionToken: sessionToken ?? null,
          })
        )
      )
    )
  );

  loadPlaceDetails$ = createEffect(() =>
    this.actions$.pipe(
      ofType(TownPlannerV2Actions.loadPlaceDetails),
      filter(({ placeId }) => !!placeId),
      switchMap(({ placeId, addressLabel, sessionToken }) =>
        this.api.getPlaceDetails(placeId, sessionToken).pipe(
          map((d) =>
            TownPlannerV2Actions.loadPlaceDetailsSuccess({
              result: {
                placeId,
                addressLabel: addressLabel || undefined,
                formattedAddress: d.formattedAddress ?? undefined,
                address: addressLabel || d.formattedAddress || undefined,
                lat: d.lat ?? undefined,
                lng: d.lng ?? undefined,

                // Option A: planning payload is optional; keep null if missing
                planning: d.planning ?? null,
              },
            })
          ),
          catchError((err) =>
            of(
              TownPlannerV2Actions.loadPlaceDetailsFailure({
                error:
                  err?.error?.error ||
                  err?.message ||
                  'Failed to load place details',
              })
            )
          )
        )
      )
    )
  );

  constructor(private actions$: Actions, private api: TownPlannerV2Service) {}
}
