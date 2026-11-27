import { Component, DestroyRef, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { StudentOperationsService } from '../student-operations.service';
import type { TrustMatchReview } from '../student-operations.types';

@Component({
  selector:'app-trust-match-history',
  imports:[DatePipe],
  styleUrls:['./student-operations-students.page.css'],
  template:`
    <button type="button" class="btn small" [attr.aria-expanded]="open" (click)="toggle()">Match decision history</button>
    @if (open) {
      @for (entry of entries; track entry.revision) {
        <p>{{ entry.decision === 'accepted' ? 'Accepted' : 'Dismissed' }} · {{ entry.evidence.invoiceNumber || entry.evidence.id }}
          · {{ entry.reviewer }} · {{ entry.reviewedAt | date:'medium' }}</p>
        <p>{{ entry.reason }}</p>
        <p>
          @if (entry.evidence.numberMatch) { Bank reference matched invoice number. }
          @if (entry.evidence.numberInReference) { Bank description contained invoice number. }
          @if (entry.evidence.referenceMatch) { Invoice and bank references matched. }
          @if (entry.evidence.amountMatch) { The deposit equalled the open balance. }
        </p>
        <small>{{ entry.evidence.lookup === 'manual' ? 'Manual lookup' : 'Suggested invoice' }} · AUD {{ entry.evidence.balance }} due
          · Rule {{ entry.ruleVersion }} · Score {{ entry.evidence.score }} · {{ entry.evidence.peers }} with this score</small>
      }
      @if (loading) { <p role="status">Loading review history…</p> }
      @else if (failed) { <button class="btn small" type="button" (click)="load(cursor)">Retry review history</button> }
      @else if (!entries.length) { <p>No match decisions recorded.</p> }
      @else if (cursor) { <button class="btn small" type="button" (click)="load(cursor)">Older decisions</button> }
    }
  `,
})
export class TrustMatchHistory implements OnChanges {
  @Input({required:true}) connection!:string;
  @Input({required:true}) depositId!:string;
  @Input() revision=0;
  open=false; loading=false; failed=false;
  entries:TrustMatchReview[]=[];
  cursor?:number;
  private request?:Subscription;
  private readonly api=inject(StudentOperationsService);
  private readonly destroy=inject(DestroyRef);
  ngOnChanges(changes:SimpleChanges) {
    this.request?.unsubscribe();
    if (changes['connection'] || changes['depositId']) this.open=false;
    this.entries=[]; this.cursor=undefined;
    if (this.open) this.load();
  }
  toggle() {
    this.open=!this.open;
    if (this.open) this.load();
    else this.request?.unsubscribe();
  }
  load(before?:number) {
    this.request?.unsubscribe();
    this.loading=true; this.failed=false;
    if (!before) {this.entries=[]; this.cursor=undefined;}
    this.request=this.api.trustInvoiceDecisionHistory(this.connection,this.depositId,before)
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next:r=>{this.entries=[...this.entries,...r.entries]; this.cursor=r.next ?? undefined; this.loading=false;},
        error:()=>{this.loading=false; this.failed=true;},
      });
  }
}
