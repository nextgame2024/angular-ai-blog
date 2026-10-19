
import {
  AfterViewChecked,
  Component,
  ElementRef,
  HostBinding,
  HostListener,
  Input,
  ViewChild,
  forwardRef,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface ManagerSelectOption {
  value: string;
  label: string;
}

@Component({
    selector: 'app-manager-select',
    imports: [],
    templateUrl: './manager-select.component.html',
    styleUrls: ['./manager-select.component.css'],
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => ManagerSelectComponent),
            multi: true,
        },
    ]
})
export class ManagerSelectComponent implements ControlValueAccessor, AfterViewChecked {
  @Input() options: ManagerSelectOption[] = [];
  @Input() placeholder = 'Select';
  @Input() disabled = false;
  @Input() searchable = false;
  @Input() ariaLabel = '';
  @Input() panelDirection: 'down' | 'up' = 'down';
  menuStyles: Record<string, string> = {};
  @ViewChild('menu') private menu?: ElementRef<HTMLElement>;
  private positionAfterRender = false;

  @HostBinding('class.is-disabled') get isDisabled(): boolean {
    return this.disabled;
  }

  open = false;
  value: string | null = null;
  searchTerm = '';

  get filteredOptions(): ManagerSelectOption[] {
    const query = this.searchTerm.trim().toLocaleLowerCase();
    return query ? this.options.filter(option => option.label.toLocaleLowerCase().includes(query)) : this.options;
  }

  private onChange: (value: string | null) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private hostRef: ElementRef<HTMLElement>) {}

  get selectedLabel(): string {
    if (this.value === null) return '';
    return this.options.find((opt) => opt.value === this.value)?.label ?? '';
  }

  toggle(event?: MouseEvent): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.disabled) return;
    this.open = !this.open;
    if (this.open) {
      this.positionAfterRender = this.panelDirection === 'up';
      this.searchTerm = '';
      const rect = this.hostRef.nativeElement.getBoundingClientRect();
      this.menuStyles = this.panelDirection === 'up' ? {
        position: 'fixed', top: 'auto', bottom: `${window.innerHeight - rect.top + 6}px`,
        left: `${rect.left}px`, right: 'auto', width: `${rect.width}px`,
        maxHeight: `${Math.max(0, Math.min(220, rect.top - 12))}px`, zIndex: '1100',
      } : {};
    }
    if (!this.open) this.onTouched();
  }

  ngAfterViewChecked(): void {
    if (!this.positionAfterRender || !this.open || !this.menu) return;
    this.positionAfterRender = false;
    const menu = this.menu.nativeElement;
    const trigger = this.hostRef.nativeElement.querySelector('.select-trigger')!.getBoundingClientRect();
    // A transformed/filtered/scaled manager shell can become the containing
    // block for fixed elements. Correct against rendered geometry so the menu
    // stays 6px above its trigger in that shell as well as in the viewport.
    let bounds = menu.getBoundingClientRect();
    const scaleX = menu.offsetWidth ? bounds.width / menu.offsetWidth : 1;
    const scaleY = menu.offsetHeight ? bounds.height / menu.offsetHeight : 1;
    menu.style.width = `${trigger.width / (scaleX || 1)}px`;
    bounds = menu.getBoundingClientRect();
    menu.style.left = `${parseFloat(menu.style.left) + (trigger.left - bounds.left) / (scaleX || 1)}px`;
    menu.style.bottom = `${parseFloat(menu.style.bottom) + (bounds.bottom - trigger.top + 6) / (scaleY || 1)}px`;
  }

  selectOption(option: ManagerSelectOption, event?: MouseEvent): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.disabled) return;
    this.value = option.value;
    this.onChange(option.value);
    this.open = false;
    this.searchTerm = '';
    this.onTouched();
  }

  writeValue(value: string | null): void {
    this.value = value ?? null;
  }

  registerOnChange(fn: (value: string | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (this.hostRef.nativeElement.contains(target)) return;
    if (this.open) {
      this.open = false;
      this.onTouched();
    }
  }

  @HostListener('window:resize')
  @HostListener('window:scroll')
  @HostListener('keydown.escape')
  closeMenu(): void { if (this.open) { this.open = false; this.onTouched(); } }
}
