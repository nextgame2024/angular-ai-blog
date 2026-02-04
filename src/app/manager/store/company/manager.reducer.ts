import { createReducer, on } from '@ngrx/store';
import { ManagerCompanyActions } from './manager.actions';
import { initialManagerCompanyState } from './manager.state';
import type { BmCompany } from '../../types/company.interface';

export const MANAGER_COMPANY_FEATURE_KEY = 'managerCompany';

export const managerCompanyReducer = createReducer(
  initialManagerCompanyState,

  on(ManagerCompanyActions.setCompanySearchQuery, (state, { query }) => ({
    ...state,
    companySearchQuery: query,
  })),

  on(ManagerCompanyActions.loadCompanies, (state, { page }) => ({
    ...state,
    companiesLoading: true,
    companiesError: null,
    companiesPage: page,
  })),

  on(ManagerCompanyActions.loadCompaniesSuccess, (state, { result }) => ({
    ...state,
    companiesLoading: false,
    companies:
      result.page > 1
        ? [
            ...state.companies,
            ...(result.items ?? []).filter(
              (c) =>
                !state.companies.some(
                  (existing) => existing.companyId === c.companyId,
                ),
            ),
          ]
        : (result.items ?? []),
    companiesPage: result.page,
    companiesLimit: result.limit,
    companiesTotal: result.total,
  })),

  on(ManagerCompanyActions.loadCompaniesFailure, (state, { error }) => ({
    ...state,
    companiesLoading: false,
    companiesError: error,
  })),

  on(ManagerCompanyActions.openCompanyCreate, (state) => ({
    ...state,
    companiesViewMode: 'form' as const,
    editingCompanyId: null,
    companiesError: null,
  })),

  on(ManagerCompanyActions.openCompanyEdit, (state, { companyId }) => ({
    ...state,
    companiesViewMode: 'form' as const,
    editingCompanyId: companyId,
    companiesError: null,
  })),

  on(ManagerCompanyActions.closeCompanyForm, (state) => ({
    ...state,
    companiesViewMode: 'list' as const,
    editingCompanyId: null,
  })),

  on(ManagerCompanyActions.saveCompany, (state) => ({
    ...state,
    companiesLoading: true,
    companiesError: null,
  })),

  on(ManagerCompanyActions.saveCompanySuccess, (state, { company }) => {
    const idx = state.companies.findIndex(
      (c: BmCompany) => c.companyId === company.companyId,
    );
    const next = [...state.companies];

    if (idx >= 0) next[idx] = company;
    else next.unshift(company);

    return {
      ...state,
      companiesLoading: false,
      companies: next,
      companiesViewMode: 'list' as const,
      editingCompanyId: null,
    };
  }),

  on(ManagerCompanyActions.saveCompanyFailure, (state, { error }) => ({
    ...state,
    companiesLoading: false,
    companiesError: error,
  })),

  on(ManagerCompanyActions.archiveCompany, (state) => ({
    ...state,
    companiesLoading: true,
    companiesError: null,
  })),

  on(ManagerCompanyActions.archiveCompanySuccess, (state, { companyId }) => ({
    ...state,
    companiesLoading: false,
    companies: state.companies.map((c: BmCompany) =>
      c.companyId === companyId ? { ...c, status: 'archived' } : c,
    ),
  })),

  on(ManagerCompanyActions.archiveCompanyFailure, (state, { error }) => ({
    ...state,
    companiesLoading: false,
    companiesError: error,
  })),
);
