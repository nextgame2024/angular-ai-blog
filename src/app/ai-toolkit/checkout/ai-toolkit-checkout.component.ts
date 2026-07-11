import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { toSignal } from '@angular/core/rxjs-interop';

import { selectCurrentUser } from '../../auth/store/reducers';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-ai-toolkit-checkout',
  imports: [CommonModule, RouterLink],
  template: `
    <main class="checkout-redirect">
      <section class="checkout-redirect__card">
        <h1>Preparing checkout</h1>
        @if (error$$()) {
          <p>{{ error$$() }}</p>
          <a routerLink="/ai-toolkit/dashboard">Back to dashboard</a>
        } @else {
          <p>Redirecting you to Stripe...</p>
        }
      </section>
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .checkout-redirect {
        display: grid;
        min-height: 60svh;
        place-items: center;
        padding: 24px;
      }

      .checkout-redirect__card {
        width: min(100%, 420px);
        padding: 24px;
        border: 1px solid rgba(148, 163, 184, 0.28);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.9);
        text-align: center;
      }

      .checkout-redirect__card h1 {
        margin: 0;
        font-size: 1.35rem;
      }

      .checkout-redirect__card p {
        margin: 10px 0 0;
        color: #64748b;
      }

      .checkout-redirect__card a {
        display: inline-flex;
        margin-top: 16px;
        color: #4f46e5;
        font-weight: 800;
      }

      :host-context(html.dark) .checkout-redirect__card {
        border-color: rgba(104, 168, 255, 0.24);
        background: rgba(9, 20, 44, 0.78);
        color: #f8fbff;
      }
    `,
  ],
})
export class AiToolkitCheckoutComponent {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly store = inject(Store);

  readonly currentUser$$ = toSignal(this.store.select(selectCurrentUser), {
    initialValue: undefined,
  });
  readonly error$$ = signal<string | null>(null);
  private readonly started$$ = signal(false);

  private readonly checkoutEffect = effect(() => {
    const currentUser = this.currentUser$$();

    if (currentUser === undefined || this.started$$()) return;

    if (!currentUser) {
      void this.router.navigateByUrl('/login?target=ai-toolkit-checkout');
      return;
    }

    this.started$$.set(true);
    this.http
      .post<{ sessionUrl?: string; redirectUrl?: string; hasAccess?: boolean }>(
        `${environment.apiUrl}/ai-toolkit/create-checkout-session`,
        {}
      )
      .subscribe({
        next: ({ sessionUrl, redirectUrl, hasAccess }) => {
          if (hasAccess) {
            void this.router.navigateByUrl(redirectUrl || '/manager/dashboard');
            return;
          }
          if (!sessionUrl) {
            this.error$$.set('Stripe did not return a checkout URL.');
            return;
          }
          window.location.href = sessionUrl;
        },
        error: () => {
          this.error$$.set('We could not start checkout. Please try again.');
        },
      });
  });
}
