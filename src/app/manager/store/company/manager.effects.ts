import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';
import { catchError, map, switchMap, withLatestFrom } from 'rxjs/operators';

import { ManagerCompanyActions } from './manager.actions';
import { ManagerCompanyService } from '../../services/manager.company.service';
import {
  selectManagerCompanySearchQuery,
  selectManagerEditingCompany,
} from './manager.selectors';

@Injectable()
export class ManagerCompanyEffects {
  constructor(
    private actions$: Actions,
    private api: ManagerCompanyService,
    private store: Store,
  ) {}

  loadCompanies$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerCompanyActions.loadCompanies),
      withLatestFrom(this.store.select(selectManagerCompanySearchQuery)),
      switchMap(([{ page }, q]) =>
        this.api.listCompanies({ page, limit: 20, q: q || undefined }).pipe(
          map((result) =>
            ManagerCompanyActions.loadCompaniesSuccess({ result }),
          ),
          catchError((err) =>
            of(
              ManagerCompanyActions.loadCompaniesFailure({
                error:
                  err?.error?.error ||
                  err?.message ||
                  'Failed to load companies',
              }),
            ),
          ),
        ),
      ),
    ),
  );

  saveCompany$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerCompanyActions.saveCompany),
      withLatestFrom(this.store.select(selectManagerEditingCompany)),
      switchMap(([{ payload }, editing]) => {
        const req$ = editing
          ? this.api.updateCompany(editing.companyId, payload)
          : this.api.createCompany(payload);

        return req$.pipe(
          map((res) =>
            ManagerCompanyActions.saveCompanySuccess({ company: res.company }),
          ),
          catchError((err) =>
            of(
              ManagerCompanyActions.saveCompanyFailure({
                error:
                  err?.error?.error ||
                  err?.message ||
                  'Failed to save company',
              }),
            ),
          ),
        );
      }),
    ),
  );

  archiveCompany$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ManagerCompanyActions.archiveCompany),
      switchMap(({ companyId }) =>
        this.api.archiveCompany(companyId).pipe(
          map(() => ManagerCompanyActions.archiveCompanySuccess({ companyId })),
          catchError((err) =>
            of(
              ManagerCompanyActions.archiveCompanyFailure({
                error:
                  err?.error?.error ||
                  err?.message ||
                  'Failed to archive company',
              }),
            ),
          ),
        ),
      ),
    ),
  );
}
