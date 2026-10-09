import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { StudentOperationsService } from '../student-operations.service';
import type { XeroConnectionStatus, XeroConnectionTest } from '../student-operations.types';

@Component({
  selector: 'app-xero-connections',
  imports: [CommonModule],
  templateUrl: './xero-connections.component.html',
  styleUrls: ['./xero-connections.component.css'],
})
export class XeroConnectionsComponent implements OnInit, OnDestroy {
  private readonly api = inject(StudentOperationsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();

  visible = false;
  checkingAccess = true;
  loading = false;
  connecting = false;
  testingConnectionId: string | null = null;
  status: XeroConnectionStatus | null = null;
  error = '';
  notice = '';
  lastTest: XeroConnectionTest | null = null;

  ngOnInit(): void {
    this.api.workspace().pipe(takeUntil(this.destroy$)).subscribe({
      next: (workspace) => {
        this.visible = workspace.role === 'chief_executive';
        this.checkingAccess = false;
        if (this.visible) this.loadStatus();
      },
      error: (response) => {
        this.checkingAccess = false;
        if (response?.status === 403) {
          this.visible = false;
          return;
        }
        this.visible = true;
        this.error = 'Xero access could not be verified. Refresh this section and try again.';
      },
    });
    const outcome = this.route.snapshot.queryParamMap.get('xero');
    if (outcome === 'connected') this.notice = 'Xero authorization completed. Verify the connected organisation below.';
    if (outcome === 'cancelled') this.notice = 'Xero authorization was cancelled.';
    if (outcome === 'failed') this.error = 'Xero authorization could not be completed. Please try again.';
    if (outcome) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { xero: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadStatus(): void {
    this.loading = true;
    this.error = '';
    this.api.xeroStatus().pipe(takeUntil(this.destroy$)).subscribe({
      next: (status) => {
        this.status = status;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.error = 'Xero connection status could not be loaded.';
      },
    });
  }

  connect(): void {
    if (this.connecting || !this.status?.configured) return;
    this.connecting = true;
    this.error = '';
    this.api.beginXeroAuthorization().pipe(takeUntil(this.destroy$)).subscribe({
      next: ({ authorizationUrl }) => window.location.assign(authorizationUrl),
      error: () => {
        this.connecting = false;
        this.error = 'Xero authorization could not be started.';
      },
    });
  }

  test(connectionId: string): void {
    if (this.testingConnectionId) return;
    this.testingConnectionId = connectionId;
    this.error = '';
    this.notice = '';
    this.lastTest = null;
    this.api.testXeroConnection(connectionId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (result) => {
        this.testingConnectionId = null;
        this.lastTest = result;
        this.notice = `${result.organisation.name} connected successfully. ${result.bankAccounts.length} bank account${result.bankAccounts.length === 1 ? '' : 's'} available.`;
        this.loadStatus();
      },
      error: () => {
        this.testingConnectionId = null;
        this.error = 'Xero could not verify this organisation. Reconnect it and try again.';
      },
    });
  }
}
