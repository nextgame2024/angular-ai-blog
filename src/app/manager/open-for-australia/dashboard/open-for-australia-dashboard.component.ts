import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
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
  error = '';

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    const count = (status?: string) => this.api.students({
      page: 1,
      limit: 1,
      status,
    });

    forkJoin({
      workspace: this.api.workspace(),
      all: count(),
      active: count('active'),
      actionRequired: count('action_required'),
      onHold: count('on_hold'),
    }).subscribe({
      next: ({ workspace, all, active, actionRequired, onHold }) => {
        this.workspace = workspace;
        this.totalStudents = all.total;
        this.activeStudents = active.total;
        this.actionRequired = actionRequired.total;
        this.onHold = onHold.total;
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        this.error = Number(error?.status) === 403
          ? 'This account does not have Open For Australia workspace access.'
          : 'The operations dashboard could not be loaded.';
      },
    });
  }

  formatRole(value: string): string {
    return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
}
