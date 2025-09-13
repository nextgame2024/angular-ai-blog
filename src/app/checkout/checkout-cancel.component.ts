import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  standalone: true,
  selector: 'mc-checkout-cancel',
  imports: [CommonModule, RouterLink],
  template: `
    <div class="container mx-auto px-4 py-12 max-w-2xl text-center">
      <h1 class="text-2xl md:text-3xl font-semibold">Payment canceled</h1>
      <p class="mt-3 text-neutral-600 dark:text-neutral-300">
        No charge was made. You can try again anytime.
      </p>
      <a routerLink="/" class="p-button p-button-text mt-6">Back to Home</a>
    </div>
  `,
})
export class CheckoutCancelComponent {}
