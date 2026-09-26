import { Component, Input } from '@angular/core';

export interface AdminTableColumn {
  key: string;
  label: string;
}

@Component({
  selector: 'app-admin-table',
  standalone: true,
  template: `
    <div class="table-wrap">
      <table>
        <caption>{{ caption }}</caption>
        <thead><tr>@for (column of columns; track column.key) { <th scope="col">{{ column.label }}</th> }</tr></thead>
        <tbody>
          @for (row of rows; track row['id']) {
            <tr>@for (column of columns; track column.key) { <td>{{ row[column.key] }}</td> }</tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: [`
    .table-wrap { overflow-x:auto; border:1px solid #dbe3e8; border-radius:.9rem; background:#fff; }
    table { width:100%; border-collapse:collapse; min-width:650px; }
    caption { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0,0,0,0); }
    th,td { padding:.8rem 1rem; border-bottom:1px solid #e7ecef; text-align:left; }
    th { background:#f7f9fa; color:#5d6b76; font-size:.72rem; letter-spacing:.06em; text-transform:uppercase; }
    td { color:#2a3b48; font-size:.9rem; } tbody tr:last-child td { border-bottom:0; }
  `],
})
export class AdminTableComponent {
  @Input({ required: true }) caption = '';
  @Input({ required: true }) columns: readonly AdminTableColumn[] = [];
  @Input({ required: true }) rows: readonly Record<string, string>[] = [];
}
