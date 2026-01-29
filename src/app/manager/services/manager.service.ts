import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export type ClientStatus = 'active' | 'archived' | string;

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

@Injectable()
export class ManagerService {
  // environment.apiUrl already includes "/api"
  private readonly apiBase = environment.apiUrl;

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
    payload: any
  ): Observable<{ client: BmClient }> {
    return this.http.put<{ client: BmClient }>(
      `${this.apiBase}/bm/clients/${clientId}`,
      { client: payload }
    );
  }

  archiveClient(clientId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiBase}/bm/clients/${clientId}`);
  }

  // -------- Client Contacts (nested) --------

  listClientContacts(
    clientId: string
  ): Observable<{ contacts: BmClientContact[] } | BmClientContact[]> {
    return this.http.get<any>(
      `${this.apiBase}/bm/clients/${clientId}/contacts`
    );
  }

  createClientContact(
    clientId: string,
    payload: any
  ): Observable<{ contact: BmClientContact } | BmClientContact> {
    return this.http.post<any>(
      `${this.apiBase}/bm/clients/${clientId}/contacts`,
      {
        contact: payload,
      }
    );
  }

  updateClientContact(
    clientId: string,
    contactId: string,
    payload: any
  ): Observable<{ contact: BmClientContact } | BmClientContact> {
    return this.http.put<any>(
      `${this.apiBase}/bm/clients/${clientId}/contacts/${contactId}`,
      { contact: payload }
    );
  }

  deleteClientContact(clientId: string, contactId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.apiBase}/bm/clients/${clientId}/contacts/${contactId}`
    );
  }
}
