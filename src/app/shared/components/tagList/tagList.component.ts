import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ChipModule } from 'primeng/chip';
import { PopularTagType } from '../../types/popularTag.type';

@Component({
  selector: 'mc-tag-list',
  templateUrl: './tagList.component.html',
  standalone: true,
  imports: [CommonModule, RouterLink, ChipModule],
})
export class TagListComponent {
  @Input() tags: PopularTagType[] = [];

  /** If true, each tag routes to /tag/<tag> (or linkBase/<tag>) */
  @Input() clickable = false;

  /** Change if you want a different base route (defaults to '/tag') */
  @Input() linkBase = '/tag';
}
