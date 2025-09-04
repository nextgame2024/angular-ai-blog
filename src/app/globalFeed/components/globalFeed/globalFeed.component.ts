import { Component } from '@angular/core';
import { FeedComponent } from 'src/app/shared/components/feed/feed.component';
import { BannerComponent } from '../../../shared/components/banner/banner.component';
import { PopularTagsComponent } from '../../../shared/components/popularTags/popularTags.component';
import { FeedTogglerComponent } from 'src/app/shared/components/feedToggler/feedToggler.component';
import { ErrorMessageComponent } from 'src/app/shared/components/errorMessage/errorMessage.component';

/* PrimeNG */
import { CardModule } from 'primeng/card';

@Component({
  selector: 'mc-global-feed',
  templateUrl: './globalFeed.component.html',
  standalone: true,
  imports: [
    // app components
    FeedComponent,
    BannerComponent,
    ErrorMessageComponent,
    PopularTagsComponent,
    FeedTogglerComponent,

    // PrimeNG
    CardModule,
  ],
})
export class GlobalFeedComponent {
  apiUrl = '/articles';
}
