import { createFeatureSelector, createSelector } from '@ngrx/store';
import { MANAGER_COMPANY_FEATURE_KEY } from './manager.reducer';
import { ManagerCompanyState } from './manager.state';
import type { BmCompany } from '../../types/company.interface';

export const selectManagerCompanyState =
  createFeatureSelector<ManagerCompanyState>(MANAGER_COMPANY_FEATURE_KEY);

export const selectManagerCompanySearchQuery = createSelector(
  selectManagerCompanyState,
  (s) => s.companySearchQuery,
);

export const selectManagerCompanies = createSelector(
  selectManagerCompanyState,
  (s) => s.companies,
);
export const selectManagerCompaniesLoading = createSelector(
  selectManagerCompanyState,
  (s) => s.companiesLoading,
);
export const selectManagerCompaniesError = createSelector(
  selectManagerCompanyState,
  (s) => s.companiesError,
);
export const selectManagerCompaniesTotal = createSelector(
  selectManagerCompanyState,
  (s) => s.companiesTotal,
);
export const selectManagerCompaniesPage = createSelector(
  selectManagerCompanyState,
  (s) => s.companiesPage,
);
export const selectManagerCompaniesLimit = createSelector(
  selectManagerCompanyState,
  (s) => s.companiesLimit,
);
export const selectManagerCompaniesViewMode = createSelector(
  selectManagerCompanyState,
  (s) => s.companiesViewMode,
);

export const selectManagerEditingCompany = createSelector(
  selectManagerCompanyState,
  (s) => {
    if (!s.editingCompanyId) return null;
    return (
      s.companies.find(
        (c: BmCompany) => c.companyId === s.editingCompanyId,
      ) ?? null
    );
  },
);
