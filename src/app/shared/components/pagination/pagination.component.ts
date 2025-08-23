import { CommonModule } from '@angular/common';
import { UtilsService } from '../../services/utils.service';
import {
  Component,
  Input,
  OnInit,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'mc-pagination',
  templateUrl: './pagination.component.html',
  standalone: true,
  imports: [CommonModule, RouterLink],
})
export class PaginationComponent implements OnInit, OnChanges {
  @Input() total: number = 0;
  @Input() limit: number = 10;
  @Input() currentPage: number = 1;
  @Input() url: string = '';

  pagesCount: number = 1;
  pages: number[] = [];

  constructor(private utilsService: UtilsService) {}

  ngOnInit(): void {
    this.recalculate();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['total'] || changes['limit'] || changes['currentPage']) {
      this.recalculate();
    }
  }

  private recalculate(): void {
    this.pagesCount = Math.ceil((this.total || 0) / (this.limit || 1));
    this.pages =
      this.pagesCount > 0 ? this.utilsService.range(1, this.pagesCount) : [];
    console.log({
      total: this.total,
      limit: this.limit,
      currentPage: this.currentPage,
      pagesCount: this.pagesCount,
      pages: this.pages,
    });
  }
}
