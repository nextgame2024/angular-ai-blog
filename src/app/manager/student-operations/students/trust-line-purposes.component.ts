import { Component, DestroyRef, Input, inject, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { StudentOperationsService } from '../student-operations.service';
import type { TrustLineChoice, TrustLineOption } from '../student-operations.types';

@Component({
  selector:'app-trust-line-purposes',imports:[FormsModule],styleUrls:['./student-operations-students.page.css'],
  styles:[':host {display:block;min-width:0;overflow-wrap:anywhere} input {max-width:100%;box-sizing:border-box}'],
  template:`
    <button type="button" class="btn small" [disabled]="loading" (click)="load()">
      {{loaded ? 'Refresh invoice lines' : 'Choose invoice line purposes'}}
    </button>
    @if (loading) { <p role="status">Loading invoice lines…</p> }
    @if (error) { <p role="alert">{{error}}</p> }
    @if (loaded) {
      @for (line of rows; track line.lineId) {
        <label>{{line.label}} · AUD {{line.available}} available
          <input inputmode="decimal" maxlength="15" placeholder="Amount for this line" [disabled]="line.available==='0.00'"
            [ngModel]="line.amount" [ngModelOptions]="{standalone:true}" (ngModelChange)="line.amount=$event; emitChoices()">
        </label>
      } @empty {
        <p>Line purposes are unavailable for this invoice. You can still reserve an invoice amount with its purpose unassigned.</p>
      }
    } @else if (choices?.length) { <p>{{choices?.length}} line purposes entered.</p> }
  `,
})
export class TrustLinePurposes {
  @Input({required:true}) connection!:string;
  @Input({required:true}) deposit!:string;
  @Input({required:true}) invoice!:string;
  @Input() choices?:TrustLineChoice[];
  readonly changed=output<TrustLineChoice[]>();
  private readonly api=inject(StudentOperationsService);
  private readonly destroy=inject(DestroyRef);
  rows:(TrustLineOption & {amount:string})[]=[];
  loading=false;
  loaded=false;
  error='';
  load() {
    if (this.loading) return;
    this.loading=true; this.loaded=false; this.error='';
    this.api.trustSplitLines(this.connection,this.deposit,this.invoice).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next:({lines})=>{
        this.loading=false; this.loaded=true;
        this.rows=lines.map(line=>{
          const previous=this.choices?.find(choice=>choice.lineId===line.lineId && choice.token===line.token);
          const fits=previous && Number(previous.amount)<=Number(line.available) && line.available!=='0.00';
          return {...line,amount:fits ? previous.amount : ''};
        });
        const retained=this.rows.filter(row=>row.amount).length;
        if (retained!==(this.choices?.length ?? 0)) {
          this.error='Some selected lines changed. Review the refreshed amounts.';
          this.emitChoices();
        }
      },
      error:()=>{this.loading=false; this.error='Could not load invoice lines. Retry the lookup.';},
    });
  }
  emitChoices() {
    this.changed.emit(this.rows.filter(row=>row.amount).map(({lineId,token,amount})=>({lineId,token,amount})));
  }
}
