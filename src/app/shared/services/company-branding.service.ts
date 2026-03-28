import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

type CompanyBranding = { companyId: string; logoUrl: string } | null;

@Injectable({
  providedIn: 'root',
})
export class CompanyBrandingService {
  private readonly branding$ = new BehaviorSubject<CompanyBranding>(null);
  readonly companyBranding$ = this.branding$.asObservable();

  setCompanyLogo(companyId: string, logoUrl: string | null | undefined): void {
    if (!companyId) return;
    if (!logoUrl) {
      this.branding$.next(null);
      return;
    }
    this.branding$.next({ companyId, logoUrl });
  }
}
