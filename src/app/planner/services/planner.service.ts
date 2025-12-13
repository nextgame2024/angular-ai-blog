// src/app/planner/services/planner.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { Observable, map } from 'rxjs';
import {
  SiteDetails,
  ProposalDetails,
  PreAssessmentResult,
} from '../types/preAssessmentState.interface';

@Injectable()
export class PlannerService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  createPreAssessment(
    site: SiteDetails,
    proposal: ProposalDetails
  ): Observable<PreAssessmentResult> {
    return this.http
      .post<{ preAssessment: PreAssessmentResult }>(
        `${this.apiUrl}/planner/pre-assessments`,
        { site, proposal }
      )
      .pipe(map((response) => response.preAssessment));
  }
}
