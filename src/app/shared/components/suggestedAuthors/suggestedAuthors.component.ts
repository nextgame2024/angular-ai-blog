// src/app/shared/components/suggestedAuthors/suggestedAuthors.component.ts
import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '@ngrx/store';
import { RouterLink } from '@angular/router';
import { AvatarModule } from 'primeng/avatar';
import { CardModule } from 'primeng/card';
import { followActions } from 'src/app/follow/store/actions';
import {
  selectSuggestions,
  selectSuggestionsLoading,
} from 'src/app/follow/store/reducers';
import { FollowButtonComponent } from '../followButton/followButton.component';

@Component({
  selector: 'mc-suggested-authors',
  templateUrl: './suggestedAuthors.component.html',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    AvatarModule,
    CardModule,
    FollowButtonComponent,
  ],
})
export class SuggestedAuthorsComponent implements OnInit {
  suggestions$ = this.store.select(selectSuggestions);
  loading$ = this.store.select(selectSuggestionsLoading);
  trackByUser = (_: number, p: { username: string }) => p.username;
  @Output() refreshTrigger = new EventEmitter<void>();

  readonly defaultAvatar =
    'https://files-nodejs-api.s3.ap-southeast-2.amazonaws.com/public/avatar-user.png';

  constructor(private store: Store) {}

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.refreshTrigger.emit();
    this.store.dispatch(followActions.loadSuggestions({ limit: 6 }));
  }

  getUserImage(image: string | null | undefined): string {
    return image || this.defaultAvatar;
  }
}
