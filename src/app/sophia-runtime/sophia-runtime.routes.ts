import { Route } from '@angular/router';

import { SophiaRealtimeClientService } from './services/sophia-realtime-client.service';
import { SophiaRuntimeConfigService } from './services/sophia-runtime-config.service';
import { SophiaSimliClientService } from './services/sophia-simli-client.service';
import { SophiaRuntimeSessionService } from './services/sophia-runtime-session.service';

export const SOPHIA_RUNTIME_ROUTES: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./kiosk/sophia-kiosk.page').then(
        (m) => m.SophiaKioskPageComponent,
      ),
    providers: [
      SophiaRuntimeSessionService,
      SophiaRuntimeConfigService,
      SophiaRealtimeClientService,
      SophiaSimliClientService,
    ],
    data: {
      title: 'Sophia Runtime',
    },
  },
];
