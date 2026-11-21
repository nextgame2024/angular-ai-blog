import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Actions } from '@ngrx/effects';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { of } from 'rxjs';
import { ManagerSuppliersPageComponent } from './manager-suppliers.page';
import { initialManagerSuppliersState } from '../../store/suppliers/manager.state';
import { managerSuppliersReducer } from '../../store/suppliers/manager.reducer';
import { ManagerSuppliersActions as A } from '../../store/suppliers/manager.actions';
import { ManagerMaterialsService } from '../../services/manager.materials.service';
import { TownPlannerV2Service } from '../../../townplanner/services/townplanner_v2.service';
import type { BmSupplier } from '../../types/suppliers.interface';

describe('Supplier register and types', () => {
  let fixture: ComponentFixture<ManagerSuppliersPageComponent>, page: ManagerSuppliersPageComponent, store: MockStore;
  const supplier: BmSupplier = {supplierId:'s1',supplierName:'Example supplier',supplierType:'products',email:'a@example.test',status:'active'};
  function state(extra: object = {}) { store.setState({managerSuppliers:{...initialManagerSuppliersState,...extra}}); fixture.detectChanges(); }
  beforeEach(async () => {
    await TestBed.configureTestingModule({imports:[ManagerSuppliersPageComponent], providers:[
      provideRouter([]), provideMockStore({initialState:{managerSuppliers:initialManagerSuppliersState}}),
      {provide:Actions,useValue:new Actions(of())},
      {provide:ManagerMaterialsService,useValue:{listMaterials:()=>of({items:[]})}},
      {provide:TownPlannerV2Service,useValue:{suggestAddresses:()=>of([]),getPlaceDetails:()=>of(null)}},
    ]}).compileComponents();
    fixture=TestBed.createComponent(ManagerSuppliersPageComponent);page=fixture.componentInstance;store=TestBed.inject(MockStore);
    fixture.detectChanges();
  });
  afterEach(()=>fixture.destroy());
  it('defaults create to Services and shows Materials only for Products in create and edit',()=>{
    page.openCreate(); state({suppliersViewMode:'form'});
    expect(page.supplierForm.controls.supplier_type.value).toBe('services');
    expect(fixture.nativeElement.textContent).not.toContain('Materials');
    expect(fixture.nativeElement.textContent).toContain('Save this supplier to access the other tabs.');
    page.supplierForm.controls.supplier_type.setValue('products');fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.form-tabs .tab').length).toBe(3);
    state({suppliersViewMode:'form',suppliers:[supplier],editingSupplierId:'s1'});
    expect(page.isProductSupplier).toBeTrue();
    expect(fixture.nativeElement.querySelectorAll('.form-tabs .tab').length).toBe(3);
    page.supplierForm.controls.supplier_type.setValue('services');fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.form-tabs .tab').length).toBe(2);
    spyOn(store,'dispatch');page.supplierForm.controls.supplier_name.setValue('Example');page.saveSupplier();
    expect(store.dispatch).toHaveBeenCalledWith(A.saveSupplier({payload:jasmine.objectContaining({supplier_type:'services'})}));
    page.setTab('materials',supplier);
    expect(store.dispatch).not.toHaveBeenCalledWith(A.setSupplierFormTab({tab:'materials'}));
  });
  it('replaces pages and preserves server sorting, and sends sorting and page-size changes',()=>{
    let s=managerSuppliersReducer(initialManagerSuppliersState,A.loadSuppliers({page:1,sort:'email',direction:'desc',limit:50}));
    s=managerSuppliersReducer(s,A.loadSuppliersSuccess({result:{items:[supplier],page:1,limit:50,total:60}}));
    s=managerSuppliersReducer(s,A.loadSuppliersSuccess({result:{items:[],page:2,limit:50,total:60}}));
    expect(s.suppliers).toEqual([]);expect(s.suppliersSort).toBe('email');
    state({suppliers:[supplier],suppliersTotal:60});spyOn(store,'dispatch');
    page.sortSuppliersBy('email');expect(store.dispatch).toHaveBeenCalledWith(A.loadSuppliers({page:1,sort:'email',direction:'asc'}));
    page.pageSizeCtrl.setValue('50');expect(store.dispatch).toHaveBeenCalledWith(A.loadSuppliers({page:1,limit:50}));
    page.goToPage(2);expect(store.dispatch).toHaveBeenCalledWith(A.loadSuppliers({page:2}));
  });
  it('shows matching empty state, accessible sorting, and desktop/mobile layouts in light and dark',()=>{
    expect(fixture.nativeElement.querySelector('.list-empty').textContent).toContain('Create your first supplier');
    state({suppliers:[supplier],suppliersTotal:1});
    expect(fixture.nativeElement.querySelector('th').getAttribute('aria-sort')).toBe('ascending');
    const frame=document.createElement('iframe');frame.style.height='900px';document.body.appendChild(frame);
    try {
      const doc=frame.contentDocument!;
      for(const style of Array.from(document.querySelectorAll('style')))doc.head.appendChild(style.cloneNode(true));
      doc.body.style.margin='0';doc.body.appendChild(fixture.nativeElement.cloneNode(true));
      for(const width of [390,1280])for(const dark of [false,true]) {
        frame.style.width=width+'px';doc.documentElement.classList.toggle('dark',dark);
        const styles=(q:string)=>frame.contentWindow!.getComputedStyle(doc.querySelector(q)!);
        expect(styles('.table-wrap').display).toBe(width<900?'none':'block');
        expect(styles('.supplier-register .cards').display).toBe(width<900?'grid':'none');
        expect(styles('.table-wrap').backgroundColor).toBe(dark?'rgb(25, 36, 51)':'rgb(255, 255, 255)');
        expect(doc.documentElement.scrollWidth).toBeLessThanOrEqual(width);
      }
    } finally {frame.remove();}
  });
});
