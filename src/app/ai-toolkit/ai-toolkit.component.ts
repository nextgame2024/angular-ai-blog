import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { Store } from '@ngrx/store';
import { toSignal } from '@angular/core/rxjs-interop';

import toolkitJson from './sophia-ai-business-toolkit-v1.json';
import { selectCurrentUser } from '../auth/store/reducers';
import { environment } from 'src/environments/environment';
import { AnalyticsService } from '../shared/services/analytics.service';

interface ToolkitFeature {
  title: string;
  copy: string;
  icon: string;
}

interface ToolkitMetadata {
  price: number;
}

interface ToolkitData {
  metadata: ToolkitMetadata;
}

@Component({
  selector: 'app-ai-toolkit',
  imports: [CommonModule, RouterModule],
  templateUrl: './ai-toolkit.component.html',
  styleUrls: ['./ai-toolkit.component.css'],
})
export class AiToolkitComponent {
  private readonly router = inject(Router);
  private readonly store = inject(Store);
  private readonly http = inject(HttpClient);
  private readonly analytics = inject(AnalyticsService);

  readonly toolkit = toolkitJson as ToolkitData;
  readonly accountModalOpen$$ = signal(false);
  readonly currentUser$$ = toSignal(this.store.select(selectCurrentUser), {
    initialValue: undefined,
  });

  readonly checklist = [
    '50+ Business Recipes',
    'Easy to use',
    'Practical & Actionable',
    'For non-technical users',
  ];

  readonly features: ToolkitFeature[] = [
    {
      title: 'Instant Access',
      copy: 'Start using immediately',
      icon: 'shield',
    },
    {
      title: 'One-Time Payment',
      copy: 'No subscriptions',
      icon: 'card',
    },
    {
      title: 'Works Everywhere',
      copy: 'Desktop, tablet, mobile',
      icon: 'screen',
    },
  ];

  startCheckout(): void {
    this.analytics.trackEvent('payment_button_click', {
      source: 'ai_toolkit_landing',
      product: 'sophia_ai_business_toolkit',
    });

    if (this.currentUser$$()) {
      this.http
        .get<{ hasAccess: boolean }>(`${environment.apiUrl}/ai-toolkit/access`)
        .subscribe({
          next: ({ hasAccess }) => {
            void this.router.navigateByUrl(
              hasAccess ? '/manager/dashboard' : '/ai-toolkit/checkout',
            );
          },
          error: () => {
            void this.router.navigateByUrl('/ai-toolkit/checkout');
          },
        });
      return;
    }

    this.accountModalOpen$$.set(true);
  }

  closeAccountModal(): void {
    this.accountModalOpen$$.set(false);
  }
}
