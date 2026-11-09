import { Component, Input } from '@angular/core';

// Matches the centered empty page used by the Students register.
@Component({
  selector: 'app-manager-empty-state',
  host: { role: 'status' },
  template: '<strong>{{ title }}</strong><span>{{ description }}</span>',
  styles: [`
    :host { display: grid; place-items: center; align-content: center; gap: .55rem;
      flex: 1 1 320px; min-height: 385px; box-sizing: border-box; padding: 2rem 1rem;
      background: #fff; color: #647386; text-align: center; overflow-wrap: anywhere; }
    strong { color: #172033; }
    :host-context(html.dark) { background: #192433; color: #afc2d9; }
    :host-context(html.dark) strong { color: #e6edf6; }
  `],
})
export class ManagerEmptyStateComponent {
  @Input({required:true}) title = '';
  @Input() description = 'No records match the current filters.';
}
