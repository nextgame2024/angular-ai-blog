import { Route } from '@angular/router';

import { SophiaRealtimeClientService } from './services/sophia-realtime-client.service';
import { SophiaRuntimeConfigService } from './services/sophia-runtime-config.service';
import { SophiaSimliClientService } from './services/sophia-simli-client.service';
import { SophiaRuntimeSessionService } from './services/sophia-runtime-session.service';
import { SophiaAvatarClientService } from './services/sophia-avatar-client.service';
import { SophiaLiveAvatarClientService } from './services/sophia-liveavatar-client.service';
import { SophiaTavusClientService } from './services/sophia-tavus-client.service';

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
      SophiaLiveAvatarClientService,
      SophiaTavusClientService,
      SophiaAvatarClientService,
    ],
    data: {
      title: 'Sophia Runtime',
    },
  },
];
