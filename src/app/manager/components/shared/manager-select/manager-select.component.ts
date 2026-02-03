import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  HostBinding,
  HostListener,
  Input,
  forwardRef,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface ManagerSelectOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-manager-select',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './manager-select.component.html',
  styleUrls: ['./manager-select.component.css'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ManagerSelectComponent),
      multi: true,
    },
  ],
})
export class ManagerSelectComponent implements ControlValueAccessor {
  @Input() options: ManagerSelectOption[] = [];
  @Input() placeholder = 'Select';
  @Input() disabled = false;

  @HostBinding('class.is-disabled') get isDisabled(): boolean {
    return this.disabled;
  }

  open = false;
  value: string | null = null;

  private onChange: (value: string | null) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private hostRef: ElementRef<HTMLElement>) {}

  get selectedLabel(): string {
    if (!this.value) return '';
    return this.options.find((opt) => opt.value === this.value)?.label ?? '';
  }

  toggle(event?: MouseEvent): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.disabled) return;
    this.open = !this.open;
    if (!this.open) this.onTouched();
  }

  selectOption(option: ManagerSelectOption, event?: MouseEvent): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.disabled) return;
    this.value = option.value;
    this.onChange(option.value);
    this.open = false;
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
}
