import { Route } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideState } from '@ngrx/store';

import { ManagerPageComponent } from './components/manager.page';
import { ManagerSectionPageComponent } from './components/manager-section.page';
import { ManagerClientsPageComponent } from './components/clients/manager-clients.page';
import { ManagerMaterialsPageComponent } from './components/materials/manager-materials.page';
import { ManagerLaborPageComponent } from './components/labor/manager-labor.page';
import { ManagerPricingPageComponent } from './components/pricing/manager-pricing.page';
import { ManagerSuppliersPageComponent } from './components/suppliers/manager-suppliers.page';
import { ManagerUsersPageComponent } from './components/users/manager-users.page';
import { ManagerProjectsPageComponent } from './components/projects/manager-projects.page';
import { ManagerProjectTypesPageComponent } from './components/projectTypes/manager-project-types.page';
import { ManagerCompanyPageComponent } from './components/company/manager-company.page';
import { ManagerMaterialsService } from './services/manager.materials.service';
import { ManagerLaborService } from './services/manager.labor.service';
import { ManagerPricingService } from './services/manager.pricing.service';
import { ManagerProjectsService } from './services/manager.projects.service';
import { ManagerProjectTypesService } from './services/manager.project.types.service';
import { ManagerSuppliersService } from './services/manager.suppliers.service';
import { ManagerCompanyService } from './services/manager.company.service';
import { ManagerService } from './services/manager.service';
import { ManagerMaterialsEffects } from './store/materials/manager.effects';
import {
  MANAGER_MATERIALS_FEATURE_KEY,
  managerMaterialsReducer,
} from './store/materials/manager.reducer';
import { ManagerLaborEffects } from './store/labor/manager.effects';
import {
  MANAGER_LABOR_FEATURE_KEY,
  managerLaborReducer,
} from './store/labor/manager.reducer';
import { ManagerPricingEffects } from './store/pricing/manager.effects';
import {
  MANAGER_PRICING_FEATURE_KEY,
  managerPricingReducer,
} from './store/pricing/manager.reducer';
import { ManagerSuppliersEffects } from './store/suppliers/manager.effects';
import {
  MANAGER_SUPPLIERS_FEATURE_KEY,
  managerSuppliersReducer,
} from './store/suppliers/manager.reducer';
import { ManagerProjectsEffects } from './store/projects/manager.effects';
import {
  MANAGER_PROJECTS_FEATURE_KEY,
  managerProjectsReducer,
} from './store/projects/manager.reducer';
import { ManagerProjectTypesEffects } from './store/projectTypes/manager.effects';
import {
  MANAGER_PROJECT_TYPES_FEATURE_KEY,
  managerProjectTypesReducer,
} from './store/projectTypes/manager.reducer';
import { ManagerCompanyEffects } from './store/company/manager.effects';
import {
  MANAGER_COMPANY_FEATURE_KEY,
  managerCompanyReducer,
} from './store/company/manager.reducer';
import { ManagerEffects } from './store/manager.effects';
import { MANAGER_FEATURE_KEY, managerReducer } from './store/manager.reducer';

export const MANAGER_ROUTES: Route[] = [
  {
    path: '',
    component: ManagerPageComponent,
    providers: [
      ManagerService,
      provideEffects(ManagerEffects),
      provideState(MANAGER_FEATURE_KEY, managerReducer),
    ],
    children: [
      // IMPORTANT: menu is the “home” state to show menu again after Back
      { path: '', pathMatch: 'full', redirectTo: 'menu' },

      {
        path: 'menu',
        component: ManagerSectionPageComponent,
        data: { title: 'Business manager' },
      },

      {
        path: 'clients',
        component: ManagerClientsPageComponent,
        data: { title: 'Clients', fullscreen: true },
      },

      // keep placeholders for now
      {
        path: 'projects',
        component: ManagerProjectsPageComponent,
        providers: [
          ManagerProjectsService,
          ManagerSuppliersService,
          ManagerLaborService,
          ManagerPricingService,
          provideEffects(ManagerProjectsEffects),
          provideState(MANAGER_PROJECTS_FEATURE_KEY, managerProjectsReducer),
        ],
        data: { title: 'Projects', fullscreen: true },
      },
      {
        path: 'project-types',
        component: ManagerProjectTypesPageComponent,
        providers: [
          ManagerProjectTypesService,
          ManagerSuppliersService,
          ManagerMaterialsService,
          ManagerLaborService,
          provideEffects(ManagerProjectTypesEffects),
          provideState(
            MANAGER_PROJECT_TYPES_FEATURE_KEY,
            managerProjectTypesReducer,
          ),
        ],
        data: { title: 'Project types', fullscreen: true },
      },
      {
        path: 'users',
        component: ManagerUsersPageComponent,
        data: { title: 'Users', fullscreen: true },
      },
      {
        path: 'company',
        component: ManagerCompanyPageComponent,
        providers: [
          ManagerCompanyService,
          provideEffects(ManagerCompanyEffects),
          provideState(MANAGER_COMPANY_FEATURE_KEY, managerCompanyReducer),
        ],
        data: { title: 'Company', fullscreen: true },
      },
      {
        path: 'suppliers',
        component: ManagerSuppliersPageComponent,
        providers: [
          ManagerSuppliersService,
          ManagerMaterialsService,
          provideEffects(ManagerSuppliersEffects),
          provideState(MANAGER_SUPPLIERS_FEATURE_KEY, managerSuppliersReducer),
        ],
        data: { title: 'Suppliers', fullscreen: true },
      },
      {
        path: 'materials',
        component: ManagerMaterialsPageComponent,
        providers: [
          ManagerMaterialsService,
          provideEffects(ManagerMaterialsEffects),
          provideState(MANAGER_MATERIALS_FEATURE_KEY, managerMaterialsReducer),
        ],
        data: { title: 'Materials', fullscreen: true },
      },
      {
        path: 'labor',
        component: ManagerLaborPageComponent,
        providers: [
          ManagerLaborService,
          provideEffects(ManagerLaborEffects),
          provideState(MANAGER_LABOR_FEATURE_KEY, managerLaborReducer),
        ],
        data: { title: 'Labor costs', fullscreen: true },
      },
      {
        path: 'pricing',
        component: ManagerPricingPageComponent,
        providers: [
          ManagerPricingService,
          provideEffects(ManagerPricingEffects),
          provideState(MANAGER_PRICING_FEATURE_KEY, managerPricingReducer),
        ],
        data: { title: 'Pricing', fullscreen: true },
      },
      {
        path: 'quotes',
        component: ManagerSectionPageComponent,
        data: { title: 'Quotes' },
      },
      {
        path: 'invoices',
        component: ManagerSectionPageComponent,
        data: { title: 'Invoices' },
      },
    ],
  },
];
