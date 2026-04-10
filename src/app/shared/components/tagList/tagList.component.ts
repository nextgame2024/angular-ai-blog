import { Component, input } from '@angular/core';

import { RouterLink } from '@angular/router';
import { ChipModule } from 'primeng/chip';
import { PopularTagType } from '../../types/popularTag.type';

@Component({
    selector: 'mc-tag-list',
    templateUrl: './tagList.component.html',
    imports: [RouterLink, ChipModule]
})
export class TagListComponent {
  readonly tags$$ = input<PopularTagType[]>([], { alias: 'tags' });

  /** If true, each tag routes to /tag/<tag> (or linkBase/<tag>) */
  readonly clickable$$ = input(false, { alias: 'clickable' });

  /** Change if you want a different base route (defaults to '/tag') */
  readonly linkBase$$ = input('/tag', { alias: 'linkBase' });
}
