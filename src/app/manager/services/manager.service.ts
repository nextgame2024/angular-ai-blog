import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { map } from 'rxjs/operators';

export type ClientStatus = 'active' | 'archived' | string;

export interface PagedResult<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

export interface BmClient {
  clientId: string;
  userId?: string;

  clientName: string;
  address?: string | null;
  email?: string | null;
  cel?: string | null;
  tel?: string | null;
  notes?: string | null;

  status?: ClientStatus;
  createdAt?: string;
  updatedAt?: string | null;
}

export interface ListClientsResponse {
  clients: BmClient[];
  page: number;
  limit: number;
  total: number;
}

export interface BmClientContact {
  contactId: string;
  clientId: string;
  name: string;
  roleTitle?: string | null;
  email?: string | null;
  cel?: string | null;
  tel?: string | null;
  createdAt?: string;
}

/* =========================
   Users
========================= */

export type UserStatus = 'active' | 'archived' | string;
export type UserType = 'client' | 'supplier' | 'employee' | string;

export interface BmUser {
  id: string; // UUID
  username: string;
  email: string;

  name?: string | null;
  address?: string | null;
  cel?: string | null;
  tel?: string | null;
  contacts?: any | null;

  type?: UserType | null; // admin | employee | supplier | client ...
  status?: UserStatus | null;

  image?: string | null;
  bio?: string | null;

  createdAt?: string | null;
  updatedAt?: string | null;

  // IMPORTANT: company_id exists in DB but NOT used in UI
  companyId?: string | null;
}

export interface ListUsersResponse {
  users: BmUser[];
  page: number;
  limit: number;
  total: number;
}

@Injectable()
export class ManagerService {
  // environment.apiUrl already includes "/api"
  private readonly apiBase = environment.apiUrl;
  private readonly usersBase = `${this.apiBase}/users`;
  private readonly userBase = `${this.apiBase}/user`;

  constructor(private http: HttpClient) {}

  // -------- Clients --------

  listClients(args: {
    q?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Observable<ListClientsResponse> {
    let params = new HttpParams();
    if (args.q) params = params.set('q', args.q);
    if (args.status) params = params.set('status', args.status);
    if (args.page) params = params.set('page', String(args.page));
    if (args.limit) params = params.set('limit', String(args.limit));

    return this.http.get<ListClientsResponse>(`${this.apiBase}/bm/clients`, {
      params,
    });
  }

  createClient(payload: any): Observable<{ client: BmClient }> {
    return this.http.post<{ client: BmClient }>(`${this.apiBase}/bm/clients`, {
      client: payload,
    });
  }

  updateClient(
    clientId: string,
    payload: any,
  ): Observable<{ client: BmClient }> {
    return this.http.put<{ client: BmClient }>(
      `${this.apiBase}/bm/clients/${clientId}`,
      { client: payload },
    );
  }

  archiveClient(clientId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiBase}/bm/clients/${clientId}`);
  }

  // -------- Client Contacts (nested) --------

  listClientContacts(
    clientId: string,
  ): Observable<{ contacts: BmClientContact[] } | BmClientContact[]> {
    return this.http.get<any>(
      `${this.apiBase}/bm/clients/${clientId}/contacts`,
    );
  }

  createClientContact(
    clientId: string,
    payload: any,
  ): Observable<{ contact: BmClientContact } | BmClientContact> {
    return this.http.post<any>(
      `${this.apiBase}/bm/clients/${clientId}/contacts`,
      {
        contact: payload,
      },
    );
  }

  updateClientContact(
    clientId: string,
    contactId: string,
    payload: any,
  ): Observable<{ contact: BmClientContact } | BmClientContact> {
    return this.http.put<any>(
      `${this.apiBase}/bm/clients/${clientId}/contacts/${contactId}`,
      { contact: payload },
    );
  }

  deleteClientContact(clientId: string, contactId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.apiBase}/bm/clients/${clientId}/contacts/${contactId}`,
    );
  }

  /* =========================
     Users
  ========================= */

  listUsers(params: {
    page: number;
    limit: number;
    q?: string;
    status?: string;
    type?: string;
  }): Observable<PagedResult<BmUser>> {
    let httpParams = new HttpParams()
      .set('page', String(params.page ?? 1))
      .set('limit', String(params.limit ?? 20));
    if (params.q) httpParams = httpParams.set('q', params.q);
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.type) httpParams = httpParams.set('type', params.type);

    return this.http
      .get<ListUsersResponse>(this.usersBase, { params: httpParams })
      .pipe(
        map((res) => ({
          items: res?.users ?? [],
          page: res?.page ?? params.page ?? 1,
          limit: res?.limit ?? params.limit ?? 20,
          total: res?.total ?? 0,
        })),
      );
  }

  createUser(payload: any): Observable<BmUser> {
    // company_id must NOT be sent; backend assigns/filters
    const safe = { ...payload };
    delete safe.company_id;
    delete safe.companyId;
    return this.http.post<{ user: BmUser }>(this.usersBase, { user: safe }).pipe(
      map((res) => res.user),
    );
  }

  updateUser(userId: string, payload: any): Observable<BmUser> {
    const safe = { ...payload };
    delete safe.company_id;
    delete safe.companyId;
    return this.http.put<{ user: BmUser }>(this.userBase, { user: safe }).pipe(
      map((res) => res.user),
    );
  }

  archiveUser(userId: string): Observable<{ ok: boolean }> {
    // No archive endpoint in backend yet.
    return this.http.patch<{ ok: boolean }>(this.userBase, {});
  }
}
