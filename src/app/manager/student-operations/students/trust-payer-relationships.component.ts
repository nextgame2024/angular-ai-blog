import { Component, DestroyRef, Input, OnChanges, inject, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { StudentOperationsService } from '../student-operations.service';
import type { TrustPayerRelationship } from '../student-operations.types';

@Component({
  selector:'app-trust-payer-relationships',imports:[FormsModule],styleUrls:['./student-operations-students.page.css'],
  styles:[':host {display:block} fieldset {min-inline-size:0} input,textarea {max-width:100%;box-sizing:border-box}'],
  template:`
    <button class="btn small" type="button" [attr.aria-expanded]="open" [disabled]="saving" (click)="toggle()">Review payers and sponsors</button>
    @if (open) {
      @if (loading) { <p role="status">Loading payer relationships…</p> }
      @if (error) { <p role="alert">{{error}}</p> }
      @if (!loaded && !loading) { <button class="btn small" type="button" (click)="load()">Reload relationships</button> }
      @if (loaded) {
        @for (row of rows; track row.name) {
          <p>{{row.name}} · {{row.relationship}} · {{row.active ? 'Confirmed' : 'Withdrawn'}} · {{row.reason}}
            <button class="btn small" type="button" [disabled]="saving" (click)="edit(row)">Review {{row.name}}</button>
          </p>
        }
        <fieldset [disabled]="saving"><legend>{{selected ? 'Review relationship' : 'Confirm a payer for this invoice contact'}}</legend>
          <label>Bank payer name <input maxlength="100" [(ngModel)]="name" [readonly]="!!selected" [ngModelOptions]="{standalone:true}"></label>
          <label><input type="checkbox" [(ngModel)]="sponsor" [ngModelOptions]="{standalone:true}"> Sponsor or parent</label>
          <label>Reason for confirmation or withdrawal <textarea maxlength="500" [(ngModel)]="reason" [ngModelOptions]="{standalone:true}"></textarea></label>
          <button class="btn small" type="button" [disabled]="name.trim().length<3 || !reason.trim()" (click)="save(true)">Confirm relationship</button>
          @if (selected) {
            @if (selected.active) { <button class="btn small" type="button" [disabled]="!reason.trim()" (click)="save(false)">Withdraw relationship</button> }
            <button class="btn small" type="button" (click)="edit()">Clear selection</button>
          }
        </fieldset>
      }
    }
  `,
})
export class TrustPayerRelationships implements OnChanges {
  @Input({required:true}) connection!:string;
  @Input({required:true}) contact!:string;
  readonly changed=output<void>();
  open=false; loaded=false; loading=false; saving=false; error='';
  rows:TrustPayerRelationship[]=[];
  selected?:TrustPayerRelationship;
  name=''; reason=''; sponsor=false;
  private request?:Subscription;
  private readonly api=inject(StudentOperationsService);
  private readonly destroy=inject(DestroyRef);

  ngOnChanges() {
    this.request?.unsubscribe(); this.open=this.loaded=this.loading=this.saving=false;
    this.rows=[]; this.error=''; this.edit();
  }
  edit(row?:TrustPayerRelationship) {
    this.selected=row; this.name=row?.name??''; this.sponsor=row?.relationship==='sponsor'; this.reason='';
  }
  toggle() {
    this.open=!this.open;
    if (this.open) this.load();
    else { this.request?.unsubscribe(); this.edit(); }
  }
  load() {
    this.loaded=false; this.loading=true; this.error='';
    this.request=this.api.trustPayers(this.connection,this.contact).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next:data=>{this.rows=data.relationships; this.loaded=true; this.loading=false;},
      error:()=>{this.loading=false;this.error='Could not load payer relationships.';},
    });
  }
  save(active:boolean) {
    if (!this.loaded || this.saving || !this.reason.trim() || this.name.trim().length<3) return;
    this.saving=true; this.error='';
    this.request=this.api.reviewTrustPayer(this.connection,this.contact,{
      name:this.name.trim(),relationship:this.sponsor?'sponsor':'payer',reason:this.reason.trim(),
      revision:this.selected?.revision??0,active,
    }).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next:()=>{this.saving=false;this.edit();this.changed.emit();},
      error:err=>{
        this.saving=false;
        if (err.status===409) {this.loaded=false;this.edit();this.error='Relationships changed. Reload to review the current entry.';}
        else this.error='Could not save the relationship. Check the name and try again.';
      },
    });
  }
}
