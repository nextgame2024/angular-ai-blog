import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { switchMap } from 'rxjs';

import { adminErrorMessage } from '../shared/admin-operation.utils';
import { AdminStatePanelComponent } from '../shared/admin-state-panel.component';
import { SophiaAdminService } from '../sophia-admin.service';
import type { InstructionSet, SophiaAdminPrincipal } from '../sophia-admin.types';

@Component({ selector: 'app-instructions-admin-page', standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AdminStatePanelComponent],
  templateUrl: './instructions-admin.page.html', styleUrls: ['../shared/admin-authoring.css'],
})
export class InstructionsAdminPage implements OnInit {
  private readonly admin=inject(SophiaAdminService);private readonly destroyRef=inject(DestroyRef);private readonly fb=inject(FormBuilder);
  readonly principal=signal<SophiaAdminPrincipal|null>(null);readonly sets=signal<InstructionSet[]>([]);readonly selected=signal<InstructionSet|null>(null);
  readonly safetyPolicy=signal('');readonly loading=signal(true);readonly busy=signal(false);readonly error=signal('');readonly notice=signal('');
  readonly setKey=this.fb.nonNullable.control('',[Validators.required,Validators.pattern(/^[a-z0-9][a-z0-9-]{0,79}$/)]);
  readonly form=this.fb.nonNullable.group({content:['',[Validators.required,Validators.maxLength(50000)]],tone:['',Validators.maxLength(500)],greeting:['',Validators.maxLength(2000)],variables:['',Validators.maxLength(4000)]});
  ngOnInit():void{this.load();}
  load(selectId?:string):void{this.loading.set(true);this.admin.context().pipe(switchMap(({principal})=>{this.principal.set(principal);return this.admin.listInstructionSets(principal.tenantId);}),takeUntilDestroyed(this.destroyRef)).subscribe({next:result=>{this.sets.set(result.instructionSets);this.safetyPolicy.set(result.platformSafetyPolicyVersion);const selected=result.instructionSets.find(item=>item.instruction_set_id===(selectId??this.selected()?.instruction_set_id))??result.instructionSets[0]??null;this.selected.set(selected);this.loading.set(false);this.busy.set(false);},error:e=>this.fail(e,'Instructions could not be loaded.')});}
  can(permission:string):boolean{return this.principal()?.permissions.includes(permission)??false;}
  select(set:InstructionSet):void{this.selected.set(set);this.error.set('');this.notice.set('');}
  createSet():void{const p=this.principal();if(!p||this.setKey.invalid||!this.can('instructions.edit')){this.setKey.markAsTouched();return;}this.start();this.admin.createInstructionSet(p.tenantId,this.setKey.value).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({next:r=>{this.notice.set('Instruction set created. It has no effect until an approved revision is included in a published agent release.');this.setKey.reset('');this.load(r.instructionSetId);},error:e=>this.fail(e,'The instruction set could not be created.')});}
  createRevision():void{const p=this.principal(),set=this.selected();if(!p||!set||this.form.invalid||!this.can('instructions.edit')){this.form.markAllAsTouched();return;}let properties;try{properties=parseDeclarations(this.form.controls.variables.value);}catch(e){this.error.set((e as Error).message);return;}const v=this.form.getRawValue();this.start();this.admin.createInstructionRevision(p.tenantId,set.instruction_set_id,{content:v.content,tone:v.tone||undefined,greeting:v.greeting||undefined,variableSchema:{type:'object',properties,additionalProperties:false}}).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({next:()=>{this.notice.set('Instruction draft created. It is not available to publication until explicitly approved.');this.form.reset({content:'',tone:'',greeting:'',variables:''});this.load(set.instruction_set_id);},error:e=>this.fail(e,'The instruction revision could not be created.')});}
  approve(revisionId:string):void{const p=this.principal(),set=this.selected();if(!p||!set||!this.can('instructions.edit'))return;this.start();this.admin.approveInstructionRevision(p.tenantId,revisionId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({next:()=>{this.notice.set('Instruction revision approved and immutable. Agent drafts must still reference and publish it.');this.load(set.instruction_set_id);},error:e=>this.fail(e,'The instruction revision could not be approved.')});}
  variableNames(set:InstructionSet['revisions'][number]):string{return Object.entries(set.variableSchema.properties).map(([key,value])=>`${key}:${value.type}`).join(', ')||'none';}
  private start():void{this.busy.set(true);this.error.set('');this.notice.set('');}
  private fail(e:unknown,f:string):void{this.error.set(adminErrorMessage(e,f));this.busy.set(false);this.loading.set(false);}
}

function parseDeclarations(value:string):Record<string,{type:'string'|'number'|'boolean'}>{const result:Record<string,{type:'string'|'number'|'boolean'}>={};for(const token of value.split(',').map(x=>x.trim()).filter(Boolean)){const [key,type,...rest]=token.split(':').map(x=>x.trim());if(rest.length||!/^[a-z][a-zA-Z0-9_]{0,63}$/.test(key)||!['string','number','boolean'].includes(type))throw new Error(`Invalid variable declaration: ${token}. Use name:string, count:number, or enabled:boolean.`);result[key]={type:type as 'string'|'number'|'boolean'};}return result;}
