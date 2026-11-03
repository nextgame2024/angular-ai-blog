import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import {
  WhatsAppConnectionService,
  WhatsAppChannelState,
} from './whatsapp-connection.service';
import { ManagerToastComponent } from '../components/shared/manager-toast/manager-toast.component';
import { ManagerListLoaderComponent } from '../components/shared/manager-list-loader/manager-list-loader.component';
@Component({
  selector: 'app-whatsapp-connection',
  imports: [
    CommonModule,
    RouterLink,
    ManagerToastComponent,
    ManagerListLoaderComponent,
  ],
  templateUrl: './whatsapp-connection.component.html',
  styleUrls: ['./whatsapp-connection.component.css'],
})
export class WhatsAppConnectionComponent implements OnInit {
  private readonly api = inject(WhatsAppConnectionService);
  private readonly destroyRef = inject(DestroyRef);
  state: WhatsAppChannelState | null = null;
  visible = true;
  loading = false;
  saving = false;
  error = '';
  notice = '';
  tone: 'success' | 'error' = 'success';
  ngOnInit() {
    this.load();
  }
  load() {
    if (this.loading || this.saving) return;
    this.loading = true;
    this.error = '';
    this.api
      .load()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (state) => {
          this.state = state;
          this.loading = false;
        },
        error: (e) => {
          this.loading = false;
          if (e.status === 403) {
            this.visible = false;
            return;
          }
          this.error =
            e.error?.error ||
            'Receiving settings could not be loaded. Try again.';
        },
      });
  }
  channel(id: string) {
    return this.state?.channels.find((c) => c.profileId === id);
  }
  toggle(id: string) {
    if (this.saving || this.loading || !this.state) return;
    const c = this.channel(id);
    const enabled = !c?.enabled;
    this.saving = true;
    this.api
      .save(id, c?.revision ?? 0, enabled)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving = false;
          this.tone = 'success';
          this.notice = enabled
            ? 'Receiving enabled. New messages will appear in the inbox after channel setup.'
            : 'Receiving paused. Existing enquiries remain available.';
          this.load();
        },
        error: (e) => {
          this.saving = false;
          this.tone = 'error';
          this.notice =
            e.error?.error ||
            'Receiving settings could not be saved. Refresh and try again.';
        },
      });
  }
}
