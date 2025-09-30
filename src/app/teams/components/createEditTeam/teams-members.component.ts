/**
 * TeamsMembersComponent
 * ----------------------
 * Purpose:
 * - Create or edit a team.
 * - Required "Team name" + assign employees using a PickList.
 * - Has two tabs: Details (active now) and Schedule (placeholder).
 * - Shows a page-level spinner while loading data.
 * - Shows a translucent white overlay while saving, to prevent extra clicks.
 *
 * Angular concepts highlighted:
 * - Standalone component with scoped imports.
 * - Route param reading: if :id exists → edit mode; else → create mode.
 * - Two async calls on init (employees + members/team name) with firstValueFrom.
 * - Simple inline validation with a "submitted" flag and disabled Save.
 */

import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

// PrimeNG UI modules used by this page
import { PickListModule } from 'primeng/picklist';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TabViewModule } from 'primeng/tabview';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

// Angular Forms
import { FormsModule } from '@angular/forms';

// RxJS helper for converting Observable to Promise-like
import { firstValueFrom } from 'rxjs';

// Services
import { TeamsService } from '../../services/teams.service';
import { EmployeesService } from '../../services/employees.service';

@Component({
  standalone: true,
  selector: 'mc-teams-members',
  templateUrl: './teams-members.component.html',
  imports: [
    CommonModule,
    RouterModule,
    PickListModule,
    ButtonModule,
    InputTextModule,
    TabViewModule,
    ProgressSpinnerModule,
    FormsModule,
  ],
})
export class TeamsMembersComponent implements OnInit {
  // If route param ":id" is present → edit mode; otherwise create mode.
  teamId = this.route.snapshot.paramMap.get('id');
  isEditMode = !!this.teamId;

  // Required field (we keep it as string for easy validation/binding).
  teamName: string = '';

  // PickList data sources:
  // - "available" on the left, "assigned" on the right
  available: any[] = [];
  assigned: any[] = [];

  // Fixed height with scroll for both lists to match the design
  listStyle = { height: '420px', overflow: 'auto' };

  // UX flags
  loading = true; // page-level load spinner
  saving = false; // saving overlay
  submitted = false; // toggles validation messages when Save is pressed

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private teams: TeamsService,
    private employees: EmployeesService
  ) {}

  /** Load employees and (if editing) current team name + members */
  async ngOnInit() {
    try {
      // 1) Load all employees for the left PickList
      const all = await firstValueFrom(this.employees.list());
      const allEmps = all?.employees ?? [];

      if (this.isEditMode) {
        // 2a) Load currently assigned members for this team
        const membersResp = await firstValueFrom(
          this.teams.getMembers(this.teamId!)
        );
        const members = membersResp?.members ?? [];

        // 2b) Load team name (we reuse list() to avoid a separate endpoint)
        const teamsListResp = await firstValueFrom(this.teams.list());
        const team = (teamsListResp?.teams ?? []).find(
          (t: any) => t.id === this.teamId
        );
        this.teamName = team?.name ?? '';

        // 3) Split employees into left (available) and right (assigned)
        const assignedIds = new Set(members.map((m: any) => m.id));
        this.assigned = members;
        this.available = allEmps.filter((e: any) => !assignedIds.has(e.id));
      } else {
        // Create mode → start with empty assigned list
        this.assigned = [];
        this.available = allEmps;
      }
    } catch (err) {
      console.error('Failed to initialize members editor:', err);
    } finally {
      // Hide the page spinner in all cases
      this.loading = false;
    }
  }

  /** PickList callbacks (no need to recalc arrays here; PrimeNG updates them) */
  onChange() {}

  /**
   * Save:
   * - Create: POST /teams → get id → PUT /teams/:id/members with the assigned IDs.
   * - Edit:   PUT /teams/:id (name) → PUT /teams/:id/members with the assigned IDs.
   */
  async save() {
    this.submitted = true;

    const name = (this.teamName || '').trim();
    if (!name) return; // Show validation message and stop

    this.saving = true; // Show overlay while saving
    try {
      if (this.isEditMode) {
        // Update team name
        await firstValueFrom(this.teams.update(this.teamId!, name));
        // Replace members
        const ids = this.assigned.map((e) => e.id);
        await firstValueFrom(this.teams.setMembers(this.teamId!, ids));
      } else {
        // Create team
        const created = await firstValueFrom(this.teams.create(name));
        const newId = created?.team?.id;
        if (!newId) throw new Error('No team id returned from API.');
        // Assign members
        const ids = this.assigned.map((e) => e.id);
        await firstValueFrom(this.teams.setMembers(newId, ids));
      }
      // Return to the list
      this.router.navigateByUrl('/teams/list');
    } catch (err) {
      console.error('Save failed:', err);
      // Optionally: show a toast with a user-friendly message
    } finally {
      this.saving = false;
    }
  }

  /** Cancel: just go back to the Teams list */
  cancel() {
    this.router.navigateByUrl('/teams/list');
  }
}
