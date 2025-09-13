import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  standalone: true,
  selector: 'mc-checkout-success',
  imports: [CommonModule, RouterLink],
  template: `
    <div class="container mx-auto px-4 py-12 max-w-2xl text-center">
      <h1 class="text-2xl md:text-3xl font-semibold">
        Thanks! Payment received.
      </h1>
      <p class="mt-3 text-neutral-600 dark:text-neutral-300">
        We’re now rendering your video. It will appear on this article shortly.
      </p>
      <p class="mt-2 text-xs text-neutral-500">Job ID: {{ jobId || '—' }}</p>
      <a routerLink="/" class="p-button p-button-text mt-6">Back to Home</a>
    </div>
  `,
})
export class CheckoutSuccessComponent {
  jobId = this.route.snapshot.queryParamMap.get('jobId');
  constructor(private route: ActivatedRoute) {}
}
