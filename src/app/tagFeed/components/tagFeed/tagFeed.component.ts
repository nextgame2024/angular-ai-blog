import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

import { FeedComponent } from 'src/app/shared/components/feed/feed.component';
import { BannerComponent } from '../../../shared/components/banner/banner.component';
import { PopularTagsComponent } from '../../../shared/components/popularTags/popularTags.component';
import { FeedTogglerComponent } from 'src/app/shared/components/feedToggler/feedToggler.component';

@Component({
    selector: 'mc-tag-feed',
    templateUrl: './tagFeed.component.html',
    imports: [
        FeedComponent,
        BannerComponent,
        PopularTagsComponent,
        FeedTogglerComponent,
    ]
})
export class TagFeedComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly params$$ = toSignal(this.route.params, {
    initialValue: this.route.snapshot.params,
  });

  readonly tagName$$ = computed(() => this.params$$()['slug'] ?? '');
  readonly apiUrl$$ = computed(() => {
    const tagName = this.tagName$$();
    if (!tagName) return '';
    return `/articles?tag=${encodeURIComponent(tagName)}`;
  });
}
