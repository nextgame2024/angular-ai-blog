import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  HostBinding,
  Input,
  ViewChild,
  forwardRef,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-manager-rich-text-editor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './manager-rich-text-editor.component.html',
  styleUrls: ['./manager-rich-text-editor.component.css'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ManagerRichTextEditorComponent),
      multi: true,
    },
  ],
})
export class ManagerRichTextEditorComponent implements ControlValueAccessor {
  @Input() placeholder = 'Type here...';
  @Input() minHeight = 180;

  @ViewChild('editor', { static: true })
  editorRef!: ElementRef<HTMLDivElement>;

  @HostBinding('class.is-disabled') disabled = false;

  value = '';
  isEmpty = true;
  selectedFontSize = '3';
  fontSizes = [
    { value: '1', label: '10' },
    { value: '2', label: '12' },
    { value: '3', label: '14' },
    { value: '4', label: '16' },
    { value: '5', label: '18' },
    { value: '6', label: '24' },
    { value: '7', label: '32' },
  ];

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: string | null): void {
    const incoming = String(value ?? '');
    const normalized = this.normalizeIncomingValue(incoming);
    this.value = normalized;
    this.isEmpty = this.isHtmlEffectivelyEmpty(normalized);
    if (this.editorRef?.nativeElement) {
      this.editorRef.nativeElement.innerHTML = normalized;
    }
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  onInput(): void {
    if (this.disabled) return;
    const raw = this.editorRef.nativeElement.innerHTML;
    const sanitized = this.sanitizeHtml(raw);
    if (sanitized !== raw) {
      this.editorRef.nativeElement.innerHTML = sanitized;
      this.moveCaretToEnd();
    }
    this.value = sanitized;
    this.isEmpty = this.isHtmlEffectivelyEmpty(sanitized);
    this.onChange(sanitized);
  }

  onBlur(): void {
    this.onTouched();
  }

  applyCommand(
    command:
      | 'bold'
      | 'italic'
      | 'underline'
      | 'insertUnorderedList'
      | 'insertOrderedList'
      | 'indent'
      | 'outdent',
  ): void {
    if (this.disabled) return;
    this.focusEditor();
    document.execCommand(command, false);
    this.onInput();
  }

  applyAlignment(
    command: 'justifyLeft' | 'justifyCenter' | 'justifyRight' | 'justifyFull',
  ): void {
    if (this.disabled) return;
    this.focusEditor();
    document.execCommand(command, false);
    this.onInput();
  }

  onFontSizeChange(event: Event): void {
    const target = event.target as HTMLSelectElement | null;
    const value = target?.value || '3';
    this.selectedFontSize = value;
    this.applyFontSize(value);
  }

  private applyFontSize(size: string): void {
    if (this.disabled) return;
    this.focusEditor();
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand('fontSize', false, size);
    this.onInput();
  }

  clearFormatting(): void {
    if (this.disabled) return;
    this.focusEditor();
    document.execCommand('removeFormat', false);
    document.execCommand('unlink', false);
    this.onInput();
  }

  insertLink(): void {
    if (this.disabled) return;
    this.focusEditor();
    const input = window.prompt('Enter URL', 'https://');
    if (!input) return;
    const href = this.normalizeHref(input);
    if (!href) return;
    document.execCommand('createLink', false, href);
    this.onInput();
  }

  private focusEditor(): void {
    this.editorRef.nativeElement.focus();
  }

  private normalizeHref(value: string): string | null {
    const href = value.trim();
    if (!href) return null;
    if (/^(https?:|mailto:|tel:)/i.test(href)) return href;
    return `https://${href}`;
  }

  private normalizeIncomingValue(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return '';
    const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(trimmed);
    if (!looksLikeHtml) {
      return this.formatPlainTextAsHtml(trimmed);
    }
    return this.sanitizeHtml(trimmed);
  }

  private formatPlainTextAsHtml(value: string): string {
    return this.escapeHtml(value)
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n/g, '<br>');
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private sanitizeHtml(value: string): string {
    const template = document.createElement('template');
    template.innerHTML = value;

    const blockedTags = new Set([
      'script',
      'style',
      'iframe',
      'object',
      'embed',
      'link',
      'meta',
    ]);

    const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT);
    const toRemove: Element[] = [];

    while (walker.nextNode()) {
      const node = walker.currentNode as Element;
      if (blockedTags.has(node.tagName.toLowerCase())) {
        toRemove.push(node);
        continue;
      }

      Array.from(node.attributes).forEach((attr) => {
        const attrName = attr.name.toLowerCase();
        const attrValue = attr.value;

        if (attrName.startsWith('on')) {
          node.removeAttribute(attr.name);
          return;
        }

        if ((attrName === 'href' || attrName === 'src') && /^\s*javascript:/i.test(attrValue)) {
          node.removeAttribute(attr.name);
          return;
        }

        if (attrName === 'style') {
          const safeStyle = this.sanitizeStyleAttribute(attrValue);
          if (safeStyle) node.setAttribute('style', safeStyle);
          else node.removeAttribute(attr.name);
          return;
        }

        if (attrName === 'align') {
          const safeAlign = this.sanitizeAlignAttribute(attrValue);
          if (safeAlign) node.setAttribute('align', safeAlign);
          else node.removeAttribute(attr.name);
          return;
        }

        if (node.tagName.toLowerCase() === 'font' && attrName === 'size') {
          if (/^[1-7]$/.test(attrValue.trim())) {
            node.setAttribute('size', attrValue.trim());
          } else {
            node.removeAttribute(attr.name);
          }
          return;
        }

        if (attrName !== 'href' && attrName !== 'target' && attrName !== 'rel') {
          node.removeAttribute(attr.name);
        }
      });

      if (node.tagName.toLowerCase() === 'a') {
        const href = node.getAttribute('href') || '';
        if (!href.trim()) {
          node.replaceWith(...Array.from(node.childNodes));
        } else {
          node.setAttribute('target', '_blank');
          node.setAttribute('rel', 'noopener noreferrer');
        }
      }
    }

    toRemove.forEach((node) => node.remove());
    return template.innerHTML;
  }

  private isHtmlEffectivelyEmpty(html: string): boolean {
    if (!html) return true;
    const text = html
      .replace(/<br\s*\/?\s*>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .trim();
    return text.length === 0;
  }

  private moveCaretToEnd(): void {
    const editor = this.editorRef.nativeElement;
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  private sanitizeAlignAttribute(value: string): string | null {
    const candidate = value.trim().toLowerCase();
    if (['left', 'center', 'right', 'justify'].includes(candidate)) {
      return candidate;
    }
    return null;
  }

  private sanitizeStyleAttribute(value: string): string | null {
    if (!value) return null;
    const safe: string[] = [];
    const declarations = value
      .split(';')
      .map((item) => item.trim())
      .filter(Boolean);

    for (const declaration of declarations) {
      const separatorIndex = declaration.indexOf(':');
      if (separatorIndex === -1) continue;

      const rawProp = declaration.slice(0, separatorIndex).trim().toLowerCase();
      const rawValue = declaration.slice(separatorIndex + 1).trim();
      if (!rawProp || !rawValue) continue;

      if (rawProp === 'text-align') {
        const aligned = this.sanitizeAlignAttribute(rawValue);
        if (aligned) safe.push(`text-align:${aligned}`);
        continue;
      }

      if (rawProp === 'margin-left' || rawProp === 'padding-left') {
        if (/^\d+(\.\d+)?(px|em|rem|%)$/i.test(rawValue)) {
          safe.push(`${rawProp}:${rawValue}`);
        }
        continue;
      }

      if (rawProp === 'font-size') {
        if (
          /^(\d+(\.\d+)?(px|em|rem|%)|(xx-small|x-small|small|medium|large|x-large|xx-large|xxx-large|smaller|larger))$/i.test(
            rawValue,
          )
        ) {
          safe.push(`font-size:${rawValue}`);
        }
        continue;
      }
    }

    return safe.length ? safe.join(';') : null;
  }
}
