import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class UtilsService {
  range(start: number, end: number): number[] {
    const s = Math.floor(Number.isFinite(start) ? start : 0);
    const e = Math.floor(Number.isFinite(end) ? end : s - 1);
    if (e < s) return [];
    const len = e - s + 1;
    return Array.from({ length: len }, (_, i) => s + i);
  }
}
