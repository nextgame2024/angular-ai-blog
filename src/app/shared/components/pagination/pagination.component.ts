
import { Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';

/* PrimeNG */
import { PaginatorModule, type PaginatorState } from 'primeng/paginator';
import { InputNumberModule } from 'primeng/inputnumber';
import { ButtonModule } from 'primeng/button';

/* Forms for the "Go to" mini input */
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'mc-pagination',
    templateUrl: './pagination.component.html',
    imports: [
    PaginatorModule,
    InputNumberModule,
    ButtonModule,
    FormsModule
]
})
export class PaginationComponent {
  readonly total$$ = input(0, { alias: 'total' }); // total records
  readonly limit$$ = input(9, { alias: 'limit' }); // rows per page
  readonly currentPage$$ = input(1, { alias: 'currentPage' }); // 1-based
  readonly url$$ = input('', { alias: 'url' }); // base route (e.g., '/articles')

  /** Derived state */
  readonly pagesCount$$ = computed(() =>
    Math.max(1, Math.ceil((this.total$$() || 0) / (this.limit$$() || 1)))
  );
  readonly first$$ = computed(
    () => (Math.max(1, this.currentPage$$()) - 1) * this.limit$$()
  );
  readonly pageLinkSize$$ = signal(5); // fewer links (tidier on md screens)

  /** "Go to page" helper */
  readonly gotoPage$$ = signal<number | null>(null);

  private readonly router = inject(Router);

  onPageChange(e: PaginatorState | null | undefined) {
    const page = (e?.page ?? 0) + 1; // paginator gives 0-based
    this.navigateToPage(page);
  }

  onGoto() {
    const gotoPage = this.gotoPage$$();
    if (gotoPage == null) return;
    const page = Math.min(
      Math.max(1, Math.trunc(gotoPage)),
      this.pagesCount$$()
    );
    this.navigateToPage(page);
  }

  prevPage() {
    if (this.currentPage$$() > 1)
      this.navigateToPage(this.currentPage$$() - 1);
  }

  nextPage() {
    if (this.currentPage$$() < this.pagesCount$$())
      this.navigateToPage(this.currentPage$$() + 1);
  }

  navigateToPage(page: number) {
    this.router.navigate([this.url$$()], {
      queryParams: { page },
      queryParamsHandling: 'merge',
    });
  }

  onGotoPageChange(value: number | null): void {
    this.gotoPage$$.set(value);
  }
}
