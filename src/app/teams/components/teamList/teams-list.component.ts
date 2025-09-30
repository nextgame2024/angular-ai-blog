/**
 * TeamsListComponent
 * -------------------
 * Purpose:
 * - Displays all teams.
 * - Allows drag & drop reordering (persisted to the API).
 * - Provides actions: Edit (go to members editor) and Delete (with confirm).
 *
 * Angular concepts highlighted:
 * - Standalone component: imports are scoped here (no NgModule needed).
 * - NgRx Store selection: subscribe to state via selectors.
 * - Angular CDK Drag & Drop: cdkDropList / cdkDrag / cdkDragHandle.
 * - RouterLink: navigate to the edit screen.
 * - PrimeNG ConfirmDialog: confirm before delete.
 */

import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Store } from '@ngrx/store';
import { Subscription } from 'rxjs';

// PrimeNG (buttons + confirm dialog UI only)
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';

// Angular CDK Drag & Drop (stable with Angular 15)
import {
  DragDropModule,
  CdkDragDrop,
  moveItemInArray,
} from '@angular/cdk/drag-drop';

// NgRx slices & actions (Teams feature)
import { teamsActions } from '../../store/actions';
import { selectIsLoading, selectTeams } from '../../store/reducers';

@Component({
  standalone: true,
  selector: 'mc-teams-list',
  templateUrl: './teams-list.component.html',
  imports: [
    CommonModule,
    RouterModule, // Needed so [routerLink] works
    ButtonModule,
    ConfirmDialogModule,
    DragDropModule, // Angular CDK DnD
  ],
  providers: [ConfirmationService, MessageService],
})
export class TeamsListComponent implements OnInit, OnDestroy {
  /** Observable for spinner on the list */
  isLoading$ = this.store.select(selectIsLoading);

  /**
   * Local copy of teams used by CDK to reorder visually.
   * Why local array?
   * - CDK expects a mutable array so it can reorder immediately in the UI.
   * - After each drop, we send the new order (ids) to the API via NgRx action.
   */
  teams: any[] = [];
  private sub?: Subscription;

  constructor(private store: Store, private confirm: ConfirmationService) {}

  ngOnInit(): void {
    // 1) Ask the store/effects to load teams from API.
    this.store.dispatch(teamsActions.load());

    // 2) Keep the UI array in sync with store state.
    this.sub = this.store.select(selectTeams).subscribe((arr) => {
      this.teams = Array.isArray(arr) ? [...arr] : [];
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  /** Show confirm before deleting */
  confirmDelete(team: any) {
    this.confirm.confirm({
      message: `Are you sure you want to delete this team "${team.name}"?`,
      header: 'Confirm',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'OK',
      rejectLabel: 'Cancel',
      accept: () => this.store.dispatch(teamsActions.delete({ id: team.id })),
    });
  }

  /**
   * CDK drop handler:
   * - Reorders the local array immediately (moveItemInArray).
   * - Dispatches the new order as an array of IDs to persist in DB.
   */
  drop(ev: CdkDragDrop<any[]>) {
    if (ev.previousIndex === ev.currentIndex) return;
    moveItemInArray(this.teams, ev.previousIndex, ev.currentIndex);
    const ids = this.teams.map((t) => t.id);
    this.store.dispatch(teamsActions.reorder({ ids }));
  }
}
