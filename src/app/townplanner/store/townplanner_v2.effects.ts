import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import {
  catchError,
  concat,
  debounceTime,
  distinctUntilChanged,
  exhaustMap,
  filter,
  map,
  of,
  switchMap,
  tap,
  timer,
  withLatestFrom,
  take,
  takeUntil,
} from 'rxjs';
import { TownPlannerV2Actions } from './townplanner_v2.actions';
import { TownPlannerV2Service } from '../services/townplanner_v2.service';
import {
  selectSelected,
  selectTownPlannerV2State,
} from './townplanner_v2.selectors';

@Injectable()
export class TownPlannerV2Effects {
  private isSelectionValid(selected: any): boolean {
    const lat = (selected as any)?.lat;
    const lng = (selected as any)?.lng;
    const addressLabel =
      (selected as any)?.addressLabel ||
      (selected as any)?.address ||
      (selected as any)?.formattedAddress;

    return (
      !!selected &&
      typeof lat === 'number' &&
      typeof lng === 'number' &&
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      typeof addressLabel === 'string' &&
      !!addressLabel.trim()
    );
  }

  private pollReportTokenForPrime$(token: string) {
    return timer(1000, 2000).pipe(
      switchMap(() => this.api.getReportByToken(token)),
      map((r) => r.report),
      filter((report) => report.status === 'ready' || report.status === 'failed'),
      take(1),
      switchMap((report) => {
        if (report.status === 'ready' && report.pdfUrl) {
          return of(
            TownPlannerV2Actions.primeReportReady({
              token,
              pdfUrl: report.pdfUrl,
            })
          );
        }
        return of(
          TownPlannerV2Actions.primeReportFailure({
            error:
              report.errorMessage ||
              'Background report pre-generation failed. You can still generate it manually.',
          })
        );
      }),
      catchError((err) =>
        of(
          TownPlannerV2Actions.primeReportFailure({
            error:
              err?.error?.error ||
              err?.message ||
              'Failed while checking background report status',
          })
        )
      )
    );
  }

  private pollReportTokenForGenerate$(token: string) {
    return timer(1000, 2000).pipe(
      switchMap(() => this.api.getReportByToken(token)),
      map((r) => r.report),
      filter((report) => report.status === 'ready' || report.status === 'failed'),
      take(1),
      switchMap((report) => {
        if (report.status === 'ready' && report.pdfUrl) {
          return of(
            TownPlannerV2Actions.generateReportReady({
              token,
              pdfUrl: report.pdfUrl,
            })
          );
        }

        return of(
          TownPlannerV2Actions.generateReportFailure({
            error:
              report.errorMessage ||
              'Report generation failed. Please try again.',
          })
        );
      }),
      catchError((err) =>
        of(
          TownPlannerV2Actions.generateReportFailure({
            error:
              err?.error?.error ||
              err?.message ||
              'Failed while checking report status',
          })
        )
      )
    );
  }

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

  // Start report generation in background after first place details load.
  primeReportOnLoadSuccess$ = createEffect(() =>
    this.actions$.pipe(
      ofType(TownPlannerV2Actions.loadPlaceDetailsSuccess),
      map(({ result }) => {
        const lat = (result as any)?.lat;
        const lng = (result as any)?.lng;
        const placeId = ((result as any)?.placeId as string) || null;
        const addressLabel =
          ((result as any)?.addressLabel as string) ||
          ((result as any)?.address as string) ||
          ((result as any)?.formattedAddress as string) ||
          '';
        return { lat, lng, placeId, addressLabel };
      }),
      filter(
        ({ lat, lng, addressLabel }) =>
          typeof lat === 'number' &&
          typeof lng === 'number' &&
          Number.isFinite(lat) &&
          Number.isFinite(lng) &&
          typeof addressLabel === 'string' &&
          !!addressLabel.trim()
      ),
      map(({ lat, lng, placeId, addressLabel }) =>
        TownPlannerV2Actions.primeReport({
          addressLabel: addressLabel.trim(),
          placeId,
          lat,
          lng,
        })
      )
    )
  );

  primeReport$ = createEffect(() =>
    this.actions$.pipe(
      ofType(TownPlannerV2Actions.primeReport),
      switchMap(({ addressLabel, placeId, lat, lng }) =>
        this.api
          .generateReport({
            addressLabel,
            placeId: placeId || null,
            lat,
            lng,
          })
          .pipe(
            switchMap((resp) => {
              const token = resp.token;
              if (resp.status === 'ready' && resp.pdfUrl) {
                return of(
                  TownPlannerV2Actions.primeReportReady({
                    token,
                    pdfUrl: resp.pdfUrl,
                  })
                );
              }

              const running$ = of(
                TownPlannerV2Actions.primeReportRunning({ token })
              );
              const poll$ = this.pollReportTokenForPrime$(token);
              return concat(running$, poll$);
            }),
            catchError((err) =>
              of(
                TownPlannerV2Actions.primeReportFailure({
                  error:
                    err?.error?.error ||
                    err?.message ||
                    'Background report pre-generation failed',
                })
              )
            ),
            takeUntil(
              this.actions$.pipe(
                ofType(
                  TownPlannerV2Actions.selectSuggestion,
                  TownPlannerV2Actions.clear
                )
              )
            )
          )
      )
    )
  );

  /**
   * Generate report:
   * - POST /report-generate returns { token, status }
   * - if status=ready returns pdfUrl immediately
   * - otherwise poll GET /report/:token until ready/failed
   *
   * Uses exhaustMap to prevent double-click spamming (while overlay blocks UI anyway).
   */
  generateReport$ = createEffect(() =>
    this.actions$.pipe(
      ofType(TownPlannerV2Actions.generateReport),
      withLatestFrom(
        this.store.select(selectSelected),
        this.store.select(selectTownPlannerV2State)
      ),
      filter(([_, selected]) => this.isSelectionValid(selected)),
      exhaustMap(([_, selected, state]) => {
        const lat = (selected as any).lat as number;
        const lng = (selected as any).lng as number;
        const placeId = ((selected as any).placeId as string) || null;
        const addressLabel =
          ((selected as any).addressLabel as string) ||
          ((selected as any).address as string) ||
          ((selected as any).formattedAddress as string) ||
          '';
        const existingToken = (state as any)?.reportToken || null;
        const existingStatus = (state as any)?.reportStatus || 'idle';
        const existingPdfUrl = (state as any)?.reportPdfUrl || null;

        // If background pre-generation already finished, open immediately.
        if (
          existingStatus === 'ready' &&
          existingToken &&
          typeof existingPdfUrl === 'string' &&
          !!existingPdfUrl
        ) {
          return of(
            TownPlannerV2Actions.generateReportReady({
              token: existingToken,
              pdfUrl: existingPdfUrl,
            })
          );
        }

        // If background pre-generation is still running, do not start a new job.
        // Poll the same token and surface user-facing running state.
        if (existingStatus === 'running' && existingToken) {
          const running$ = of(
            TownPlannerV2Actions.generateReportRunning({
              token: existingToken,
            })
          );
          const poll$ = this.pollReportTokenForGenerate$(existingToken);
          return concat(running$, poll$);
        }

        return this.api
          .generateReport({
            token: existingToken || null,
            addressLabel: addressLabel.trim(),
            placeId,
            lat,
            lng,
          })
          .pipe(
            switchMap((resp) => {
              const token = resp.token;

              // Ready immediately (cached or fast)
              if (resp.status === 'ready' && resp.pdfUrl) {
                return of(
                  TownPlannerV2Actions.generateReportReady({
                    token,
                    pdfUrl: resp.pdfUrl,
                  })
                );
              }

              // Running => dispatch running, then poll
              const running$ = of(
                TownPlannerV2Actions.generateReportRunning({ token })
              );
              const poll$ = this.pollReportTokenForGenerate$(token);

              return concat(running$, poll$);
            }),
            catchError((err) =>
              of(
                TownPlannerV2Actions.generateReportFailure({
                  error:
                    err?.error?.error ||
                    err?.message ||
                    'Failed to generate property report',
                })
              )
            )
          );
      })
    )
  );

  // Open PDF automatically when ready (no UI changes needed)
  openPdfOnReady$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(TownPlannerV2Actions.generateReportReady),
        tap(({ pdfUrl }) => {
          // best effort: open in a new tab
          window.open(pdfUrl, '_blank', 'noopener');
        })
      ),
    { dispatch: false }
  );

  constructor(
    private actions$: Actions,
    private api: TownPlannerV2Service,
    private store: Store
  ) {}
}
