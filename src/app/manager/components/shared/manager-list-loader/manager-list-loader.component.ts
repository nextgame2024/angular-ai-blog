import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-manager-list-loader',
  standalone: true,
  host: { '[class.overlay-host]': 'overlay' },
  template: `
    <div class="manager-list-loader" [class.overlay]="overlay" role="status" aria-live="polite">
      <span class="loader-ring" aria-hidden="true"></span>
      <span class="loader-bar" aria-hidden="true"></span>
      <span class="loader-text">{{ label }}</span>
    </div>
  `,
  styleUrls: ['./manager-list-loader.component.css'],
})
export class ManagerListLoaderComponent {
  @Input() label = 'Loading records…';
  @Input() overlay = false;
}
