import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-admin-pagination',
  standalone: true,
  template: `
    @if (totalItems > pageSize) {
      <nav class="pagination" aria-label="Module directory pages">
        <button type="button" (click)="change(page - 1)" [disabled]="page <= 1">Previous</button>
        <span>Page {{ page }} of {{ pageCount }}</span>
        <button type="button" (click)="change(page + 1)" [disabled]="page >= pageCount">Next</button>
      </nav>
    }
  `,
  styles: [`
    .pagination { display:flex; align-items:center; justify-content:flex-end; gap:.75rem; margin-top:1rem; }
    button { border:1px solid #cbd7df; border-radius:.65rem; background:#fff; color:#263746; padding:.55rem .8rem; font:inherit; cursor:pointer; }
    button:disabled { opacity:.45; cursor:not-allowed; }
    span { color:#65727d; font-size:.9rem; }
  `],
})
export class AdminPaginationComponent {
  @Input() page = 1;
  @Input() pageSize = 8;
  @Input() totalItems = 0;
  @Output() readonly pageChange = new EventEmitter<number>();

  get pageCount(): number {
    return Math.max(1, Math.ceil(this.totalItems / this.pageSize));
  }

  change(page: number): void {
    if (page < 1 || page > this.pageCount || page === this.page) return;
    this.pageChange.emit(page);
  }
}
