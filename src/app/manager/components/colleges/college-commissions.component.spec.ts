import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { CollegeCommissionsComponent } from './college-commissions.component';
import { BmCollegeCommissionRule, ManagerCollegesService } from '../../services/manager.colleges.service';

describe('CollegeCommissionsComponent',()=>{
  let api:jasmine.SpyObj<ManagerCollegesService>;
  const rule:BmCollegeCommissionRule={ruleId:'rule-1',collegeId:'college-1',classification:null,location:null,program:null,
    commissionBasisPoints:3182,calculationMethod:'tuition_fee_percentage',calculationDescription:'Tuition fee x commission (2 decimals)',
    roundingDecimalPlaces:2,cashbackStatus:'not_recorded',cashbackDescription:'Not recorded',cashbackCalculationDescription:'No aplica',
    cashbackCalculation:null,bonusAmount:null,bonusStatus:'not_applicable',bonusDescription:'Not applicable',applicationConditions:'Tuition only',active:true,
    createdAt:'2026-11-08T00:00:00Z',updatedAt:'2026-11-08T00:00:00Z'};
  beforeEach(async()=>{
    api=jasmine.createSpyObj<ManagerCollegesService>('api',['commissions','createCommission','updateCommission','archiveCommission']);
    api.commissions.and.returnValue(of({rules:[rule]}));api.createCommission.and.returnValue(of({rule}));api.updateCommission.and.returnValue(of({rule}));api.archiveCommission.and.returnValue(of(undefined));
    await TestBed.configureTestingModule({imports:[CollegeCommissionsComponent],providers:[{provide:ManagerCollegesService,useValue:api}]}).compileComponents();
  });
  function setup(){const fixture=TestBed.createComponent(CollegeCommissionsComponent);fixture.componentRef.setInput('collegeId','college-1');fixture.detectChanges();return fixture;}
  it('renders wildcard conditions, precise rate, benefits and application conditions in table and mobile cards',()=>{
    const fixture=setup();const el:HTMLElement=fixture.nativeElement;
    expect(api.commissions).toHaveBeenCalledWith('college-1');expect(el.querySelector('table')?.textContent).toContain('31.82%');
    expect(el.querySelector('.user-card')?.textContent).toContain('Any');expect(el.textContent).toContain('Tuition only');
    expect(el.querySelector('th[aria-sort="ascending"]')).not.toBeNull();
  });
  it('validates rates and transmits an exact integer rate and blank wildcard conditions',()=>{
    const fixture=setup(), component=fixture.componentInstance;component.open();component.form.patchValue({percentage:'31.825'});component.save();
    expect(api.createCommission).not.toHaveBeenCalled();fixture.detectChanges();expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    component.form.patchValue({percentage:'31.82'});component.save();
    expect(api.createCommission).toHaveBeenCalledWith('college-1',jasmine.objectContaining({commission_basis_points:3182,classification:'',location:'',program:''}));
    expect(api.commissions).toHaveBeenCalledTimes(2);
  });
  it('includes the revision on edits and keeps the form open on conflicts',()=>{
    api.updateCommission.and.returnValue(throwError(()=>({error:{error:'This rule has changed'}})));
    const fixture=setup(), component=fixture.componentInstance;component.open(rule);component.save();
    expect(api.updateCommission).toHaveBeenCalledWith('college-1','rule-1',jasmine.objectContaining({expected_updated_at:rule.updatedAt}));
    expect(component.formOpen).toBeTrue();expect(component.message).toContain('changed');expect(component.saving).toBeFalse();
  });
  it('uses numeric two-decimal benefit fields and sends exact values including zero',()=>{
    const fixture=setup(),c=fixture.componentInstance;c.open();fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[formControlName="cashback_calculation"]').type).toBe('number');
    expect(fixture.nativeElement.querySelector('[formControlName="bonus_amount"]').step).toBe('0.01');
    c.form.patchValue({percentage:'30',cashback_status:'specified',bonus_status:'specified',cashback_calculation:'12.345',bonus_amount:'0'});
    c.save();expect(api.createCommission).not.toHaveBeenCalled();
    c.form.patchValue({cashback_calculation:'12.30'});c.save();
    expect(api.createCommission).toHaveBeenCalledWith('college-1',jasmine.objectContaining({cashback_calculation:'12.30',bonus_amount:'0.00'}));
  });
  it('round-trips numeric benefits and preserves legacy notes during edits',()=>{
    const fixture=setup(),c=fixture.componentInstance;c.open({...rule,cashbackStatus:'specified',cashbackCalculation:'15.25',bonusStatus:'specified',bonusAmount:'30.00'});
    c.save();expect(api.updateCommission).toHaveBeenCalledWith('college-1',rule.ruleId,jasmine.objectContaining({cashback_calculation:'15.25',bonus_amount:'30.00',cashback_calculation_description:'No aplica'}));
  });
  it('does not present a failed request as an empty rule list and supports retry',()=>{
    api.commissions.and.returnValue(throwError(()=>({})));
    const fixture=setup();expect(fixture.nativeElement.textContent).toContain('Could not load commission rules');
    expect(fixture.nativeElement.textContent).not.toContain('No commission rules yet');
    api.commissions.and.returnValue(of({rules:[]}));fixture.componentInstance.load();fixture.detectChanges();expect(fixture.nativeElement.textContent).toContain('No commission rules yet');
  });
  it('cancels old college requests and ignores an out-of-order refresh',()=>{
    const old=new Subject<{rules:BmCollegeCommissionRule[]}>();api.commissions.and.returnValue(old);
    const fixture=setup();api.commissions.and.returnValue(of({rules:[{...rule,collegeId:'college-2',ruleId:'new'}]}));
    fixture.componentRef.setInput('collegeId','college-2');fixture.detectChanges();old.next({rules:[rule]});
    expect(fixture.componentInstance.rules[0].ruleId).toBe('new');
  });
  it('paginates the complete rule collection and archives only after confirmation',()=>{
    api.commissions.and.returnValue(of({rules:Array.from({length:30},(_,i)=>({...rule,ruleId:`rule-${i}`}))}));
    const fixture=setup(), component=fixture.componentInstance;expect(component.displayedRules.length).toBe(25);component.goToPage(2);expect(component.displayedRules.length).toBe(5);
    component.pageSize.setValue('50');expect(component.page).toBe(1);expect(component.displayedRules.length).toBe(30);
    spyOn(window,'confirm').and.returnValue(true);component.archive(rule);expect(api.archiveCommission).toHaveBeenCalledWith('college-1',rule);
  });

  for(const width of [390,1440]) for(const dark of [false,true]) {
    it(`renders the list and form at ${width}px in ${dark?'dark':'light'} mode without page overflow`,()=>{
      const fixture=setup();
      const iframe=document.createElement('iframe');iframe.style.width=`${width}px`;iframe.style.height='900px';document.body.appendChild(iframe);
      try {
        const doc=iframe.contentDocument!, win=iframe.contentWindow!;doc.documentElement.classList.toggle('dark',dark);
        document.querySelectorAll('style').forEach(style=>doc.head.appendChild(style.cloneNode(true)));
        doc.body.style.margin='0';doc.body.appendChild(fixture.nativeElement.cloneNode(true));
        const table=doc.querySelector('.table-wrap')!,cards=doc.querySelector('.cards')!;
        expect(win.getComputedStyle(table).display).toBe(width<900?'none':'block');
        expect(win.getComputedStyle(cards).display).toBe(width<900?'grid':'none');
        expect(doc.documentElement.scrollWidth).toBeLessThanOrEqual(width+1);
        fixture.componentInstance.open(rule);fixture.detectChanges();doc.body.replaceChildren(fixture.nativeElement.cloneNode(true));
        expect(doc.documentElement.scrollWidth).toBeLessThanOrEqual(width+1);
        const grid=win.getComputedStyle(doc.querySelector('.commission-form-grid')!);
        expect(grid.gridTemplateColumns.split(' ').length).toBe(width<700?1:3);
        const form=doc.querySelector('form')!;
        expect(form.querySelector('.calculation-note')?.previousElementSibling?.classList.contains('commission-form-grid')).toBeTrue();
        const note=win.getComputedStyle(doc.querySelector('.calculation-note')!);
        expect(note.backgroundColor).toBe(dark?'rgb(27, 42, 61)':'rgb(247, 249, 252)');
      } finally {iframe.remove();}
    });
  }
});
