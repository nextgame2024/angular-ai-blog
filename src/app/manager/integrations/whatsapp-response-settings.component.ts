import { CommonModule } from '@angular/common';
import { Component, DestroyRef, Input, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { WhatsAppConnectionService } from './whatsapp-connection.service';
import { ManagerSelectComponent } from '../components/shared/manager-select/manager-select.component';
import { ManagerToastComponent } from '../components/shared/manager-toast/manager-toast.component';
@Component({
  selector: 'app-whatsapp-response-settings',
  imports: [
    CommonModule,
    FormsModule,
    ManagerSelectComponent,
    ManagerToastComponent,
  ],
  template: `
    <button class="btn" type="button" (click)="open()" [disabled]="loading">
      Configure Sophia replies
    </button>
    @if (expanded) {
      <div class="response-settings">
        <label
          >Approved agent release<app-manager-select
            [options]="options"
            [(ngModel)]="releaseId"
            placeholder="Select an approved release"
            [disabled]="loading || saving" /></label
        ><label
          >Reply mode<app-manager-select
            [options]="modes"
            [(ngModel)]="mode"
            [disabled]="loading || saving"
        /></label>
        <p>
          Review mode creates drafts for your team. Automatic mode answers new
          text enquiries using approved knowledge and asks for human help when
          it cannot answer. Sending also requires an enabled connection. Voice
          replies are a later step.
        </p>
        <button
          class="btn"
          type="button"
          (click)="save()"
          [disabled]="loading || saving || !releaseId"
        >
          Save reply settings
        </button>
      </div>
    }
    @if (message) {
      <app-manager-toast
        [message]="message"
        [tone]="tone"
        (closed)="message = ''"
      />
    }
  `,
  styles: [
    `
      :host {
        display: block;
        margin-top: 12px;
        color: inherit;
      }
      .response-settings {
        display: grid;
        gap: 12px;
        margin-top: 12px;
        max-width: 560px;
      }
      label {
        font-size: 13px;
        display: grid;
        gap: 6px;
      }
      p {
        font-size: 12px;
        line-height: 1.5;
      }
      .btn {
        min-height: 44px;
        border: 1px solid #c7d8ee;
        background: transparent;
        color: #315fff;
        border-radius: 8px;
        padding: 10px 14px;
        font: inherit;
        font-size: 12px;
        cursor: pointer;
      }
      .btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      :host-context(html.dark) .btn {
        color: #a5b4fc;
        border-color: #475569;
      }
    `,
  ],
})
export class WhatsAppResponseSettingsComponent {
  @Input({ required: true }) profileId = '';
  private readonly api = inject(WhatsAppConnectionService);
  private readonly destroy = inject(DestroyRef);
  expanded = false;
  loading = false;
  saving = false;
  releaseId = '';
  mode = 'review';
  revision = 0;
  message = '';
  tone: 'success' | 'error' = 'success';
  options: { value: string; label: string }[] = [];
  readonly modes = [
    { value: 'review', label: 'Draft for review' },
    { value: 'automatic', label: 'Automatic text replies' },
  ];
  open() {
    if (this.loading) return;
    this.loading = true;
    this.api
      .responses()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (s) => {
          this.loading = false;
          this.expanded = true;
          this.options = s.releases.map((r) => ({
            value: r.id,
            label: `${r.label} · Version ${r.version}`,
          }));
          const b = s.bindings.find((b) => b.profileId === this.profileId);
          this.releaseId = b?.releaseId ?? '';
          this.mode = b?.mode ?? 'review';
          this.revision = b?.revision ?? 0;
        },
        error: (e) => {
          this.loading = false;
          this.error(e);
        },
      });
  }
  save() {
    if (this.saving || !this.releaseId) return;
    this.saving = true;
    this.api
      .bindResponse(this.profileId, this.releaseId, this.mode, this.revision)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (r) => {
          this.saving = false;
          this.revision = r.revision;
          this.tone = 'success';
          this.message = 'Reply settings saved.';
        },
        error: (e) => {
          this.saving = false;
          this.error(e);
        },
      });
  }
  private error(e: any) {
    this.tone = 'error';
    this.message =
      e.error?.error ||
      'Reply settings could not be loaded or saved. Try again.';
  }
}
