import { Route } from '@angular/router';

import { SophiaRealtimeClientService } from './services/sophia-realtime-client.service';
import { SophiaRuntimeSessionService } from './services/sophia-runtime-session.service';

export const SOPHIA_RUNTIME_ROUTES: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./kiosk/sophia-kiosk.page').then(
        (m) => m.SophiaKioskPageComponent,
      ),
    providers: [SophiaRuntimeSessionService, SophiaRealtimeClientService],
    data: {
      title: 'Sophia Runtime',
    },
  },
];
