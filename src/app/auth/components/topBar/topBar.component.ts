import { Component } from '@angular/core';
import { combineLatest } from 'rxjs';
import { Store } from '@ngrx/store';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { selectCurrentUser } from '../../store/reducers';

// PrimeNG
import { MenubarModule } from 'primeng/menubar';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'mc-topbar',
  standalone: true,
  templateUrl: './topBar.component.html',
  styleUrls: ['./topBar.component.css'], // 👈 add this
  imports: [
    CommonModule,
    RouterLink,
    MenubarModule,
    AvatarModule,
    ButtonModule,
  ],
})
export class TopBarComponent {
  data$ = combineLatest({
    currentUser: this.store.select(selectCurrentUser),
  });

  defaultAvatar =
    'https://files-nodejs-api.s3.ap-southeast-2.amazonaws.com/public/avatar-user.png';

  constructor(private store: Store) {}

  getUserImage(image: string | null | undefined): string {
    return image || this.defaultAvatar;
  }
}
