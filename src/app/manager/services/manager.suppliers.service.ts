import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

import type {
  BmSupplier,
  BmSupplierContact,
  BmSupplierMaterial,
  ListSuppliersResponse,
  PagedResult,
} from '../types/suppliers.interface';

@Injectable()
export class ManagerSuppliersService {
  private readonly apiBase = environment.apiUrl;
  private readonly suppliersBase = `${this.apiBase}/bm/suppliers`;

  constructor(private http: HttpClient) {}

  listSuppliers(params: {
    page: number;
    limit: number;
    q?: string;
    status?: string;
  }): Observable<PagedResult<BmSupplier>> {
    let httpParams = new HttpParams()
      .set('page', String(params.page ?? 1))
      .set('limit', String(params.limit ?? 20));
    if (params.q) httpParams = httpParams.set('q', params.q);
    if (params.status) httpParams = httpParams.set('status', params.status);

    return this.http
      .get<ListSuppliersResponse>(this.suppliersBase, { params: httpParams })
      .pipe(
        map((res) => ({
          items: res?.suppliers ?? [],
          page: res?.page ?? params.page ?? 1,
          limit: res?.limit ?? params.limit ?? 20,
          total: res?.total ?? 0,
        })),
      );
  }

  getSupplier(supplierId: string): Observable<{ supplier: BmSupplier }> {
    return this.http.get<{ supplier: BmSupplier }>(
      `${this.suppliersBase}/${supplierId}`,
    );
  }

  createSupplier(payload: any): Observable<{ supplier: BmSupplier }> {
    return this.http.post<{ supplier: BmSupplier }>(this.suppliersBase, {
      supplier: payload,
    });
  }

  updateSupplier(
    supplierId: string,
    payload: any,
  ): Observable<{ supplier: BmSupplier }> {
    return this.http.put<{ supplier: BmSupplier }>(
      `${this.suppliersBase}/${supplierId}`,
      { supplier: payload },
    );
  }

  archiveSupplier(supplierId: string): Observable<void> {
    return this.http.delete<void>(`${this.suppliersBase}/${supplierId}`);
  }

  // Contacts
  listSupplierContacts(
    supplierId: string,
    params: { page: number; limit: number },
  ): Observable<{ contacts: BmSupplierContact[]; page: number; limit: number; total: number }> {
    let httpParams = new HttpParams()
      .set('page', String(params.page ?? 1))
      .set('limit', String(params.limit ?? 20));
    return this.http.get<{ contacts: BmSupplierContact[]; page: number; limit: number; total: number }>(
      `${this.suppliersBase}/${supplierId}/contacts`,
      { params: httpParams },
    );
  }

  createSupplierContact(
    supplierId: string,
    payload: any,
  ): Observable<{ contact: BmSupplierContact }>
  {
    return this.http.post<{ contact: BmSupplierContact }>(
      `${this.suppliersBase}/${supplierId}/contacts`,
      { contact: payload },
    );
  }

  updateSupplierContact(
    supplierId: string,
    contactId: string,
    payload: any,
  ): Observable<{ contact: BmSupplierContact }>
  {
    return this.http.put<{ contact: BmSupplierContact }>(
      `${this.suppliersBase}/${supplierId}/contacts/${contactId}`,
      { contact: payload },
    );
  }

  deleteSupplierContact(supplierId: string, contactId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.suppliersBase}/${supplierId}/contacts/${contactId}`,
    );
  }

  // Supplier materials
  listSupplierMaterials(
    supplierId: string,
    params: { page: number; limit: number },
  ): Observable<{ materials: BmSupplierMaterial[]; page: number; limit: number; total: number }> {
    let httpParams = new HttpParams()
      .set('page', String(params.page ?? 1))
      .set('limit', String(params.limit ?? 20));
    return this.http.get<{ materials: BmSupplierMaterial[]; page: number; limit: number; total: number }>(
      `${this.suppliersBase}/${supplierId}/materials`,
      { params: httpParams },
    );
  }

  addSupplierMaterial(
    supplierId: string,
    payload: any,
  ): Observable<{ supplierMaterial: BmSupplierMaterial }>
  {
    return this.http.post<{ supplierMaterial: BmSupplierMaterial }>(
      `${this.suppliersBase}/${supplierId}/materials`,
      { supplierMaterial: payload },
    );
  }

  updateSupplierMaterial(
    supplierId: string,
    materialId: string,
    payload: any,
  ): Observable<{ supplierMaterial: BmSupplierMaterial }>
  {
    return this.http.put<{ supplierMaterial: BmSupplierMaterial }>(
      `${this.suppliersBase}/${supplierId}/materials/${materialId}`,
      { supplierMaterial: payload },
    );
  }

  removeSupplierMaterial(supplierId: string, materialId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.suppliersBase}/${supplierId}/materials/${materialId}`,
    );
  }
}
