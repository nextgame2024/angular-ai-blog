import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AdminStatePanelComponent } from '../shared/admin-state-panel.component';

@Component({
  selector: 'app-sophia-admin-forbidden',
  standalone: true,
  imports: [RouterLink, AdminStatePanelComponent],
  template: `
    <app-admin-state-panel kind="forbidden" title="Permission required" [message]="message" />
    <a class="return" routerLink="/sophia-admin/overview">Return to Admin overview</a>
  `,
  styles: [`.return { display:inline-block; margin-top:1rem; color:#08766b; font-weight:750; }`],
})
export class SophiaAdminForbiddenPage {
  private readonly route = inject(ActivatedRoute);
  readonly permission = this.route.snapshot.queryParamMap.get('permission');
  readonly message = this.permission
    ? `Your current organisation role does not grant ${this.permission}. The API also enforces this permission.`
    : 'Your current organisation role does not grant access to this workspace.';
}
