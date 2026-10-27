import { Component } from '@angular/core';
import { FormControl,ReactiveFormsModule } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TownPlannerV2Service } from '../../../../townplanner/services/townplanner_v2.service';
import { ManagerAddressAutocompleteComponent } from './manager-address-autocomplete.component';

@Component({imports:[ReactiveFormsModule,ManagerAddressAutocompleteComponent],template:'<app-manager-address-autocomplete [formControl]="address" ariaLabel="Campus address" />'})
class HostComponent {readonly address=new FormControl('',{nonNullable:true});}

describe('ManagerAddressAutocompleteComponent',()=>{
  it('selects a Google-backed suggestion and writes its formatted address',async()=>{
    const places={suggestAddresses:jasmine.createSpy().and.returnValue(of([{placeId:'place',description:'16 Cook St, Mortdale NSW'}])),getPlaceDetails:jasmine.createSpy().and.returnValue(of({formattedAddress:'16 Cook St, Mortdale NSW 2223',lat:-33,lng:151}))};
    await TestBed.configureTestingModule({imports:[HostComponent],providers:[{provide:TownPlannerV2Service,useValue:places}]}).compileComponents();
    const fixture=TestBed.createComponent(HostComponent);fixture.detectChanges();const input=fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.dispatchEvent(new FocusEvent('focus'));input.value='16 Cook';input.dispatchEvent(new Event('input'));await new Promise(resolve=>setTimeout(resolve,230));fixture.detectChanges();
    expect(places.suggestAddresses).toHaveBeenCalled();const option=fixture.nativeElement.querySelector('.address-suggestion') as HTMLButtonElement;expect(option.textContent).toContain('16 Cook');option.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));fixture.detectChanges();
    expect(fixture.componentInstance.address.value).toBe('16 Cook St, Mortdale NSW 2223');expect(places.getPlaceDetails).toHaveBeenCalledWith('place',jasmine.any(String));
  });
});
