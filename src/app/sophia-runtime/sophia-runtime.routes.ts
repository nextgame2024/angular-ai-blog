import { Route } from '@angular/router';

import { SophiaRealtimeClientService } from './services/sophia-realtime-client.service';
import { SophiaGeminiLiveClientService } from './services/sophia-gemini-live-client.service';
import { SophiaRuntimeConfigService } from './services/sophia-runtime-config.service';
import { SophiaSimliClientService } from './services/sophia-simli-client.service';
import { SophiaRuntimeSessionService } from './services/sophia-runtime-session.service';
import { SophiaLiveAvatarClientService } from './services/sophia-liveavatar-client.service';
import { SophiaTavusClientService } from './services/sophia-tavus-client.service';
import { SophiaSessionFacade } from './services/sophia-session.facade';
import {
  SophiaBrowserTransportRegistry,
  SophiaPresentationAdapterRegistry,
} from './services/browser-transport/sophia-browser-transport.registry';
import {
  SOPHIA_BROWSER_TRANSPORT_ADAPTERS,
  SOPHIA_PRESENTATION_ADAPTERS,
} from './services/browser-transport/sophia-browser-transport.types';
import {
  SophiaLiveAvatarPresentationAdapter,
  SophiaSimliPresentationAdapter,
  SophiaStaticPresentationAdapter,
} from './services/browser-transport/sophia-presentation.adapters';
import {
  SophiaDailyConversationBrowserAdapter,
  SophiaGeminiLiveBrowserAdapter,
  SophiaNativeRealtimeBrowserAdapter,
} from './services/browser-transport/sophia-session-transport.adapters';
import { SophiaPresentationMediaPolicy } from './presentation/sophia-presentation-media-policy';
import { SophiaToolPresentationRegistry } from './presentation/sophia-tool-presentation.registry';
import {
  SOPHIA_PRESENTATION_MEDIA_HOSTS,
  SOPHIA_CORE_TOOL_ACTIVITY_LABELS,
  SOPHIA_TOOL_ACTIVITY_LABELS,
  SOPHIA_TOOL_PRESENTATION_RENDERERS,
} from './presentation/sophia-tool-presentation.types';
import {
  REAL_ESTATE_MEDIA_HOSTS,
  REAL_ESTATE_TOOL_ACTIVITY_LABELS,
  RealEstateToolPresentationRenderer,
} from './presentation/packs/real-estate/real-estate-tool-presentation.renderer';

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
      SophiaGeminiLiveClientService,
      SophiaSimliClientService,
      SophiaLiveAvatarClientService,
      SophiaTavusClientService,
      SophiaStaticPresentationAdapter,
      SophiaSimliPresentationAdapter,
      SophiaLiveAvatarPresentationAdapter,
      SophiaNativeRealtimeBrowserAdapter,
      SophiaGeminiLiveBrowserAdapter,
      SophiaDailyConversationBrowserAdapter,
      SophiaPresentationAdapterRegistry,
      SophiaBrowserTransportRegistry,
      SophiaPresentationMediaPolicy,
      SophiaToolPresentationRegistry,
      RealEstateToolPresentationRenderer,
      {
        provide: SOPHIA_PRESENTATION_MEDIA_HOSTS,
        useValue: REAL_ESTATE_MEDIA_HOSTS,
      },
      {
        provide: SOPHIA_TOOL_PRESENTATION_RENDERERS,
        useExisting: RealEstateToolPresentationRenderer,
        multi: true,
      },
      {
        provide: SOPHIA_TOOL_ACTIVITY_LABELS,
        useValue: SOPHIA_CORE_TOOL_ACTIVITY_LABELS,
        multi: true,
      },
      {
        provide: SOPHIA_TOOL_ACTIVITY_LABELS,
        useValue: REAL_ESTATE_TOOL_ACTIVITY_LABELS,
        multi: true,
      },
      {
        provide: SOPHIA_PRESENTATION_ADAPTERS,
        useExisting: SophiaStaticPresentationAdapter,
        multi: true,
      },
      {
        provide: SOPHIA_PRESENTATION_ADAPTERS,
        useExisting: SophiaSimliPresentationAdapter,
        multi: true,
      },
      {
        provide: SOPHIA_PRESENTATION_ADAPTERS,
        useExisting: SophiaLiveAvatarPresentationAdapter,
        multi: true,
      },
      {
        provide: SOPHIA_BROWSER_TRANSPORT_ADAPTERS,
        useExisting: SophiaNativeRealtimeBrowserAdapter,
        multi: true,
      },
      {
        provide: SOPHIA_BROWSER_TRANSPORT_ADAPTERS,
        useExisting: SophiaGeminiLiveBrowserAdapter,
        multi: true,
      },
      {
        provide: SOPHIA_BROWSER_TRANSPORT_ADAPTERS,
        useExisting: SophiaDailyConversationBrowserAdapter,
        multi: true,
      },
      SophiaSessionFacade,
    ],
    data: {
      title: 'Sophia Runtime',
    },
  },
];
