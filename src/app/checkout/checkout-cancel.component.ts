import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  standalone: true,
  selector: 'mc-checkout-cancel',
  templateUrl: './checkout-cancel.component.html',
  imports: [CommonModule, RouterLink],
})
export class CheckoutCancelComponent {}
