import { HttpErrorResponse } from '@angular/common/http';

export function adminErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    const message = error.error?.message;
    const text = Array.isArray(message) ? message.join(' ') : message;
    if (typeof text === 'string' && text.trim()) return text;
    if (error.status === 409) return 'This record changed. Reload it before trying again.';
    if (error.status === 403) return 'Your current membership cannot perform this operation.';
  }
  const candidate = error as { message?: unknown };
  return typeof candidate?.message === 'string' && candidate.message.trim()
    ? candidate.message
    : fallback;
}

export function hasRecentMfa(value?: string): boolean {
  if (!value) return false;
  const verifiedAt = Date.parse(value);
  return Number.isFinite(verifiedAt) && verifiedAt >= Date.now() - 12 * 60 * 60 * 1_000;
}

export function humanizeKey(value: string): string {
  return value.split(/[._]/).map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : '').join(' ');
}
