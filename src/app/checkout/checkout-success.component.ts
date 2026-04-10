import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { interval, switchMap, startWith } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  RenderService,
  type RenderStatusResponse,
  type RenderJobStatus,
} from '../shared/services/render.service';

@Component({
    selector: 'mc-checkout-success',
    templateUrl: './checkout-success.component.html',
    imports: [CommonModule, RouterLink]
})
export class CheckoutSuccessComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly render = inject(RenderService);

  private readonly queryParams$$ = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  readonly jobId$$ = signal('');
  readonly articleSlug$$ = signal('');

  // ✅ strong typing for status
  readonly status$$ = signal<RenderJobStatus>('paid');
  readonly signedUrl$$ = signal<string | null>(null);
  readonly expiresAt$$ = signal<string | null>(null);

  private readonly paramsSyncEffect = effect(() => {
    const params = this.queryParams$$();
    const jobId = params.get('jobId') || '';
    const article = params.get('article') || '';

    if (jobId !== this.jobId$$()) {
      this.jobId$$.set(jobId);
    }
    if (article !== this.articleSlug$$()) {
      this.articleSlug$$.set(article);
    }
  });

  private readonly pollEffect = effect((onCleanup) => {
    const jobId = this.jobId$$();
    if (!jobId) return;

    const sub = interval(5000)
      .pipe(
        startWith(0),
        switchMap(() => this.render.getStatus(jobId))
      )
      .subscribe({
        next: (r: RenderStatusResponse) => {
          this.status$$.set(r.status);
          this.expiresAt$$.set(r.expiresAt || null);
          this.signedUrl$$.set(r.signedUrl || null);
          const currentSlug = this.articleSlug$$();
          if (!currentSlug && r.articleSlug) {
            this.articleSlug$$.set(r.articleSlug);
          }

          // stop polling once terminal
          if (r.status === 'done' || r.status === 'failed') sub.unsubscribe();
        },
        error: () => {
          // optional: show a transient error/toast; keep polling or stop as desired
        },
      });

    onCleanup(() => sub.unsubscribe());
  });
}
