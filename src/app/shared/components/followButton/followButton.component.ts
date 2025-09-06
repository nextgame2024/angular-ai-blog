import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '@ngrx/store';
import { followActions } from 'src/app/follow/store/actions';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'mc-follow-button',
  templateUrl: './followButton.component.html',
  standalone: true,
  imports: [CommonModule, ButtonModule],
})
export class FollowButtonComponent implements OnInit {
  @Input() username!: string;
  @Input() following = false;

  constructor(private store: Store) {}

  ngOnInit(): void {
    if (!this.username) {
      throw new Error('mc-follow-button: "username" input is required.');
    }
  }

  toggle(): void {
    if (!this.username) return;
    this.store.dispatch(
      this.following
        ? followActions.unfollow({ username: this.username })
        : followActions.follow({ username: this.username })
    );
  }
}
