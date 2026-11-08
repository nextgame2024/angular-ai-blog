import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface BmCollege {
  collegeId: string;
  collegeName: string;
  acronym?: string | null;
  ownerName: string | null;
  abn: string | null;
  address: string | null;
  city: string | null;
  category: string | null;
  email: string | null;
  cel: string | null;
  tel: string | null;
  notes: string | null;
  status: 'active' | 'archived';
  cricosProviderCode?: string | null;
  tradingName?: string | null;
  institutionType?: string | null;
  institutionCapacity?: number | null;
  website?: string | null;
  postalAddress?: string | null;
  postalCity?: string | null;
  postalState?: string | null;
  postalPostcode?: string | null;
  cricosSyncedAt?: string | null;
}

export interface BmCollegeContact {
  contactId: string;
  collegeId: string;
  name: string;
  roleTitle: string | null;
  email: string | null;
  cel: string | null;
  tel: string | null;
  fax: string | null;
  source: 'manual' | 'cricos';
  contactType: string | null;
  sourceUrl: string | null;
  sourceCheckedAt: string | null;
  sourceActive: boolean;
}

export interface BmCollegeSite {
  siteId: string;
  collegeId: string;
  email: string | null;
  address: string | null;
  phone: string | null;
  mobile: string | null;
  city: string | null;
  category: string | null;
  locationName?: string | null;
  locationType?: string | null;
  state?: string | null;
  postcode?: string | null;
  isPrimary: boolean;
}

export interface BmCollegeCourse {
  courseId: string;
  collegeId: string;
  cricosCourseCode: string;
  courseName: string;
  vetNationalCode: string | null;
  dualQualification: boolean;
  field1Broad: string | null;
  field1Narrow: string | null;
  field1Detailed: string | null;
  field2Broad: string | null;
  field2Narrow: string | null;
  field2Detailed: string | null;
  courseLevel: string | null;
  foundationStudies: boolean;
  workComponent: boolean;
  workComponentHoursWeek: number | null;
  workComponentWeeks: number | null;
  workComponentTotalHours: number | null;
  courseLanguage: string | null;
  durationWeeks: number | null;
  tuitionFeeCents: number | null;
  nonTuitionFeeCents: number | null;
  estimatedTotalCostCents: number | null;
  expired: boolean;
  locationCount: number;
  locations: string[];
}

export type BmCollegeCourseSort = 'name' | 'code' | 'level' | 'duration' | 'cost' | 'status';

export type BmCollegeSort = 'name' | 'email' | 'mobile' | 'status';

export interface BmCollegeCommissionRule {
  ruleId: string;
  collegeId: string;
  classification: 'ELICOS' | 'VET' | 'HE' | null;
  location: 'ON-SHORE' | 'OFF-SHORE' | null;
  program: string | null;
  commissionBasisPoints: number;
  calculationMethod: 'tuition_fee_percentage';
  calculationDescription: string;
  roundingDecimalPlaces: number;
  cashbackStatus: 'not_recorded' | 'not_applicable' | 'specified';
  cashbackDescription: string | null;
  cashbackCalculationDescription: string | null;
  bonusStatus: 'not_recorded' | 'not_applicable' | 'specified';
  bonusDescription: string | null;
  applicationConditions: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class ManagerCollegesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/bm/colleges`;

  list(q = '', page = 1, limit = 25, sort: BmCollegeSort = 'name', direction: 'asc' | 'desc' = 'asc'): Observable<{ colleges: BmCollege[]; total: number; page: number; limit: number }> {
    let params = new HttpParams().set('page', page).set('limit', limit).set('sort', sort).set('direction', direction);
    if (q) params = params.set('q', q);
    return this.http.get<{ colleges: BmCollege[]; total: number; page: number; limit: number }>(this.base, { params });
  }

  create(value: object) { return this.http.post<{ college: BmCollege }>(this.base, { college: value }); }
  createFromOffer(value:object){return this.http.post<{college:BmCollege}>(`${this.base}/from-offer`,{college:value});}
  get(id: string) { return this.http.get<{ college: BmCollege }>(`${this.base}/${id}`); }
  update(id: string, value: object) { return this.http.put<{ college: BmCollege }>(`${this.base}/${id}`, { college: value }); }
  archive(id: string) { return this.http.delete<void>(`${this.base}/${id}`); }
  commissions(id: string) { return this.http.get<{ rules: BmCollegeCommissionRule[] }>(`${this.base}/${id}/commissions`); }
  createCommission(id: string, rule: object) { return this.http.post<{ rule: BmCollegeCommissionRule }>(`${this.base}/${id}/commissions`, { rule }); }
  updateCommission(id: string, ruleId: string, rule: object) { return this.http.put<{ rule: BmCollegeCommissionRule }>(`${this.base}/${id}/commissions/${ruleId}`, { rule }); }
  archiveCommission(id: string, rule: BmCollegeCommissionRule) {
    return this.http.delete<void>(`${this.base}/${id}/commissions/${rule.ruleId}`, { body: { rule: { expected_updated_at: rule.updatedAt } } });
  }
  contacts(id: string) { return this.http.get<{ contacts: BmCollegeContact[] }>(`${this.base}/${id}/contacts`); }
  createContact(id: string, value: object) { return this.http.post<{ contact: BmCollegeContact }>(`${this.base}/${id}/contacts`, { contact: value }); }
  updateContact(id: string, contactId: string, value: object) { return this.http.put<{ contact: BmCollegeContact }>(`${this.base}/${id}/contacts/${contactId}`, { contact: value }); }
  deleteContact(id: string, contactId: string) { return this.http.delete<void>(`${this.base}/${id}/contacts/${contactId}`); }
  sites(id: string) { return this.http.get<{ sites: BmCollegeSite[] }>(`${this.base}/${id}/sites`); }
  createSite(id: string, value: object) { return this.http.post<{ site: BmCollegeSite }>(`${this.base}/${id}/sites`, { site: value }); }
  updateSite(id: string, siteId: string, value: object) { return this.http.put<{ site: BmCollegeSite }>(`${this.base}/${id}/sites/${siteId}`, { site: value }); }
  deleteSite(id: string, siteId: string) { return this.http.delete<void>(`${this.base}/${id}/sites/${siteId}`); }
  courses(id: string, q = '', status: 'active' | 'expired' | 'all' = 'active', page = 1, limit = 25,
    sort: BmCollegeCourseSort = 'name', direction: 'asc' | 'desc' = 'asc') {
    let params = new HttpParams().set('status', status).set('page', page).set('limit', limit)
      .set('sort', sort).set('direction', direction);
    if (q) params = params.set('q', q);
    return this.http.get<{ courses: BmCollegeCourse[]; total: number; page: number; limit: number }>(`${this.base}/${id}/courses`, { params });
  }
}
