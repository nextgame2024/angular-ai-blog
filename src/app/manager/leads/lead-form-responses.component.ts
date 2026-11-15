import { Component, Input, OnChanges, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { environment } from 'src/environments/environment';
interface FormResponse {
  id: string;
  formName: string;
  createdAt: string;
  answers: {
    id: string;
    label: string;
    value: string | string[];
    format?: string;
  }[];
}
@Component({
  selector: 'app-lead-form-responses',
  imports: [CommonModule],
  template: ` <section class="notice">
    <h4>Form responses</h4>
    @if (loading) {
      <p role="status">Loading responses…</p>
    }
    @if (error) {
      <p role="alert">{{ error }}</p>
      <button type="button" class="btn" (click)="load()">Retry</button>
    }
    @for (response of responses; track response.id) {
      <details>
        <summary>
          {{ response.formName }} · {{ response.createdAt | date: 'medium' }}
        </summary>
        <dl>
          @for (answer of response.answers; track answer.id) {
            <dt>{{ answer.label }}</dt>
            <dd>
              @if (answer.format === 'html') {
                <div [innerHTML]="display(answer.value)"></div>
              } @else {
                {{ display(answer.value) }}
              }
            </dd>
          }
        </dl>
      </details>
    }
  </section>`,
  styleUrls: ['./lead-workspace.page.css'],
  styles: [
    `
      :host {
        display: block;
        margin: 1rem;
      }
      h4 {
        font-size: 0.9rem;
        font-weight: 700;
      }
      summary {
        cursor: pointer;
        padding: 0.5rem 0;
      }
      dt {
        font-weight: 600;
      }
      dd {
        margin: 0.3rem 0 1rem;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
    `,
  ],
})
export class LeadFormResponsesComponent implements OnChanges {
  @Input() leadId = '';
  private http = inject(HttpClient);
  private destroy = inject(DestroyRef);
  private request?: Subscription;
  loading = false;
  error = '';
  responses: FormResponse[] = [];
  ngOnChanges() {
    this.load();
  }
  load() {
    this.request?.unsubscribe();
    this.responses = [];
    this.error = '';
    if (!this.leadId) return;
    this.loading = true;
    this.request = this.http
      .get<{ items: FormResponse[] }>(
        `${environment.apiUrl}/bm/lead-assistant/leads/${this.leadId}/form-submissions`,
      )
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (r) => {
          this.responses = r.items;
          this.loading = false;
        },
        error: () => {
          this.loading = false;
          this.error = 'Could not load form responses.';
        },
      });
  }
  display(v: string | string[]) {
    return Array.isArray(v) ? v.join(', ') : v || 'Not answered';
  }
}
