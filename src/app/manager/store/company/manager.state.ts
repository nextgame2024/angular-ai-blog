import type { BmCompany } from '../../types/company.interface';

export type CompanyViewMode = 'list' | 'form';

export interface ManagerCompanyState {
  companySearchQuery: string;

  companies: BmCompany[];
  companiesLoading: boolean;
  companiesError: string | null;
  companiesPage: number;
  companiesLimit: number;
  companiesTotal: number;
  companiesViewMode: CompanyViewMode;
  editingCompanyId: string | null;
}

export const initialManagerCompanyState: ManagerCompanyState = {
  companySearchQuery: '',

  companies: [],
  companiesLoading: false,
  companiesError: null,
  companiesPage: 1,
  companiesLimit: 20,
  companiesTotal: 0,
  companiesViewMode: 'list',
  editingCompanyId: null,
};
