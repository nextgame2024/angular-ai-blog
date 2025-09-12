import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'mc-footer',
  templateUrl: './footer.component.html',
  standalone: true,
  imports: [CommonModule, RouterLink],
})
export class FooterComponent {
  /** Optional: pass a logo URL in; defaults to environment.logoUrl */
  @Input() logoUrl: string | null = environment.logoUrl ?? null;

  defaultLogo = environment.logoUrl ?? '';
  year = new Date().getFullYear();
}
