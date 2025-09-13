import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { interval, Subscription, switchMap, startWith } from 'rxjs';
import {
  RenderService,
  type RenderStatusResponse,
  type RenderJobStatus,
} from '../shared/services/render.service';

@Component({
  standalone: true,
  selector: 'mc-checkout-success',
  templateUrl: './checkout-success.component.html',
  imports: [CommonModule, RouterLink],
})
export class CheckoutSuccessComponent implements OnDestroy {
  jobId = this.route.snapshot.queryParamMap.get('jobId') || '';
  articleSlug = this.route.snapshot.queryParamMap.get('article') || ''; // optional if you add it later

  // ✅ strong typing for status
  status: RenderJobStatus = 'paid';
  signedUrl: string | null = null;
  expiresAt: string | null = null;

  sub?: Subscription;

  constructor(private route: ActivatedRoute, private render: RenderService) {
    // poll every 5s
    this.sub = interval(5000)
      .pipe(
        startWith(0),
        switchMap(() => this.render.getStatus(this.jobId))
      )
      .subscribe({
        next: (r: RenderStatusResponse) => {
          this.status = r.status;
          this.expiresAt = r.expiresAt || null;
          this.signedUrl = r.signedUrl || null;

          // stop polling once terminal
          if (this.status === 'done' || this.status === 'failed') {
            this.sub?.unsubscribe();
          }
        },
        error: () => {
          // optional: show a transient error/toast; keep polling or stop as desired
        },
      });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
}
