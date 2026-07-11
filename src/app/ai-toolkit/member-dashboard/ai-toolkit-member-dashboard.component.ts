import { HttpClient } from '@angular/common/http';
import { Component, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';

import { authActions } from '../../auth/store/actions';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-ai-toolkit-member-dashboard',
  template: `
    <main class="member-dashboard" aria-label="Sophia AI Toolkit member dashboard"></main>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .member-dashboard {
        min-height: 70svh;
      }
    `,
  ],
})
export class AiToolkitMemberDashboardComponent {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly store = inject(Store);
  private readonly confirmed$$ = signal(false);

  private readonly confirmPaymentEffect = effect(() => {
    if (this.confirmed$$()) return;

    const sessionId = this.route.snapshot.queryParamMap.get('session_id');
    if (!sessionId) return;

    this.confirmed$$.set(true);
    this.http
      .post(`${environment.apiUrl}/ai-toolkit/confirm-session`, { sessionId })
      .subscribe({
        next: () => {
          this.store.dispatch(authActions.getCurrentUser());
          void this.router.navigateByUrl('/manager/dashboard');
        },
        error: () => {
          this.store.dispatch(authActions.getCurrentUser());
          void this.router.navigateByUrl('/manager/dashboard');
        },
      });
  });
}
