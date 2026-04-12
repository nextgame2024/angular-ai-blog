
import {
  Component,
  ElementRef,
  HostBinding,
  HostListener,
  Input,
  ViewChild,
  forwardRef,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
    selector: 'app-manager-rich-text-editor',
    imports: [],
    templateUrl: './manager-rich-text-editor.component.html',
    styleUrls: ['./manager-rich-text-editor.component.css'],
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => ManagerRichTextEditorComponent),
            multi: true,
        },
    ]
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
  private savedSelection: Range | null = null;

  writeValue(value: string | null): void {
    const incoming = String(value ?? '');
    const normalized = this.normalizeIncomingValue(incoming);
    this.value = normalized;
    this.isEmpty = this.isHtmlEffectivelyEmpty(normalized);
    this.savedSelection = null;
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
    this.captureSelection();
  }

  onBlur(): void {
    this.onTouched();
  }

  @HostListener('document:selectionchange')
  onDocumentSelectionChange(): void {
    this.captureSelection();
  }

  onToolbarButtonMouseDown(event: MouseEvent): void {
    if (this.disabled) {
      return;
    }

    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.closest('button.tool')) {
      return;
    }

    event.preventDefault();
    this.restoreSelection();
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
    this.restoreSelection();
    document.execCommand('styleWithCSS', false, 'false');
    document.execCommand(command, false);
    this.onInput();
  }

  applyAlignment(
    command: 'justifyLeft' | 'justifyCenter' | 'justifyRight' | 'justifyFull',
  ): void {
    if (this.disabled) return;
    this.restoreSelection();
    document.execCommand('styleWithCSS', false, 'false');
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
    this.restoreSelection();
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand('fontSize', false, size);
    document.execCommand('styleWithCSS', false, 'false');
    this.onInput();
  }

  clearFormatting(): void {
    if (this.disabled) return;
    this.restoreSelection();
    document.execCommand('removeFormat', false);
    document.execCommand('unlink', false);
    this.onInput();
  }

  insertLink(): void {
    if (this.disabled) return;
    const preservedSelection = this.cloneSavedSelection();
    const input = window.prompt('Enter URL', 'https://');
    if (!input) return;
    const href = this.normalizeHref(input);
    if (!href) return;
    this.savedSelection = preservedSelection;
    this.restoreSelection();
    document.execCommand('createLink', false, href);
    this.onInput();
  }

  private focusEditor(): void {
    this.editorRef.nativeElement.focus();
  }

  private captureSelection(): void {
    if (!this.editorRef?.nativeElement) {
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }

    const range = selection.getRangeAt(0);
    if (!this.isRangeInsideEditor(range)) {
      return;
    }

    this.savedSelection = range.cloneRange();
  }

  private restoreSelection(): void {
    this.focusEditor();

    const selection = window.getSelection();
    if (!selection) {
      return;
    }

    selection.removeAllRanges();

    const range = this.cloneSavedSelection();
    if (range && this.isRangeInsideEditor(range)) {
      try {
        selection.addRange(range);
        return;
      } catch {
        this.savedSelection = null;
      }
    }

    const fallbackRange = document.createRange();
    fallbackRange.selectNodeContents(this.editorRef.nativeElement);
    fallbackRange.collapse(false);
    selection.addRange(fallbackRange);
    this.savedSelection = fallbackRange.cloneRange();
  }

  private cloneSavedSelection(): Range | null {
    return this.savedSelection ? this.savedSelection.cloneRange() : null;
  }

  private isRangeInsideEditor(range: Range): boolean {
    const editor = this.editorRef.nativeElement;
    return editor.contains(range.commonAncestorContainer);
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
    this.savedSelection = range.cloneRange();
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

      if (rawProp === 'font-weight') {
        if (/^(normal|bold|bolder|lighter|[1-9]00)$/i.test(rawValue)) {
          safe.push(`font-weight:${rawValue}`);
        }
        continue;
      }

      if (rawProp === 'font-style') {
        if (/^(normal|italic|oblique)$/i.test(rawValue)) {
          safe.push(`font-style:${rawValue}`);
        }
        continue;
      }

      if (rawProp === 'text-decoration' || rawProp === 'text-decoration-line') {
        if (/^(none|underline|line-through|underline line-through|line-through underline)$/i.test(rawValue)) {
          safe.push(`${rawProp}:${rawValue}`);
        }
        continue;
      }
    }

    return safe.length ? safe.join(';') : null;
  }
}
