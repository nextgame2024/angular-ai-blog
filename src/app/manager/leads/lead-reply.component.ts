import { CommonModule } from '@angular/common';
import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  OnDestroy,
  inject,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Subscription, timer, exhaustMap, filter } from 'rxjs';
import {
  LeadConversation,
  LeadWorkspaceService,
} from './lead-workspace.service';
import { ManagerToastComponent } from '../components/shared/manager-toast/manager-toast.component';
@Component({
  selector: 'app-lead-reply',
  imports: [CommonModule, ReactiveFormsModule, ManagerToastComponent],
  template: `
    @if (conversation.reply; as reply) {
      <section class="reply-box" aria-label="WhatsApp reply">
        <h4>Reply to customer</h4>
        <p>
          Messages sent here are visible to the customer. Internal notes stay
          separate.
        </p>
        @if (reply.blockedReason) {
          <p>{{ reply.blockedReason }}</p>
        }
        <label for="customer-reply">Text reply</label
        ><textarea
          id="customer-reply"
          rows="3"
          maxlength="4000"
          [formControl]="body"
          [readOnly]="busy"
          placeholder="Write your reply"
        ></textarea>
        @if (reply.canResume) {
          <button
            class="btn"
            type="button"
            (click)="resume()"
            [disabled]="busy"
          >
            Resume Sophia
          </button>
        }
        <div class="actions">
          <button
            class="btn primary"
            type="button"
            (click)="send()"
            [disabled]="busy || !reply.canSend || !body.value.trim()"
          >
            Send reply</button
          ><button
            class="btn"
            type="button"
            (click)="draft()"
            [disabled]="
              busy ||
              conversation.lead.ownership !== 'human' ||
              conversation.lead.humanOwner !== actorId
            "
          >
            Draft with Sophia
          </button>
        </div>
        @for (job of reply.jobs; track job.id) {
          <div class="draft">
            <strong>{{
              job.state === 'ready'
                ? 'Sophia draft'
                : job.state === 'needs_human'
                  ? 'Human assistance needed'
                  : 'Answer: ' + job.state
            }}</strong>
            @if (job.answer && job.state === 'ready') {
              <p>{{ job.answer }}</p>
              <button
                class="btn"
                type="button"
                (click)="useDraft(job.answer)"
                [disabled]="busy || !!body.value.trim()"
              >
                Use draft
              </button>
            }
            @if (job.sources.length) {
              <small
                >Based on {{ job.sources.length }} approved source(s).</small
              >
            }
          </div>
        }
        @for (voice of reply.voiceJobs ?? []; track voice.id) {
          <p class="delivery">
            {{
              voice.kind === 'transcribe'
                ? 'Voice transcription'
                : 'Voice preparation'
            }}: {{ deliveryLabel(voice.state) }}
            @if (voice.canRetry) {
              <button
                class="btn"
                type="button"
                [disabled]="busy"
                (click)="retryVoice(voice.id)"
              >
                Retry voice only
              </button>
            }
            @if (voice.kind === 'transcribe' && voice.state === 'failed') {
              <br />Open WhatsApp to review the voice message with the customer.
            }
          </p>
        }
        @for (message of reply.messages; track message.id) {
          <p class="delivery">
            {{ message.format === 'audio' ? 'Voice reply' : 'Text reply' }}:
            {{ deliveryLabel(message.state) }} ·
            {{ message.createdAt | date: 'short' }}
            @if (message.state === 'unknown') {
              <br />Delivery could not be confirmed. Check the conversation
              before sending again.
            }
          </p>
        }
      </section>
    }
    @if (notice) {
      <app-manager-toast
        [message]="notice"
        [tone]="tone"
        (closed)="notice = ''"
      />
    }
  `,
  styleUrls: ['./lead-reply.component.css'],
})
export class LeadReplyComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) conversation!: LeadConversation;
  @Input() actorId = '';
  @Output() updated = new EventEmitter<LeadConversation>();
  private readonly api = inject(LeadWorkspaceService);
  private polling?: Subscription;
  private request?: Subscription;
  private id = '';
  private key = '';
  readonly body = new FormControl('', { nonNullable: true });
  busy = false;
  notice = '';
  tone: 'success' | 'error' = 'success';
  get hasUnsaved() {
    return !!this.body.value.trim();
  }
  ngOnChanges() {
    if (this.id !== this.conversation.lead.leadId) {
      this.request?.unsubscribe();
      this.id = this.conversation.lead.leadId;
      this.reset();
      this.busy = false;
    }
    this.polling?.unsubscribe();
    const r = this.conversation.reply;
    if (
      r &&
      ((r.voiceJobs ?? []).some((j) =>
        ['queued', 'working'].includes(j.state),
      ) ||
        r.jobs.some((j) => ['queued', 'working'].includes(j.state)) ||
        r.messages.some((m) =>
          ['preparing', 'queued', 'dispatching', 'accepted'].includes(m.state),
        ))
    )
      this.polling = timer(5000, 10000)
        .pipe(
          filter(() => !document.hidden),
          exhaustMap(() => this.api.detail(this.id)),
        )
        .subscribe({
          next: (d) => {
            if (d.lead.leadId === this.id) {
              this.conversation = d;
              this.updated.emit(d);
            }
          },
          error: () => {
            this.polling?.unsubscribe();
          },
        });
  }
  reset() {
    this.body.reset('');
    this.key = '';
  }
  send() {
    if (
      this.busy ||
      !this.conversation.reply?.canSend ||
      !this.body.value.trim()
    )
      return;
    this.key ||= crypto.randomUUID();
    this.busy = true;
    this.request = this.api
      .reply(
        this.id,
        this.key,
        this.conversation.lead.ownershipVersion,
        this.body.value,
      )
      .subscribe({
        next: (d) => {
          this.busy = false;
          this.reset();
          this.conversation = d;
          this.updated.emit(d);
          this.tone = 'success';
          this.notice = 'Reply queued for sending.';
        },
        error: (e) => this.error(e),
      });
  }
  draft() {
    if (this.busy) return;
    this.busy = true;
    this.request = this.api
      .draft(this.id, this.conversation.lead.ownershipVersion)
      .subscribe({
        next: (d) => {
          this.busy = false;
          this.conversation = d;
          this.updated.emit(d);
          this.tone = 'success';
          this.notice =
            'Draft requested. You can keep working while Sophia prepares it.';
        },
        error: (e) => this.error(e),
      });
  }
  resume() {
    if (this.busy || !this.conversation.reply?.canResume) return;
    this.busy = true;
    this.request = this.api
      .ownership(this.id, this.conversation.lead.ownershipVersion, 'bot')
      .subscribe({
        next: (d) => {
          this.busy = false;
          this.conversation = d;
          this.updated.emit(d);
          this.tone = 'success';
          this.notice = 'Sophia resumed for this conversation.';
        },
        error: (e) => this.error(e),
      });
  }
  retryVoice(jobId: string) {
    if (this.busy) return;
    this.busy = true;
    this.request = this.api.retryVoice(this.id, jobId).subscribe({
      next: (d) => {
        this.busy = false;
        this.conversation = d;
        this.updated.emit(d);
        this.tone = 'success';
        this.notice = 'Voice reply queued. The text will not be resent.';
      },
      error: (e) => this.error(e),
    });
  }
  useDraft(answer: string) {
    if (this.body.value.trim()) return;
    this.body.setValue(answer);
  }
  deliveryLabel(state: string) {
    return (
      (
        {
          preparing: 'Preparing',
          working: 'Processing',
          ready: 'Ready',
          queued: 'Queued',
          dispatching: 'Sending',
          accepted: 'Sent',
          delivered: 'Delivered',
          read: 'Read',
          failed: 'Not delivered',
          unknown: 'Delivery uncertain',
          cancelled: 'Cancelled',
        } as Record<string, string>
      )[state] ?? state
    );
  }
  private error(e: any) {
    this.busy = false;
    this.tone = 'error';
    this.notice =
      e.error?.error || 'The reply could not be queued. Retry the same reply.';
  }
  ngOnDestroy() {
    this.polling?.unsubscribe();
    this.request?.unsubscribe();
  }
}
