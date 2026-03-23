export type NavigationType = 'header' | 'menu';

export interface BmNavigationLink {
  navigationLinkId: string;
  companyId: string;
  companyName?: string | null;
  userId?: string | null;
  navigationType: NavigationType;
  navigationLabel: string;
  active: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface ListNavigationLinksResponse {
  navigationLinks: BmNavigationLink[];
  page: number;
  limit: number;
  total: number;
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

export interface NavigationLinksSyncResult {
  navigationLinks: BmNavigationLink[];
  createdLabels: string[];
  removedLabels: string[];
}

export interface NavigationLabelOption {
  value: string;
  label: string;
}

export const NAVIGATION_TYPE_OPTIONS: NavigationLabelOption[] = [
  { value: 'header', label: 'header' },
  { value: 'menu', label: 'menu' },
];

export const HEADER_NAVIGATION_LABEL_OPTIONS: NavigationLabelOption[] = [
  { value: 'Home', label: 'Home' },
  { value: 'Town planner', label: 'Town planner' },
  { value: 'Business manager', label: 'Business manager' },
  { value: 'Settings', label: 'Settings' },
];

export const MENU_NAVIGATION_LABEL_OPTIONS: NavigationLabelOption[] = [
  { value: 'Clients', label: 'Clients' },
  { value: 'Projects', label: 'Projects' },
  { value: 'Project types', label: 'Project types' },
  { value: 'Users', label: 'Users' },
  { value: 'Company', label: 'Company' },
  { value: 'Navigation links', label: 'Navigation links' },
  { value: 'Suppliers', label: 'Suppliers' },
  { value: 'Materials', label: 'Materials' },
  { value: 'Labor costs', label: 'Labor costs' },
  { value: 'Pricing', label: 'Pricing' },
  { value: 'Quotes', label: 'Quotes' },
  { value: 'Invoices', label: 'Invoices' },
];

export const NAVIGATION_LABEL_OPTIONS_BY_TYPE: Record<
  NavigationType,
  NavigationLabelOption[]
> = {
  header: HEADER_NAVIGATION_LABEL_OPTIONS,
  menu: MENU_NAVIGATION_LABEL_OPTIONS,
};
