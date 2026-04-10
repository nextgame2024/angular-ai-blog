import { Component, computed, input, signal } from '@angular/core';

import { RouterLink } from '@angular/router';
import { environment } from 'src/environments/environment';

@Component({
    selector: 'mc-footer',
    templateUrl: './footer.component.html',
    imports: [RouterLink]
})
export class FooterComponent {
  /** Optional: pass a logo URL in; defaults to environment.logoUrl */
  readonly logoUrl$$ = input<string | null>(environment.logoUrl ?? null, {
    alias: 'logoUrl',
  });
  readonly resolvedLogoUrl$$ = computed(
    () => this.logoUrl$$() ?? environment.logoUrl ?? ''
  );
  readonly year$$ = signal(new Date().getFullYear());
}
