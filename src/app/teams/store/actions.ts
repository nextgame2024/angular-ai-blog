/**
 * Teams Actions (NgRx)
 * --------------------
 * WHAT IS THIS FILE?
 * Actions are simple, serializable objects that describe *what happened* in the app.
 * They do NOT contain business logic or API calls; they are just “messages.”
 *
 * WHY DO WE NEED ACTIONS?
 * - Components dispatch actions (e.g., “load teams”).
 * - Effects listen for actions to perform side effects (e.g., HTTP requests).
 * - Reducers respond to actions to update the store (immutable state updates).
 *
 * TRAINING TIP:
 * Think of Actions as *verbs* describing user intent or external events.
 */

import { createActionGroup, props, emptyProps } from '@ngrx/store';
import { TeamInterface } from '../types/team.interface';

export const teamsActions = createActionGroup({
  source: 'teams', // helpful for debugging (action types will be prefixed with [teams])
  events: {
    /**
     * Load the list of teams from the API.
     * Fired by TeamsListComponent on init.
     */
    Load: emptyProps(),

    /**
     * The API returned successfully with teams.
     * Fired by the load effect when HTTP succeeds.
     */
    'Load success': props<{ teams: TeamInterface[] }>(),

    /**
     * The API failed (network/401/500/etc.).
     * Fired by the load effect when HTTP fails.
     */
    'Load failure': props<{ error: string }>(),

    /**
     * Create a new team (name only).
     * Fired by Members page in CREATE mode.
     */
    Create: props<{ name: string }>(),
    'Create success': props<{ team: TeamInterface }>(),
    'Create failure': props<{ error: string }>(),

    /**
     * Update an existing team’s name.
     * Fired by Members page in EDIT mode before setting members.
     */
    Update: props<{ id: string; name: string }>(),
    'Update success': props<{ team: TeamInterface }>(),
    'Update failure': props<{ error: string }>(),

    /**
     * Delete a team.
     * Fired by TeamsListComponent after user confirms.
     */
    Delete: props<{ id: string }>(),
    'Delete success': props<{ id: string }>(),
    'Delete failure': props<{ error: string }>(),

    /**
     * Persist new order after drag & drop.
     * Fired by TeamsListComponent drop handler.
     */
    Reorder: props<{ ids: string[] }>(),
    'Reorder success': props<{ teams: TeamInterface[] }>(),
    'Reorder failure': props<{ error: string }>(),
  },
});
