import { ManagerRichTextEditorComponent } from '../manager/components/shared/manager-rich-text-editor/manager-rich-text-editor.component';
import {
  Component,
  ViewChild,
  DestroyRef,
  HostListener,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { switchMap, catchError, of } from 'rxjs';
import { environment } from 'src/environments/environment';
import { FormBlock } from '../manager/leads/lead-forms.service';
import {
  LeadFormCalendarComponent,
  FormAppointment,
} from '../manager/leads/lead-form-calendar.component';
import { ManagerSelectComponent } from '../manager/components/shared/manager-select/manager-select.component';
import { ManagerToastComponent } from '../manager/components/shared/manager-toast/manager-toast.component';
interface PublishedForm {
  name: string;
  businessName: string;
  version: number;
  blocks: FormBlock[];
}
@Component({
  selector: 'app-public-lead-form',
  imports: [
    CommonModule,
    FormsModule,
    LeadFormCalendarComponent,
    ManagerSelectComponent,
    ManagerToastComponent,
    ManagerRichTextEditorComponent,
  ],
  template: `
    <main class="public-shell">
      @if (loading) {
        <p role="status">Loading form…</p>
      }
      @if (error) {
        <p role="alert">{{ error }}</p>
      }
      @if (result) {
        <section class="card form-body">
          <h1>Thank you for telling us about your business!</h1>
          @if (result.appointment) {
            <p>
              Your appointment is confirmed for
              <strong>{{ appointmentLabel(result.appointment) }}</strong
              >.
            </p>
          }
          <p>
            Our team will review your answers to better understand your needs
            and identify relevant opportunities before we meet.
          </p>
          <p>We look forward to speaking with you.</p>
        </section>
      } @else if (form) {
        <section class="card form-body">
          <div class="honeypot" aria-hidden="true">
            <label for="website">Website</label
            ><input
              id="website"
              [(ngModel)]="website"
              tabindex="-1"
              autocomplete="off"
            />
          </div>
          <div class="form-preview">
            @for (block of form.blocks; track block.id; let i = $index) {
              @switch (block.kind) {
                @case ('title') {
                  <h1>{{ block.text }}</h1>
                }
                @case ('subtitle') {
                  <h2>{{ block.text }}</h2>
                }
                @case ('description') {
                  <div class="description" [innerHTML]="block.text"></div>
                }
                @case ('question') {
                  <label
                    [id]="'question-' + block.id"
                    [attr.for]="'answer-' + form.blocks[i + 1]?.id"
                    >{{ block.text }}
                    @if (block.required) {
                      <span class="required-mark">Required</span>
                    }
                  </label>
                }
                @case ('richtext') {
                  <app-manager-rich-text-editor
                    [id]="'answer-' + block.id"
                    [ngModel]="answers[block.id] ?? ''"
                    (ngModelChange)="answers[block.id] = $event"
                    [disabled]="saving"
                    [placeholder]="block.text || 'Write your answer…'"
                    [attr.aria-label]="question(i)?.text || 'Your answer'"
                    [class.invalid]="invalid.has(block.id)"
                  />
                }
                @case ('input') {
                  <input
                    [id]="'answer-' + block.id"
                    [ngModel]="answers[block.id] ?? ''"
                    (ngModelChange)="answers[block.id] = $event"
                    maxlength="4000"
                    [placeholder]="block.text"
                    [disabled]="saving"
                    [attr.aria-label]="
                      question(i)?.text || block.text || 'Your answer'
                    "
                    [attr.aria-required]="question(i)?.required || null"
                    [class.invalid]="invalid.has(block.id)"
                  />
                }
                @case ('list') {
                  <app-manager-select
                    [id]="'answer-' + block.id"
                    [ngModel]="answers[block.id] ?? ''"
                    (ngModelChange)="answers[block.id] = $event"
                    [options]="options(block)"
                    [disabled]="saving"
                    [ariaLabel]="question(i)?.text || 'Select an option'"
                    [class.invalid]="invalid.has(block.id)"
                    placeholder="Select an option"
                  />
                }
                @case ('checkboxes') {
                  <fieldset
                    class="checks"
                    [attr.aria-label]="question(i)?.text || 'Choose options'"
                    [disabled]="saving"
                    [class.invalid]="invalid.has(block.id)"
                  >
                    @if (!question(i)) {
                      <legend>Choose options</legend>
                    }
                    <div
                      class="check-options"
                      [class.single-option]="block.options.length === 1"
                    >
                      @for (option of block.options; track option) {
                        <label
                          ><input
                            type="checkbox"
                            [checked]="checked(block.id, option)"
                            (change)="
                              toggle(
                                block.id,
                                option,
                                $any($event.target).checked
                              )
                            "
                          />{{ option }}</label
                        >
                      }
                    </div>
                  </fieldset>
                }
                @case ('calendar') {
                  <app-lead-form-calendar
                    [block]="block"
                    [token]="token"
                    [formVersion]="form.version"
                    [disabled]="saving"
                    (selectionChange)="appointment = $event"
                    [class.invalid]="invalid.has(block.id)"
                  />
                }
              }
            }
          </div>
          <button
            class="btn primary submit"
            type="button"
            (click)="submit()"
            [disabled]="saving"
          >
            {{ saving ? 'Sending…' : 'Send' }}
          </button>
        </section>
      }
      @if (toast) {
        <app-manager-toast
          [message]="toast"
          tone="error"
          (closed)="toast = ''"
        />
      }
    </main>
  `,
  styleUrls: ['../manager/leads/lead-workspace.page.css'],
  styles: [
    `
      .public-shell {
        max-width: 1100px;
        margin: 2rem auto;
        padding: 1rem;
      }
      header {
        margin-bottom: 1rem;
      }
      h1 {
        font-size: 1.7rem;
        font-weight: 750;
      }
      h2 {
        font-size: 1.3rem;
        font-weight: 700;
      }
      .business-name {
        font-weight: 600;
        color: #607496;
      }
      .form-preview > label {
        margin-top: 1.2rem;
      }
      .form-preview > input,
      .form-preview > app-manager-select {
        display: block;
        margin-bottom: 1rem;
      }
      .description {
        line-height: 1.7;
        margin: 1rem 0;
        overflow-wrap: anywhere;
      }
      .checks {
        border: 0;
        padding: 0.5rem 0;
      }
      .check-options {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.125rem 1.25rem;
      }
      .check-options.single-option {
        grid-template-columns: minmax(0, 1fr);
      }
      .checks label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        min-height: 32px;
        margin: 0;
        overflow-wrap: anywhere;
      }
      .checks input {
        width: 18px;
        min-height: 18px;
        flex: 0 0 18px;
      }
      .required-mark {
        font-size: 0.75rem;
        font-style: italic;
        font-weight: 400;
      }
      .honeypot {
        position: absolute;
        left: -10000px;
        width: 1px;
        height: 1px;
        overflow: hidden;
      }
      .submit {
        width: 100%;
      }
      app-lead-form-calendar {
        display: block;
      }
      @media (max-width: 600px) {
        .check-options {
          grid-template-columns: minmax(0, 1fr);
        }
        .check-options.single-option {
          grid-template-columns: minmax(0, 1fr);
        }
        .checks label {
          min-height: 44px;
        }
        .public-shell {
          margin: 0.5rem auto;
          padding: 0.5rem;
        }
      }
    `,
  ],
})
export class PublicFormPage implements OnInit {
  @ViewChild(LeadFormCalendarComponent) calendar?: LeadFormCalendarComponent;
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private destroy = inject(DestroyRef);
  token = '';
  form: PublishedForm | null = null;
  loading = true;
  error = '';
  toast = '';
  saving = false;
  result: any = null;
  website = '';
  answers: Record<string, string | string[] | undefined> = {};
  appointment: FormAppointment | null = null;
  invalid = new Set<string>();
  private key = crypto.randomUUID();
  get hasCalendar() {
    return !!this.form?.blocks.some((b) => b.kind === 'calendar');
  }
  ngOnInit() {
    this.route.paramMap
      .pipe(
        switchMap((p) => {
          this.token = p.get('token') ?? '';
          this.loading = true;
          this.form = null;
          this.error = '';
          this.result = null;
          this.answers = {};
          this.appointment = null;
          this.key = crypto.randomUUID();
          return this.http
            .get<PublishedForm>(
              `${environment.apiUrl}/public/forms/${this.token}`,
            )
            .pipe(
              catchError((e) => {
                this.error = this.message(e);
                return of(null);
              }),
            );
        }),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe((f) => {
        this.loading = false;
        this.form = f;
      });
  }
  question(i: number) {
    const q = this.form?.blocks[i - 1];
    return q?.kind === 'question' ? q : null;
  }
  options(b: FormBlock) {
    return b.options.map((label) => ({ value: label, label }));
  }
  checked(id: string, v: string) {
    return Array.isArray(this.answers[id]) && this.answers[id].includes(v);
  }
  toggle(id: string, v: string, on: boolean) {
    const values = Array.isArray(this.answers[id])
      ? (this.answers[id] as string[])
      : [];
    this.answers[id] = on
      ? [...new Set([...values, v])]
      : values.filter((x) => x !== v);
  }
  answerEmpty(block: { id: string; kind: string }) {
    const value = this.answers[block.id];
    if (block.kind !== 'richtext') return !value?.length;
    const template = document.createElement('template');
    template.innerHTML = typeof value === 'string' ? value : '';
    template.content
      .querySelectorAll('script,style')
      .forEach((node) => node.remove());
    return !(template.content.textContent || '')
      .replace(/[\u200b-\u200d\ufeff]/g, '')
      .trim();
  }
  submit() {
    if (!this.form || this.saving || this.result) return;
    this.invalid.clear();
    this.form.blocks.forEach((b, i) => {
      if (this.question(i)?.required && this.answerEmpty(b))
        this.invalid.add(b.id);
      if (b.kind === 'calendar' && !this.appointment) this.invalid.add(b.id);
    });
    if (this.invalid.size) {
      this.toast = 'Complete the highlighted fields.';
      return;
    }
    this.saving = true;
    this.http
      .post(`${environment.apiUrl}/public/forms/${this.token}/submissions`, {
        requestKey: this.key,
        formVersion: this.form.version,
        answers: this.answers,
        appointment: this.appointment,
        website: this.website,
      })
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (r) => {
          this.saving = false;
          this.result = r;
        },
        error: (e) => {
          this.saving = false;
          this.toast = this.message(e);
          this.invalid = new Set(e.error?.fields ?? []);
          if (e.status === 409 && this.invalid.has('slot'))
            this.calendar?.load();
        },
      });
  }
  appointmentLabel(a: { startsAt: string; timezone: string }) {
    return (
      new Intl.DateTimeFormat('en-AU', {
        timeZone: a.timezone,
        dateStyle: 'full',
        timeStyle: 'short',
      }).format(new Date(a.startsAt)) +
      ' (' +
      a.timezone +
      ')'
    );
  }
  private message(e: any) {
    return typeof e?.error?.error === 'string'
      ? e.error.error
      : 'The form could not be loaded or submitted. Please try again.';
  }
  @HostListener('window:beforeunload', ['$event']) leaving(
    e: BeforeUnloadEvent,
  ) {
    if (
      !this.result &&
      (Object.keys(this.answers).length || this.appointment)
    ) {
      e.preventDefault();
      e.returnValue = '';
    }
  }
}
