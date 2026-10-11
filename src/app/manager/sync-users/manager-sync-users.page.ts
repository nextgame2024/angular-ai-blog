import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import { RouterModule } from '@angular/router';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ManagerSelectComponent } from '../components/shared/manager-select/manager-select.component';
import {
  ManagerSyncUsersService,
  SyncCandidate,
  SyncOverview,
} from './manager-sync-users.service';

@Component({
  selector: 'app-manager-sync-users',
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    ManagerSelectComponent,
    A11yModule,
  ],
  templateUrl: './manager-sync-users.page.html',
  styleUrls: ['./manager-sync-users.page.css'],
})
export class ManagerSyncUsersPageComponent implements OnInit, OnDestroy {
  private api = inject(ManagerSyncUsersService);
  data: SyncOverview | null = null;
  loading = true;
  saving = false;
  error = '';
  toast = '';
  page = 1;
  selected: SyncCandidate | null = null;
  status = new FormControl('', { nonNullable: true });
  search = new FormControl('', { nonNullable: true });
  form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(500)],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    studentId: new FormControl('', { nonNullable: true }),
  });
  options = [
    { value: '', label: 'All records' },
    { value: 'pending', label: 'Pending action' },
    { value: 'ready', label: 'Ready to sync' },
    { value: 'linked', label: 'Linked records' },
    { value: 'excluded', label: 'Excluded' },
  ];
  private poll?: ReturnType<typeof setTimeout>;
  private toastTimer?: ReturnType<typeof setTimeout>;
  private request = 0;
  private destroyed = false;
  get running() {
    return (
      this.data?.runs.some((r) =>
        ['queued', 'processing'].includes(r.status),
      ) ?? false
    );
  }
  get pages() {
    return Math.max(1, Math.ceil((this.data?.total ?? 0) / 25));
  }
  ngOnInit() {
    void this.load();
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.request++;
    clearTimeout(this.poll);
    clearTimeout(this.toastTimer);
  }
  async load(background = false) {
    const token = ++this.request;
    clearTimeout(this.poll);
    if (!background) this.loading = true;
    try {
      const data = await firstValueFrom(
        this.api.list(this.page, this.status.value, this.search.value),
      );
      if (token !== this.request || this.destroyed) return;
      this.data = data;
      this.error = '';
      if (this.page > this.pages) {
        this.page = this.pages;
        void this.load();
        return;
      }
      if (this.running || this.data.automatic)
        this.poll = setTimeout(
          () => void this.load(true),
          this.running ? 2000 : 15000,
        );
    } catch (e: any) {
      if (token === this.request)
        this.error =
          e?.error?.error || 'Unable to load sync records. Please retry.';
    } finally {
      if (token === this.request) this.loading = false;
    }
  }
  filter() {
    this.page = 1;
    void this.load();
  }
  move(delta: number) {
    this.page += delta;
    void this.load();
  }
  async run(mode: 'preview' | 'apply') {
    this.saving = true;
    this.error = '';
    try {
      await firstValueFrom(this.api.run(mode));
      await this.load(true);
      this.notify(
        mode === 'preview'
          ? 'Checking imported contacts…'
          : 'Student sync queued. You can leave this page while it runs.',
      );
    } catch (e: any) {
      this.error = e?.error?.error || 'Unable to start sync. Please retry.';
    } finally {
      this.saving = false;
    }
  }
  edit(row: SyncCandidate) {
    this.selected = row;
    this.form.reset({
      name: row.resolution_name || row.display_name,
      email:
        row.resolution_email || (row.emails.length === 1 ? row.emails[0] : ''),
      studentId: '',
    });
  }
  async resolve(action: 'correct' | 'link' | 'exclude') {
    if (!this.selected) return;
    if (
      action === 'correct' &&
      (this.form.controls.name.invalid || this.form.controls.email.invalid)
    ) {
      this.form.markAllAsTouched();
      this.notify('Enter a student name and a valid email.');
      return;
    }
    if (action === 'link' && !this.form.controls.studentId.value.trim()) {
      this.form.controls.studentId.setErrors({ required: true });
      this.form.controls.studentId.markAsTouched();
      this.notify('Enter the existing Student ID.');
      return;
    }
    this.saving = true;
    try {
      await firstValueFrom(
        this.api.resolve(this.selected.id, {
          action,
          ...this.form.getRawValue(),
        }),
      );
      this.selected = null;
      this.notify(
        action === 'correct'
          ? 'Correction saved. Run Sync ready users to process it.'
          : 'Record updated.',
      );
      await this.load(true);
    } catch (e: any) {
      this.notify(e?.error?.error || 'Unable to save. Please retry.');
    } finally {
      this.saving = false;
    }
  }
  private notify(message: string) {
    this.toast = message;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toast = ''), 6000);
  }
}
