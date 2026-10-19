import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';

@Component({
  selector: 'app-page-jump',
  template: `
    <span>Page</span>
    <input type="number" inputmode="numeric" min="1" [max]="totalPages"
      [value]="draft" [disabled]="disabled" [attr.aria-label]="label"
      [attr.aria-invalid]="invalid || null" (input)="draft = $any($event.target).value; invalid = false"
      (keydown.enter)="$event.preventDefault(); go()" />
    @if (totalPages !== null) { <span>of {{ totalPages }}</span> }
    <button type="button" [disabled]="disabled" (click)="go()" [attr.aria-label]="'Go to page: ' + label">Go</button>
  `,
  styles: [`
    :host { display:inline-flex; align-items:center; gap:.35rem; white-space:nowrap; color:inherit; font:inherit; font-size:.78rem }
    input { box-sizing:border-box; width:3.8rem; min-height:2.1rem; border:1px solid #cbd7e8; border-radius:.4rem; background:#fff; color:#172033; padding:.3rem; text-align:center; font:inherit }
    button { min-height:2.1rem; border:1px solid #cbd7e8; border-radius:.4rem; background:#fff; color:#315ca4; padding:.3rem .55rem; font:inherit; cursor:pointer }
    input:focus-visible,button:focus-visible { outline:2px solid #0eac9e; outline-offset:2px }
    input[aria-invalid=true] { border-color:#dc2626 }
    :disabled { opacity:.5; cursor:not-allowed }
    :host-context(html.dark) input,:host-context(html.dark) button { background:#263449; color:#e2e8f0; border-color:#4a6180 }
    @media (pointer:coarse) { input,button { min-height:2.75rem } }
  `],
})
export class PageJumpComponent implements OnChanges {
  @Input() page = 1;
  @Input() totalPages: number | null = 1;
  @Input() disabled = false;
  @Input() label = 'Page number';
  @Output() readonly pageChange = new EventEmitter<number>();
  draft = '1';
  invalid = false;
  ngOnChanges(): void { this.draft = String(this.page); this.invalid = false; }
  go(): void {
    if (this.disabled) return;
    const value = Number(this.draft);
    if (!this.draft.trim() || !Number.isSafeInteger(value) || value < 1) { this.invalid = true; return; }
    const target = this.totalPages === null ? value : Math.min(value, Math.max(1, this.totalPages));
    this.draft = String(target);
    this.invalid = false;
    if (target !== this.page) this.pageChange.emit(target);
  }
}
