import { TestBed } from '@angular/core/testing';
import { of,Subject,throwError } from 'rxjs';
import { CaseOfferReviewComponent,offerMoneyInput } from './case-offer-review.component';
import { StudentOperationsService } from '../student-operations/student-operations.service';
import { ManagerCollegesService } from '../services/manager.colleges.service';
import { TownPlannerV2Service } from '../../townplanner/services/townplanner_v2.service';
import type { StudentDocumentAnalysis,StudentOfferExtraction } from '../student-operations/student-operations.types';
const source:StudentOfferExtraction={kind:'letter_of_offer',studentName:'Example Student',collegeName:'Example College',campusAddress:'16 Cook St, MORTDALE, NSW, 2223',abn:null,cricosProviderCode:'03829G',currency:'AUD',statedTotalMinor:904000,evidence:[{page:2,quote:'Grand total $9040'}],issues:[],
  courses:[{name:'General English',code:'116682E',startsOn:'2027-01-25',endsOn:'2028-03-19',duration:'60 weeks'}],
  fees:[{label:'Tuition and materials',amountMinor:904000,conditional:false,condition:null},{label:'International transfer',amountMinor:2500,conditional:true,condition:'International payments only'}],
  instalments:[{sequence:1,dueTerm:'Immediately',dueOn:null,totalMinor:99500,includedConditionalFeeMinor:2500,components:[{label:'Material',amountMinor:5000},{label:'Tuition',amountMinor:72000}]},{sequence:2,dueTerm:null,dueOn:'2028-01-31',totalMinor:807000,includedConditionalFeeMinor:0,components:[]}]};
const result:StudentDocumentAnalysis={documentId:'doc',jobId:'job',resultId:'result',status:'needs_review',reviewVersion:0,extraction:source,reasons:[],reviewReason:null,decision:null,enabled:true,
  offer:{resolution:'exact',exactCollegeId:'college',candidates:[{collegeId:'college',name:'Example College',abn:null}],colleges:[{collegeId:'college',name:'Example College',abn:null}],currentCollegeId:null,selectedCollegeId:'college',caseRecordVersion:2,offerId:'offer',isCurrent:false,problems:[],totals:{statedTotalMinor:904000,instalmentTotalMinor:906500,includedConditionalFeesMinor:2500,baseInstalmentTotalMinor:904000,unexplainedDifference:false}}};
describe('CaseOfferReviewComponent',()=>{
  let api:any,colleges:any;
  beforeEach(async()=>{
    api={reviewDocumentAnalysis:jasmine.createSpy().and.returnValue(of({saved:true})),documentAnalysis:jasmine.createSpy().and.returnValue(of(result))};
    colleges={createFromOffer:jasmine.createSpy().and.returnValue(of({college:{collegeId:'new-college'}}))};
    await TestBed.configureTestingModule({imports:[CaseOfferReviewComponent],providers:[{provide:StudentOperationsService,useValue:api},{provide:TownPlannerV2Service,useValue:{suggestAddresses:()=>of([]),getPlaceDetails:()=>of(null)}}]}).overrideComponent(CaseOfferReviewComponent,{set:{providers:[{provide:ManagerCollegesService,useValue:colleges}]}}).compileComponents();
  });
  function setup(input=result){const f=TestBed.createComponent(CaseOfferReviewComponent);f.componentRef.setInput('analysis',structuredClone(input));f.componentRef.setInput('caseId','case');f.componentRef.setInput('documentId','doc');f.detectChanges();return f;}
  it('keeps both totals and conditional fee without an applicability decision',()=>{
    const f=setup(),c=f.componentInstance;expect(c.paymentTotals).toEqual({total:906500,included:2500});expect(c.totalsDiffer).toBeFalse();
    expect(c.form.controls.campusAddress.value).toBe('16 Cook St, MORTDALE, NSW, 2223');c.form.controls.campusAddress.setValue('Corrected campus');
    c.form.controls.reason.setValue('Reviewed source');c.save('confirmed');const value=api.reviewDocumentAnalysis.calls.mostRecent().args[2];
    expect(value.expectedCaseVersion).toBe(2);expect(value.collegeId).toBe('college');expect(value.corrections.campusAddress).toBe('Corrected campus');expect(value.corrections.instalments[0]).toEqual(source.instalments[0]);expect(value.corrections.statedTotalMinor).toBe(904000);expect(value.corrections.fees[1].conditional).toBeTrue();expect(value).not.toEqual(jasmine.objectContaining({feeApplies:jasmine.anything()}));
  });
  it('groups student/college details in a card and keeps create/add/remove actions in their requested positions',()=>{
    const f=setup({...result,offer:{...result.offer!,currentCollegeId:'college'}}),c=f.componentInstance;
    const card=f.nativeElement.querySelector('fieldset.student-college') as HTMLElement;
    expect(card.getAttribute('aria-labelledby')).toBe('student-college-heading-doc');
    expect(card.querySelector('.detail-heading')!.textContent).toContain('Current case college: Example College');
    expect(card.querySelector('.detail-heading button')!.textContent).toContain('Create college');
    const labels=(selector:string)=>Array.from(f.nativeElement.querySelectorAll(`${selector}>label`)).map((label:any)=>label.firstChild.textContent.trim());
    expect(labels('.details-fields')).toEqual(['Student name','College on the offer','Address / campus','ABN','CRICOS provider code','College for this case']);
    expect(labels('.course-fields')).toEqual(['Name','Course code','Duration','Start date','End date']);
    expect(card.querySelector('app-manager-address-autocomplete')).not.toBeNull();expect(card.querySelector('app-manager-select')).not.toBeNull();
    (f.nativeElement.querySelector('.courses-heading button') as HTMLButtonElement).click();f.detectChanges();expect(c.form.controls.courses.length).toBe(2);
    (f.nativeElement.querySelector('[aria-label="Remove course 2"]') as HTMLButtonElement).click();f.detectChanges();
    expect(c.form.controls.courses.length).toBe(1);expect(c.form.controls.courses.at(0).controls.name.value).toBe('General English');expect(api.reviewDocumentAnalysis).not.toHaveBeenCalled();
  });
  it('parses money exactly and rejects fractions of cents, negatives and exponent input',()=>{
    expect(offerMoneyInput('995.00')).toBe(99500);expect(offerMoneyInput('0.29')).toBe(29);for(const value of ['-25','2.555','1e3','NaN',''])expect(offerMoneyInput(value)).toBeNull();
  });
  it('separates first-payment amounts from whole-offer totals without applying a fee',()=>{
    const f=setup({...result,extraction:{...source,instalments:[...source.instalments].reverse()}}),c=f.componentInstance;
    c.selectTab('fees');f.detectChanges();expect(c.firstPaymentSummary).toEqual({base:97000,total:99500});
    const summary=f.nativeElement.querySelector('.fee-summary').textContent;
    for(const value of ['Whole-offer totals','First scheduled payment','AUD 9040.00','AUD 9065.00','AUD 25.00','AUD 970.00','AUD 995.00'])expect(summary).toContain(value);
    expect(c.form.controls.instalments.getRawValue().map(r=>r.sequence)).toEqual(['2','1']);
    c.form.controls.instalments.at(1).controls.includedFee.setValue('1000.00');expect(c.firstPaymentSummary).toBeNull();
    expect(api.reviewDocumentAnalysis).not.toHaveBeenCalled();
  });
  it('uses an accessible remove icon for each fee and only removes the chosen draft row',()=>{
    const f=setup(),c=f.componentInstance;c.selectTab('fees');f.detectChanges();
    const rows=f.nativeElement.querySelectorAll('.fee-entry');expect(rows.length).toBe(2);
    const first=rows[0].querySelector('[aria-label="Remove fee 1"]') as HTMLButtonElement;expect(first.querySelector('svg')).not.toBeNull();
    expect(Array.from(rows[0].querySelectorAll('label')).map((l:any)=>l.textContent.trim())).toEqual(['Fee','Amount','When it applies','Conditional fee']);
    c.busy=true;f.detectChanges();expect(first.disabled).toBeTrue();first.click();expect(c.form.controls.fees.length).toBe(2);
    c.busy=false;f.detectChanges();first.click();f.detectChanges();expect(c.form.controls.fees.length).toBe(1);expect(c.form.controls.fees.at(0).controls.label.value).toBe('International transfer');expect(api.reviewDocumentAnalysis).not.toHaveBeenCalled();
  });
  it('uses one compact fee-table header, preserves each extracted value and adds editable rows below it',()=>{
    const names=['Enrolment fee','COE Issue Fee','Total Material Fee','Total Tuition Fee','International Fund Transfer (IFT) Fee','OSHC (if applicable & organised by ECC)'];
    const fees=names.map((label,i)=>({label,amountMinor:i===0?20000:i===3?864000:0,conditional:i===4,condition:i===4?'International payments':null}));
    const f=setup({...result,extraction:{...source,fees}}),c=f.componentInstance;c.selectTab('fees');f.detectChanges();
    const table=f.nativeElement.querySelector('.fees-table') as HTMLTableElement;
    expect(Array.from(table.querySelectorAll('th')).map(th=>th.textContent!.trim())).toEqual(['Fee','Amount','When it applies','Conditional fee','Action']);
    expect(Array.from(table.querySelectorAll('th')).every(th=>th.scope==='col')).toBeTrue();
    expect(table.querySelectorAll('tbody tr').length).toBe(6);expect(table.querySelector('legend')).toBeNull();
    expect(Array.from(table.querySelectorAll<HTMLInputElement>('[formcontrolname="label"]')).map(input=>input.value)).toEqual(names);
    expect((table.querySelector('[aria-label="Fee 1 amount"]') as HTMLInputElement).value).toBe('200.00');
    expect((table.querySelector('[aria-label="Fee 5 is conditional"]') as HTMLInputElement).checked).toBeTrue();
    expect(f.nativeElement.querySelector('.fee-summary').textContent).toContain('Whole-offer totals');
    const add=Array.from(f.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find(b=>b.textContent?.trim()==='+ Add fee')!;
    expect(table.contains(add)).toBeFalse();add.click();f.detectChanges();expect(table.querySelectorAll('tbody tr').length).toBe(7);
    expect(c.form.controls.fees.getRawValue().slice(0,6).map(fee=>fee.label)).toEqual(names);expect(api.reviewDocumentAnalysis).not.toHaveBeenCalled();
  });
  it('does not confirm a superseded offer',()=>{
    const f=setup({...result,currentForType:false}),c=f.componentInstance;c.form.controls.reason.setValue('Historical offer');c.save('confirmed');
    expect(api.reviewDocumentAnalysis).not.toHaveBeenCalled();expect(f.nativeElement.querySelector('button[type="submit"]').disabled).toBeTrue();
  });
  it('requires note, selected college and acknowledged unexplained totals',()=>{
    const f=setup(),c=f.componentInstance,notice=spyOn(c.problem,'emit');c.save('confirmed');expect(api.reviewDocumentAnalysis).not.toHaveBeenCalled();
    c.form.controls.reason.setValue('Difference reviewed');c.form.controls.total.setValue('9100.00');c.save('confirmed');expect(api.reviewDocumentAnalysis).not.toHaveBeenCalled();expect(notice).toHaveBeenCalledWith(jasmine.stringMatching('acknowledge'));
    c.form.controls.acknowledgeTotals.setValue(true);c.save('confirmed');expect(api.reviewDocumentAnalysis).toHaveBeenCalled();
  });
  it('does not replace the existing case college without explicit confirmation',()=>{
    const f=setup({...result,offer:{...result.offer!,currentCollegeId:'previous'}}),c=f.componentInstance;c.form.controls.reason.setValue('Reviewed');c.save('confirmed');expect(api.reviewDocumentAnalysis).not.toHaveBeenCalled();c.form.controls.replaceCollege.setValue(true);c.save('confirmed');expect(api.reviewDocumentAnalysis).toHaveBeenCalled();
  });
  it('keeps retry identity after an uncertain review and guards duplicate submissions',()=>{
    const f=setup(),c=f.componentInstance;c.form.controls.reason.setValue('Reviewed');api.reviewDocumentAnalysis.and.returnValue(throwError(()=>({status:503})));c.save('confirmed');const key=api.reviewDocumentAnalysis.calls.mostRecent().args[3];const waiting=new Subject<any>();api.reviewDocumentAnalysis.and.returnValue(waiting);c.save('confirmed');c.save('confirmed');expect(api.reviewDocumentAnalysis.calls.count()).toBe(2);expect(api.reviewDocumentAnalysis.calls.mostRecent().args[3]).toBe(key);waiting.next({});expect(c.busy).toBeFalse();
  });
  it('creates a college with current mandatory fields and preserves unsaved offer edits',()=>{
    const f=setup(),c=f.componentInstance;c.form.controls.courses.at(0).controls.name.setValue('Edited English');c.beginCollege();c.collegeForm.controls.college_name.setValue('New College');
    api.documentAnalysis.and.returnValue(of({...result,offer:{...result.offer!,colleges:[...result.offer!.colleges,{collegeId:'new-college',name:'New College',abn:null}]}}));c.createCollege();
    expect(colleges.createFromOffer.calls.mostRecent().args[0]).toEqual({college_name:'New College',owner_name:'',abn:'',notes:''});expect(c.form.controls.collegeId.value).toBe('new-college');expect(c.form.controls.courses.at(0).controls.name.value).toBe('Edited English');expect(c.analysis.offer?.caseRecordVersion).toBe(2);
  });
  it('keeps college actions inside the creation form, not the offer footer, and saves through the buttons',()=>{
    const f=setup(),c=f.componentInstance;
    const button=(text:string)=>Array.from(f.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find(b=>b.textContent?.trim()===text)!;
    button('+ Create college').click();f.detectChanges();
    expect(f.nativeElement.querySelector('.college-form .college-actions').textContent).toContain('Save college');
    expect(f.nativeElement.querySelector('.offer-footer').textContent).not.toContain('Save college');
    expect(button('Cancel college').closest('.college-form')).not.toBeNull();
    expect(button('Confirm offer').disabled).toBeTrue();
    c.collegeForm.controls.college_name.setValue('New College');button('Edit new college').click();f.detectChanges();
    expect(c.collegeForm.controls.college_name.value).toBe('New College');
    api.documentAnalysis.and.returnValue(of({...result,offer:{...result.offer!,colleges:[...result.offer!.colleges,{collegeId:'new-college',name:'New College',abn:null}]}}));
    button('Save college').click();f.detectChanges();
    expect(c.creating).toBeFalse();expect(c.form.controls.collegeId.value).toBe('new-college');expect(button('Confirm offer').disabled).toBeFalse();
    expect(f.nativeElement.textContent).toContain('College saved and selected');
  });
  it('shows validation and API failure toasts without losing the college draft',()=>{
    const f=setup(),c=f.componentInstance;c.beginCollege();c.collegeForm.controls.college_name.setValue('   ');c.createCollege();f.detectChanges();
    expect(colleges.createFromOffer).not.toHaveBeenCalled();expect(f.nativeElement.querySelector('app-manager-toast [role="alert"]').textContent).toContain('Enter a college name');
    c.collegeForm.controls.college_name.setValue('New College');colleges.createFromOffer.and.returnValue(throwError(()=>({status:409})));c.createCollege();f.detectChanges();
    expect(c.busy).toBeFalse();expect(c.creating).toBeTrue();expect(c.collegeForm.controls.college_name.value).toBe('New College');
    expect(f.nativeElement.querySelector('app-manager-toast [role="alert"]').textContent).toContain('matching college');
  });
  it('blocks double saves and retries only directory loading once the college is saved',()=>{
    const f=setup(),c=f.componentInstance,pending=new Subject<any>();c.beginCollege();colleges.createFromOffer.and.returnValue(pending);
    c.createCollege();c.createCollege();expect(colleges.createFromOffer).toHaveBeenCalledTimes(1);expect(c.busy).toBeTrue();
    api.documentAnalysis.and.returnValue(throwError(()=>({status:503})));pending.next({college:{collegeId:'new-college'}});pending.complete();f.detectChanges();
    expect(c.collegeError).toContain('was saved');expect(c.collegeForm.disabled).toBeTrue();
    api.documentAnalysis.and.returnValue(of({...result,offer:{...result.offer!,colleges:[...result.offer!.colleges,{collegeId:'new-college',name:'New College',abn:null}]}}));
    c.createCollege();expect(colleges.createFromOffer).toHaveBeenCalledTimes(1);expect(c.form.controls.collegeId.value).toBe('new-college');expect(c.analysis.offer?.caseRecordVersion).toBe(2);
  });
  it('keeps offer submission blocked until college creation is saved or cancelled',()=>{
    const f=setup(),c=f.componentInstance;c.beginCollege();c.save('confirmed');c.save('rejected');expect(api.reviewDocumentAnalysis).not.toHaveBeenCalled();
    c.cancelCollege();expect(c.creating).toBeFalse();expect(c.collegeError).toBe('');
  });
  it('rejects with a note even when extracted financial fields are incomplete',()=>{
    const f=setup(),c=f.componentInstance;c.form.controls.total.setValue('');c.form.controls.reason.setValue('Wrong offer');c.save('rejected');expect(api.reviewDocumentAnalysis.calls.mostRecent().args[2].corrections).toBeNull();
  });
  it('switches accessible tabs without losing edits and keeps both actions outside the panels',()=>{
    const f=setup(),c=f.componentInstance;c.form.controls.name.setValue('Edited student');
    const tabs=Array.from(f.nativeElement.querySelectorAll('[role="tab"]')) as HTMLButtonElement[];
    expect(tabs.map(t=>t.textContent?.trim())).toEqual(['Details','Fee details','Instalment schedule','Evidence & review note']);
    for(const tab of tabs){tab.click();f.detectChanges();expect(tab.getAttribute('aria-selected')).toBe('true');expect(f.nativeElement.querySelectorAll('[role="tabpanel"]:not([hidden])').length).toBe(1);expect(f.nativeElement.querySelector('.offer-footer').closest('[role="tabpanel"]')).toBeNull();}
    tabs[0].click();f.detectChanges();expect(c.form.controls.name.value).toBe('Edited student');
    tabs[0].dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true}));f.detectChanges();expect(c.activeTab).toBe('review');
    tabs[3].dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));f.detectChanges();expect(c.activeTab).toBe('details');
  });
  it('opens the relevant tab for missing notes, colleges, fees and payment errors',()=>{
    const f=setup(),c=f.componentInstance;c.save('confirmed');expect(c.activeTab).toBe('review');
    c.form.controls.reason.setValue('Checked');c.form.controls.collegeId.setValue('');c.save('confirmed');expect(c.activeTab).toBe('details');
    c.form.controls.collegeId.setValue('college');c.form.controls.total.setValue('bad');c.save('confirmed');expect(c.activeTab).toBe('fees');
    c.form.controls.total.setValue('9040.00');c.form.controls.instalments.at(0).controls.total.setValue('bad');c.save('confirmed');expect(c.activeTab).toBe('instalments');f.destroy();
  });
  for(const width of [390,900,1440])for(const dark of [false,true])it(`fits offer fields at ${width}px in ${dark?'dark':'light'} mode`,()=>{
    const f=setup();const frame=document.createElement('iframe');frame.style.width=`${width}px`;frame.style.height='900px';document.body.appendChild(frame);
    try{const doc=frame.contentDocument!,win=frame.contentWindow!;document.querySelectorAll('style').forEach(s=>doc.head.appendChild(s.cloneNode(true)));doc.documentElement.classList.toggle('dark',dark);doc.body.style.margin='0';
      for(const tab of f.componentInstance.tabs){f.componentInstance.activeTab=tab.key;f.detectChanges();
        const host=f.nativeElement.cloneNode(true) as HTMLElement;host.style.display='flex';host.style.flexDirection='column';host.style.height='650px';host.style.width=`${Math.min(width-32,1180)}px`;doc.body.appendChild(host);
        expect(host.scrollWidth).toBeLessThanOrEqual(host.clientWidth+1);for(const b of host.querySelectorAll<HTMLButtonElement>('button'))if(b.getBoundingClientRect().height)expect(b.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
        const scroll=host.querySelector('.offer-scroll')!;scroll.scrollTop=scroll.scrollHeight;
        const footer=host.querySelector('.offer-footer')!;expect(footer.getBoundingClientRect().bottom).toBeLessThanOrEqual(host.getBoundingClientRect().bottom+1);expect(footer.getBoundingClientRect().top).toBeGreaterThanOrEqual(host.getBoundingClientRect().top);
        if(tab.key==='details'){
          const columns=width===1440?3:width===900?2:1;
          for(const selector of ['.details-fields','.course-fields']){
            const grid=host.querySelector<HTMLElement>(selector)!,labels=Array.from(grid.querySelectorAll<HTMLElement>(':scope>label'));
            expect(win.getComputedStyle(grid).gridTemplateColumns.split(' ').length).toBe(columns);
            expect(grid.scrollWidth).toBeLessThanOrEqual(grid.clientWidth+1);
            for(let i=1;i<columns;i++)expect(Math.abs(labels[i].getBoundingClientRect().top-labels[0].getBoundingClientRect().top)).toBeLessThan(2);
            expect(labels[columns].getBoundingClientRect().top).toBeGreaterThanOrEqual(labels[0].getBoundingClientRect().bottom);
          }
          const card=host.querySelector<HTMLElement>('.student-college')!,course=host.querySelector<HTMLElement>('.course-entry')!;
          expect(win.getComputedStyle(card).borderColor).toBe(win.getComputedStyle(course).borderColor);
          expect(win.getComputedStyle(card.querySelector('.detail-heading')!).color).toBe(dark?'rgb(193, 208, 230)':'rgb(23, 32, 51)');
          if(columns===3){
            const date=course.querySelector<HTMLInputElement>('[formcontrolname="endsOn"]')!,remove=course.querySelector<HTMLElement>('.course-remove')!;
            expect(Math.abs(date.getBoundingClientRect().bottom-remove.getBoundingClientRect().bottom)).toBeLessThan(2);
          }
        }
        if(tab.key==='fees'){
          const row=host.querySelector('.fee-entry')!,remove=row.querySelector<HTMLButtonElement>('.fee-remove')!;
          expect(remove.getBoundingClientRect().width).toBeGreaterThanOrEqual(44);expect(remove.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
          expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth+1);
          expect(win.getComputedStyle(host.querySelector('.fees-table thead')!).display).toBe(width===390?'none':'table-header-group');
          expect(win.getComputedStyle(row.querySelector('.fee-cell-label')!).display).toBe(width===390?'block':'none');
          if(width===1440){const inputs=Array.from(row.querySelectorAll('input:not([type="checkbox"])'));const top=inputs[0].getBoundingClientRect().top;for(const input of inputs)expect(Math.abs(input.getBoundingClientRect().top-top)).toBeLessThan(2);expect(Math.abs(remove.getBoundingClientRect().top-top)).toBeLessThan(2);}
          expect(win.getComputedStyle(remove).color).toBe(dark?'rgb(255, 173, 184)':'rgb(180, 56, 72)');
        }
        if(tab.key==='instalments'){
          for(const row of host.querySelectorAll('.payment-fields')){
            const inputs=Array.from(row.querySelectorAll('input'));expect(inputs.length).toBe(5);
            expect(row.textContent).toContain('Conditional fee already included');expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth+1);
            if(width===1440){const top=inputs[0].getBoundingClientRect().top;for(const input of inputs)expect(Math.abs(input.getBoundingClientRect().top-top)).toBeLessThan(2);}
            else if(width===390){for(let i=1;i<inputs.length;i++)expect(inputs[i].getBoundingClientRect().top).toBeGreaterThan(inputs[i-1].getBoundingClientRect().bottom);}
          }
        }
        expect(win.getComputedStyle(host.querySelector('input')!).backgroundColor).toBe(dark?'rgb(38, 52, 73)':'rgb(255, 255, 255)');host.remove();
      }
      f.componentInstance.beginCollege();f.detectChanges();
      const host=f.nativeElement.cloneNode(true) as HTMLElement;host.style.height='650px';host.style.width=`${Math.min(width-32,1180)}px`;doc.body.appendChild(host);
      const footer=host.querySelector<HTMLElement>('.offer-footer')!;
      expect(host.scrollWidth).toBeLessThanOrEqual(host.clientWidth+1);
      for(const b of footer.querySelectorAll<HTMLButtonElement>('button')){
        expect(b.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
        expect(b.getBoundingClientRect().top).toBeGreaterThanOrEqual(host.getBoundingClientRect().top);
        expect(b.getBoundingClientRect().bottom).toBeLessThanOrEqual(host.getBoundingClientRect().bottom+1);
      }
      expect(footer.textContent).not.toContain('Save college');
      const college=host.querySelector<HTMLElement>('.college-form')!,actions=college.querySelector<HTMLElement>('.college-actions')!;
      expect(actions.scrollWidth).toBeLessThanOrEqual(actions.clientWidth+1);
      for(const b of actions.querySelectorAll<HTMLButtonElement>('button')){
        expect(b.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
        expect(b.getBoundingClientRect().top).toBeGreaterThanOrEqual(college.getBoundingClientRect().top);
        expect(b.getBoundingClientRect().bottom).toBeLessThanOrEqual(college.getBoundingClientRect().bottom);
      }
      const scroll=host.querySelector<HTMLElement>('.offer-scroll')!,before=actions.getBoundingClientRect().top,footerTop=footer.getBoundingClientRect().top;
      scroll.scrollTop=100;expect(actions.getBoundingClientRect().top).toBeLessThan(before);expect(footer.getBoundingClientRect().top).toBe(footerTop);
      expect(scroll.clientHeight).toBeGreaterThan(100);host.remove();
    }finally{frame.remove();f.destroy();}
  });
});
