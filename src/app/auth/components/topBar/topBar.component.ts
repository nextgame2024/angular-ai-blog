import { Component } from '@angular/core';
import { combineLatest, map } from 'rxjs';
import { Store } from '@ngrx/store';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { selectCurrentUser } from '../../store/reducers';

// PrimeNG
import { MenubarModule } from 'primeng/menubar';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';

// Theme
import { ThemeService } from 'src/app/shared/services/theme.service';

@Component({
  selector: 'mc-topbar',
  standalone: true,
  templateUrl: './topBar.component.html',
  styleUrls: ['./topBar.component.css'],
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

  isDark$ = this.theme.mode$.pipe(map((m) => m === 'dark'));

  constructor(private store: Store, private theme: ThemeService) {}

  getUserImage(image: string | null | undefined): string {
    return image || this.defaultAvatar;
  }

  toggleTheme() {
    this.theme.toggle();
  }
}
