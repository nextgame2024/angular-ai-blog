import { CommonModule } from '@angular/common';
import {
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import { Router } from '@angular/router';

/* PrimeNG */
import { PaginatorModule } from 'primeng/paginator';
import { InputNumberModule } from 'primeng/inputnumber';
import { ButtonModule } from 'primeng/button';

/* Forms for the "Go to" mini input */
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'mc-pagination',
  templateUrl: './pagination.component.html',
  standalone: true,
  imports: [
    CommonModule,
    PaginatorModule,
    InputNumberModule,
    ButtonModule,
    FormsModule,
  ],
})
export class PaginationComponent implements OnInit, OnChanges {
  @Input() total = 0; // total records
  @Input() limit = 9; // rows per page
  @Input() currentPage = 1; // 1-based
  @Input() url = ''; // base route (e.g., '/articles')

  /** Derived state */
  pagesCount = 1; // total pages
  first = 0; // 0-based index of first record for p-paginator
  pageLinkSize = 5; // fewer links (tidier on md screens)

  /** "Go to page" helper */
  gotoPage?: number;

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.recalc();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['total'] || changes['limit'] || changes['currentPage']) {
      this.recalc();
    }
  }

  private recalc(): void {
    this.pagesCount = Math.max(
      1,
      Math.ceil((this.total || 0) / (this.limit || 1))
    );
    this.first = (Math.max(1, this.currentPage) - 1) * this.limit; // 0-based for paginator
  }

  onPageChange(e: {
    first: number;
    rows: number;
    page: number;
    pageCount: number;
  }) {
    const page = (e?.page ?? 0) + 1; // paginator gives 0-based
    this.navigateToPage(page);
  }

  onGoto() {
    if (!this.gotoPage) return;
    const page = Math.min(
      Math.max(1, Math.trunc(this.gotoPage)),
      this.pagesCount
    );
    this.navigateToPage(page);
  }

  prevPage() {
    if (this.currentPage > 1) this.navigateToPage(this.currentPage - 1);
  }

  nextPage() {
    if (this.currentPage < this.pagesCount)
      this.navigateToPage(this.currentPage + 1);
  }

  navigateToPage(page: number) {
    this.router.navigate([this.url], {
      queryParams: { page },
      queryParamsHandling: 'merge',
    });
  }
}
