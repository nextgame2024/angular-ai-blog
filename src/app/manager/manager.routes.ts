import { Route } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideState } from '@ngrx/store';

import { ManagerPageComponent } from './components/manager.page';
import { ManagerSectionPageComponent } from './components/manager-section.page';
import { ManagerClientsPageComponent } from './components/clients/manager-clients.page';
import { ManagerMaterialsPageComponent } from './components/materials/manager-materials.page';
import { ManagerUsersPageComponent } from './components/users/manager-users.page';
import { ManagerMaterialsService } from './services/manager.materials.service';
import { ManagerService } from './services/manager.service';
import { ManagerMaterialsEffects } from './store/materials/manager.effects';
import {
  MANAGER_MATERIALS_FEATURE_KEY,
  managerMaterialsReducer,
} from './store/materials/manager.reducer';
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
        component: ManagerSectionPageComponent,
        data: { title: 'Projects' },
      },
      {
        path: 'users',
        component: ManagerUsersPageComponent,
        data: { title: 'Users', fullscreen: true },
      },
      {
        path: 'suppliers',
        component: ManagerSectionPageComponent,
        data: { title: 'Suppliers' },
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
        component: ManagerSectionPageComponent,
        data: { title: 'Labor costs' },
      },
      {
        path: 'pricing',
        component: ManagerSectionPageComponent,
        data: { title: 'Pricing' },
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
