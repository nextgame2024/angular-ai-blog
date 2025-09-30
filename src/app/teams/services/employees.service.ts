/**
 * EmployeesService
 * ----------------
 * Purpose:
 * - Fetch employees from the API so the members editor can assign them.
 *
 * Angular concepts:
 * - Injectable providedIn: 'root' → singleton service.
 * - HttpClient: returns Observables (use firstValueFrom in component when needed).
 */

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment.development';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class EmployeesService {
  private base = `${environment.apiUrl}/employees`;

  constructor(private http: HttpClient) {}

  /** GET /employees → { employees: [...] } */
  list(): Observable<{ employees: any[] }> {
    return this.http.get<{ employees: any[] }>(this.base);
  }
}
