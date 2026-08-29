import { Route } from '@angular/router';

import { SophiaRuntimeSessionService } from './services/sophia-runtime-session.service';

export const SOPHIA_RUNTIME_ROUTES: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./kiosk/sophia-kiosk.page').then(
        (m) => m.SophiaKioskPageComponent,
      ),
    providers: [SophiaRuntimeSessionService],
    data: {
      title: 'Sophia Runtime',
    },
  },
];
