import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { StudentOperationsService } from '../student-operations.service';
import type { StudentOperationsWorkspace } from '../student-operations.types';

@Component({
  selector: 'app-student-operations-dashboard',
  imports: [CommonModule, RouterModule],
  templateUrl: './student-operations-dashboard.component.html',
  styleUrls: ['./student-operations-dashboard.component.css'],
})
export class StudentOperationsDashboardComponent implements OnInit {
  private readonly api = inject(StudentOperationsService);

  workspace: StudentOperationsWorkspace | null = null;
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
          ? 'This account does not have Student Operations workspace access.'
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
