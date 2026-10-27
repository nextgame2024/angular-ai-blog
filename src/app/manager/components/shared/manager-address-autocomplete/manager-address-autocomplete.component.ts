import { Component,Input,OnDestroy,forwardRef,inject } from '@angular/core';
import { ControlValueAccessor,NG_VALUE_ACCESSOR } from '@angular/forms';
import { Subject,catchError,debounceTime,of,switchMap,takeUntil } from 'rxjs';
import { TownPlannerV2Service } from '../../../../townplanner/services/townplanner_v2.service';
import type { TownPlannerV2AddressSuggestion } from '../../../../townplanner/store/townplanner_v2.state';

@Component({
  selector:'app-manager-address-autocomplete',
  templateUrl:'./manager-address-autocomplete.component.html',
  styleUrls:['./manager-address-autocomplete.component.css'],
  providers:[{provide:NG_VALUE_ACCESSOR,useExisting:forwardRef(()=>ManagerAddressAutocompleteComponent),multi:true}],
})
export class ManagerAddressAutocompleteComponent implements ControlValueAccessor,OnDestroy {
  private static nextId=0;
  @Input() placeholder='Address';
  @Input() ariaLabel='Address';
  @Input() maxLength=500;
  private readonly places=inject(TownPlannerV2Service);
  private readonly queries=new Subject<string>();
  private readonly destroyed=new Subject<void>();
  readonly listId=`manager-address-options-${ManagerAddressAutocompleteComponent.nextId++}`;
  private sessionToken:string|null=null;
  value='';disabled=false;focused=false;suggestions:TownPlannerV2AddressSuggestion[]=[];activeIndex=-1;
  private change:(value:string)=>void=()=>{};private touched:()=>void=()=>{};

  constructor(){
    this.queries.pipe(debounceTime(200),switchMap(query=>{
      const value=query.trim();
      if(!this.focused||value.length<3){this.clearSuggestions();return of([]);}
      if(!this.sessionToken)this.sessionToken=this.createSessionToken();
      return this.places.suggestAddresses(value,this.sessionToken).pipe(catchError(()=>of([])));
    }),takeUntil(this.destroyed)).subscribe(suggestions=>{this.suggestions=suggestions;this.activeIndex=suggestions.length?0:-1;});
  }
  writeValue(value:string|null|undefined){this.value=value??'';}
  registerOnChange(change:(value:string)=>void){this.change=change;}
  registerOnTouched(touched:()=>void){this.touched=touched;}
  setDisabledState(disabled:boolean){this.disabled=disabled;if(disabled)this.clearSuggestions();}
  input(value:string){this.value=value;this.change(value);this.queries.next(value);}
  focus(){this.focused=true;this.queries.next(this.value);}
  blur(){this.focused=false;this.touched();setTimeout(()=>{if(!this.focused)this.clearSuggestions();},120);}
  keydown(event:KeyboardEvent){
    if(!this.suggestions.length)return;
    if(event.key==='ArrowDown'){event.preventDefault();this.activeIndex=(this.activeIndex+1)%this.suggestions.length;}
    else if(event.key==='ArrowUp'){event.preventDefault();this.activeIndex=(this.activeIndex-1+this.suggestions.length)%this.suggestions.length;}
    else if(event.key==='Enter'&&this.activeIndex>=0){event.preventDefault();this.select(this.suggestions[this.activeIndex]);}
    else if(event.key==='Escape'){event.preventDefault();this.clearSuggestions();}
  }
  select(suggestion:TownPlannerV2AddressSuggestion){
    this.value=suggestion.description;this.change(this.value);this.clearSuggestions();
    const token=this.sessionToken;this.sessionToken=null;
    this.places.getPlaceDetails(suggestion.placeId,token).pipe(takeUntil(this.destroyed),catchError(()=>of(null))).subscribe(details=>{
      const formatted=details?.formattedAddress?.trim();if(formatted){this.value=formatted;this.change(formatted);}
    });
  }
  private clearSuggestions(){this.suggestions=[];this.activeIndex=-1;}
  private createSessionToken(){return globalThis.crypto?.randomUUID?.()??Math.random().toString(36).slice(2);}
  ngOnDestroy(){this.destroyed.next();this.destroyed.complete();}
}
