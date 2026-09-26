import { Component, Input } from '@angular/core';

export type AdminStateKind = 'loading' | 'empty' | 'error' | 'forbidden';

@Component({
  selector: 'app-admin-state-panel',
  standalone: true,
  template: `
    <section class="state" [attr.data-kind]="kind" [attr.aria-busy]="kind === 'loading'" [attr.role]="kind === 'error' ? 'alert' : 'status'">
      <span class="state__icon" aria-hidden="true">{{ icon }}</span>
      <div>
        <h2>{{ title }}</h2>
        <p>{{ message }}</p>
      </div>
    </section>
  `,
  styles: [`
    .state { display:flex; gap:1rem; align-items:flex-start; padding:1.25rem; border:1px solid #dbe3ea; border-radius:1rem; background:#fff; color:#263746; }
    .state[data-kind='error'], .state[data-kind='forbidden'] { border-color:#efb7ad; background:#fff7f5; }
    .state__icon { display:grid; place-items:center; width:2.25rem; height:2.25rem; flex:0 0 auto; border-radius:50%; background:#e6f2f0; color:#075b52; font-weight:800; }
    h2 { margin:0 0 .35rem; font-size:1rem; }
    p { margin:0; color:#5b6975; line-height:1.5; }
  `],
})
export class AdminStatePanelComponent {
  @Input({ required: true }) kind: AdminStateKind = 'empty';
  @Input({ required: true }) title = '';
  @Input({ required: true }) message = '';

  get icon(): string {
    return { loading: '…', empty: '○', error: '!', forbidden: '×' }[this.kind];
  }
}
