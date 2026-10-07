import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { OpenForAustraliaService } from '../open-for-australia.service';
import type { OpenForAustraliaWorkspace } from '../open-for-australia.types';

@Component({
  selector: 'app-open-for-australia-dashboard',
  imports: [CommonModule, RouterModule],
  templateUrl: './open-for-australia-dashboard.component.html',
  styleUrls: ['./open-for-australia-dashboard.component.css'],
})
export class OpenForAustraliaDashboardComponent implements OnInit {
  private readonly api = inject(OpenForAustraliaService);

  workspace: OpenForAustraliaWorkspace | null = null;
  activeStudents = 0;
  actionRequired = 0;
  onHold = 0;
  totalStudents = 0;
  loading = true;
  refreshing = false;
  error = '';
  refreshError = '';
  lastUpdatedAt: number | null = null;

  ngOnInit(): void {
    this.load();
  }

  load(refresh = false): void {
    const hasCachedDashboard = this.api.hasDashboardCache();
    this.loading = !hasCachedDashboard;
    this.refreshing = refresh && hasCachedDashboard;
    this.error = '';
    this.refreshError = '';
    this.api.dashboard({ refresh }).subscribe({
      next: ({ workspace, summary }) => {
        this.workspace = workspace;
        this.totalStudents = summary.totalStudents;
        this.activeStudents = summary.activeStudents;
        this.actionRequired = summary.actionRequired;
        this.onHold = summary.onHold;
        this.lastUpdatedAt = this.api.dashboardCachedAt();
        this.loading = false;
        this.refreshing = false;
      },
      error: (error) => {
        this.loading = false;
        this.refreshing = false;
        const message = Number(error?.status) === 403
          ? 'This account does not have Open For Australia workspace access.'
          : 'The operations dashboard could not be loaded.';
        if (hasCachedDashboard) {
          this.refreshError = `${message} The last loaded values are still displayed.`;
        } else {
          this.error = message;
        }
      },
    });
  }

  formatRole(value: string): string {
    return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
}
