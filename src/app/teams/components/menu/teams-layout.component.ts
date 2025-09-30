/**
 * TeamsLayoutComponent
 * ---------------------
 * Purpose:
 * - Provides the left-side panel menu and the right-side router-outlet
 *   where child pages render (List, Members).
 *
 * Angular concepts highlighted:
 * - Feature layout: acts as a shell for nested child routes.
 * - PrimeNG PanelMenu: simple left navigation menu.
 */

import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PanelMenuModule } from 'primeng/panelmenu';
import { MenuItem } from 'primeng/api';
import { CommonModule } from '@angular/common';

@Component({
  standalone: true,
  selector: 'mc-teams-layout',
  templateUrl: './teams-layout.component.html',
  imports: [CommonModule, RouterOutlet, PanelMenuModule],
})
export class TeamsLayoutComponent {
  items: MenuItem[] = [
    { label: 'Teams', routerLink: 'list', icon: 'pi pi-users' },
    { label: 'Item 1', routerLink: 'list1', icon: 'pi pi-users' },
    { label: 'Item 2', routerLink: 'list2', icon: 'pi pi-users' },
    { label: 'Item 3', routerLink: 'list3', icon: 'pi pi-users' },
    { label: 'Item 4', routerLink: 'list4', icon: 'pi pi-users' },
    { label: 'Item 5', routerLink: 'list5', icon: 'pi pi-users' },
    { label: 'Item 6', routerLink: 'list6', icon: 'pi pi-users' },
    { label: 'Item 7', routerLink: 'list7', icon: 'pi pi-users' },
    { label: 'Item 8', routerLink: 'list8', icon: 'pi pi-users' },
    { label: 'Item 9', routerLink: 'list9', icon: 'pi pi-users' },
    { label: 'Item 10', routerLink: 'list10', icon: 'pi pi-users' },
    { label: 'Item 11', routerLink: 'list11', icon: 'pi pi-users' },
  ];
}
